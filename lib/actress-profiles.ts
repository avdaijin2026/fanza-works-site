import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

export type ActressProfile = {
  id: string;
  name: string;
  ruby?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  height?: string;
  birthday?: string;
  bloodType?: string;
  hobby?: string;
  prefectures?: string;
  imageURL?: {
    small?: string;
    large?: string;
    list?: string;
  };
};

export type ActressProfileResult = {
  profile: ActressProfile | null;
  status: "available" | "not-found" | "unavailable";
};

type ActressProfileCacheEntry = {
  schemaVersion: number;
  savedAt: string;
  actressId: string;
  profile: ActressProfile;
};

const FANZA_API_BASE = "https://api.dmm.com/affiliate/v3";
const ACTRESS_PROFILE_CACHE_DIR =
  "/root/fanza-works-site-cache/actress-profiles";
const ACTRESS_PROFILE_CACHE_SCHEMA_VERSION = 1;
const ACTRESS_PROFILE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getActressProfileCachePath(actressId: string) {
  return path.join(ACTRESS_PROFILE_CACHE_DIR, `${actressId}.json`);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: unknown) {
  const normalizedValue = normalizeText(value);

  return normalizedValue || undefined;
}

function normalizeImageURL(value: unknown): ActressProfile["imageURL"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const imageURL = value as Record<string, unknown>;
  const normalizedImageURL = {
    small: normalizeOptionalText(imageURL.small),
    large: normalizeOptionalText(imageURL.large),
    list: normalizeOptionalText(imageURL.list),
  };

  return Object.values(normalizedImageURL).some(Boolean)
    ? normalizedImageURL
    : undefined;
}

function normalizeActressProfile(value: unknown): ActressProfile | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const profile = value as Record<string, unknown>;
  const id = normalizeText(profile.id ?? profile.actress_id);
  const name = normalizeText(profile.name);

  if (!/^\d+$/.test(id) || !name) {
    return null;
  }

  const normalizedProfile: ActressProfile = {
    id,
    name,
    ruby: normalizeOptionalText(profile.ruby),
    bust: normalizeOptionalText(profile.bust),
    waist: normalizeOptionalText(profile.waist),
    hip: normalizeOptionalText(profile.hip),
    height: normalizeOptionalText(profile.height),
    birthday: normalizeOptionalText(profile.birthday),
    bloodType: normalizeOptionalText(profile.blood_type),
    hobby: normalizeOptionalText(profile.hobby),
    prefectures: normalizeOptionalText(profile.prefectures),
    imageURL: normalizeImageURL(profile.imageURL),
  };

  return Object.fromEntries(
    Object.entries(normalizedProfile).filter(([, nestedValue]) => {
      if (!nestedValue) {
        return false;
      }

      if (typeof nestedValue === "object") {
        return Object.values(nestedValue).some(Boolean);
      }

      return true;
    })
  ) as ActressProfile;
}

function isActressProfileCacheEntry(
  value: unknown,
  actressId: string
): value is ActressProfileCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<ActressProfileCacheEntry>;

  return (
    entry.schemaVersion === ACTRESS_PROFILE_CACHE_SCHEMA_VERSION &&
    typeof entry.savedAt === "string" &&
    Number.isFinite(Date.parse(entry.savedAt)) &&
    entry.actressId === actressId &&
    !!entry.profile &&
    typeof entry.profile === "object" &&
    entry.profile.id === actressId &&
    typeof entry.profile.name === "string" &&
    entry.profile.name.length > 0
  );
}

async function readActressProfileCache(actressId: string) {
  try {
    const entry: unknown = JSON.parse(
      await readFile(getActressProfileCachePath(actressId), "utf8")
    );

    return isActressProfileCacheEntry(entry, actressId) ? entry : null;
  } catch {
    return null;
  }
}

async function saveActressProfileCache(
  actressId: string,
  profile: ActressProfile
) {
  const cachePath = getActressProfileCachePath(actressId);
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  const entry: ActressProfileCacheEntry = {
    schemaVersion: ACTRESS_PROFILE_CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    actressId,
    profile,
  };

  try {
    await mkdir(ACTRESS_PROFILE_CACHE_DIR, { recursive: true });
    await writeFile(temporaryPath, JSON.stringify(entry), "utf8");
    await rename(temporaryPath, cachePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    console.error("Actress profile cache write error:", {
      actressId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchActressProfile(actressId: string) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;
  const url =
    `${FANZA_API_BASE}/ActressSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&actress_id=${encodeURIComponent(actressId)}` +
    `&hits=1` +
    `&offset=1` +
    `&output=json`;

  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json();
  const resultStatus = json?.result?.status;
  const actresses = json?.result?.actress ?? json?.result?.items ?? [];
  const profile = Array.isArray(actresses)
    ? normalizeActressProfile(actresses[0])
    : null;

  if (!response.ok || String(resultStatus) !== "200") {
    throw new Error(
      `女優プロフィールデータの取得に失敗しました: HTTP ${
        response.status
      }, result.status ${String(resultStatus)}`
    );
  }

  if (!Array.isArray(actresses)) {
    throw new Error("女優プロフィールデータの形式が不正です");
  }

  if (actresses.length === 0) {
    return null;
  }

  if (!profile) {
    throw new Error("女優プロフィールデータの内容が不正です");
  }

  return profile;
}

export const getActressProfileResult = cache(async function getActressProfileResult(
  actressId: string
): Promise<ActressProfileResult> {
  if (!/^\d+$/.test(actressId)) {
    return { profile: null, status: "not-found" };
  }

  const cachedProfile = await readActressProfileCache(actressId);

  if (
    cachedProfile &&
    Date.now() - Date.parse(cachedProfile.savedAt) <=
      ACTRESS_PROFILE_CACHE_TTL_MS
  ) {
    return { profile: cachedProfile.profile, status: "available" };
  }

  try {
    const profile = await fetchActressProfile(actressId);

    if (!profile) {
      return { profile: null, status: "not-found" };
    }

    await saveActressProfileCache(actressId, profile);

    return { profile, status: "available" };
  } catch (error) {
    console.error("Actress profile fetch error:", {
      actressId,
      error: error instanceof Error ? error.message : String(error),
      cacheFallback: !!cachedProfile,
    });

    return cachedProfile
      ? { profile: cachedProfile.profile, status: "available" }
      : { profile: null, status: "unavailable" };
  }
});

export async function getActressProfile(actressId: string) {
  return (await getActressProfileResult(actressId)).profile;
}
