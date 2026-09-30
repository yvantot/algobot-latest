import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sourceFingerprint, gitProvenance } from "../scripts/build-provenance.js";

test("source fingerprint changes with served code or weights but not collected participant files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "algobot-build-fixture-"));
  try {
    for (const dir of ["src", "public/models", "training/data"]) fs.mkdirSync(path.join(root, dir), { recursive:true });
    fs.writeFileSync(path.join(root, "src/game.js"), "first");
    fs.writeFileSync(path.join(root, "public/models/weights.bin"), Buffer.from([1,2,3]));
    const first = sourceFingerprint(root);
    assert.deepEqual(first, sourceFingerprint(root));
    fs.writeFileSync(path.join(root, "training/data/student.json"), "private test fixture");
    assert.deepEqual(first, sourceFingerprint(root));
    fs.writeFileSync(path.join(root, "src/game.js"), "second");
    const second = sourceFingerprint(root);
    assert.notEqual(first.source_sha256, second.source_sha256);
    fs.writeFileSync(path.join(root, "public/models/weights.bin"), Buffer.from([4,5,6]));
    assert.notEqual(second.source_sha256, sourceFingerprint(root).source_sha256);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});

test("build is dirty only when served source differs from the commit, and records which files", () => {
  const calls = [];
  const git = status => args => { calls.push(args); return args[0] === "rev-parse" ? "abc123\n" : status; };
  assert.deepEqual(gitProvenance(git("")), { commit: "abc123", dirty: false });
  assert.deepEqual(calls[1].slice(0, 3), ["status", "--porcelain", "--"]);
  assert.ok(calls[1].includes("src") && !calls[1].includes("training"));
  assert.deepEqual(gitProvenance(git(" M src/game.js\n?? public/new.png\n")),
    { commit: "abc123", dirty: true, dirty_files: ["src/game.js", "public/new.png"] });
});
