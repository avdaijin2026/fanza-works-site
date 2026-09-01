import { MetadataRoute } from "next";
import { genreIdMap } from "@/lib/genre-id-map";
import { labelIdMap } from "@/lib/label-id-map";
import { withFanzaInFlight } from "@/lib/in-flight-limiter";

const BASE_URL = "https://avdizin.com";
const WORKS_PER_PAGE = 20;
const API_HITS = 100;
const SITEMAP_REVALIDATE_SECONDS = 21600;

export const dynamic = "force-dynamic";

function getUniqueNumericIds(values: Iterable<string>) {
  return [...new Set([...values].filter((value) => /^\d+$/.test(value)))];
}

function getItemInfoIds(
  works: any[],
  itemInfoKey: "actress" | "maker" | "series",
  idKeys: string[]
) {
  const ids = works.flatMap((item) => {
    const values = Array.isArray(item?.iteminfo?.[itemInfoKey])
      ? item.iteminfo[itemInfoKey]
      : [];

    return values
      .map((value: any) => {
        const id = idKeys.map((key) => value?.[key]).find(Boolean);
        return String(id || "");
      })
      .filter(Boolean);
  });

  return getUniqueNumericIds(ids);
}

function hasUsableWorkImage(item: any) {
  const imageUrls = [item?.imageURL?.large, item?.imageURL?.list]
    .map((imageUrl) => String(imageUrl || ""))
    .filter(Boolean);

  return imageUrls.some(
    (imageUrl) =>
      !/now[_-]?print(?:ing)?|no[_-]?image|dummy|coming[_-]?soon/i.test(imageUrl)
  );
}

async function getSitemapWorks(limit: number) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  const works = new Map<string, any>();
  let offset = 1;
  let totalCount = 0;

  while (works.size < limit) {
    const params = new URLSearchParams({
      api_id: apiId || "",
      affiliate_id: affiliateId || "",
      site: "FANZA",
      service: "digital",
      floor: "videoa",
      hits: String(API_HITS),
      offset: String(offset),
      sort: "rank",
      output: "json",
    });
    const requestUrl = `https://api.dmm.com/affiliate/v3/ItemList?${params}`;
    const { response, json } = await withFanzaInFlight(requestUrl, async () => {
      const response = await fetch(requestUrl, {
        next: { revalidate: SITEMAP_REVALIDATE_SECONDS },
      });
      const json = await response.json();
      return { response, json };
    });

    if (!response.ok) {
      throw new Error(
        `サイトマップ用作品データの取得に失敗しました: ${response.status}`
      );
    }

    const items = Array.isArray(json?.result?.items)
      ? json.result.items
      : [];

    totalCount = Number(json?.result?.total_count ?? totalCount);

    for (const item of items) {
      if (item?.content_id && hasUsableWorkImage(item)) {
        works.set(String(item.content_id), item);
      }

      if (works.size >= limit) {
        break;
      }
    }

    if (
      items.length < API_HITS ||
      (totalCount > 0 && offset + API_HITS > totalCount)
    ) {
      break;
    }

    offset += API_HITS;
  }

  return [...works.values()].slice(0, limit);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date() },
    { url: `${BASE_URL}/genres`, lastModified: new Date() },
    { url: `${BASE_URL}/actresses`, lastModified: new Date() },
    { url: `${BASE_URL}/rankings/actresses`, lastModified: new Date() },
    { url: `${BASE_URL}/series`, lastModified: new Date() },
    { url: `${BASE_URL}/makers`, lastModified: new Date() },
    { url: `${BASE_URL}/labels`, lastModified: new Date() },
  ];

  const maxPages = 50;
  const works = await getSitemapWorks(maxPages * WORKS_PER_PAGE);
  const genrePages: MetadataRoute.Sitemap = getUniqueNumericIds(
    Object.values(genreIdMap)
  ).map((id) => ({
    url: `${BASE_URL}/genres/${id}`,
    lastModified: new Date(),
  }));
  const labelPages: MetadataRoute.Sitemap = getUniqueNumericIds(
    Object.values(labelIdMap)
  ).map((id) => ({
    url: `${BASE_URL}/labels/${id}`,
    lastModified: new Date(),
  }));
  const actressPages: MetadataRoute.Sitemap = getItemInfoIds(works, "actress", [
    "id",
    "actress_id",
  ]).map((id) => ({
    url: `${BASE_URL}/actresses/${id}`,
    lastModified: new Date(),
  }));
  const makerPages: MetadataRoute.Sitemap = getItemInfoIds(works, "maker", [
    "id",
    "maker_id",
  ]).map((id) => ({
    url: `${BASE_URL}/makers/${id}`,
    lastModified: new Date(),
  }));
  const seriesPages: MetadataRoute.Sitemap = getItemInfoIds(works, "series", [
    "id",
    "series_id",
  ]).map((id) => ({
    url: `${BASE_URL}/series/${id}`,
    lastModified: new Date(),
  }));

  const workPages: MetadataRoute.Sitemap = works.map((item: any) => ({
    url: `${BASE_URL}/works/${item.content_id}`,
    lastModified: item.date ? new Date(item.date) : new Date(),
  }));

  return [
    ...staticPages,
    ...genrePages,
    ...labelPages,
    ...actressPages,
    ...makerPages,
    ...seriesPages,
    ...workPages,
  ];
}
