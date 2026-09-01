import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import {
  ACTRESSES_LIST_CACHE_DIR,
  DETAIL_CACHE_DIR,
  GET_WORKS_CACHE_DIR,
  POPULAR_ACTRESS_RANKING_CACHE_DIR,
  POPULAR_ACTRESS_RANKING_CACHE_PATH,
  RELATED_ACTRESS_WORKS_CACHE_DIR,
  getActressesListCachePath,
  getDetailCachePath,
  getRelatedActressWorksCachePath,
  getWorksCachePath,
  type ActressesListCacheConditions,
  type GetWorksCacheConditions,
  type RelatedActressWorksCacheConditions,
} from "@/lib/cache-paths";
import { MAX_PUBLIC_PAGE } from "@/lib/seo";
import {
  InFlightLimitError,
  withFanzaInFlight,
} from "@/lib/in-flight-limiter";

export type WorkSort = "rank" | "date" | "review" | "price" | "-price";

export type ActressRankingEntry = {
  id: string;
  name: string;
  image: string;
  score: number;
  appearanceCount: number;
};

type RankedWorkActress = {
  id?: string | number;
  actress_id?: string | number;
  name?: string;
};

type RankedWork = {
  iteminfo?: {
    actress?: RankedWorkActress[];
  };
};

const FANZA_API_BASE = "https://api.dmm.com/affiliate/v3";
const ACTRESS_RANKING_WORK_COUNT = 100;
const ACTRESS_RANKING_CANDIDATE_LIMIT = 30;
const ACTRESS_RANKING_LIMIT = 20;
const ACTRESS_PROFILE_REQUEST_INTERVAL = 1100;
const ACTRESSES_LIST_CACHE_SCHEMA_VERSION = 1;
const DETAIL_CACHE_SCHEMA_VERSION = 1;
const POPULAR_ACTRESS_RANKING_CACHE_SCHEMA_VERSION = 1;
const RELATED_ACTRESS_WORKS_CACHE_SCHEMA_VERSION = 1;
const RELATED_ACTRESS_WORKS_CACHE_FRESH_MS = 6 * 60 * 60 * 1000;
const ITEM_LIST_MAX_OFFSET = 50_000;

type GetWorksConditions = GetWorksCacheConditions & {
  sort: WorkSort;
};

type GetWorksResult = {
  items: any[];
  totalPages: number;
  totalCount: number;
};

type GetWorksCacheEntry = GetWorksResult & {
  savedAt: string;
  conditions: GetWorksConditions;
};

type ActressesListResult = {
  actresses: any[];
  totalPages: number;
  totalCount: number;
  dataStatus?: "fresh" | "stale-cache" | "unavailable" | "out-of-range";
};

type ActressesListCacheEntry = {
  schemaVersion: number;
  savedAt: string;
  conditions: ActressesListCacheConditions;
  result: ActressesListResult;
};

type DetailCacheEntry = {
  schemaVersion: number;
  savedAt: string;
  contentId: string;
  item: Record<string, any>;
};

type PopularActressRankingCacheEntry = {
  schemaVersion: number;
  savedAt: string;
  ranking: ActressRankingEntry[];
};

type RelatedActressWorksCacheEntry = {
  schemaVersion: number;
  savedAt: string;
  conditions: RelatedActressWorksCacheConditions;
  items: any[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withInFlightDedup<T>(url: string, operation: () => Promise<T>) {
  return withFanzaInFlight(url, operation);
}

async function fetchJsonWithInFlight(
  url: string,
  init: RequestInit
// FANZA's response schema is endpoint-specific and normalized by each caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ response: Response; json: any }> {
  return withInFlightDedup(url, async () => {
    const response = await fetch(url, init);
    const json = await response.json();
    return { response, json };
  });
}

function createGetWorksConditions(
  page: number,
  sort: WorkSort,
  genreId?: string,
  actressId?: string,
  seriesId?: string,
  makerId?: string,
  labelId?: string,
  keyword?: string
): GetWorksConditions {
  return {
    page,
    sort,
    genreId: genreId || "",
    actressId: actressId || "",
    seriesId: seriesId || "",
    makerId: makerId || "",
    labelId: labelId || "",
    keyword: keyword?.trim() || "",
  };
}

function createActressesListConditions(
  page: number,
  keyword: string | undefined,
  hits: number,
  offset: number
): ActressesListCacheConditions {
  return {
    page,
    keyword: keyword?.trim() || "",
    hits,
    offset,
  };
}

function isGetWorksCacheEntry(value: unknown): value is GetWorksCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<GetWorksCacheEntry>;

  return (
    Array.isArray(entry.items) &&
    typeof entry.totalPages === "number" &&
    Number.isFinite(entry.totalPages) &&
    typeof entry.totalCount === "number" &&
    Number.isFinite(entry.totalCount) &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    !!entry.conditions &&
    typeof entry.conditions === "object"
  );
}

function isActressesListResult(
  value: unknown
): value is ActressesListResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Partial<ActressesListResult>;

  return (
    Array.isArray(result.actresses) &&
    typeof result.totalPages === "number" &&
    Number.isFinite(result.totalPages) &&
    typeof result.totalCount === "number" &&
    Number.isFinite(result.totalCount)
  );
}

