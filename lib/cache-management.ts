import path from "node:path";
import { execFile } from "node:child_process";
import { opendir, readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

export const CACHE_ROOT =
  process.env.FANZA_CACHE_ROOT ?? "/root/fanza-works-site-cache";
export const CACHE_MAX_BYTES = 10 * 1024 ** 3;
export const CACHE_WARNING_BYTES = 8 * 1024 ** 3;
export const CACHE_TARGET_BYTES = 8 * 1024 ** 3;
export const CACHE_STATUS_PATH = path.join(
  CACHE_ROOT,
  ".cache-cleanup-status.json"
);

export type CacheStatus = "ok" | "warning" | "critical";

export type CacheHealth = {
  bytes: number;
  files: number;
  status: CacheStatus;
  lastCleanup: string | null;
  scanError?: string;
};

const execFileAsync = promisify(execFile);

function getAllocatedBytes(stats: { blocks?: number; size: number }) {
  return typeof stats.blocks === "number" && stats.blocks > 0
    ? stats.blocks * 512
    : stats.size;
}

async function scanDirectory(directoryPath: string) {
  try {
    const [{ stdout: duOutput }, { stdout: findOutput }] = await Promise.all([
      execFileAsync(
        "du",
        ["--summarize", "--block-size=1", "--", CACHE_ROOT],
        { maxBuffer: 1024 }
      ),
      execFileAsync(
        "find",
        [
          CACHE_ROOT,
          "-type",
          "f",
          "!",
          "-name",
          ".cache-cleanup-*",
          "-printf",
          ".",
        ],
        { maxBuffer: 64 * 1024 * 1024 }
      ),
    ]);
    const bytes = Number.parseInt(duOutput, 10);
    if (!Number.isFinite(bytes)) {
      throw new Error("du returned an invalid cache size");
    }
    return { bytes, files: findOutput.length };
  } catch {
    // Fall back to Node filesystem APIs if GNU du/find are unavailable.
  }

  const filePaths: string[] = [];
  const directory = await opendir(directoryPath);

  try {
    for await (const entry of directory) {
      if (entry.name.startsWith(".cache-cleanup-")) {
        continue;
      }

      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        filePaths.push(...(await collectFiles(entryPath)));
      } else if (entry.isFile()) {
        filePaths.push(entryPath);
      }
    }
  } finally {
    await directory.close().catch(() => {});
  }

  let nextIndex = 0;
  let bytes = 0;
  const workers = Array.from(
    { length: Math.min(64, filePaths.length) },
    async () => {
      while (nextIndex < filePaths.length) {
        const filePath = filePaths[nextIndex++];
        const stats = await stat(filePath);
        bytes += getAllocatedBytes(stats);
      }
    }
  );
  await Promise.all(workers);

  return { bytes, files: filePaths.length };
}

async function collectFiles(directoryPath: string): Promise<string[]> {
  const filePaths: string[] = [];
  const directory = await opendir(directoryPath);

  try {
    for await (const entry of directory) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        filePaths.push(...(await collectFiles(entryPath)));
      } else if (entry.isFile()) {
        filePaths.push(entryPath);
      }
    }
  } finally {
    await directory.close().catch(() => {});
  }

  return filePaths;
}

function getCacheStatus(bytes: number): CacheStatus {
  if (bytes >= CACHE_MAX_BYTES) {
    return "critical";
  }
  if (bytes >= CACHE_WARNING_BYTES) {
    return "warning";
  }
  return "ok";
}

async function readLastCleanup() {
  try {
    const value: unknown = JSON.parse(await readFile(CACHE_STATUS_PATH, "utf8"));
    if (
      value &&
      typeof value === "object" &&
      "completedAt" in value &&
      typeof value.completedAt === "string"
    ) {
      return value.completedAt;
    }
  } catch {
    // The first cleanup may not have run yet.
  }

  return null;
}

export async function getCacheHealth(): Promise<CacheHealth> {
  try {
    const [{ bytes, files }, lastCleanup] = await Promise.all([
      scanDirectory(CACHE_ROOT),
      readLastCleanup(),
    ]);

    return {
      bytes,
      files,
      status: getCacheStatus(bytes),
      lastCleanup,
    };
  } catch (error) {
    return {
      bytes: 0,
      files: 0,
      status: "critical",
      lastCleanup: await readLastCleanup(),
      scanError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatCacheSize(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}
