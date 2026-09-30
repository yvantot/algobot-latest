# Gameplay data uploads

The frontend and upload Worker are separate deployments. The game seals and
gzips the browser's research archive, sends a backup every three minutes, and
sends when Finish opens or the player returns to the menu. Uploads do not replace
the local game save or clear research data. Closing a browser is not a reliable
network flush; students should wait for Finish to confirm success, or download
their file if upload fails.

## Frontend (the link students visit)

In the game project's **Settings → Build → Build variables and secrets**, set:

| Name | Value |
| --- | --- |
| `VITE_UPLOAD_URL` | `https://upload.algobot.fun` |
| `VITE_UPLOAD_TOKEN` | Same value as the upload Worker's `STUDY_TOKEN` |

Use build command `npm run build && npm run verify:upload-build`. Keep the game's
existing frontend deploy command/output directory (`dist`). A new successful
build is required after changing these values. Runtime Variables and Secrets
alone cannot alter a prebuilt Vite bundle. Apply settings to whichever production
or preview branch students actually use.

The upload token is included in browser JavaScript. It is a shared write token,
not a confidential administrator credential or proof of student identity. Never
put `ADMIN_TOKEN` in a `VITE_` variable. The Worker checks allowed browser origins,
but CORS is not authentication against non-browser clients.

## Upload Worker (the receiving endpoint)

From the repository root, configure the `algobot-upload` Worker with:

```sh
npx wrangler secret put STUDY_TOKEN --config upload-worker/wrangler.toml
npx wrangler secret put ADMIN_TOKEN --config upload-worker/wrangler.toml
npx wrangler deploy --config upload-worker/wrangler.toml
```

Keep existing secret values if already configured. `DATA` must bind to the
`algobot-data` R2 bucket; the custom domain must route `upload.algobot.fun` to
this Worker. The config supplies `ROUND=round3` and allows the apex, www, and
current Workers.dev game origins. Add the exact origin if the student link
changes. Changing a frontend build does **not** deploy this separate Worker.

Each player has one file per collection round: `round/participant/data.json.gz`.
It contains the player's sessions, merged by session ID. Later uploads replace
that file, retaining sessions absent from a particular browser. Other participants
in a shared browser's export are excluded. Unreadable legacy backup bytes remain
available through the game's local JSON download; the cloud archive contains
validated session records.

Session revisions reject conflicting or history-dropping updates. Older clients
use export timestamps and history checks. R2 conditional writes retry concurrent
merges, so simultaneous sessions and late retries cannot erase newer data.
Unchanged session content skips the storage write. SHA-256 validates transport
consistency, not who authored the data. Historical snapshot keys remain readable
by the download script but are no longer created.

Uploads are limited to 20 MiB compressed and 16 MiB decompressed. Invalid gzip,
invalid v4 manifests, mismatched session identity, and bad checksums are rejected.
The combined player archive has the same limits. Exceeding them fails without
replacing existing cloud data; download locally and start a new collection round
before a participant approaches this limit. One file grows with recorded activity,
not with repeated copies of the same sessions.
The game makes at most three attempts, with a 30-second deadline per attempt;
manual download remains available while sending. Background attempts run once
per interval and can recover on the next interval after a failure.

## Downloading and verification

Store `UPLOAD_URL` and `ADMIN_TOKEN` in the environment or the ignored
`upload-worker/.admin.local` file. Run `npm run pull-data -- round3`. Files are
written to ignored `training/raw/round3`. Corrupt objects are reported and
skipped so later valid objects still download. Any skip produces a nonzero exit
status; inspect it before preparing training data.

```sh
npm test
npx playwright test tests/e2e/cloud-upload.spec.js --project=chromium
npm run test:upload:integration
npm run build
npm run verify:upload-build
```

The integration test uses Chromium's actual cross-origin fetch and gzip,
Wrangler's local workerd runtime, and disposable local R2. It does not upload
fixtures to the research bucket.

Checked on 2026-09-30 before deploying these changes: `https://algobot.fun` and
the configured Workers.dev link returned 200. Both served bundles without the
upload feature. `https://www.algobot.fun` returned 404, so use the apex or
Workers.dev student link until that site route is configured. The live upload
endpoint answered CORS preflight correctly for all three origins and accepted
the local production upload token (an empty-body probe was rejected with 413
before storage). An authenticated listing of an empty QA prefix also returned
200, confirming that the live Worker can access R2. These checks do not prove a
new production R2 write. After
deploying both projects, verify the new bundle and perform a designated QA
upload/readback before starting collection.

Local validation for this change: 411 unit tests, three Chromium dialog tests,
the real Chromium/workerd/R2 integration test, and the isolated production build
passed. The build verifier confirmed that the production upload URL and token
were embedded without printing the token. No production study objects were
created by these checks.

References: [Cloudflare build variables](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#environment-variables),
[Vite environment variables](https://vite.dev/guide/env-and-mode),
[R2 conditional writes](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#conditional-operations).