function isActressesListCacheEntry(
  value: unknown,
  conditions: ActressesListCacheConditions
): value is ActressesListCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ActressesListCacheEntry>;

  return (
    entry.schemaVersion === ACTRESSES_LIST_CACHE_SCHEMA_VERSION &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    !!entry.conditions &&
    JSON.stringify(entry.conditions) === JSON.stringify(conditions) &&
    isActressesListResult(entry.result)
  );
}

async function saveGetWorksCache(
  conditions: GetWorksConditions,
  result: GetWorksResult
) {
  const cachePath = getWorksCachePath(conditions);
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  const entry: GetWorksCacheEntry = {
    ...result,
    savedAt: new Date().toISOString(),
    conditions,
  };

  try {
    await mkdir(GET_WORKS_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("ItemList works cache write error:", {
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });
  }
}

async function saveActressesListCache(
  conditions: ActressesListCacheConditions,
  result: ActressesListResult
) {
  const cachePath = getActressesListCachePath(conditions);
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  const entry: ActressesListCacheEntry = {
    schemaVersion: ACTRESSES_LIST_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    conditions,
    result,
  };

  try {
    await mkdir(ACTRESSES_LIST_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("ActressSearch list cache write error:", {
      page: conditions.page,
      keywordPresent: conditions.keyword.length > 0,
      hits: conditions.hits,
      offset: conditions.offset,
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });
  }
}

async function readActressesListCache(
  conditions: ActressesListCacheConditions
) {
  try {
    const entry: unknown = JSON.parse(
      await readFile(getActressesListCachePath(conditions), "utf8")
    );

    return isActressesListCacheEntry(entry, conditions) ? entry : null;
  } catch {
    return null;
  }
}

async function readGetWorksCache(conditions: GetWorksConditions) {
  try {
    const cachePath = getWorksCachePath(conditions);
    const entry: unknown = JSON.parse(await readFile(cachePath, "utf8"));

    if (
      !isGetWorksCacheEntry(entry) ||
      JSON.stringify(entry.conditions) !== JSON.stringify(conditions)
    ) {
      return null;
    }

    return entry;
  } catch {
    return null;
  }
}

function isDetailCacheEntry(
  value: unknown,
  contentId: string
): value is DetailCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<DetailCacheEntry>;
  const cachedContentId = String(entry.item?.content_id ?? "");

  return (
    entry.schemaVersion === DETAIL_CACHE_SCHEMA_VERSION &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    entry.contentId === contentId &&
    !!entry.item &&
    typeof entry.item === "object" &&
    cachedContentId.toLowerCase() === contentId.toLowerCase()
  );
}

async function saveDetailCache(
  contentId: string,
  item: Record<string, any>
) {
  const cachePath = getDetailCachePath(contentId);
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  const entry: DetailCacheEntry = {
    schemaVersion: DETAIL_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    contentId,
    item,
  };

  try {
    await mkdir(DETAIL_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("ItemList detail cache write error:", {
      contentId,
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });
  }
}

async function readDetailCache(contentId: string) {
  try {
    const entry: unknown = JSON.parse(
      await readFile(getDetailCachePath(contentId), "utf8")
    );

    return isDetailCacheEntry(entry, contentId) ? entry : null;
  } catch {
    return null;
  }
}

function isActressRankingEntry(value: unknown): value is ActressRankingEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ActressRankingEntry>;

  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.name === "string" &&
    entry.name.length > 0 &&
    typeof entry.image === "string" &&
    entry.image.length > 0 &&
    typeof entry.score === "number" &&
    Number.isFinite(entry.score) &&
    typeof entry.appearanceCount === "number" &&
    Number.isFinite(entry.appearanceCount)
  );
}

function isPopularActressRankingCacheEntry(
  value: unknown
): value is PopularActressRankingCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<PopularActressRankingCacheEntry>;

  return (
    entry.schemaVersion === POPULAR_ACTRESS_RANKING_CACHE_SCHEMA_VERSION &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    Array.isArray(entry.ranking) &&
    entry.ranking.length > 0 &&
    entry.ranking.every(isActressRankingEntry)
  );
}

async function savePopularActressRankingCache(
  ranking: ActressRankingEntry[]
) {
  const temporaryPath = `${POPULAR_ACTRESS_RANKING_CACHE_PATH}.${process.pid}.${randomUUID()}.tmp`;
  const entry: PopularActressRankingCacheEntry = {
    schemaVersion: POPULAR_ACTRESS_RANKING_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    ranking,
  };

  try {
    await mkdir(POPULAR_ACTRESS_RANKING_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, POPULAR_ACTRESS_RANKING_CACHE_PATH);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("Popular actress ranking cache write error:", {
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });
  }
}

async function readPopularActressRankingCache() {
  try {
    const entry: unknown = JSON.parse(
      await readFile(POPULAR_ACTRESS_RANKING_CACHE_PATH, "utf8")
    );

    return isPopularActressRankingCacheEntry(entry) ? entry : null;
  } catch {
    return null;
  }
}

function isRelatedActressWorksCacheEntry(
  value: unknown,
  conditions: RelatedActressWorksCacheConditions
): value is RelatedActressWorksCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<RelatedActressWorksCacheEntry>;

  return (
    entry.schemaVersion === RELATED_ACTRESS_WORKS_CACHE_SCHEMA_VERSION &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    Array.isArray(entry.items) &&
    entry.items.length > 0 &&
    !!entry.conditions &&
    JSON.stringify(entry.conditions) === JSON.stringify(conditions)
  );
}

