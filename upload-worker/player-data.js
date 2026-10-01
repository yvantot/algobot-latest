import { MAX_UPLOAD_BYTES, readLimited } from "./dataset.js";

export async function storePlayerData(bucket, key, data, participant, body) {
  const indexes = data.sessions.flatMap((session, i) => session.student_id === participant ? [i] : []);
  if (indexes.length !== data.sessions.length) {
    const filtered = {
      ...data,
      participant_count: 1,
      session_count: indexes.length,
      sessions: indexes.map(i => data.sessions[i]),
      integrity: { ...data.integrity, sessions: indexes.map(i => data.integrity.sessions[i]) },
    };
    // Session contents are unchanged, so their validated checksums remain valid.
    body = await readLimited(new Blob([JSON.stringify(filtered)]).stream()
      .pipeThrough(new CompressionStream("gzip")), MAX_UPLOAD_BYTES);
  }
  await bucket.put(key, body, {
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: { receivedAt: new Date().toISOString(), storageFormat: "player_upload_v1" },
  });
  return { duplicate: false, sessionCount: indexes.length };
}
