import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("staging commands reject a production upload endpoint before build or deployment", () => {
  for (const action of ["dev", "build", "deploy", "dry-run"]) {
    const result = spawnSync(process.execPath, ["scripts/staging.js", action], {
      encoding: "utf8",
      env: { ...process.env, VITE_UPLOAD_URL: "https://upload.algobot.fun", VITE_UPLOAD_TOKEN: "fixture" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Production upload settings are not allowed/);
    assert.doesNotMatch(result.stdout, /vite|wrangler/);
  }
});

test("staging cannot deploy when browser and Worker credentials disagree", () => {
  const result = spawnSync(process.execPath, ["scripts/staging.js", "deploy"], {
    encoding: "utf8",
    env: { ...process.env, VITE_UPLOAD_URL: "https://algobot-upload-test.jidalman-work.workers.dev", VITE_UPLOAD_TOKEN: "deliberately-mismatched-fixture" },
  });
  assert.equal(result.status, 1);
  // Clean checkouts have no local secrets; both cases must stop before building.
  assert.match(result.stderr, /Test Worker secrets must match|ENOENT/);
  assert.doesNotMatch(result.stdout, /vite|wrangler/);
});