async function readRelatedActressWorksCache(
  conditions: RelatedActressWorksCacheConditions
) {
  try {
    const entry: unknown = JSON.parse(
      await readFile(getRelatedActressWorksCachePath(conditions), "utf8")
    );

    return isRelatedActressWorksCacheEntry(entry, conditions) ? entry : null;
  } catch {
    return null;
  }
}

async function saveRelatedActressWorksCache(
  conditions: RelatedActressWorksCacheConditions,
  items: any[]
) {
  const cachePath = getRelatedActressWorksCachePath(conditions);
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  const entry: RelatedActressWorksCacheEntry = {
    schemaVersion: RELATED_ACTRESS_WORKS_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    conditions,
    items,
  };

  try {
    await mkdir(RELATED_ACTRESS_WORKS_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, cachePath);
    console.info("Related actress works cache save", {
      actressId: conditions.actressId,
      sort: conditions.sort,
      pageSize: conditions.pageSize,
    });
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("Related actress works cache write error:", {
      actressId: conditions.actressId,
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });
  }
}

function selectRelatedActressWorks(
  items: any[],
  currentContentId: string,
  limit: number
) {
  return items
    .filter((item: any) => item?.content_id !== currentContentId)
    .slice(0, limit);
}

function sanitizeFanzaLogValue(value: unknown): unknown {
  const sensitiveValues = [
    process.env.DMM_API_ID,
    process.env.DMM_AFFILIATE_ID,
  ].filter((sensitiveValue): sensitiveValue is string => !!sensitiveValue);

  if (typeof value === "string") {
    return sensitiveValues.reduce(
      (sanitizedValue, sensitiveValue) =>
        sanitizedValue.replaceAll(sensitiveValue, "[REDACTED]"),
      value
    );
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeFanzaLogValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) => key !== "api_id" && key !== "affiliate_id"
        )
        .map(([key, nestedValue]) => [
          key,
          sanitizeFanzaLogValue(nestedValue),
        ])
    );
  }

  return value;
}

function logFanzaApiError(
  message: string,
  status: number | null,
  url: string,
  error: unknown,
  responseMessage?: unknown,
  responseErrors?: unknown,
  resultStatus?: unknown
) {
  const parsed = (() => {
    try {
      const value = new URL(url);
      const rawOffset = value.searchParams.get("offset");
      const offset = rawOffset && /^\d+$/.test(rawOffset) ? Number(rawOffset) : null;
      return {
        api: value.pathname.split("/").pop() || "unknown",
        offset,
      };
    } catch {
      return { api: "unknown", offset: null };
    }
  })();
  const key = `${parsed.api}|${status ?? "network"}|${String(resultStatus)}|${Math.floor((parsed.offset ?? 0) / 100)}`;
  const now = Date.now();
  const bucket = apiErrorLogBuckets.get(key);

  if (bucket && now - bucket.lastLoggedAt < 60_000) {
    bucket.count += 1;
    return;
  }

  if (apiErrorLogBuckets.size >= 256) apiErrorLogBuckets.clear();
  apiErrorLogBuckets.set(key, { count: (bucket?.count ?? 0) + 1, lastLoggedAt: now });
  console.error(message, {
    timestamp: new Date(now).toISOString(),
    api: parsed.api,
    status,
    resultStatus: sanitizeFanzaLogValue(resultStatus),
    offset: parsed.offset,
    responseMessage: sanitizeFanzaLogValue(responseMessage),
    responseErrors: sanitizeFanzaLogValue(responseErrors),
    suppressedInWindow: bucket?.count ?? 0,
    error: sanitizeFanzaLogValue(
      error instanceof Error ? error.message : String(error)
    ),
  });
}

const apiErrorLogBuckets = new Map<
  string,
  { count: number; lastLoggedAt: number }
>();

class ItemListRequestError extends Error {
  status: number | null;
  resultStatus?: unknown;
  responseMessage?: unknown;
  responseErrors?: unknown;

  constructor(
    message: string,
    status: number | null,
    resultStatus?: unknown,
    responseMessage?: unknown,
    responseErrors?: unknown
  ) {
    super(message);
    this.name = "ItemListRequestError";
    this.status = status;
    this.resultStatus = resultStatus;
    this.responseMessage = responseMessage;
    this.responseErrors = responseErrors;
  }
}

class ActressSearchRequestError extends Error {
  status: number | null;
  resultStatus?: unknown;

  constructor(message: string, status: number | null, resultStatus?: unknown) {
    super(message);
    this.name = "ActressSearchRequestError";
    this.status = status;
    this.resultStatus = resultStatus;
  }
}

function shouldRetryItemListHttpStatus(status: number) {
  return status === 400 || status === 429 || status >= 500;
}

async function fetchItemListWithRetry(url: string) {
  return withInFlightDedup(url, () => fetchItemListWithRetryUnshared(url));
}

