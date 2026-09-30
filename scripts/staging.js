import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const action = process.argv[2];
if (!["build", "deploy", "dry-run", "dev"].includes(action)) throw Error("Use build, deploy, dry-run, or dev.");
const endpoint = "https://algobot-upload-test.jidalman-work.workers.dev";
const env = loadEnv("staging", process.cwd(), "VITE_");
if (env.VITE_UPLOAD_URL !== endpoint || !env.VITE_UPLOAD_TOKEN?.trim()) {
  throw Error("Set the test upload URL and token in .env.staging.local. Production upload settings are not allowed here.");
}
const childEnv = { ...process.env, VITE_UPLOAD_URL: endpoint, VITE_UPLOAD_TOKEN: env.VITE_UPLOAD_TOKEN };
function run(file, args) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: "inherit", env: childEnv });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const vite = "node_modules/vite/bin/vite.js";
const wrangler = "node_modules/wrangler/bin/wrangler.js";
if (action === "dev") {
  run(vite, ["--mode", "staging", "--port", "5173", "--strictPort"]);
} else {
  const game = JSON.parse(readFileSync("cloudflare/test/game.jsonc", "utf8"));
  const upload = JSON.parse(readFileSync("cloudflare/test/upload.jsonc", "utf8"));
  if (game.name !== "algobot-test" || upload.name !== "algobot-upload-test" ||
      game.routes.length || upload.routes.length || game.assets.directory !== "../../dist-staging" ||
      upload.r2_buckets.length !== 1 || upload.r2_buckets[0].bucket_name !== "algobot-data-test" ||
      upload.vars.ROUND !== "testing") throw Error("Test deployment must use only the test Workers and test bucket.");
  if (action !== "build") {
    const secrets = JSON.parse(readFileSync("cloudflare/test/.secrets.local", "utf8"));
    if (secrets.STUDY_TOKEN !== env.VITE_UPLOAD_TOKEN || !secrets.ADMIN_TOKEN || secrets.ADMIN_TOKEN === secrets.STUDY_TOKEN) {
      throw Error("Test Worker secrets must match the test frontend and use a separate admin token.");
    }
  }
  run(vite, ["build", "--mode", "staging", "--outDir", "dist-staging"]);
  run("scripts/verify-upload-build.js", ["dist-staging", "staging"]);
  const html = readFileSync("dist-staging/index.html", "utf8").replace(/<title>.*?<\/title>/, "<title>Algobot TEST</title>");
  writeFileSync("dist-staging/index.html", html);
  writeFileSync("dist-staging/_headers", "/*\n  X-Robots-Tag: noindex, nofollow\n");
  if (action !== "build") {
    const dry = action === "dry-run" ? ["--dry-run"] : [];
    run(wrangler, ["deploy", "--config", "cloudflare/test/upload.jsonc", "--secrets-file", "cloudflare/test/.secrets.local", ...dry]);
    run(wrangler, ["deploy", "--config", "cloudflare/test/game.jsonc", ...dry]);
  }
}
