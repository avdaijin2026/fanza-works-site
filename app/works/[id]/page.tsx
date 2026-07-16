import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb, { type BreadcrumbItem } from "@/components/Breadcrumb";
import BreadcrumbJsonLd from "@/components/StructuredData/BreadcrumbJsonLd";
import SampleGallery from "./SampleGallery";
import VideoPlayer from "./VideoPlayer";
import { genreIdMap } from "@/lib/genre-id-map";
import { getDetail, getWorksByActress } from "@/lib/dmm";

const SITE_URL = "https://avdizin.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    alternates: {
      canonical: `${SITE_URL}/works/${encodeURIComponent(id)}`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await getDetail(id);

  if (!item) return notFound();

  const movieUrl =
    item.sampleMovieURL?.size_720_480 ||
    item.sampleMovieURL?.size_644_414 ||
    item.sampleMovieURL?.size_560_360 ||
    item.sampleMovieURL?.size_476_306 ||
    "";

  const posterImage =
    item.imageURL?.large ||
    item.sampleImageURL?.sample_l?.image?.[0] ||
    "";
  const fanzaUrl = item.affiliateURL || item.URL;

  const actressList = item.iteminfo?.actress || [];
  const seriesList = item.iteminfo?.series || [];
  const makerList = item.iteminfo?.maker || [];
  const labelList = item.iteminfo?.label || [];
  const genreList = item.iteminfo?.genre || [];
  const actressId = actressList
    .map((actress: any) => actress.id || actress.actress_id)
    .find(Boolean);
  const sameActressWorks = actressId
    ? await getWorksByActress(String(actressId), id, 6)
    : [];
  const breadcrumbGenre = genreList.find((genre: any) => {
    const genreId = genre.id || genre.genre_id;
    return genreId && genre.name;
  });
  const breadcrumbGenreId = breadcrumbGenre
    ? String(breadcrumbGenre.id || breadcrumbGenre.genre_id)
    : "";
  const breadcrumbItems: BreadcrumbItem[] =
    breadcrumbGenreId && breadcrumbGenre?.name
      ? [
          { name: "ホーム", href: "/" },
          { name: "ジャンル", href: "/genres" },
          {
            name: String(breadcrumbGenre.name),
            href: `/genres/${encodeURIComponent(breadcrumbGenreId)}`,
          },
          {
            name: item.title,
            href: `/works/${encodeURIComponent(id)}`,
          },
        ]
      : [
          { name: "ホーム", href: "/" },
          { name: "作品" },
          {
            name: item.title,
            href: `/works/${encodeURIComponent(id)}`,
          },
        ];

  if (labelList.length > 0) {
  console.log("detail labelList:", JSON.stringify(labelList, null, 2));

  const lines = labelList
    .filter((l: any) => {
      const id = String(l.id || l.label_id || "");
      const name = l.name;
      return id && name;
    })
    .map((l: any) => `  "${l.name}": "${String(l.id || l.label_id)}",`)
    .join("\n");

  if (lines) {
    console.log("\n[new label-id-map candidate]");
    console.log(lines);
    console.log("[/new label-id-map candidate]\n");
    }
  }

  if (genreList.length > 0) {
    const lines = genreList
      .filter((g: any) => {
        const id = String(g.id || g.genre_id || "");
        const name = g.name;
        return id && name && !genreIdMap[name];
      })
      .map((g: any) => `  "${g.name}": "${String(g.id || g.genre_id)}",`)
      .join("\n");

    if (lines) {
      console.log("\n[new genre-id-map candidate]");
      console.log(lines);
      console.log("[/new genre-id-map candidate]\n");
    }
  }

  console.log("detail genreList:", JSON.stringify(genreList, null, 2));

  return (
    <main style={{ padding: "20px" }}>
      <BreadcrumbJsonLd items={breadcrumbItems} siteUrl={SITE_URL} />
{/* ===== タイトルエリア ===== */}
<div
  style={{
    marginBottom: "20px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
  <Breadcrumb items={breadcrumbItems} />
  <h1
    style={{
      fontSize: "20px",
      lineHeight: "1.6",
      fontWeight: "bold",
      color: "#fff",
      marginBottom: "10px",
    }}
  >
    {item.title}
  </h1>

<div
  style={{
    fontSize: "13px",
    color: "#aaa",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#111",
    padding: "6px 10px",
    borderRadius: "6px",
    width: "fit-content",
  }}
>
    <span>📅</span>
    <span>
      {item.date ? item.date.split(" ")[0] : ""}
    </span>
  </div>
</div>
      <div
        style={{
          marginTop: "20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        {movieUrl ? (
          <VideoPlayer posterImage={posterImage} movieUrl={movieUrl} />
        ) : (
          <div style={{ color: "#999" }}>サンプル動画はありません</div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <a
          href={fanzaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#1f73ff",
            color: "#fff",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: "bold",
          }}
        >
          FANZAで見る
        </a>
      </div>

      <div
        style={{
          marginTop: "20px",
          marginBottom: "20px",
          color: "#fff",
          maxWidth: "900px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {actressList.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: "80px" }}>女優</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {actressList.map((a: any) => {
                const actressId = a.id || a.actress_id;

                if (!actressId) {
                  return (
                    <span
                      key={a.name}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        background: "#111",
                        color: "#4ea1ff",
                        display: "inline-block",
                      }}
                    >
                      {a.name}
                    </span>
                  );
                }

                return (
                  <Link
                    key={actressId}
                    href={`/actresses/${encodeURIComponent(String(actressId))}`}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      background: "#111",
                      color: "#4ea1ff",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    {a.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {seriesList.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: "80px" }}>シリーズ</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {seriesList.map((s: any) => {
                const seriesId = s.id || s.series_id;

                if (!seriesId) {
                  return (
                    <span
                      key={s.name}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        background: "#111",
                        color: "#4ea1ff",
                      }}
                    >
                      {s.name}
                    </span>
                  );
                }

                return (
                  <Link
                    key={seriesId}
                    href={`/series/${encodeURIComponent(seriesId)}`}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      background: "#111",
                      color: "#4ea1ff",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    {s.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {makerList.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: "80px" }}>メーカー</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {makerList.map((m: any) => {
                const makerId = m.id || m.maker_id;

                if (!makerId) {
                  return (
                    <span
                      key={m.name}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #ccc",
                        borderRadius: "6px",
                        background: "#111",
                        color: "#4ea1ff",
                      }}
                    >
                      {m.name}
                    </span>
                  );
                }

                return (
                  <Link
                    key={makerId}
                    href={`/makers/${encodeURIComponent(makerId)}`}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      background: "#111",
                      color: "#4ea1ff",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    {m.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

{labelList.length > 0 && (
  <div
    style={{
      marginBottom: "16px",
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
    }}
  >
    <div style={{ minWidth: "80px" }}>レーベル</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {labelList.map((l: any) => {
        const labelId = l.id || l.label_id;

        if (!labelId) {
          return (
            <span
              key={l.name}
              style={{
                padding: "8px 12px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                background: "#111",
                color: "#4ea1ff",
                display: "inline-block",
              }}
            >
              {l.name}
            </span>
          );
        }

        return (
          <Link
            key={labelId}
            href={`/labels/${encodeURIComponent(labelId)}`}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "6px",
              background: "#111",
              color: "#4ea1ff",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            {l.name}
          </Link>
        );
      })}
    </div>
  </div>
)}

        {genreList.length > 0 && (
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: "80px" }}>ジャンル</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {genreList.map((g: any) => {
                const genreId = g.id || g.genre_id;

                return (
                  <Link
                    key={genreId || g.name}
                    href={`/genres/${encodeURIComponent(genreId)}`}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      background: "#111",
                      color: "#4ea1ff",
                      textDecoration: "none",
                      display: "inline-block",
                    }}
                  >
                    {g.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <SampleGallery images={item.sampleImageURL?.sample_l?.image || []} />
      </div>

      {sameActressWorks.length > 0 && (
        <section
          style={{
            maxWidth: "1100px",
            margin: "40px auto 0",
            padding: "0 12px 30px",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              color: "#fff",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            同じ女優の作品
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              gap: "24px 16px",
            }}
          >
            {sameActressWorks.map((work: any) => (
              <Link
                key={work.content_id}
                href={`/works/${work.content_id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div>
                  <img
                    src={work.imageURL?.large || work.imageURL?.list}
                    alt={work.title}
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
                    {work.title}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "#aaa",
                    }}
                  >
                    登録日 {work.date}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </main>
  );
}