async function fetchItemListWithRetryUnshared(url: string) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: new AbortController().signal,
      });

      const json = await response.json();
      const resultStatus = json?.result?.status;
      const isSuccessfulResult = String(resultStatus) === "200";
      const shouldRetry =
        attempt < maxAttempts &&
        (shouldRetryItemListHttpStatus(response.status) ||
          (response.ok && !isSuccessfulResult));

      if (shouldRetry) {
        await sleep(attempt * 1000);
        continue;
      }

      if (response.ok && isSuccessfulResult) {
        return json;
      }

      throw new ItemListRequestError(
        `作品データの取得に失敗しました: HTTP ${response.status}, result.status ${String(
          resultStatus
        )}`,
        response.status,
        resultStatus,
        json?.result?.message,
        json?.result?.errors
      );
    } catch (error) {
      if (error instanceof ItemListRequestError) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        throw new ItemListRequestError(
          "作品データの取得中に通信エラーが発生しました",
          null,
          undefined
        );
      }

      await sleep(attempt * 1000);
    }
  }

  throw new ItemListRequestError(
    "作品データの取得に失敗しました",
    null,
    undefined
  );
}

function hasUsableWorkImage(item: any) {
  const imageUrls = [item?.imageURL?.large, item?.imageURL?.list]
    .map((imageUrl) => String(imageUrl || ""))
    .filter(Boolean);

  if (imageUrls.length === 0) {
    return false;
  }

  return imageUrls.some(
    (imageUrl) =>
      !/now[_-]?print(?:ing)?|no[_-]?image|dummy|coming[_-]?soon/i.test(imageUrl)
  );
}

export async function getDetail(contentId: string) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  const normalizedContentId = contentId.trim();
  const url =
    `${FANZA_API_BASE}/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&cid=${encodeURIComponent(normalizedContentId)}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&output=json`;

  try {
    const { response, json } = await fetchJsonWithInFlight(url, { cache: "no-store" });
    const resultStatus = json?.result?.status;
    const totalCount = Number(json?.result?.total_count ?? 0);
    const items = Array.isArray(json?.result?.items)
      ? json.result.items
      : [];
    const item = items.find(
      (candidate: any) =>
        String(candidate?.content_id ?? "").toLowerCase() ===
        normalizedContentId.toLowerCase()
    );

    if (
      !response.ok ||
      String(resultStatus) !== "200" ||
      totalCount < 1 ||
      !item
    ) {
      throw new ItemListRequestError(
        `作品詳細データの取得に失敗しました: HTTP ${
          response.status
        }, result.status ${String(resultStatus)}, total_count ${totalCount}`,
        response.status,
        resultStatus,
        json?.result?.message,
        json?.result?.errors
      );
    }

    await saveDetailCache(normalizedContentId, item);

    return item;
  } catch (error) {
    const requestError =
      error instanceof ItemListRequestError ? error : null;

    logFanzaApiError(
      "ItemList detail error:",
      requestError?.status ?? null,
      url,
      error,
      requestError?.responseMessage,
      requestError?.responseErrors,
      requestError?.resultStatus
    );

    const cachedDetail = await readDetailCache(normalizedContentId);

    if (cachedDetail) {
      const cacheAgeMs = Math.max(
        0,
        Date.now() - Date.parse(cachedDetail.savedAt)
      );

      console.error("ItemList detail stale cache fallback triggered:", {
        contentId: normalizedContentId,
        savedAt: cachedDetail.savedAt,
        schemaVersion: cachedDetail.schemaVersion,
        cacheAgeMs,
        cacheAgeMinutes: Math.floor(cacheAgeMs / 60000),
      });

      return cachedDetail.item;
    }

    return null;
  }
}

