import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const cleanupScript = path.resolve("scripts/cleanup-cache.mjs");

function runCleanup(cacheRoot, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cleanupScript], {
      env: {
        ...process.env,
        FANZA_CACHE_ROOT: cacheRoot,
        FANZA_CACHE_ACTIVE_GRACE_MS: "0",
        ...environment,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(new Error(`cleanup exited ${code}: ${stderr}`))
    );
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("deletes cache files older than 30 days and preserves newer files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fanza-cache-age-"));
  try {
    const directory = path.join(root, "details");
    await mkdir(directory);
    const oldFile = path.join(directory, "old.json");
    const newFile = path.join(directory, "new.json");
    await writeFile(oldFile, "{}");
    await writeFile(newFile, "{}");
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await utimes(oldFile, oldDate, oldDate);

    await runCleanup(root);

    assert.equal(await exists(oldFile), false);
    assert.equal(await exists(newFile), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deletes least-recently-used files until below the target", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fanza-cache-size-"));
  try {
    const directory = path.join(root, "get-works");
    await mkdir(directory);
    const dates = [3, 2, 1];
    for (const daysAgo of dates) {
      const filePath = path.join(directory, `${daysAgo}.json`);
      await writeFile(filePath, Buffer.alloc(4096, daysAgo));
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      await utimes(filePath, date, date);
    }

    await runCleanup(root, {
      FANZA_CACHE_MAX_BYTES: "8192",
      FANZA_CACHE_TARGET_BYTES: "4096",
    });

    assert.deepEqual(await readdir(directory), ["1.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
