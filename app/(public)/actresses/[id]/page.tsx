import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import BreadcrumbJsonLd from "@/components/StructuredData/BreadcrumbJsonLd";
import { getActressDescription } from "@/lib/actress-descriptions";
import {
  getActressProfileResult,
  type ActressProfile,
} from "@/lib/actress-profiles";
import { getWorks, type WorkSort } from "@/lib/dmm";
import { createCanonicalUrl, validatePage } from "@/lib/seo";

const SITE_URL = "https://avdizin.com";

const sortTabs: { label: string; value: WorkSort }[] = [
  { label: "人気順", value: "rank" },
  { label: "新着順", value: "date" },
  { label: "評価順", value: "review" },
  { label: "価格高い順", value: "price" },
  { label: "価格安い順", value: "-price" },
];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string | string[];
    sort?: string;
  }>;
};

type ItemInfoKey = "genre" | "series" | "maker" | "label";

type RelatedLink = {
  id: string;
  name: string;
  count: number;
};

type ActressPageSummary = {
  description: string;
  latestDate: string;
  totalReviewCount: number;
  averageRating: string;
  relatedGenres: RelatedLink[];
  relatedSeries: RelatedLink[];
  relatedMakers: RelatedLink[];
  relatedLabels: RelatedLink[];
};

const genericGenreNames = new Set(["4K", "ハイビジョン", "独占配信"]);

function requireValidActressId(value: string) {
  if (!/^\d+$/.test(value)) {
    console.warn(`Rejected invalid actressId: ${value}`);
    notFound();
  }

  return value;
}

function normalizeWorkSort(sort?: string): WorkSort {
  return sortTabs.some((tab) => tab.value === sort)
    ? (sort as WorkSort)
    : "rank";
}

