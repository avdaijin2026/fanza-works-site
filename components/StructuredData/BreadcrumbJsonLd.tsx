import type { BreadcrumbItem } from "@/components/Breadcrumb";

type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[];
  siteUrl: string;
};

function toAbsoluteUrl(siteUrl: string, href: string) {
  const cleanHref = href.split(/[?#]/)[0] || "/";

  if (/^https?:\/\//.test(cleanHref)) {
    return cleanHref;
  }

  return new URL(cleanHref, siteUrl).toString();
}

export default function BreadcrumbJsonLd({
  items,
  siteUrl,
}: BreadcrumbJsonLdProps) {
  if (items.length < 2) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const listItem: {
        "@type": "ListItem";
        position: number;
        name: string;
        item?: string;
      } = {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
      };

      if (item.href) {
        listItem.item = toAbsoluteUrl(siteUrl, item.href);
      }

      return listItem;
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
