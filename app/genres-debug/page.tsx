import type { Metadata } from "next";
import { getGenres } from "@/lib/dmm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const initials = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];

export default async function GenresDebugPage() {
  const genreLists = await Promise.all(
    initials.map(async (initial) => {
      const genres = await getGenres(initial);
      return {
        initial,
        genres,
      };
    })
  );

  return (
    <main style={{ padding: "24px", background: "#111", color: "#fff", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "28px", marginBottom: "24px" }}>ジャンルID確認ページ</h1>

      {genreLists.map((group) => (
        <section key={group.initial} style={{ marginBottom: "32px" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>
            {group.initial} 行
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
            {group.genres.map((genre) => (
              <div
                key={`${group.initial}-${genre.id}-${genre.name}`}
                style={{
                  border: "1px solid #333",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  background: "#1a1a1a",
                }}
              >
                <div style={{ color: "#4da3ff", fontWeight: "bold" }}>{genre.name}</div>
                <div style={{ color: "#aaa", fontSize: "13px", marginTop: "4px" }}>
                  id: {genre.id}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
