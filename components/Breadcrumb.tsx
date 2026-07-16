import Link from "next/link";

export type BreadcrumbItem = {
  name: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="パンくずリスト"
      style={{
        padding: "12px 12px 0",
        fontSize: "12px",
        lineHeight: 1.6,
        color: "#888",
      }}
    >
      <ol
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.name}-${index}`}
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: 0,
              }}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    margin: "0 6px 0 2px",
                    color: "#666",
                  }}
                >
                  &gt;
                </span>
              )}

              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  style={{
                    color: "#aaa",
                    textDecoration: "none",
                  }}
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  style={{
                    color: isLast ? "#ddd" : "#aaa",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
