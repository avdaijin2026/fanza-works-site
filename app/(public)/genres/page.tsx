import type { Metadata } from "next";
import Link from "next/link";
import { genreGroups } from "@/lib/genre-groups";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://avdizin.com/genres",
  },
};

export default function GenresPage() {
  return (
    <main>
      <div className="genres-page">
        <h1 className="genres-page-title">ジャンル一覧</h1>

        <div className="genres-anchor-list">
          {genreGroups.map((group) => (
            <a
              key={group.title}
              href={`#genre-${group.title}`}
              className="genres-anchor-link"
            >
              {group.title}
            </a>
          ))}
        </div>

        {genreGroups.map((group) => (
          <section
            key={group.title}
            id={`genre-${group.title}`}
            className="genre-section"
          >
            <h2 className="genre-section-title">● {group.title}</h2>

            <div className="genre-grid">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/genres/${item.id}`}
                  className="genre-grid-link"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
