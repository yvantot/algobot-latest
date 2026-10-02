import { reportGameError } from '../diagnostics.js';
// Sends the sealed research dataset to the study's upload Worker (upload-worker/).
// Builds without VITE_UPLOAD_URL and VITE_UPLOAD_TOKEN keep download-only behavior.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function uploadConfig(env = import.meta.env ?? {}) {
  const url = env.VITE_UPLOAD_URL?.trim(), token = env.VITE_UPLOAD_TOKEN?.trim();
  return url && token ? { url: `${url.replace(/\/+$/, "")}/upload`, token } : null;
}

export async function gzipText(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function uploadDataset(dataset, { participant, session, config = uploadConfig(),
  fetchImpl = globalThis.fetch, attempts = 3, wait = pause, timeoutMs = 30000 } = {}) {
  if (!config) throw Error("Automatic upload is not configured for this build.");
  if (!SAFE_ID.test(participant ?? "") || !SAFE_ID.test(session ?? "")) throw Error("Missing participant or session ID.");
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error("Invalid upload retry settings.");
  const body = await gzipText(JSON.stringify(dataset));
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await wait(2000 * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Upload timed out. Please try again or download your data.")), timeoutMs);
    try {
      const response = await fetchImpl(config.url, { method: "POST", body, signal: controller.signal, headers: {
        "Content-Type": "application/gzip", "X-Study-Token": config.token,
        "X-Participant": participant, "X-Session": session } });
      if (response.ok) {
        const receipt = await response.json();
        if (receipt?.ok !== true || typeof receipt.key !== "string" || !receipt.key) throw Error("Upload server did not confirm storage.");
        return receipt;
      }
      lastError = Error(`Upload server replied ${response.status}`);
      // A rejected token, ID or size will be rejected again; only retry server and rate-limit errors.
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) { lastError = error; }
    finally { clearTimeout(timer); }
  }
  reportGameError('upload', lastError);
  throw lastError;
}
