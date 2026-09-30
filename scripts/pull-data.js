// Downloads uploaded research datasets from the upload Worker into training/raw/<round>/.
// Needs UPLOAD_URL (the Worker address) and ADMIN_TOKEN, from the environment or
// from upload-worker/.admin.local (two lines: UPLOAD_URL=... and ADMIN_TOKEN=...).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  MAX_DATASET_BYTES,
  MAX_UPLOAD_BYTES,
  SAFE_ID,
  readLimited,
  validateDataset,
} from "../upload-worker/dataset.js";

export async function pullData({
  base,
  token,
  round = "round3",
  outDir = join("training", "raw", round),
  fetchImpl = globalThis.fetch,
  warn = console.warn,
}) {
  if (!base || !token) throw Error("Set UPLOAD_URL and ADMIN_TOKEN.");
  if (!SAFE_ID.test(round)) throw Error("Invalid collection round.");
  base = base.replace(/\/+$/, "");
  const auth = { Authorization: `Bearer ${token}` };
  const listing = await fetchImpl(
    `${base}/admin/list?prefix=${encodeURIComponent(`${round}/`)}`,
    { headers: auth, signal: AbortSignal.timeout(30000) },
  );
  if (!listing.ok) throw Error(`Listing failed: ${listing.status}`);
  const { objects } = await listing.json();
  if (!Array.isArray(objects)) throw Error("Invalid object listing.");
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  const failures = [];
  for (const { key } of objects) {
    try {
      const parts = typeof key === "string" ? key.split("/") : [];
      const [folder, participant, file] = parts;
      // Both legacy session keys and immutable snapshot keys remain downloadable.
      if (
        parts.length !== 3 ||
        folder !== round ||
        !SAFE_ID.test(participant) ||
        !/^[A-Za-z0-9_-]{1,130}\.json\.gz$/.test(file)
      )
        throw Error("Invalid object key.");
      const response = await fetchImpl(
        `${base}/admin/file?key=${encodeURIComponent(key)}`,
        { headers: auth, signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const compressed = await readLimited(response.body, MAX_UPLOAD_BYTES);
      const json = gunzipSync(compressed, {
        maxOutputLength: MAX_DATASET_BYTES,
      }).toString("utf8");
      await validateDataset(JSON.parse(json));
      const target = join(
        outDir,
        `algobot_dataset_v4_${participant}__${file.replace(/\.json\.gz$/, "")}.json`,
      );
      writeFileSync(target, json);
      written++;
    } catch (error) {
      failures.push({ key, error: error.message });
      warn(`Skipped ${key}: ${error.message}`);
    }
  }
  return { written, total: objects.length, failures, outDir };
}

async function main() {
  const localFile = "upload-worker/.admin.local";
  const local = existsSync(localFile)
    ? Object.fromEntries(
        readFileSync(localFile, "utf8")
          .split(/\r?\n/)
          .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      )
    : {};
  const result = await pullData({
    base: process.env.UPLOAD_URL ?? local.UPLOAD_URL,
    token: process.env.ADMIN_TOKEN ?? local.ADMIN_TOKEN,
    round: process.argv[2] ?? "round3",
  });
  console.log(
    `${result.written} of ${result.total} uploads saved to ${result.outDir}`,
  );
  if (result.failures.length) process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
