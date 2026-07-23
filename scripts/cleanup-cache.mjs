import path from "node:path";
import {
  appendFile,
  lstat,
  mkdir,
  open,
  opendir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";

const DEFAULT_CACHE_ROOT = "/root/fanza-works-site-cache";
const cacheRoot = path.resolve(
  process.env.FANZA_CACHE_ROOT ?? DEFAULT_CACHE_ROOT
);
const maxBytes = readPositiveNumber("FANZA_CACHE_MAX_BYTES", 10 * 1024 ** 3);
const targetBytes = readPositiveNumber(
  "FANZA_CACHE_TARGET_BYTES",
  8 * 1024 ** 3
);
const maxAgeMs = readPositiveNumber(
  "FANZA_CACHE_MAX_AGE_MS",
  30 * 24 * 60 * 60 * 1000
);
const activeGraceMs = readPositiveNumber(
  "FANZA_CACHE_ACTIVE_GRACE_MS",
  10 * 60 * 1000
);
const logPath = path.join(cacheRoot, ".cache-cleanup.log");
const statusPath = path.join(cacheRoot, ".cache-cleanup-status.json");
const lockPath = path.join(cacheRoot, ".cache-cleanup.lock");
const protectedNames = new Set([
  path.basename(logPath),
  path.basename(statusPath),
  path.basename(lockPath),
]);

function readPositiveNumber(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

function allocatedBytes(stats) {
  return typeof stats.blocks === "number" && stats.blocks > 0
    ? stats.blocks * 512
    : stats.size;
}

function formatSize(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}

function safeError(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function writeLog(lines) {
  const entry = [
    `[${new Date().toISOString()}] Cache Cleanup`,
    ...lines,
    "",
  ].join("\n");
  await appendFile(logPath, entry, { encoding: "utf8", mode: 0o640 });
  process.stdout.write(entry);
}

async function scan(directoryPath, files) {
  const directory = await opendir(directoryPath);
  try {
    for await (const entry of directory) {
      if (directoryPath === cacheRoot && protectedNames.has(entry.name)) {
        continue;
      }
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await scan(entryPath, files);
      } else if (entry.isFile()) {
        const stats = await lstat(entryPath);
        files.push({
          path: entryPath,
          dev: stats.dev,
          ino: stats.ino,
          size: stats.size,
          allocated: allocatedBytes(stats),
          mtimeMs: stats.mtimeMs,
          atimeMs: stats.atimeMs,
        });
      }
    }
  } finally {
    await directory.close().catch(() => {});
  }
}

async function deleteUnchanged(file, now) {
  const current = await lstat(file.path);
  if (
    !current.isFile() ||
    current.dev !== file.dev ||
    current.ino !== file.ino ||
    current.size !== file.size ||
    current.mtimeMs !== file.mtimeMs ||
    now - Math.max(current.atimeMs, current.mtimeMs) < activeGraceMs
  ) {
    return false;
  }
  await unlink(file.path);
  return true;
}

async function saveStatus(result) {
  const temporaryPath = `${statusPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o640,
  });
  await rename(temporaryPath, statusPath);
}

async function acquireLock() {
  try {
    return await open(lockPath, "wx", 0o640);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const lockStats = await stat(lockPath);
    if (Date.now() - lockStats.mtimeMs <= 6 * 60 * 60 * 1000) {
      throw new Error("another cache cleanup is already running");
    }
    await unlink(lockPath);
    return open(lockPath, "wx", 0o640);
  }
}

async function main() {
  if (
    cacheRoot === path.parse(cacheRoot).root ||
    (!process.env.FANZA_CACHE_ROOT && cacheRoot !== DEFAULT_CACHE_ROOT)
  ) {
    throw new Error(`unsafe cache root: ${cacheRoot}`);
  }
  if (targetBytes > maxBytes) {
    throw new Error("cache target must not exceed cache maximum");
  }

  await mkdir(cacheRoot, { recursive: true });
  const lock = await acquireLock();
  let beforeBytes = 0;
  let afterBytes = 0;
  let deletedFiles = 0;
  let deletedBytes = 0;

  try {
    await lock.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })
    );
    const files = [];
    await scan(cacheRoot, files);
    beforeBytes = files.reduce((sum, file) => sum + file.allocated, 0);
    afterBytes = beforeBytes;
    const now = Date.now();
    const deletedPaths = new Set();

    const remove = async (file) => {
      try {
        if (!(await deleteUnchanged(file, now))) return;
        deletedPaths.add(file.path);
        deletedFiles += 1;
        deletedBytes += file.allocated;
        afterBytes = Math.max(0, afterBytes - file.allocated);
      } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
      }
    };

    for (const file of files) {
      if (now - file.mtimeMs >= maxAgeMs) {
        await remove(file);
      }
    }

    if (afterBytes > maxBytes) {
      const oldestFirst = files
        .filter((file) => !deletedPaths.has(file.path))
        .sort(
          (left, right) =>
            Math.min(left.atimeMs, left.mtimeMs) -
            Math.min(right.atimeMs, right.mtimeMs)
        );
      for (const file of oldestFirst) {
        if (afterBytes <= targetBytes) break;
        await remove(file);
      }
    }

    const completedAt = new Date().toISOString();
    const result = {
      completedAt,
      beforeBytes,
      deletedFiles,
      deletedBytes,
      afterBytes,
    };
    await saveStatus(result);
    await writeLog([
      `Before: ${formatSize(beforeBytes)}`,
      `Deleted Files: ${deletedFiles.toLocaleString("en-US")}`,
      `Deleted Size: ${formatSize(deletedBytes)}`,
      `After: ${formatSize(afterBytes)}`,
      "Status: Success",
    ]);
  } catch (error) {
    await writeLog([
      `Before: ${formatSize(beforeBytes)}`,
      `Deleted Files: ${deletedFiles.toLocaleString("en-US")}`,
      `Deleted Size: ${formatSize(deletedBytes)}`,
      `After: ${formatSize(afterBytes)}`,
      "Status: Error",
      `Error: ${safeError(error)}`,
    ]).catch((logError) => {
      console.error("Cache cleanup log error:", safeError(logError));
    });
    throw error;
  } finally {
    await lock.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}

main().catch((error) => {
  console.error("Cache cleanup aborted:", safeError(error));
  process.exitCode = 1;
});
