import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
  for (const entry of ["src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "scripts/build-provenance.js"]) visit(entry);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(file).update("\0").update(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest()).update("\0");
  }
  return { source_sha256: hash.digest("hex"), source_file_count: files.length,
    fingerprint_scope: "src, public, index.html, package files, vite config and fingerprint script; exact file bytes at server/build startup" };
}