export async function getWorks(
  page = 1,
  genreId?: string,
  seriesId?: string,
  makerId?: string,
  actressId?: string,
  labelId?: string,
  keyword?: string,
  sort: WorkSort = "rank"
) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PUBLIC_PAGE) {
    return {
      items: [],
      totalPages: 1,
      totalCount: 0,
      dataStatus: "unavailable" as const,
    };
  }

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  const conditions = createGetWorksConditions(
    page,
    sort,
    genreId,
    actressId,
    seriesId,
    makerId,
    labelId,
    keyword
  );

  const pageSize = 20;
  const fetchHits = 100;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  let articleParam = "";

  if (labelId) {
    articleParam = `&article=label&article_id=${labelId}`;
  } else if (actressId) {
    articleParam = `&article=actress&article_id=${actressId}`;
  } else if (makerId) {
    articleParam = `&article=maker&article_id=${makerId}`;
  } else if (seriesId) {
    articleParam = `&article=series&article_id=${seriesId}`;
  } else if (genreId) {
    articleParam = `&article=genre&article_id=${genreId}`;
  }

  const keywordParam = keyword
    ? `&keyword=${encodeURIComponent(keyword)}`
    : "";
  const sortParam = `&sort=${encodeURIComponent(sort)}`;

  let offset = 1;
  let totalCount = 0;
  let visibleSeen = 0;
  let items: any[] = [];
  let requestUrl = "";

  try {
    while (visibleSeen < endIndex) {
      if (!Number.isInteger(offset) || offset < 1 || offset > ITEM_LIST_MAX_OFFSET) {
        console.warn("FANZA ItemList request skipped: offset out of range", {
          timestamp: new Date().toISOString(),
          api: "ItemList",
          offset: Number.isFinite(offset) ? offset : null,
          page,
          cacheResult: "unavailable",
        });
        return {
          items: [],
          totalPages: 1,
          totalCount: 0,
          dataStatus: "unavailable" as const,
        };
      }

      requestUrl =
        `https://api.dmm.com/affiliate/v3/ItemList` +
        `?api_id=${apiId}` +
        `&affiliate_id=${affiliateId}` +
        `&site=FANZA` +
        `&service=digital` +
        `&floor=videoa` +
        `&hits=${fetchHits}` +
        `&offset=${offset}` +
        `${sortParam}` +
        `${articleParam}` +
        `${keywordParam}` +
        `&output=json`;

      const json = await fetchItemListWithRetry(requestUrl);
      const rawItems = json?.result?.items;
      const rawTotalCount = json?.result?.total_count;

      if (
        !Array.isArray(rawItems) ||
        !Number.isFinite(Number(rawTotalCount)) ||
        Number(rawTotalCount) < 0
      ) {
        throw new ItemListRequestError(
          "作品データのレスポンス形式が不正です",
          200,
          json?.result?.status,
          json?.result?.message,
          json?.result?.errors
        );
      }

      const batch = rawItems;

      totalCount = Number(rawTotalCount);

      if (page > 1 && startIndex >= totalCount) {
        return {
          items: [],
          totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
          totalCount,
          dataStatus: "out-of-range" as const,
        };
      }

      if (batch.length === 0) {
        break;
      }

      const visibleBatch = batch.filter(hasUsableWorkImage);
      const sliceStart = Math.max(0, startIndex - visibleSeen);
      const sliceEnd = Math.max(0, endIndex - visibleSeen);

      if (sliceStart < visibleBatch.length) {
        items.push(...visibleBatch.slice(sliceStart, sliceEnd));
      }

      visibleSeen += visibleBatch.length;

      if (
        items.length >= pageSize ||
        batch.length < fetchHits ||
        (totalCount > 0 && offset + fetchHits > totalCount)
      ) {
        break;
      }

      offset += fetchHits;
    }

    items = items.slice(0, pageSize);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const result = {
      items,
      totalPages,
      totalCount,
    };

    await saveGetWorksCache(conditions, result);

    return { ...result, dataStatus: "fresh" as const };
  } catch (error) {
    const requestError =
      error instanceof ItemListRequestError ? error : null;

    logFanzaApiError(
      "ItemList works error:",
      requestError?.status ?? null,
      requestUrl,
      error,
      requestError?.responseMessage,
      requestError?.responseErrors,
      requestError?.resultStatus
    );
    const cachedResult = await readGetWorksCache(conditions);

    if (cachedResult) {
      const cacheAgeMs = Math.max(
        0,
        Date.now() - Date.parse(cachedResult.savedAt)
      );

      if (!(error instanceof InFlightLimitError)) {
        console.error("ItemList stale cache fallback triggered:", {
          savedAt: cachedResult.savedAt,
          cacheAgeMs,
          cacheAgeMinutes: Math.floor(cacheAgeMs / 60000),
        });
      }

      return {
        items: cachedResult.items,
        totalPages: cachedResult.totalPages,
        totalCount: cachedResult.totalCount,
        dataStatus: "stale-cache" as const,
      };
    }

    if (!(error instanceof InFlightLimitError)) {
      console.error("ItemList empty fallback triggered");
    }

    return {
      items: [],
      totalPages: 1,
      totalCount: 0,
      dataStatus: "unavailable" as const,
    };
  }
}

async function getRankedWorksPage(offset: number) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const url =
    `${FANZA_API_BASE}/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&sort=rank` +
    `&hits=100` +
    `&offset=${offset}` +
    `&output=json`;

  const { response: res, json } = await fetchJsonWithInFlight(url, { next: { revalidate: 21600 } });

  if (!res.ok) {
    throw new Error(`人気作品データの取得に失敗しました: ${res.status}`);
  }

  const resultStatus = json?.result?.status;

  if (String(resultStatus) !== "200") {
    throw new Error(
      `人気作品データの取得に失敗しました: result.status ${String(
        resultStatus
      )}`
    );
  }

  const items = json?.result?.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("人気作品データが空です");
  }

  return items;
}

async function getRankingActressProfile(actressId: string) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const url =
    `${FANZA_API_BASE}/ActressSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&actress_id=${encodeURIComponent(actressId)}` +
    `&hits=5` +
    `&offset=1` +
    `&output=json`;

  const { response: res, json } = await fetchJsonWithInFlight(url, { next: { revalidate: 21600 } });

  if (!res.ok) {
    throw new Error(`女優画像データの取得に失敗しました: ${res.status}`);
  }

  const resultStatus = json?.result?.status;

  if (String(resultStatus) !== "200") {
    throw new Error(
      `女優画像データの取得に失敗しました: result.status ${String(
        resultStatus
      )}`
    );
  }

  const actresses = json?.result?.actress ?? json?.result?.items ?? [];

  return Array.isArray(actresses) ? actresses[0] ?? null : null;
}

