import Link from "next/link";
import { getWorks } from "@/lib/dmm";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
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
  }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page || "1");

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
    keyword
  );

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

  const makePageHref = (page: number) => {
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