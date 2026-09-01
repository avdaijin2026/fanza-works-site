import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorks, type WorkSort } from "@/lib/dmm";
import { createCanonicalUrl, validatePage } from "@/lib/seo";

const sortTabs: { label: string; value: WorkSort }[] = [
  { label: "人気順", value: "rank" },
  { label: "新着順", value: "date" },
  { label: "評価順", value: "review" },
  { label: "価格高い順", value: "price" },
  { label: "価格安い順", value: "-price" },
];

function normalizeWorkSort(sort?: string): WorkSort {
  return sortTabs.some((tab) => tab.value === sort)
    ? (sort as WorkSort)
    : "rank";
}

function getPagination(currentPage: number, totalPages: number) {
  const pages: (number | string)[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
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

type HomeSearchParams = {
  page?: string | string[];
  genre?: string;
  genre_name?: string;
  series?: string;
  series_name?: string;
  maker?: string;
  maker_name?: string;
  actress?: string;
  actress_name?: string;
  label?: string;
  label_name?: string;
  keyword?: string;
  sort?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const pageValidation = validatePage(params.page);
  if (pageValidation.status !== "valid") {
    return { robots: { index: false, follow: false } };
  }
  const isKeywordSearch = Boolean(params.keyword?.trim());

  return {
    robots: {
      index: !isKeywordSearch,
      follow: true,
    },
    alternates: {
      canonical: createCanonicalUrl("/", {
        page: String(pageValidation.page),
        filters: { keyword: params.keyword },
      }),
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;
  const pageValidation = validatePage(params.page);
  if (pageValidation.status !== "valid") notFound();
  const currentPage = pageValidation.page;
  const currentSort = normalizeWorkSort(params.sort);

  const genreId = params.genre;
  const genreName = params.genre_name;
  const seriesId = params.series;
  const seriesName = params.series_name;
  const makerId = params.maker;
  const makerName = params.maker_name;
  const actressId = params.actress;
  const actressName = params.actress_name;
  const labelId = params.label;
  const labelName = params.label_name;
  const keyword = params.keyword?.trim();

  const result = await getWorks(
    currentPage,
    genreId,
    seriesId,
    makerId,
    actressId,
    labelId,
    keyword,
    currentSort
  );

  if (result.dataStatus === "out-of-range") notFound();

  const items = result.items;
  const totalPages = result.totalPages;
  const paginationItems = getPagination(currentPage, totalPages);

  const title = keyword
    ? `「${keyword}」の検索結果`
    : labelId
      ? `${labelName || "レーベル"}の作品一覧`
      : actressId
        ? `${actressName || "女優"}の作品一覧`
        : makerId
          ? `${makerName || "メーカー"}の作品一覧`
          : seriesId
            ? `${seriesName || "シリーズ"}の作品一覧`
            : genreId
              ? `${genreName || "ジャンル"}の作品一覧`
              : "作品一覧";

  const makePageHref = (page: number, sort: WorkSort = currentSort) => {
    const query = new URLSearchParams();
    query.set("page", String(page));

    if (genreId) query.set("genre", genreId);
    if (genreName) query.set("genre_name", genreName);
    if (seriesId) query.set("series", seriesId);
    if (seriesName) query.set("series_name", seriesName);
    if (makerId) query.set("maker", makerId);
    if (makerName) query.set("maker_name", makerName);
    if (actressId) query.set("actress", actressId);
    if (actressName) query.set("actress_name", actressName);
    if (labelId) query.set("label", labelId);
    if (labelName) query.set("label_name", labelName);
    if (keyword) query.set("keyword", keyword);
    query.set("sort", sort);

    return `/?${query.toString()}`;
  };

  return (
    <main>
      <div
        style={{
          maxWidth: "1800px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            padding: "12px 12px 0",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          {title}
        </div>

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

        {keyword && (
          <div
            style={{
              padding: "6px 12px 0",
              color: "#aaa",
              fontSize: "13px",
            }}
          >
            検索キーワード: {keyword}
          </div>
        )}

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
