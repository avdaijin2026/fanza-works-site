import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import BreadcrumbJsonLd from "@/components/StructuredData/BreadcrumbJsonLd";
import { getWorks, type WorkSort } from "@/lib/dmm";

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
    page?: string;
    sort?: string;
  }>;
};

type WorkItem = {
  content_id: string;
  title: string;
  date?: string;
  imageURL?: {
    large?: string;
    list?: string;
  };
  iteminfo?: {
    maker?: {
      id?: string | number;
      maker_id?: string | number;
      name?: string;
    }[];
  };
};

function requireValidMakerId(value: string) {
  if (!/^\d+$/.test(value)) {
    console.warn(`Rejected invalid makerId: ${value}`);
    notFound();
  }

  return value;
}

function normalizePage(page?: string) {
  const value = Number(page || "1");

  return Number.isInteger(value) && value > 0 ? value : 1;
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

function findMakerName(items: WorkItem[], makerId: string) {
  for (const item of items) {
    const makers = Array.isArray(item.iteminfo?.maker)
      ? item.iteminfo.maker
      : [];
    const maker = makers.find(
      (candidate) =>
        String(candidate.id ?? candidate.maker_id ?? "") === makerId
    );

    if (maker?.name) {
      return maker.name;
    }
  }

  return "";
}

const getMakerPageData = cache(
  async (makerId: string, page: number, sort: WorkSort) => {
    const result = await getWorks(
      page,
      undefined,
      undefined,
      makerId,
      undefined,
      undefined,
      undefined,
      sort
    );
    const items = result.items as WorkItem[];
    const makerName = findMakerName(items, makerId);

    return {
      ...result,
      makerName,
      title: makerName
        ? `${makerName}作品一覧 - AV大臣`
        : `メーカーID ${makerId} の作品一覧 - AV大臣`,
    };
  }
);

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const makerId = requireValidMakerId(id);
  const currentPage = normalizePage(query.page);
  const currentSort = normalizeWorkSort(query.sort);
  const { title } = await getMakerPageData(makerId, currentPage, currentSort);

  return {
    title,
    alternates: {
      canonical: `${SITE_URL}/makers/${encodeURIComponent(makerId)}`,
    },
  };
}

export default async function MakerWorksPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const makerId = requireValidMakerId(id);
  const currentPage = normalizePage(query.page);
  const currentSort = normalizeWorkSort(query.sort);
  const { items, totalPages, title, makerName } = await getMakerPageData(
    makerId,
    currentPage,
    currentSort
  );
  const paginationItems = getPagination(currentPage, totalPages);
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "ホーム", href: "/" },
    { name: "メーカー", href: "/makers" },
    {
      name: makerName || `メーカーID ${makerId}`,
      href: `/makers/${encodeURIComponent(makerId)}`,
    },
  ];

  const makePageHref = (page: number, sort: WorkSort = currentSort) => {
    const queryParams = new URLSearchParams({
      page: String(page),
      sort,
    });

    return `/makers/${encodeURIComponent(makerId)}?${queryParams.toString()}`;
  };

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
          {(items as WorkItem[]).map((item) => (
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
