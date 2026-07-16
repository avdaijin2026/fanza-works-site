import { access, opendir } from "node:fs/promises";
import {
  DETAIL_CACHE_DIR,
  POPULAR_ACTRESS_RANKING_CACHE_PATH,
  TOP_WORKS_CACHE_PATH,
} from "@/lib/cache-paths";

export const dynamic = "force-dynamic";

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasDetailCache() {
  try {
    const directory = await opendir(DETAIL_CACHE_DIR);

    try {
      for await (const entry of directory) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          return true;
        }
      }
    } finally {
      await directory.close().catch(() => {});
    }
  } catch {
    return false;
  }

  return false;
}

export async function GET() {
  const [top, ranking, detail] = await Promise.all([
    fileExists(TOP_WORKS_CACHE_PATH),
    fileExists(POPULAR_ACTRESS_RANKING_CACHE_PATH),
    hasDetailCache(),
  ]);
  const checks = { top, ranking, detail };
  const isHealthy = Object.values(checks).every(Boolean);

  return Response.json(
    {
      status: isHealthy ? "ok" : "error",
      checks,
      checkedAt: new Date().toISOString(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
