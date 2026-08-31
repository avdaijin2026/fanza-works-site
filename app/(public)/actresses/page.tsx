import type { Metadata } from "next";
import Link from "next/link";
import { getActresses } from "@/lib/dmm";
import { createCanonicalUrl } from "@/lib/seo";

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

type SearchParams = Promise<{
  page?: string;
  keyword?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const isKeywordSearch = Boolean(params.keyword?.trim());

  return {
    robots: {
      index: !isKeywordSearch,
      follow: true,
    },
    alternates: {
      canonical: createCanonicalUrl("/actresses", {
        page: params.page,
        filters: { keyword: params.keyword },
      }),
    },
  };
}

export default async function ActressesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page || "1");
  const keyword = params.keyword?.trim() || "";

  const { actresses, totalPages } = await getActresses(currentPage, keyword);

  const visibleActresses = actresses.filter((actress: any) => {
    const image =
      actress.imageURL?.large ||
      actress.imageURL?.small ||
      actress.imageURL?.list;

    return !!image;
  });

  const paginationItems = getPagination(currentPage, totalPages);

  return (
    <main>
      <div
        style={{
          maxWidth: "1800px",
          margin: "0 auto",
          width: "100%",
          padding: "20px 16px 60px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            marginBottom: "20px",
            fontWeight: "bold",
            color: "#fff",
          }}
        >
          AV女優一覧
        </h1>

        <form
          action="/actresses"
          method="get"
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          <input
            type="text"
            name="keyword"
            defaultValue=""
            placeholder="女優名で検索"
            style={{
              width: "320px",
              maxWidth: "100%",
              padding: "10px 12px",
              border: "1px solid #333",
              borderRadius: "6px",
              background: "#111",
              color: "#fff",
              fontSize: "14px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              border: "1px solid #333",
              borderRadius: "6px",
              background: "#1f73ff",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            検索
          </button>
        </form>

        <div
          style={{
            color: "#aaa",
            fontSize: "13px",
            marginBottom: "18px",
          }}
        >
          {keyword
            ? `「${keyword}」の検索結果：このページ ${visibleActresses.length}件表示`
            : `このページ ${visibleActresses.length}件表示`}
        </div>

        {visibleActresses.length === 0 ? (
          <div
            style={{
              color: "#aaa",
              padding: "24px 0",
            }}
          >
            画像付きの女優データが見つかりませんでした。
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "16px 12px",
            }}
          >
            {visibleActresses.map((actress: any, index: number) => {
              const image =
                actress.imageURL?.small ||
                actress.imageURL?.small ||
                actress.imageURL?.list ||
                "";

              const actressId =
                actress.id ||
                actress.actress_id ||
                `${actress.name || "actress"}-${index}`;

              const actressName = actress.name || "名称不明";

              return (
                <Link
                  key={actressId}
                  href={`/actresses/${encodeURIComponent(String(actressId))}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      background: "#111",
                      border: "1px solid #222",
                      borderRadius: "8px",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={image}
                      alt={actressName}
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 5",
                        objectFit: "cover",
                        display: "block",
                        background: "#111",
                      }}
                    />

                    <div
                      style={{
                        padding: "10px 10px 12px",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          lineHeight: "1.5",
                          color: "#fff",
                          fontWeight: "bold",
                        }}
                      >
                        {actressName}
                      </p>

                      {actress.ruby && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "12px",
                            color: "#aaa",
                          }}
                        >
                          {actress.ruby}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              margin: "32px 0 0",
              color: "#fff",
              fontSize: "14px",
            }}
          >
            {currentPage > 1 && (
              <Link
                href={`/actresses?page=${currentPage - 1}${
                  keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""
                }`}
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
                  href={`/actresses?page=${page}${
                    keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""
                  }`}
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
                href={`/actresses?page=${currentPage + 1}${
                  keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""
                }`}
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
        )}
      </div>
    </main>
  );
}
