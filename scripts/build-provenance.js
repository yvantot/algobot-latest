import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Served source/assets. Collected data, logs and deploy-tool files are outside this scope.
export const SOURCE_SCOPE = ["src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "scripts/build-provenance.js"];

// Fingerprint served source/assets, excluding collected data and Git bookkeeping.
export function sourceFingerprint(root) {
  const files = [];
  function visit(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw Error(`Cannot fingerprint symlink: ${relative}`);
    if (stat.isDirectory()) for (const name of fs.readdirSync(full).sort()) visit(`${relative}/${name}`);
    else if (stat.isFile()) files.push(relative);
  }
  for (const entry of SOURCE_SCOPE) visit(entry);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(file).update("\0").update(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest()).update("\0");
  }
  return { source_sha256: hash.digest("hex"), source_file_count: files.length,
    fingerprint_scope: "src, public, index.html, package files, vite config and fingerprint script; exact file bytes at server/build startup" };
}

// Dirty means the served source differs from the commit. Untracked data files, logs or files a
// deploy tool generates outside SOURCE_SCOPE do not count. Changed paths are kept for diagnosis.
export function gitProvenance(git) {
  const commit = git(["rev-parse", "HEAD"]).trim();
  const changed = git(["status", "--porcelain", "--", ...SOURCE_SCOPE]).split("\n").map(line => line.slice(3).trim()).filter(Boolean);
  return { commit, dirty: changed.length > 0, ...(changed.length ? { dirty_files: changed.slice(0, 20) } : {}) };
}
