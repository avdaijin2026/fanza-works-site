import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMakers } from "@/lib/dmm";
import { createCanonicalUrl, validatePage } from "@/lib/seo";

const initials = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ",
];

type MakerSearchParams = {
  initial?: string;
  page?: string | string[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<MakerSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const pageValidation = validatePage(params.page);
  if (pageValidation.status !== "valid") return { robots: { index: false, follow: false } };
  const initial = params.initial?.trim();

  return {
    alternates: {
      canonical: createCanonicalUrl("/makers", {
        page: String(pageValidation.page),
        filters: { initial: initial && initial !== "あ" ? initial : undefined },
      }),
    },
  };
}

export default async function MakersPage({
  searchParams,
}: {
  searchParams: Promise<MakerSearchParams>;
}) {
  const params = await searchParams;
  const pageValidation = validatePage(params.page);
  if (pageValidation.status !== "valid") notFound();
  const initial = params.initial || "あ";
  const page = pageValidation.page;

  const { makers, totalCount, totalPages } = await getMakers(initial, page);

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
          メーカー一覧
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          {initials.map((char) => (
            <Link
              key={char}
              href={`/makers?initial=${encodeURIComponent(char)}`}
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 0",
                borderRadius: "6px",
                textDecoration: "none",
                border: "1px solid #333",
                background: char === initial ? "#fff" : "#111",
                color: char === initial ? "#000" : "#fff",
                fontWeight: char === initial ? "bold" : "normal",
                fontSize: "14px",
              }}
            >
              {char}
            </Link>
          ))}
        </div>

        <div
          style={{
            color: "#aaa",
            fontSize: "13px",
            marginBottom: "18px",
          }}
        >
          「{initial}」から始まるメーカー：{totalCount}件
        </div>

        {makers.length === 0 ? (
          <div
            style={{
              color: "#aaa",
              padding: "24px 0",
            }}
          >
            メーカーが見つかりませんでした。
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {makers.map((item) => (
              <Link
                key={item.id}
                href={`/makers/${item.id}`}
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: "8px",
                  padding: "14px 12px",
                }}
              >
                <div
                  style={{
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "bold",
                    lineHeight: "1.5",
                    marginBottom: "6px",
                  }}
                >
                  {item.name}
                </div>

                {item.ruby && (
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: "12px",
                    }}
                  >
                    {item.ruby}
                  </div>
                )}
              </Link>
            ))}
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
            {page > 1 && (
              <Link
                href={`/makers?initial=${encodeURIComponent(initial)}&page=${page - 1}`}
                style={{
                  color: "#fff",
                  textDecoration: "none",
                  padding: "6px 8px",
                }}
              >
                ← 前へ
              </Link>
            )}

            <span style={{ color: "#aaa" }}>
              {page} / {totalPages}
            </span>

            {page < totalPages && (
              <Link
                href={`/makers?initial=${encodeURIComponent(initial)}&page=${page + 1}`}
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
