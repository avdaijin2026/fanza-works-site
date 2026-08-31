import type { Metadata } from "next";
import { getGenres } from "@/lib/dmm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const initials = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];

export default async function GenresSearchPage() {
  const genreLists = await Promise.all(
    initials.map(async (initial) => {
      const genres = await getGenres(initial);
      return genres.map((genre) => ({
        ...genre,
        initial,
      }));
    })
  );

  const allGenres = genreLists.flat();

  const targets = ["イタズラ", "インストラクター", "女子校生", "巨乳", "中出し"];

  return (
    <main style={{ padding: "24px", background: "#111", color: "#fff", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "24px" }}>ジャンル検索確認ページ</h1>

      {targets.map((target) => {
        const matched = allGenres.filter((genre) => genre.name.includes(target));

        return (
          <section key={target} style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>{target}</h2>

            {matched.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                {matched.map((genre) => (
                  <div
                    key={`${genre.initial}-${genre.id}-${genre.name}`}
                    style={{
                      border: "1px solid #333",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      background: "#1a1a1a",
                    }}
                  >
                    <div style={{ color: "#4da3ff", fontWeight: "bold" }}>{genre.name}</div>
                    <div style={{ color: "#aaa", fontSize: "13px", marginTop: "4px" }}>
                      id: {genre.id} / {genre.initial}行
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#aaa" }}>見つかりませんでした</div>
            )}
          </section>
        );
      })}
    </main>
  );
}
