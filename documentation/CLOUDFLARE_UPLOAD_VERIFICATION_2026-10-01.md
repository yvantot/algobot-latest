# Production upload verification

Verified October 1, 2026 (Asia/Taipei) using the live game at `https://algobot.fun`.

## Result

The live game uploaded a QA research archive through `upload.algobot.fun` into the `algobot-data` R2 bucket. Authenticated readback returned the stored gzip file, and validation passed for every session checksum and the content hash in the object name.

Cloudflare Workers Builds reports success for production commit `15701f439aa6abd657ff3d7a0eceade9efb2e626`, build `db901126-2d0e-4766-b0c4-2b296d9cc3f1`. The apex and Workers.dev frontend bundles contain the upload code and expected configuration. The `www.algobot.fun` frontend still returns 404; use the apex address.

## Retained test object

**Keep this object until the user explicitly requests deletion. Exclude this participant from research analysis.**

- Bucket: `algobot-data`
- Participant: `QA_UPLOAD_20261001_KEEP`
- Prefix: `round3/QA_UPLOAD_20261001_KEEP/`
- Session: `6969b3bb-3737-4fa6-8319-351b21f3059f`
- Object: `6969b3bb-3737-4fa6-8319-351b21f3059f--cedcb2b79c8c853c1788b70fc4f385ac3f2c72c1bc3357f06e2f6cf0c74d693f.json.gz`
- Stored: September 30, 2026 at 16:03:37 UTC (October 1 at 00:03:37 Taipei)
- Size: 2,704 bytes compressed
- Contents: one game-generated QA session with four raw events

The archive records `source_type: recorded` because the normal game UI created it. The QA participant label identifies it as verification data, not a student observation.

## Procedure and scope

Opened the production game with `?study_participant=QA_UPLOAD_20261001_KEEP`, started a new playthrough, closed the opening demo, and named the farm `QA Upload Test - KEEP`. Used Start Menu and Confirm to save and return. That normal game path sent the archive through the browser to the deployed upload Worker. No fixture was inserted directly into R2.

Listed only the QA prefix through the authenticated admin endpoint, downloaded the exact object, decompressed it, checked the v4 manifest and SHA-256 session checksums, and matched the full dataset hash against the object key. The archive contains only the QA participant.

This verifies a real browser upload from the production site, including browser CORS, the configured token, Worker validation, R2 persistence, and authenticated download. It does not constitute a completed study playthrough or an exhaustive production fault test.

Local evidence is retained in the ignored `.manual-save-review/` folder: `retained-qa-upload-result.json`, `qa-upload-live-game.png`, the downloaded archive, and the read-only `verify-retained-qa-upload.mjs` script. No remote objects were deleted.
