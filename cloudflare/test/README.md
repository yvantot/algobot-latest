# Cloudflare test environment

| Component | Resource |
| --- | --- |
| Game | https://algobot-test.jidalman-work.workers.dev |
| Upload API | https://algobot-upload-test.jidalman-work.workers.dev |
| R2 | `algobot-data-test`, prefix `testing/` |
| Game config | `cloudflare/test/game.jsonc` |
| Upload config | `cloudflare/test/upload.jsonc` |

These are persistent, separately named Workers, updated directly from local files. They provide a stable preview address for repeated play and Continue testing. They do not use Git-triggered builds. The production `main` build and `upload-worker/wrangler.toml` remain independent. Cloudflare describes persistent environments and branch previews in [Compare workflows](https://developers.cloudflare.com/workers/previews/compare-workflows/).

## Update and play

Run these commands from the repository root:

```sh
npm run deploy:staging       # Build, verify uploads, deploy test API and game
npm run dev:staging          # Local game, real test R2 uploads; localhost:5173
npm run deploy:staging:check # Build and Wrangler dry runs; no deployment
```

The hosted test game contains the local challenge fix and save-notice changes. Rebuild and deploy after later edits to update the link. Local development updates through Vite without deployment. Browser saves belong to each origin; localhost, the test URL, and algobot.fun each have separate farms.

Return to the start menu to trigger the normal gameplay archive upload, or use Finish & Send when available. Inspect **R2 → algobot-data-test → testing/** in Cloudflare. Uploads are research archives, not remote Continue saves. Keep the tab open while uploading; closing the browser does not guarantee delivery.

The test URL is public, with `X-Robots-Tag: noindex, nofollow`. This discourages indexing but does not restrict access. Admin listing and downloads require a separate admin token. Do not distribute the test link to study participants.

## Credentials on a new computer

Use the existing project Wrangler dependency and authenticate with `npx wrangler login`. The configured account is the same account as production. Create the `algobot-data-test` R2 bucket once if provisioning this setup in an empty account, and update the account and workers.dev subdomain consistently if moving accounts.

Create `.env.staging.local` (ignored):

```dotenv
VITE_UPLOAD_URL=https://algobot-upload-test.jidalman-work.workers.dev
VITE_UPLOAD_TOKEN=<test-study-token>
```

Create `cloudflare/test/.secrets.local` (ignored, JSON):

```json
{
  "STUDY_TOKEN": "<same-test-study-token>",
  "ADMIN_TOKEN": "<separate-test-admin-token>"
}
```

Restore the existing test credentials securely when updating this environment from another computer. Generate independent random values only when intentionally initializing or rotating test credentials. Never reuse production credentials. `ADMIN_TOKEN` must never enter a Vite variable or browser bundle.

The deployment command validates test resource names and the upload URL before building. It sends secrets through Wrangler's protected file input and does not print their values. Config files contain no secrets. The Vite output goes to ignored `dist-staging/`, leaving production `dist/` independent.

Test records are kept until explicitly removed. The retained production QA record documented in `documentation/CLOUDFLARE_UPLOAD_VERIFICATION_2026-10-01.md` stays in the production bucket and must not be deleted without the user's instruction.
