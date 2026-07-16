import { createHash } from "node:crypto";
import path from "node:path";

export type GetWorksCacheConditions = {
  page: number;
  sort: string;
  genreId: string;
  actressId: string;
  seriesId: string;
  makerId: string;
  labelId: string;
  keyword: string;
};

export type RelatedActressWorksCacheConditions = {
  actressId: string;
  sort: string;
  pageSize: number;
};

export type ActressesListCacheConditions = {
  page: number;
  keyword: string;
  hits: number;
  offset: number;
};

export const GET_WORKS_CACHE_DIR =
  "/root/fanza-works-site-cache/get-works";
export const DETAIL_CACHE_DIR = "/root/fanza-works-site-cache/details";
export const ACTRESSES_LIST_CACHE_DIR =
  "/root/fanza-works-site-cache/actresses-list";
export const RELATED_ACTRESS_WORKS_CACHE_DIR =
  "/root/fanza-works-site-cache/related-actress-works";
export const POPULAR_ACTRESS_RANKING_CACHE_DIR =
  "/root/fanza-works-site-cache/popular-actress-ranking";
export const POPULAR_ACTRESS_RANKING_CACHE_PATH = path.join(
  POPULAR_ACTRESS_RANKING_CACHE_DIR,
  "latest.json"
);

export const TOP_WORKS_CACHE_CONDITIONS: GetWorksCacheConditions = {
  page: 1,
  sort: "rank",
  genreId: "",
  actressId: "",
  seriesId: "",
  makerId: "",
  labelId: "",
  keyword: "",
};

export function getWorksCachePath(conditions: GetWorksCacheConditions) {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify(conditions))
    .digest("hex");

  return path.join(GET_WORKS_CACHE_DIR, `${cacheKey}.json`);
}

export function getActressesListCachePath(
  conditions: ActressesListCacheConditions
) {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify(conditions))
    .digest("hex");

  return path.join(ACTRESSES_LIST_CACHE_DIR, `${cacheKey}.json`);
}

export function getDetailCachePath(contentId: string) {
  const cacheKey = createHash("sha256").update(contentId).digest("hex");

  return path.join(DETAIL_CACHE_DIR, `${cacheKey}.json`);
}

export function getRelatedActressWorksCachePath(
  conditions: RelatedActressWorksCacheConditions
) {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify(conditions))
    .digest("hex");

  return path.join(RELATED_ACTRESS_WORKS_CACHE_DIR, `${cacheKey}.json`);
}

export const TOP_WORKS_CACHE_PATH = getWorksCachePath(
  TOP_WORKS_CACHE_CONDITIONS
);
