export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DATASET_BYTES = 16 * 1024 * 1024;
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function sha256(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateDataset(data, identity) {
  if (!data || data.dataset_version !== "v4" || data.artifact_type !== "algobot_dataset" ||
      !Array.isArray(data.sessions) || !data.sessions.length || data.session_count !== data.sessions.length ||
      data.integrity?.algorithm !== "SHA-256" || !Array.isArray(data.integrity.sessions) ||
      data.integrity.sessions.length !== data.sessions.length) throw Error("Invalid sealed dataset.");
  const ids = new Set();
  for (let i = 0; i < data.sessions.length; i++) {
    const session = data.sessions[i], entry = data.integrity.sessions[i];
    // Historical recovery exports can contain a legacy record without a session ID.
    if (!session || typeof session !== "object" || Array.isArray(session) ||
        typeof session.student_id !== "string" || !session.student_id ||
        (session.session_id !== null && typeof session.session_id !== "string") ||
        !entry || entry.session_id !== session.session_id ||
        (session.session_id !== null && ids.has(session.session_id))) throw Error("Invalid session manifest.");
    ids.add(session.session_id);
    if (entry.sha256 !== await sha256(new TextEncoder().encode(JSON.stringify(session)))) throw Error("Session checksum mismatch.");
  }
  if (identity && !data.sessions.some(s => s.session_id === identity.session && s.student_id === identity.participant)) {
    throw Error("Upload identity does not match a session in the dataset.");
  }
}

export async function readLimited(stream, limit) {
  if (!stream) throw Error("Empty upload.");
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw Object.assign(Error("Dataset exceeds size limit."), { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function decodeUpload(body, identity) {
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"));
  const bytes = await readLimited(stream, MAX_DATASET_BYTES);
  const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  await validateDataset(data, identity);
  return { data, hash: await sha256(bytes) };
}
