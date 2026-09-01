import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import BreadcrumbJsonLd from "@/components/StructuredData/BreadcrumbJsonLd";
import {
  getPopularActressRanking,
  type ActressRankingEntry,
} from "@/lib/dmm";
import { getSafeFanzaError } from "@/lib/fanza-safe-log";

const SITE_URL = "https://avdizin.com";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "人気女優ランキング",
  description:
    "FANZAの人気作品上位100作品をもとにAV大臣が独自集計した人気女優ランキングです。",
  alternates: {
    canonical: `${SITE_URL}/rankings/actresses`,
  },
};

export default async function PopularActressesRankingPage() {
  let ranking: ActressRankingEntry[] = [];
  let hasError = false;
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "ホーム", href: "/" },
    { name: "人気女優ランキング", href: "/rankings/actresses" },
  ];

  try {
    ranking = await getPopularActressRanking();
  } catch (error) {
    console.error("Popular actress ranking error:", {
      error: getSafeFanzaError(error),
    });
    hasError = true;
  }

  return (
    <main>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
      <div
        style={{
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "24px 16px 60px",
        }}
      >
        <Breadcrumb items={breadcrumbItems} />

        <h1
          style={{
            margin: "0 0 8px",
            color: "#fff",
            fontSize: "28px",
            lineHeight: 1.3,
          }}
        >
          人気女優ランキング
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            color: "#999",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          FANZAの人気作品上位100作品をもとにしたAV大臣独自集計です。
          FANZA公式ランキングではありません。
        </p>

        {hasError ? (
          <p style={{ color: "#aaa", fontSize: "14px" }}>
            ランキングデータを一時的に取得できません。時間をおいて再度お試しください。
          </p>
        ) : ranking.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: "14px" }}>
            ランキングデータを取得できませんでした。
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "10px",
            }}
          >
            {ranking.map((actress: ActressRankingEntry, index: number) => {
              const href = `/actresses/${encodeURIComponent(actress.id)}`;

              return (
                <article
                  key={actress.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(42px, 64px) minmax(72px, 96px) minmax(140px, 1fr) repeat(2, minmax(80px, 120px))",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    border: "1px solid #222",
                    borderRadius: "8px",
                    background: "#111",
                  }}
                >
                  <div
                    style={{
                      color: index < 3 ? "#fff" : "#aaa",
                      fontSize: index < 3 ? "22px" : "17px",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                    <span
                      style={{
                        marginLeft: "2px",
                        fontSize: "11px",
                        fontWeight: "normal",
                      }}
                    >
                      位
                    </span>
                  </div>

                  <Link href={href} aria-label={`${actress.name}の作品一覧`}>
                    <img
                      src={actress.image}
                      alt={actress.name}
                      style={{
                        width: "100%",
                        aspectRatio: "4 / 5",
                        objectFit: "cover",
                        display: "block",
                        borderRadius: "6px",
                        background: "#000",
                      }}
                    />
                  </Link>

                  <Link
                    href={href}
                    style={{
                      minWidth: 0,
                      color: "#4ea1ff",
                      fontSize: "16px",
                      fontWeight: "bold",
                      lineHeight: 1.5,
                    }}
                  >
                    {actress.name}
                  </Link>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        marginBottom: "3px",
                        color: "#777",
                        fontSize: "11px",
                      }}
                    >
                      スコア
                    </div>
                    <div
                      style={{
                        color: "#fff",
                        fontSize: "16px",
                        fontWeight: "bold",
                      }}
                    >
                      {actress.score.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        marginBottom: "3px",
                        color: "#777",
                        fontSize: "11px",
                      }}
                    >
                      出演カウント
                    </div>
                    <div
                      style={{
                        color: "#fff",
                        fontSize: "16px",
                        fontWeight: "bold",
                      }}
                    >
                      {actress.appearanceCount}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <style>{`
          @media (max-width: 640px) {
            article {
              grid-template-columns: 42px 72px minmax(0, 1fr) !important;
              gap: 10px !important;
              padding: 10px !important;
            }

            article > div:nth-of-type(2),
            article > div:nth-of-type(3) {
              grid-column: 3;
              text-align: left !important;
            }

            article > div:nth-of-type(2) {
              align-self: end;
            }

            article > div:nth-of-type(3) {
              align-self: start;
            }
          }
        `}</style>
      </div>
    </main>
  );
}
