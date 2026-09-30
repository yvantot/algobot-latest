import { sealDataset } from "../../src/game/ml/export-integrity.js";
import { gzipText } from "../../src/game/ml/cloud-upload.js";

export async function dataset(events = [1], participant = "P001", session = "s-1") {
  return sealDataset({ dataset_version: "v4", session_count: 1,
    sessions: [{ student_id: participant, session_id: session, raw_events: events }] });
}
export async function zipped(data) { return gzipText(JSON.stringify(data ?? await dataset())); }
export function fakeEnv() {
  const store = new Map();
  return { store, ROUND: "round3", ALLOWED_ORIGINS: "https://algobot.fun,https://www.algobot.fun", STUDY_TOKEN: "study", ADMIN_TOKEN: "admin",
    DATA: {
      put: async (key, body, options) => {
        if (options?.onlyIf?.get("If-None-Match") === "*" && store.has(key)) return null;
        store.set(key, new Uint8Array(body)); return { key };
      },
      get: async key => store.has(key) ? { body: store.get(key) } : null,
      list: async ({ prefix }) => ({ truncated: false,
        objects: [...store].filter(([k]) => k.startsWith(prefix)).map(([key, v]) => ({ key, size: v.length, uploaded: new Date(0) })) }),
    } };
}
export const request = (body, headers = {}) => new Request("https://w.dev/upload", { method: "POST", body,
  headers: { Origin: "https://algobot.fun", "Content-Type": "application/gzip",
    "X-Study-Token": "study", "X-Participant": "P001", "X-Session": "s-1", ...headers } });
