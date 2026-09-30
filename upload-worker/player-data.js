import { MAX_DATASET_BYTES, MAX_UPLOAD_BYTES, decodeUpload, readLimited, sha256 } from "./dataset.js";

const encode = value => new TextEncoder().encode(JSON.stringify(value));
const fail = (message, status = 409) => Object.assign(Error(message), { status });
const revision = session => Number.isSafeInteger(session.upload_revision) && session.upload_revision > 0 ? session.upload_revision : 0;
const comparable = ({ export_date, upload_revision, ...session }) => JSON.stringify(session);

function retainsHistory(previous, next) {
  if (previous.end_time && !next.end_time) return false;
  if (previous.source_type === "developer_test" && next.source_type !== "developer_test") return false;
  if ((previous.research_exclusion_reasons ?? []).some(reason => !(next.research_exclusion_reasons ?? []).includes(reason))) return false;
  for (const field of ["raw_events", "feature_timeseries", "dda_log"]) {
    const before = previous[field] ?? [], after = next[field] ?? [];
    if (before.length > after.length || before.some((event, i) => JSON.stringify(event) !== JSON.stringify(after[i]))) return false;
  }
  for (const attempt of previous.quest_attempts ?? []) {
    if (!(next.quest_attempts ?? []).some(a => a.quest_key === attempt.quest_key && (!attempt.completed || a.completed))) return false;
  }
  for (const attempt of previous.challenge_attempts ?? []) {
    const after = (next.challenge_attempts ?? []).find(a => a.assessment_id === attempt.assessment_id);
    if (!after || (attempt.reward_claimed && !after.reward_claimed) ||
        (attempt.status !== "in_progress" && after.status === "in_progress")) return false;
    const submissions = attempt.submissions ?? [], updated = after.submissions ?? [];
    if (submissions.length > updated.length || submissions.some((s, i) => JSON.stringify(s) !== JSON.stringify(updated[i]))) return false;
    for (const field of ["student_id", "session_id", "task_id", "rubric_version", "assessor_id", "started_at", "first_exposure"]) {
      if (attempt[field] !== after[field]) return false;
    }
    if (attempt.status === "scored" && ["status", "score", "max_score", "finished_at", "assistance", "purpose"].some(field => attempt[field] !== after[field])) return false;
  }
  return true;
}

function newer(previous, next) {
  if (comparable(previous) === comparable(next)) return previous;
  const oldRevision = revision(previous), newRevision = revision(next);
  if (oldRevision && newRevision) {
    if (newRevision < oldRevision) return previous;
    if (newRevision === oldRevision) throw fail("Conflicting session revision; existing data preserved.");
    if (!retainsHistory(previous, next)) throw fail("Session update would lose recorded history.");
    return next;
  }
  // Older deployed clients have no sequence. Their exports still carry a time
  // and append-only histories; both must agree before replacing a session.
  const oldTime = Date.parse(previous.export_date), newTime = Date.parse(next.export_date);
  if (newTime < oldTime || (oldRevision && !newRevision)) return previous;
  if (retainsHistory(previous, next) && (newTime > oldTime || !retainsHistory(next, previous))) return next;
  if (retainsHistory(next, previous)) return previous;
  throw fail("Unordered session update; existing data preserved.");
}

async function merge(previous, incoming, participant) {
  const sessions = new Map();
  const id = async session => session.session_id ?? `legacy:${await sha256(encode(session))}`;
  for (const session of previous?.sessions ?? []) {
    if (session.student_id !== participant) throw fail("Stored participant mismatch.", 503);
    sessions.set(await id(session), session);
  }
  let changed = !previous;
  for (const session of incoming.sessions.filter(s => s.student_id === participant)) {
    const key = await id(session), old = sessions.get(key);
    const selected = old ? newer(old, session) : session;
    if (selected !== old) { sessions.set(key, selected); changed = true; }
  }
  if (!changed) return null;
  const records = [...sessions.values()].sort((a, b) => String(a.session_id).localeCompare(String(b.session_id)));
  const data = {
    dataset_version: "v4", artifact_type: "algobot_dataset", export_id: crypto.randomUUID(),
    export_date: new Date().toISOString(), storage_format: "player_archive_v1",
    participant_count: 1, session_count: records.length, sessions: records,
    integrity: { algorithm: "SHA-256", sessions: await Promise.all(records.map(async session => ({
      session_id: session.session_id, sha256: await sha256(encode(session)),
    }))) },
  };
  const bytes = encode(data);
  if (bytes.byteLength > MAX_DATASET_BYTES) throw fail("Player archive exceeds size limit; existing data preserved.", 413);
  return readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")), MAX_UPLOAD_BYTES);
}

export async function storePlayerData(bucket, key, data, participant) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const object = await bucket.get(key);
    let previous = null;
    if (object) {
      try { previous = (await decodeUpload(await readLimited(object.body, MAX_UPLOAD_BYTES))).data; }
      catch { throw fail("Stored archive could not be verified; existing data preserved.", 503); }
    }
    const body = await merge(previous, data, participant);
    if (!body) return { duplicate: true, sessionCount: previous.session_count };
    const stored = await bucket.put(key, body, {
      onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/gzip" },
      customMetadata: { receivedAt: new Date().toISOString(), storageFormat: "player_archive_v1" },
    });
    if (stored) return { duplicate: false };
  }
  throw fail("Archive changed during upload; retry shortly.", 503);
}
