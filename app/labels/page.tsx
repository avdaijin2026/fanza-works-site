import Link from "next/link";
import { labelGroups } from "@/lib/label-groups";

export default function LabelsPage() {
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
          レーベル一覧
        </h1>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "30px",
            borderBottom: "1px solid #333",
            paddingBottom: "12px",
          }}
        >
          {labelGroups.map((group) => (
            <a
              key={group.title}
              href={`#label-${group.title}`}
              style={{
                color: "#4da3ff",
                fontWeight: "bold",
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              {group.title}
            </a>
          ))}
        </div>

        {labelGroups.map((group) => (
          <section
            key={group.title}
            id={`label-${group.title}`}
            style={{
              marginBottom: "40px",
              scrollMarginTop: "100px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                marginBottom: "14px",
                fontWeight: "bold",
                color: "#fff",
              }}
            >
              ● {group.title}
            </h2>

            {group.items.length === 0 ? (
              <div
                style={{
                  color: "#aaa",
                  padding: "12px 0",
                }}
              >
                レーベルがありません。
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "14px",
                }}
              >
                {group.items.map((item) => {
                  const isActive = !!item.id;

                  const cardStyle: React.CSSProperties = {
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    background: "#111",
                    border: "1px solid #222",
                    borderRadius: "8px",
                    padding: "14px 12px",
                    minHeight: "74px",
                    opacity: isActive ? 1 : 0.55,
                    pointerEvents: isActive ? "auto" : "none",
                  };

                  const content = (
                    <>
                      <div
                        style={{
                          color: isActive ? "#4da3ff" : "#888",
                          fontSize: "14px",
                          fontWeight: "bold",
                          lineHeight: "1.5",
                          marginBottom: "6px",
                          wordBreak: "break-word",
                        }}
                      >
                        {item.name}
                      </div>

                      {!isActive && (
                        <div
                          style={{
                            color: "#666",
                            fontSize: "12px",
                          }}
                        >
                          リンク未設定
                        </div>
                      )}
                    </>
                  );

                  if (!isActive) {
                    return (
                      <div key={item.name} style={cardStyle}>
                        {content}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={`/?label=${item.id}&label_name=${encodeURIComponent(item.name)}`}
                      style={cardStyle}
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}