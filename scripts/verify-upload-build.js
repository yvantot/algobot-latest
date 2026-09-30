import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "VITE_");
const endpoint = env.VITE_UPLOAD_URL?.trim(), token = env.VITE_UPLOAD_TOKEN?.trim();
if (!endpoint || !token) throw Error("Set VITE_UPLOAD_URL and VITE_UPLOAD_TOKEN in the frontend Build variables before building.");
const url = new URL(endpoint);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw Error("Use an HTTPS upload Worker base URL without credentials, query, or fragment.");
const assets = resolve(process.argv[2] ?? "dist", "assets");
const bundles = readdirSync(assets).filter(name => name.endsWith(".js")).map(name => readFileSync(join(assets, name), "utf8"));
if (!bundles.some(text => text.includes(endpoint) && text.includes(token) && text.includes("X-Study-Token"))) {
  throw Error("The built frontend is missing upload configuration or code. Rebuild with the frontend Build variables set.");
}
console.log(`Upload enabled in the frontend build for ${url.origin}. Token value omitted.`);
