import Link from "next/link";
import { notFound } from "next/navigation";
import SampleGallery from "./SampleGallery";
import VideoPlayer from "./VideoPlayer";
import { genreIdMap } from "@/lib/genre-id-map";

async function getDetail(id: string) {
  const apiId = process.env.DMM_API_ID!;
  const affiliateId = process.env.DMM_AFFILIATE_ID!;

  const url = `https://api.dmm.com/affiliate/v3/ItemList?api_id=${apiId}&affiliate_id=${affiliateId}&cid=${id}&site=FANZA&service=digital&floor=videoa&output=json`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  return json?.result?.items?.[0];
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

  const actressList = item.iteminfo?.actress || [];
  const seriesList = item.iteminfo?.series || [];
  const makerList = item.iteminfo?.maker || [];
  const labelList = item.iteminfo?.label || [];
  const genreList = item.iteminfo?.genre || [];

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
{/* ===== タイトルエリア ===== */}
<div
  style={{
    marginBottom: "20px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
  }}
>
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
          href={item.URL}
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
                    href={`/?actress=${actressId}&actress_name=${encodeURIComponent(a.name)}`}
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
                    href={`/?series=${seriesId}&series_name=${encodeURIComponent(s.name)}`}
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
                    href={`/?maker=${makerId}&maker_name=${encodeURIComponent(m.name)}`}
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
            href={`/?label=${labelId}&label_name=${encodeURIComponent(l.name)}`}
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
                    href={`/?genre=${genreId}&genre_name=${encodeURIComponent(g.name)}`}
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
    </main>
  );
}