async function buildPopularActressRanking(): Promise<ActressRankingEntry[]> {
  const works = (await getRankedWorksPage(1)).slice(
    0,
    ACTRESS_RANKING_WORK_COUNT
  );
  const scores = new Map<
    string,
    {
      id: string;
      name: string;
      score: number;
      appearanceCount: number;
    }
  >();

  works.forEach((work: RankedWork, index: number) => {
    const actresses = Array.isArray(work?.iteminfo?.actress)
      ? work.iteminfo.actress
      : [];
    const uniqueActresses = new Map<string, string>();

    actresses.forEach((actress: RankedWorkActress) => {
      const id = String(actress?.id ?? actress?.actress_id ?? "");
      const name = String(actress?.name ?? "");

      if (id && name && !uniqueActresses.has(id)) {
        uniqueActresses.set(id, name);
      }
    });

    if (uniqueActresses.size === 0 || uniqueActresses.size >= 6) {
      return;
    }

    const score = ACTRESS_RANKING_WORK_COUNT - index;

    uniqueActresses.forEach((name, id) => {
      const current = scores.get(id);

      scores.set(id, {
        id,
        name,
        score: (current?.score ?? 0) + score,
        appearanceCount: (current?.appearanceCount ?? 0) + 1,
      });
    });
  });

  const candidates = [...scores.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.appearanceCount - a.appearanceCount ||
        a.id.localeCompare(b.id)
    )
    .slice(0, ACTRESS_RANKING_CANDIDATE_LIMIT);
  const ranking: ActressRankingEntry[] = [];

  for (const candidate of candidates) {
    if (ranking.length >= ACTRESS_RANKING_LIMIT) {
      break;
    }

    const profile = await getRankingActressProfile(candidate.id);
    const image =
      profile?.imageURL?.large ||
      profile?.imageURL?.small ||
      profile?.imageURL?.list ||
      "";

    if (image) {
      ranking.push({
        id: candidate.id,
        name: String(profile?.name || candidate.name),
        image,
        score: candidate.score,
        appearanceCount: candidate.appearanceCount,
      });
    }

    await sleep(ACTRESS_PROFILE_REQUEST_INTERVAL);
  }

  return ranking;
}

export async function getPopularActressRanking(): Promise<
  ActressRankingEntry[]
> {
  try {
    const ranking = await buildPopularActressRanking();

    if (ranking.length === 0) {
      throw new Error("人気女優ランキングが空です");
    }

    await savePopularActressRankingCache(ranking);

    return ranking;
  } catch (error) {
    console.error("Popular actress ranking error:", {
      error: sanitizeFanzaLogValue(
        error instanceof Error ? error.message : String(error)
      ),
    });

    const cachedRanking = await readPopularActressRankingCache();

    if (cachedRanking) {
      const cacheAgeMs = Math.max(
        0,
        Date.now() - Date.parse(cachedRanking.savedAt)
      );

      console.error("Popular actress ranking stale cache fallback triggered:", {
        savedAt: cachedRanking.savedAt,
        schemaVersion: cachedRanking.schemaVersion,
        cacheAgeMs,
        cacheAgeMinutes: Math.floor(cacheAgeMs / 60000),
      });

      return cachedRanking.ranking;
    }

    throw error;
  }
}

export async function getWorksByActress(
  actressId: string,
  currentContentId: string,
  limit = 6
) {
  if (!/^\d+$/.test(actressId)) {
    console.warn(`Rejected invalid actressId: ${actressId}`);
    return [];
  }

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  const sort: WorkSort = "rank";
  const pageSize = Math.min(100, Math.max(1, limit + 10));
  const conditions: RelatedActressWorksCacheConditions = {
    actressId,
    sort,
    pageSize,
  };
  const cachedWorks = await readRelatedActressWorksCache(conditions);
  const cacheAgeMs = cachedWorks
    ? Math.max(0, Date.now() - Date.parse(cachedWorks.savedAt))
    : null;

  if (
    cachedWorks &&
    cacheAgeMs !== null &&
    cacheAgeMs < RELATED_ACTRESS_WORKS_CACHE_FRESH_MS
  ) {
    console.info("Related actress works cache hit", {
      actressId: conditions.actressId,
      sort: conditions.sort,
      pageSize: conditions.pageSize,
      savedAt: cachedWorks.savedAt,
    });

    return selectRelatedActressWorks(
      cachedWorks.items,
      currentContentId,
      limit
    );
  }

  const url =
    `https://api.dmm.com/affiliate/v3/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&hits=${pageSize}` +
    `&offset=1` +
    `&sort=${sort}` +
    `&article=actress` +
    `&article_id=${encodeURIComponent(conditions.actressId)}` +
    `&output=json`;
  try {
    const json = await fetchItemListWithRetry(url);
    const items = Array.isArray(json?.result?.items)
      ? json.result.items
      : [];

    if (items.length === 0) {
      throw new ItemListRequestError(
        "同じ女優の作品データが空です",
        200,
        json?.result?.status,
        json?.result?.message,
        json?.result?.errors
      );
    }

    await saveRelatedActressWorksCache(conditions, items);

    return selectRelatedActressWorks(items, currentContentId, limit);
  } catch (error) {
    const requestError =
      error instanceof ItemListRequestError ? error : null;

    logFanzaApiError(
      "ItemList actress works error:",
      requestError?.status ?? null,
      url,
      error,
      requestError?.responseMessage,
      requestError?.responseErrors,
      requestError?.resultStatus
    );

    if (cachedWorks) {
      console.error("Related actress works cache fallback", {
        actressId: conditions.actressId,
        sort: conditions.sort,
        pageSize: conditions.pageSize,
        savedAt: cachedWorks.savedAt,
        cacheAgeMs,
      });

      return selectRelatedActressWorks(
        cachedWorks.items,
        currentContentId,
        limit
      );
    }

    return [];
  }
}

