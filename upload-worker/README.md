# Gameplay data uploads

The frontend and upload Worker are separate deployments. The game seals and
gzips the browser's research archive, sends a backup every minute, and
sends when Finish opens or the player returns to the menu. Uploads do not replace
the local game save or clear research data. Closing a browser is not a reliable
network flush; students should wait for Finish to confirm success, or download
their file if upload fails.

Saving a challenge score or claiming its reward also requests an immediate upload.
If a background upload is already running, the latest challenge state is sent as
soon as it finishes, without overlapping those requests. A failed send retains
local data and the minute timer continues retrying.

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
It contains the player's sessions from the latest successful upload. Every upload
replaces that file completely, including when it has fewer sessions or an older
revision. The Worker streams the request body directly into R2. It does not read
old data, decompress, parse JSON, verify checksums, validate gameplay, filter,
compare, merge, or recompress. The game selects the current participant's sessions
before sending; the Worker trusts the routing headers and stores the exact bytes.

The last completed storage write wins. Use one browser/device per participant
code: another device or a delayed retry can replace more complete data.
Even unchanged, malformed, or empty uploads replace the file. Authentication,
allowed origins and safe routing identifiers are still checked. Checksums generated
by the browser can be checked offline. Historical snapshot keys remain readable
by the download script but are no longer created.

The Worker imposes no dataset size or validity checks; Cloudflare's platform
request/storage limits still apply. The offline training import retains its
20 MiB compressed and 16 MiB decompressed validation limits.
The game makes at most three attempts, with a 30-second deadline per attempt;
manual download remains available while sending. The background timer runs every
60 seconds with at most two attempts and skips overlapping uploads. Browsers may
suspend timers while closed or asleep; reconnecting or returning to the tab also
triggers a send.

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
[R2 writes](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#bucket-method-definitions).


## Find participant upload failures

In the algobot-upload Worker's Observability logs, search for
`research_upload_failed` and the participant code (for example `P017`).
Structured fields include `participant_code`, `session_id`, `round`,
`status`, `reason`, and `timestamp`. Codes are claimed request identities,
not proof of who sent the request. Invalid identifiers are logged as null.

Reasons distinguish invalid tokens, routing identifiers, origins, and storage
failures. These application logs omit credentials,
gameplay payloads, raw exception text, and submitted programs.
Requests that never reach the Worker, such as a disconnected browser, cannot
produce a server-side error log. Logging begins with this deployment and does
not reconstruct earlier failures. Authenticated requests with valid identifiers
also log `research_upload_started` before storing the body and
`research_upload_stored` after a successful write. Correlate the start entry
with platform CPU-limit failures using the request ID to identify the participant.
