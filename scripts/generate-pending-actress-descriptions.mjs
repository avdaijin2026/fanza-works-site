import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FANZA_API_BASE = "https://api.dmm.com/affiliate/v3";
const RANKED_WORK_COUNT = 100;
const ACTRESS_WORK_HITS = 30;
const DEFAULT_BATCH_LIMIT = 5;
const REQUEST_INTERVAL_MS = 1200;
const MIN_DESCRIPTION_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 180;
const EXCLUDED_GENRE_NAMES = new Set(["独占配信", "ハイビジョン"]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const descriptionsPath = resolve(projectRoot, "data/actress-descriptions.json");
const pendingPath = resolve(
  projectRoot,
  "data/pending-actress-descriptions.json"
);

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function getBatchLimit() {
  const configuredLimit = Number.parseInt(
    process.env.ACTRESS_DESCRIPTION_BATCH_LIMIT || "",
    10
  );

  return Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_BATCH_LIMIT;
}

async function fetchFanza(endpoint, params) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error(
      "DMM_API_ID と DMM_AFFILIATE_ID を環境変数に設定してください"
    );
  }

  const query = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    output: "json",
    ...params,
  });
  const response = await fetch(`${FANZA_API_BASE}/${endpoint}?${query}`);

  if (!response.ok) {
    throw new Error(`${endpoint} の取得に失敗しました: ${response.status}`);
  }

  return response.json();
}

async function getRankedWorks() {
  const json = await fetchFanza("ItemList", {
    site: "FANZA",
    service: "digital",
    floor: "videoa",
    sort: "rank",
    hits: String(RANKED_WORK_COUNT),
    offset: "1",
  });

  return Array.isArray(json?.result?.items)
    ? json.result.items.slice(0, RANKED_WORK_COUNT)
    : [];
}

function buildActressScoreMap(works) {
  const scores = new Map();

  works.forEach((work, index) => {
    const actresses = Array.isArray(work?.iteminfo?.actress)
      ? work.iteminfo.actress
      : [];
    const uniqueActresses = new Map();

    actresses.forEach((actress) => {
      const id = String(actress?.id ?? actress?.actress_id ?? "");
      const name = String(actress?.name ?? "");

      if (id && name && !uniqueActresses.has(id)) {
        uniqueActresses.set(id, name);
      }
    });

    if (uniqueActresses.size === 0 || uniqueActresses.size >= 6) {
      return;
    }

    const score = RANKED_WORK_COUNT - index;

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

  return [...scores.values()].sort(
    (a, b) =>
      b.score - a.score ||
      b.appearanceCount - a.appearanceCount ||
      a.id.localeCompare(b.id)
  );
}

async function readPendingDescriptions() {
  try {
    const content = await readFile(pendingPath, "utf8");
    const pending = JSON.parse(content);

    if (!Array.isArray(pending)) {
      throw new Error("pendingデータが配列ではありません");
    }

    return pending;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readRegisteredDescriptionIds() {
  const content = await readFile(descriptionsPath, "utf8");
  const descriptions = JSON.parse(content);

  if (
    !descriptions ||
    typeof descriptions !== "object" ||
    Array.isArray(descriptions)
  ) {
    throw new Error(
      "data/actress-descriptions.json はオブジェクト形式で管理してください"
    );
  }

  return new Set(Object.keys(descriptions));
}

async function getActressGenreTendency(actressId) {
  const json = await fetchFanza("ItemList", {
    site: "FANZA",
    service: "digital",
    floor: "videoa",
    sort: "rank",
    article: "actress",
    article_id: actressId,
    hits: String(ACTRESS_WORK_HITS),
    offset: "1",
  });
  const works = Array.isArray(json?.result?.items) ? json.result.items : [];
  const genreCounts = new Map();

  works.forEach((work) => {
    const genres = Array.isArray(work?.iteminfo?.genre)
      ? work.iteminfo.genre
      : [];
    const uniqueGenres = new Set();

    genres.forEach((genre) => {
      const name = String(genre?.name ?? "").trim();

      if (name && !EXCLUDED_GENRE_NAMES.has(name)) {
        uniqueGenres.add(name);
      }
    });

    uniqueGenres.forEach((name) => {
      genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
    });
  });

  return [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, 3)
    .map(([name]) => name);
}

function createSuggestedDescription(name, genres) {
  const genreText =
    genres.length > 0
      ? `${genres.join("、")}などのジャンルを中心に、さまざまな出演作が見つかります`
      : "さまざまなジャンルの出演作が見つかります";
  let description =
    `${name}の出演作品には、${genreText}。` +
    "このページでは、出演作品を人気順・新着順・評価順・価格順に並べ替え、作品ごとの詳細やサンプル情報を確認できます。気になる作品を比較しながら、好みに合う一本を探す際にご活用ください。";

  if (description.length > MAX_DESCRIPTION_LENGTH && genres.length > 2) {
    return createSuggestedDescription(name, genres.slice(0, 2));
  }

  if (description.length < MIN_DESCRIPTION_LENGTH) {
    description +=
      "出演傾向を確認しながら、まだ知らない作品を探すこともできます。";
  }

  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    throw new Error(
      `${name}の説明文が${MIN_DESCRIPTION_LENGTH}〜${MAX_DESCRIPTION_LENGTH}文字に収まりませんでした: ${description.length}文字`
    );
  }

  return description;
}

async function writePendingDescriptions(pending) {
  const temporaryPath = `${pendingPath}.tmp`;
  const content = `${JSON.stringify(pending, null, 2)}\n`;

  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, pendingPath);
}

async function main() {
  const batchLimit = getBatchLimit();
  const pending = await readPendingDescriptions();
  const registeredIds = await readRegisteredDescriptionIds();
  const pendingIds = new Set(
    pending.map((entry) => String(entry?.actress_id ?? "")).filter(Boolean)
  );
  const rankedWorks = await getRankedWorks();
  const allRankedActresses = buildActressScoreMap(rankedWorks);
  const targets = allRankedActresses
    .filter(
      (actress) =>
        !registeredIds.has(actress.id) && !pendingIds.has(actress.id)
    )
    .slice(0, batchLimit);
  const additions = [];

  for (const actress of targets) {
    const genres = await getActressGenreTendency(actress.id);
    const suggestedDescription = createSuggestedDescription(
      actress.name,
      genres
    );

    additions.push({
      actress_id: actress.id,
      name: actress.name,
      suggestedDescription,
    });

    if (additions.length < targets.length) {
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  if (additions.length > 0) {
    await writePendingDescriptions([...pending, ...additions]);
  }

  console.log(`人気作品取得件数: ${rankedWorks.length}`);
  console.log(`集計Map女優数: ${allRankedActresses.length}`);
  console.log(`登録済み女優数: ${registeredIds.size}`);
  console.log(`既存pending女優数: ${pendingIds.size}`);
  console.log(`今回の追加件数: ${additions.length}`);

  additions.forEach((entry) => {
    console.log(`追加: ${entry.actress_id} ${entry.name}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