export async function getWorksBySeries(
  seriesId: string,
  currentContentId: string,
  limit = 6
) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = Math.min(100, limit + 10);

  const url =
    `https://api.dmm.com/affiliate/v3/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&hits=${hits}` +
    `&offset=1` +
    `&sort=rank` +
    `&article=series` +
    `&article_id=${encodeURIComponent(seriesId)}` +
    `&output=json`;
  try {
    const json = await fetchItemListWithRetry(url);
    const items = json?.result?.items ?? [];

    return items
      .filter((item: any) => item?.content_id !== currentContentId)
      .slice(0, limit);
  } catch (error) {
    const requestError =
      error instanceof ItemListRequestError ? error : null;

    logFanzaApiError(
      "ItemList series works error:",
      requestError?.status ?? null,
      url,
      error,
      requestError?.responseMessage,
      requestError?.responseErrors,
      requestError?.resultStatus
    );
    return [];
  }
}

export async function getWorksByMaker(
  makerId: string,
  currentContentId: string,
  limit = 6
) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = Math.min(100, limit + 10);

  const url =
    `https://api.dmm.com/affiliate/v3/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&hits=${hits}` +
    `&offset=1` +
    `&sort=rank` +
    `&article=maker` +
    `&article_id=${encodeURIComponent(makerId)}` +
    `&output=json`;
  try {
    const json = await fetchItemListWithRetry(url);
    const items = json?.result?.items ?? [];

    return items
      .filter((item: any) => item?.content_id !== currentContentId)
      .slice(0, limit);
  } catch (error) {
    const requestError =
      error instanceof ItemListRequestError ? error : null;

    logFanzaApiError(
      "ItemList maker works error:",
      requestError?.status ?? null,
      url,
      error,
      requestError?.responseMessage,
      requestError?.responseErrors,
      requestError?.resultStatus
    );
    return [];
  }
}

export async function getGenres(initial = "あ") {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const url =
    `https://api.dmm.com/affiliate/v3/GenreSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=100` +
    `&offset=1` +
    `&output=json`;

  try {
    const { response: res, json } = await fetchJsonWithInFlight(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("GenreSearch failed:", initial, res.status, url);
      return [];
    }

    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.genre)) {
      list = result.genre;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    return list.map((g: any) => ({
      id: String(g.genre_id ?? g.id ?? ""),
      name: String(g.name ?? ""),
    }));
  } catch (error) {
    console.error("GenreSearch error:", initial, error);
    return [];
  }
}