function getPagination(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

function findActressName(items: any[], actressId: string) {
  for (const item of items) {
    const actresses = Array.isArray(item?.iteminfo?.actress)
      ? item.iteminfo.actress
      : [];
    const actress = actresses.find(
      (candidate: any) =>
        String(candidate?.id ?? candidate?.actress_id ?? "") === actressId
    );

    if (actress?.name) {
      return String(actress.name);
    }
  }

  return "";
}

function getItemInfoId(value: any, key: ItemInfoKey) {
  const idKeys: Record<ItemInfoKey, string[]> = {
    genre: ["id", "genre_id"],
    series: ["id", "series_id"],
    maker: ["id", "maker_id"],
    label: ["id", "label_id"],
  };
  const id = idKeys[key].map((idKey) => value?.[idKey]).find(Boolean);
  const normalizedId = String(id || "");

  return /^\d+$/.test(normalizedId) ? normalizedId : "";
}

function getRelatedLinks(
  items: any[],
  key: ItemInfoKey,
  limit: number
): RelatedLink[] {
  const links = new Map<string, RelatedLink>();

  for (const item of items) {
    const values = Array.isArray(item?.iteminfo?.[key])
      ? item.iteminfo[key]
      : [];
    const seenInItem = new Set<string>();

    for (const value of values) {
      const id = getItemInfoId(value, key);
      const name = String(value?.name || "").trim();

      if (
        !id ||
        !name ||
        seenInItem.has(id) ||
        (key === "genre" && genericGenreNames.has(name))
      ) {
        continue;
      }

      seenInItem.add(id);

      const current = links.get(id);
      links.set(id, {
        id,
        name,
        count: (current?.count || 0) + 1,
      });
    }
  }

  return [...links.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"))
    .slice(0, limit);
}

function getLatestDate(items: any[]) {
  let latestTime = 0;
  let latestDate = "";

  for (const item of items) {
    const date = String(item?.date || "");
    const time = Date.parse(date);

    if (Number.isFinite(time) && time > latestTime) {
      latestTime = time;
      latestDate = date.split(" ")[0];
    }
  }

  return latestDate;
}

function getReviewSummary(items: any[]) {
  let totalReviewCount = 0;
  let weightedRatingTotal = 0;

  for (const item of items) {
    const reviewCount = Number(item?.review?.count || 0);
    const averageRating = Number(item?.review?.average || 0);

    if (
      Number.isFinite(reviewCount) &&
      reviewCount > 0 &&
      Number.isFinite(averageRating) &&
      averageRating > 0
    ) {
      totalReviewCount += reviewCount;
      weightedRatingTotal += averageRating * reviewCount;
    }
  }

  return {
    totalReviewCount,
    averageRating:
      totalReviewCount > 0
        ? (weightedRatingTotal / totalReviewCount).toFixed(2)
        : "",
  };
}

function createPageDescription(actressName: string, actressId: string) {
  const name = actressName || `女優ID ${actressId}`;

  return `${name}の出演作品一覧です。人気順・新着順・評価順で作品を並び替えながら、このページの関連ジャンル、関連シリーズ、関連メーカー、関連レーベルから掲載作品を探せます。`;
}

function createMetaDescription(actressName: string, actressId: string) {
  const name = actressName || `女優ID ${actressId}`;

  return `${name}の出演作品一覧。人気順・新着順・評価順で作品を探せます。関連ジャンル、シリーズ、メーカー、レーベルからも掲載作品を確認できます。`;
}

function createActressPageSummary(
  items: any[],
  actressName: string,
  actressId: string
): ActressPageSummary {
  const reviewSummary = getReviewSummary(items);
  const registeredDescription = getActressDescription(actressId);

  return {
    description:
      registeredDescription || createPageDescription(actressName, actressId),
    latestDate: getLatestDate(items),
    totalReviewCount: reviewSummary.totalReviewCount,
    averageRating: reviewSummary.averageRating,
    relatedGenres: getRelatedLinks(items, "genre", 8),
    relatedSeries: getRelatedLinks(items, "series", 6),
    relatedMakers: getRelatedLinks(items, "maker", 5),
    relatedLabels: getRelatedLinks(items, "label", 5),
  };
}

function getLatestWorks(items: any[]) {
  return [...items]
    .sort((a, b) => {
      const aTime = Date.parse(String(a?.date || ""));
      const bTime = Date.parse(String(b?.date || ""));

      return (
        (Number.isFinite(bTime) ? bTime : 0) -
        (Number.isFinite(aTime) ? aTime : 0)
      );
    })
    .slice(0, 3);
}

function getFeaturedWorks(items: any[]) {
  return [...items]
    .sort((a, b) => {
      const aReviewCount = Number(a?.review?.count || 0);
      const bReviewCount = Number(b?.review?.count || 0);
      const aAverage = Number(a?.review?.average || 0);
      const bAverage = Number(b?.review?.average || 0);
      const aTime = Date.parse(String(a?.date || ""));
      const bTime = Date.parse(String(b?.date || ""));

      return (
        bReviewCount - aReviewCount ||
        bAverage - aAverage ||
        (Number.isFinite(bTime) ? bTime : 0) -
          (Number.isFinite(aTime) ? aTime : 0)
      );
    })
    .slice(0, 5);
}

function getProfileImage(profile: ActressProfile | null) {
  return (
    profile?.imageURL?.large ||
    profile?.imageURL?.small ||
    profile?.imageURL?.list ||
    ""
  );
}

function formatCentimeterValue(value?: string) {
  if (!value) {
    return "";
  }

  return /^\d+(?:\.\d+)?$/.test(value) ? `${value}cm` : value;
}

function getProfileRows(profile: ActressProfile | null) {
  if (!profile) {
    return [];
  }

  const sizeParts = [
    profile.bust ? `B${formatCentimeterValue(profile.bust)}` : "",
    profile.waist ? `W${formatCentimeterValue(profile.waist)}` : "",
    profile.hip ? `H${formatCentimeterValue(profile.hip)}` : "",
  ].filter(Boolean);
  const rows = [
    { label: "ふりがな", value: profile.ruby },
    { label: "生年月日", value: profile.birthday },
    { label: "身長", value: formatCentimeterValue(profile.height) },
    { label: "3サイズ", value: sizeParts.join(" / ") },
    { label: "血液型", value: profile.bloodType },
    { label: "趣味", value: profile.hobby },
    { label: "出身地", value: profile.prefectures },
  ];

  return rows.filter((row): row is { label: string; value: string } =>
    Boolean(row.value)
  );
}

const getActressPageData = cache(
  async (actressId: string, page: number, sort: WorkSort) => {
    const result = await getWorks(
      page,
      undefined,
      undefined,
      undefined,
      actressId,
      undefined,
      undefined,
      sort
    );
    const actressName = findActressName(result.items, actressId);
    const summary = createActressPageSummary(
      result.items,
      actressName,
      actressId
    );

    return {
      ...result,
      actressName,
      summary,
      metaDescription: createMetaDescription(actressName, actressId),
      title: actressName
        ? `${actressName}の出演作品一覧`
        : `女優ID ${actressId} の作品一覧`,
    };
  }
);

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actressId = requireValidActressId(id);
  const pageValidation = validatePage(query.page);
  if (pageValidation.status !== "valid") return { robots: { index: false, follow: false } };
  const currentPage = pageValidation.page;
  const currentSort = normalizeWorkSort(query.sort);
  const { title, metaDescription, dataStatus } = await getActressPageData(
    actressId,
    currentPage,
    currentSort
  );

  if (dataStatus === "out-of-range") {
    return { robots: { index: false, follow: false } };
  }

  return {
    title,
    description: metaDescription,
    alternates: {
      canonical: createCanonicalUrl(
        `/actresses/${encodeURIComponent(actressId)}`,
        { page: String(pageValidation.page) }
      ),
    },
  };
}

export default async function ActressWorksPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actressId = requireValidActressId(id);
  const pageValidation = validatePage(query.page);
  if (pageValidation.status !== "valid") notFound();
  const currentPage = pageValidation.page;
  const currentSort = normalizeWorkSort(query.sort);
  const [
    actressPageData,
    actressProfileResult,
  ] = await Promise.all([
    getActressPageData(actressId, currentPage, currentSort),
    getActressProfileResult(actressId),
  ]);
  const { items, totalPages, totalCount, title, actressName, summary } = actressPageData;
  if (actressPageData.dataStatus === "out-of-range") notFound();
  if (actressProfileResult.status === "not-found") {
    notFound();
  }
  const actressProfile = actressProfileResult.profile;
  const displayName =
    actressName || actressProfile?.name || `女優ID ${actressId}`;
  const profileImage = getProfileImage(actressProfile);
  const profileRows = getProfileRows(actressProfile);
  const latestWorks = getLatestWorks(items);
  const featuredWorks = getFeaturedWorks(items);
  const paginationItems = getPagination(currentPage, totalPages);
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "ホーム", href: "/" },
    { name: "AV女優", href: "/actresses" },
    {
      name: actressName || `女優ID ${actressId}`,
      href: `/actresses/${encodeURIComponent(actressId)}`,
    },
  ];

  const makePageHref = (page: number, sort: WorkSort = currentSort) => {
    const queryParams = new URLSearchParams({
      page: String(page),
      sort,
    });

    return `/actresses/${encodeURIComponent(actressId)}?${queryParams.toString()}`;
  };
  const relatedGroups: {
    title: string;
    hrefPrefix: string;
    links: RelatedLink[];
  }[] = [
    {
      title: "このページの関連ジャンル",
      hrefPrefix: "/genres",
      links: summary.relatedGenres,
    },
    {
      title: "関連シリーズ",
      hrefPrefix: "/series",
      links: summary.relatedSeries,
    },
    {
      title: "関連メーカー",
      hrefPrefix: "/makers",
      links: summary.relatedMakers,
    },
    {
      title: "関連レーベル",
      hrefPrefix: "/labels",
      links: summary.relatedLabels,
    },
  ];

  return (
    <main>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      <div
        style={{
          maxWidth: "1800px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Breadcrumb items={breadcrumbItems} />

        <h1
          style={{
            padding: "12px 12px 0",
            margin: 0,
            color: "#fff",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          {title}
        </h1>

        <section
          style={{
            margin: "12px 12px 0",
            padding: "20px",
            background: "#111",
            border: "1px solid #222",
            borderRadius: "8px",
            color: "#fff",
          }}
        >
          <div
            className="actress-profile-layout"
            style={{
              display: profileImage ? "grid" : "block",
              gridTemplateColumns: profileImage
                ? "minmax(160px, 220px) minmax(0, 1fr)"
                : undefined,
              alignItems: "start",
              gap: "20px",
              marginBottom: "22px",
            }}
          >
            {profileImage && (
              <img
                src={profileImage}
                alt={displayName}
                style={{
                  width: "100%",
                  maxWidth: "220px",
                  aspectRatio: "4 / 5",
                  objectFit: "cover",
                  display: "block",
                  background: "#000",
                  border: "1px solid #222",
                  borderRadius: "8px",
                }}
              />
            )}

            <div style={{ maxWidth: "960px", minWidth: 0 }}>
              <h2
                style={{
                  margin: "0 0 12px",
                  color: "#eee",
                  fontSize: "16px",
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                {displayName}プロフィール
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  color: "#ddd",
                  fontSize: "15px",
                  lineHeight: 1.8,
                }}
              >
                {summary.description}
              </p>
              <p
                style={{
                  margin: profileRows.length > 0 ? "0 0 16px" : 0,
                  color: "#bbb",
                  fontSize: "14px",
                  lineHeight: 1.8,
                }}
              >
                このページで表示している作品では、最新登録日は
                <strong style={{ color: "#eee", fontWeight: 700 }}>
                  {summary.latestDate ? ` ${summary.latestDate}` : "未確認"}
                </strong>
                です。レビューは合計
                <strong style={{ color: "#eee", fontWeight: 700 }}>
                  {summary.totalReviewCount.toLocaleString()}件
                </strong>
                {summary.averageRating ? (
                  <>
                    、平均評価は
                    <strong style={{ color: "#eee", fontWeight: 700 }}>
                      {summary.averageRating}
                    </strong>
                  </>
                ) : (
                  ""
                )}
                です。下の関連リンクから掲載作品をたどり、続く最新作品と作品一覧で気になる作品を確認できます。
              </p>

              {profileRows.length > 0 && (
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px 14px",
                    margin: 0,
                  }}
                >
                  {profileRows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        padding: "10px 12px",
                        background: "#000",
                        border: "1px solid #222",
                        borderRadius: "8px",
                        minWidth: 0,
                      }}
                    >
                      <dt
                        style={{
                          marginBottom: "5px",
                          color: "#888",
                          fontSize: "12px",
                          lineHeight: 1.4,
                        }}
                      >
                        {row.label}
                      </dt>
                      <dd
                        style={{
                          margin: 0,
                          color: "#eee",
                          fontSize: "14px",
                          fontWeight: 700,
                          lineHeight: 1.45,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>

          {latestWorks.length > 0 && (
            <div
              style={{
                paddingTop: "18px",
                borderTop: "1px solid #222",
                marginBottom: featuredWorks.length > 0 ? "24px" : "0",
              }}
            >
              <h2
                style={{
                  margin: "0 0 12px",
                  color: "#eee",
                  fontSize: "16px",
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                最新作品
              </h2>
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#bbb",
                  fontSize: "14px",
                  lineHeight: 1.8,
                }}
              >
                まずは新しく登録された出演作品からチェックできます。
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "12px",
                }}
              >
                {latestWorks.map((item: any) => (
                  <Link
                    className="actress-latest-work-card"
                    key={item.content_id}
                    href={`/works/${item.content_id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "104px minmax(0, 1fr)",
                      gap: "12px",
                      alignItems: "center",
                      minHeight: "104px",
                      padding: "12px",
                      background: "#000",
                      border: "1px solid #222",
                      borderRadius: "8px",
                      color: "inherit",
                      textDecoration: "none",
                      minWidth: 0,
                      transition:
                        "background 0.15s ease, border-color 0.15s ease",
                    }}
                  >
                    <img
                      src={item.imageURL?.large || item.imageURL?.list}
                      alt={item.title}
                      style={{
                        width: "104px",
                        aspectRatio: "4 / 3",
                        objectFit: "cover",
                        display: "block",
                        background: "#111",
                        borderRadius: "6px",
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          marginBottom: "8px",
                          color: "#fff",
                          fontSize: "14px",
                          fontWeight: 700,
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          color: "#999",
                          fontSize: "12px",
                          lineHeight: 1.5,
                        }}
                      >
                        登録日 {String(item.date || "").split(" ")[0]}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {featuredWorks.length > 0 && (
            <div
              style={{
                paddingTop: "18px",
                borderTop: "1px solid #222",
                marginBottom: "24px",
              }}
            >
              <h2
                style={{
                  margin: "0 0 12px",
                  color: "#eee",
                  fontSize: "16px",
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                注目作品ピックアップ
              </h2>
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#bbb",
                  fontSize: "14px",
                  lineHeight: 1.8,
                }}
              >
                このページに掲載中の作品から、レビュー数や評価をもとに注目作品をピックアップしています。
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "12px",
                }}
              >
                {featuredWorks.map((item: any) => (
                  <Link
                    className="actress-latest-work-card"
                    key={item.content_id}
                    href={`/works/${item.content_id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "104px minmax(0, 1fr)",
                      gap: "12px",
                      alignItems: "center",
                      minHeight: "104px",
                      padding: "12px",
                      background: "#000",
                      border: "1px solid #222",
                      borderRadius: "8px",
                      color: "inherit",
                      textDecoration: "none",
                      minWidth: 0,
                      transition:
                        "background 0.15s ease, border-color 0.15s ease",
                    }}
                  >
                    <img
                      src={item.imageURL?.large || item.imageURL?.list}
                      alt={item.title}
                      style={{
                        width: "104px",
                        aspectRatio: "4 / 3",
                        objectFit: "cover",
                        display: "block",
                        background: "#111",
                        borderRadius: "6px",
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          marginBottom: "8px",
                          color: "#fff",
                          fontSize: "14px",
                          fontWeight: 700,
                          lineHeight: 1.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          color: "#999",
                          fontSize: "12px",
                          lineHeight: 1.5,
                        }}
                      >
                        レビュー {Number(item.review?.count || 0).toLocaleString()}件
                        {item.review?.average
                          ? ` / 評価 ${item.review.average}`
                          : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              paddingTop: "18px",
              borderTop: "1px solid #222",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                color: "#eee",
                fontSize: "16px",
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              関連リンク
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                color: "#bbb",
                fontSize: "14px",
                lineHeight: 1.8,
              }}
            >
              ジャンル・シリーズ・メーカー・レーベルから、関連する作品も探せます。
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              {relatedGroups
                .filter((group) => group.links.length > 0)
                .map((group) => (
                  <div key={group.title}>
                    <h3
                      style={{
                        margin: "0 0 10px",
                        color: "#eee",
                        fontSize: "16px",
                        fontWeight: 700,
                        lineHeight: 1.45,
                      }}
                    >
                      {group.title}
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "9px",
                      }}
                    >
                      {group.links.map((link) => (
                        <Link
                          className="actress-summary-chip"
                          key={link.id}
                          href={`${group.hrefPrefix}/${encodeURIComponent(
                            link.id
                          )}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            minHeight: "34px",
                            padding: "8px 12px",
                            color: "#4ea1ff",
                            background: "#000",
                            border: "1px solid #333",
                            borderRadius: "999px",
                            fontSize: "13px",
                            fontWeight: 600,
                            lineHeight: 1.2,
                            textDecoration: "none",
                            transition:
                              "background 0.15s ease, border-color 0.15s ease, color 0.15s ease",
                          }}
                        >
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <style>{`
            .actress-summary-chip:hover {
              background: #07111f !important;
              border-color: #4ea1ff !important;
              color: #8fc3ff !important;
            }

            .actress-latest-work-card:hover {
              background: #050505 !important;
              border-color: #333 !important;
            }

            @media (max-width: 640px) {
              .actress-profile-layout {
                grid-template-columns: 1fr !important;
              }

              .actress-latest-work-card {
                grid-template-columns: 96px minmax(0, 1fr) !important;
                min-height: 96px !important;
                padding: 10px !important;
              }

              .actress-latest-work-card img {
                width: 96px !important;
              }
            }
          `}</style>
        </section>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            padding: "12px 12px 0",
          }}
        >
          {sortTabs.map((tab) => {
            const isActive = tab.value === currentSort;

            return (
              <Link
                key={tab.value}
                href={makePageHref(1, tab.value)}
                style={{
                  color: isActive ? "#000" : "#fff",
                  background: isActive ? "#fff" : "transparent",
                  textDecoration: "none",
                  padding: "7px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.35)",
                  fontSize: "14px",
                  fontWeight: isActive ? "bold" : "normal",
                  lineHeight: 1,
                  flex: "0 0 auto",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "24px 16px",
            padding: "14px 12px 30px",
          }}
        >
          {items.map((item: any) => (
            <Link
              key={item.content_id}
              href={`/works/${item.content_id}`}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <div>
                <img
                  src={item.imageURL?.large || item.imageURL?.list}
                  alt={item.title}
                  style={{
                    width: "100%",
                    aspectRatio: "4 / 3",
                    objectFit: "cover",
                    display: "block",
                    background: "#111",
                  }}
                />

                <p
                  style={{
                    margin: "8px 0 4px",
                    fontSize: "14px",
                    lineHeight: "1.45",
                    color: "#fff",
                  }}
                >
                  {item.title}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#aaa",
                  }}
                >
                  登録日 {item.date}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {items.length === 0 && (
          <div
            style={{
              padding: "0 12px 40px",
              color: "#aaa",
              fontSize: "14px",
            }}
          >
            該当する作品が見つかりませんでした。
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            margin: "10px 0 40px",
            color: "#fff",
            fontSize: "14px",
          }}
        >
          {currentPage > 1 && (
            <Link
              href={makePageHref(currentPage - 1)}
              style={{
                color: "#fff",
                textDecoration: "none",
                padding: "6px 8px",
              }}
            >
              ← 前へ
            </Link>
          )}

          {paginationItems.map((page, index) =>
            page === "..." ? (
              <span
                key={`dots-${index}`}
                style={{
                  color: "#aaa",
                  padding: "6px 4px",
                }}
              >
                ...
              </span>
            ) : (
              <Link
                key={page}
                href={makePageHref(Number(page))}
                style={{
                  color: page === currentPage ? "#000" : "#fff",
                  background: page === currentPage ? "#fff" : "transparent",
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.35)",
                  fontWeight: page === currentPage ? "bold" : "normal",
                  lineHeight: 1,
                }}
              >
                {page}
              </Link>
            )
          )}

          {currentPage < totalPages && (
            <Link
              href={makePageHref(currentPage + 1)}
              style={{
                color: "#fff",
                textDecoration: "none",
                padding: "6px 8px",
              }}
            >
              次へ →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