export async function getActresses(page = 1, keyword?: string) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PUBLIC_PAGE) {
    return {
      actresses: [],
      totalPages: 1,
      totalCount: 0,
      dataStatus: "unavailable" as const,
    };
  }

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const pageSize = 24;
  const fetchHits = 24;
  const initialOffset = 1;
  const normalizedKeyword = keyword?.trim() || "";
  const conditions = createActressesListConditions(
    page,
    normalizedKeyword,
    fetchHits,
    initialOffset
  );
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const keywordParam = normalizedKeyword
    ? `&keyword=${encodeURIComponent(normalizedKeyword)}`
    : "";

  const hasImage = (actress: any) => {
    return !!(
      actress?.imageURL?.large ||
      actress?.imageURL?.small ||
      actress?.imageURL?.list
    );
  };

  let offset = initialOffset;
  let rawTotalCount = 0;
  let visibleSeen = 0;
  let actresses: any[] = [];

  const maxLoops = Math.max(20, page * 8);

  try {
    for (let loop = 0; loop < maxLoops; loop++) {
      const url =
        `https://api.dmm.com/affiliate/v3/ActressSearch` +
        `?api_id=${apiId}` +
        `&affiliate_id=${affiliateId}` +
        `&hits=${fetchHits}` +
        `&offset=${offset}` +
        `${keywordParam}` +
        `&output=json`;

      const { res, json } = await withInFlightDedup(url, async () => {
        const response = await fetch(url, { cache: "no-store" });
        let body: any;
        try {
          body = await response.json();
        } catch {
          throw new ActressSearchRequestError(
            "ActressSearch JSON parse failed",
            response.status,
            undefined
          );
        }
        return { res: response, json: body };
      });

      const result = json?.result;
      const resultStatus = result?.status;
      const isSuccessfulResult = String(resultStatus) === "200";

      if (!res.ok || !isSuccessfulResult) {
        throw new ActressSearchRequestError(
          `ActressSearch failed: HTTP ${res.status}, result.status ${String(
            resultStatus
          )}`,
          res.status,
          resultStatus
        );
      }

      const batch = result?.actress ?? result?.items;

      rawTotalCount = Number(result?.total_count ?? rawTotalCount ?? 0);

      if (
        Number.isFinite(rawTotalCount) &&
        rawTotalCount >= 0 &&
        page > 1 && startIndex >= rawTotalCount
      ) {
        return {
          actresses: [],
          totalPages: Math.max(1, Math.ceil(rawTotalCount / fetchHits)),
          totalCount: rawTotalCount,
          dataStatus: "out-of-range" as const,
        };
      }

      if (!Array.isArray(batch)) {
        throw new ActressSearchRequestError(
          "ActressSearch response did not include an actress/items array",
          res.status,
          resultStatus
        );
      }

      if (batch.length === 0) {
        break;
      }

      const visibleBatch = batch.filter(hasImage);

      const sliceStart = Math.max(0, startIndex - visibleSeen);
      const sliceEnd = Math.max(0, endIndex - visibleSeen);

      if (sliceStart < visibleBatch.length) {
        actresses.push(...visibleBatch.slice(sliceStart, sliceEnd));
      }

      visibleSeen += visibleBatch.length;

      if (actresses.length >= pageSize) {
        actresses = actresses.slice(0, pageSize);
        break;
      }

      if (rawTotalCount > 0 && offset + fetchHits > rawTotalCount) {
        break;
      }

      offset += fetchHits;
    }

    const result = {
      actresses,
      totalPages: Math.max(1, Math.ceil(rawTotalCount / fetchHits)),
      totalCount: rawTotalCount,
      dataStatus: "fresh" as const,
    };

    await saveActressesListCache(conditions, {
      actresses: result.actresses,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
    });

    return result;
  } catch (error) {
    const requestError =
      error instanceof ActressSearchRequestError ? error : null;

    if (!(error instanceof InFlightLimitError)) {
      console.error("ActressSearch list error:", {
        status: requestError?.status ?? null,
        resultStatus: sanitizeFanzaLogValue(requestError?.resultStatus),
        page: conditions.page,
        keywordPresent: conditions.keyword.length > 0,
        hits: conditions.hits,
        offset,
        error: sanitizeFanzaLogValue(
          error instanceof Error ? error.message : String(error)
        ),
      });
    }

    const cachedResult = await readActressesListCache(conditions);

    if (cachedResult) {
      const cacheAgeMs = Math.max(
        0,
        Date.now() - Date.parse(cachedResult.savedAt)
      );

      if (!(error instanceof InFlightLimitError)) {
        console.error("ActressSearch list stale cache fallback triggered:", {
          savedAt: cachedResult.savedAt,
          cacheAgeMs,
          cacheAgeMinutes: Math.floor(cacheAgeMs / 60000),
          page: conditions.page,
          keywordPresent: conditions.keyword.length > 0,
          hits: conditions.hits,
          offset: conditions.offset,
        });
      }

      return { ...cachedResult.result, dataStatus: "stale-cache" as const };
    }

    if (!(error instanceof InFlightLimitError)) {
      console.error("ActressSearch list empty fallback triggered:", {
        page: conditions.page,
        keywordPresent: conditions.keyword.length > 0,
        hits: conditions.hits,
        offset: conditions.offset,
      });
    }

    return {
      actresses: [],
      totalPages: 1,
      totalCount: 0,
      dataStatus: "unavailable" as const,
    };
  }
}

export async function getSeries(initial = "あ", page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PUBLIC_PAGE) {
    return { series: [], totalCount: 0, totalPages: 1 };
  }

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = 100;
  const offset = (page - 1) * hits + 1;

  const url =
    `https://api.dmm.com/affiliate/v3/SeriesSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=${hits}` +
    `&offset=${offset}` +
    `&output=json`;

  try {
    const { response: res, json } = await fetchJsonWithInFlight(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("SeriesSearch failed:", initial, res.status, url);
      return {
        series: [],
        totalCount: 0,
        totalPages: 1,
      };
    }

    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.series)) {
      list = result.series;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    const series = list.map((s: any) => ({
      id: String(s.series_id ?? s.id ?? ""),
      name: String(s.name ?? ""),
      ruby: String(s.ruby ?? ""),
      listUrl: String(s.list_url ?? s.listURL ?? ""),
    }));

    const totalCount = Number(result?.total_count ?? series.length ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / hits));

    if (page > 1 && (page - 1) * hits >= totalCount) {
      return { series: [], totalCount, totalPages };
    }

    return {
      series,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("SeriesSearch error:", initial, error);
    return {
      series: [],
      totalCount: 0,
      totalPages: 1,
    };
  }
}

export async function getMakers(initial = "あ", page = 1) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PUBLIC_PAGE) {
    return { makers: [], totalCount: 0, totalPages: 1 };
  }

  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = 100;
  const offset = (page - 1) * hits + 1;

  const url =
    `https://api.dmm.com/affiliate/v3/MakerSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=${hits}` +
    `&offset=${offset}` +
    `&output=json`;

  try {
    const { response: res, json } = await fetchJsonWithInFlight(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("MakerSearch failed:", initial, res.status, url);
      return {
        makers: [],
        totalCount: 0,
        totalPages: 1,
      };
    }

    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.maker)) {
      list = result.maker;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    const makers = list.map((m: any) => ({
      id: String(m.maker_id ?? m.id ?? ""),
      name: String(m.name ?? ""),
      ruby: String(m.ruby ?? ""),
      listUrl: String(m.list_url ?? m.listURL ?? ""),
    }));

    const totalCount = Number(result?.total_count ?? makers.length ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / hits));

    if (page > 1 && (page - 1) * hits >= totalCount) {
      return { makers: [], totalCount, totalPages };
    }

    return {
      makers,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("MakerSearch error:", error);
    return {
      makers: [],
      totalCount: 0,
      totalPages: 1,
    };
  }
}
