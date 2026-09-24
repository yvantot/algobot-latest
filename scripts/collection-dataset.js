import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inspectCollection } from "../src/game/ml/collection-quality.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { RESEARCH_SCHEMA, RESEARCH_FEATURES, recentSequence } from "../src/game/ml/research-features.js";

export function readCollection(input) {
  const files = fs.statSync(input).isDirectory()
    ? fs.readdirSync(input).filter(f => f.endsWith(".json") && !f.includes("replay")).sort().map(f => path.join(input, f))
    : [input];
  const sessions = new Map(), source_sha256 = {};
  for (const file of files) {
    const bytes = fs.readFileSync(file);
    source_sha256[path.basename(file)] = crypto.createHash("sha256").update(bytes).digest("hex");
    const data = JSON.parse(bytes.toString().replace(/^\uFEFF/, ""));
    if (data.data_quality?.stored_sessions_fully_readable === false) throw Error(`${file}: export contains unreadable storage; recover it before training`);
    if (data.dataset_version === "v4" && !data.integrity) throw Error(`${file}: v4 export has no integrity manifest`);
    if (data.integrity) {
      if (data.integrity.algorithm !== "SHA-256" || !Array.isArray(data.sessions) ||
          data.integrity.sessions?.length !== data.sessions.length) throw Error(`${file}: invalid integrity manifest`);
      data.sessions.forEach((s, i) => {
        const hash = crypto.createHash("sha256").update(JSON.stringify(s)).digest("hex");
        if (data.integrity.sessions[i].session_id !== s.session_id || data.integrity.sessions[i].sha256 !== hash) throw Error(`${file}: session checksum mismatch`);
      });
    }
    for (const session of data.sessions ?? [data]) {
      if (!session?.session_id) throw Error(`${file}: record has no session_id; use canonical dataset exports only`);
      const old = sessions.get(session.session_id);
      if (old && old.student_id !== session.student_id) throw Error(`Conflicting participant IDs for ${session.session_id}`);
      if (old) for (const key of ["raw_events", "feature_timeseries"]) {
        const a = old[key] ?? [], b = session[key] ?? [];
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) throw Error(`Conflicting ${key} history for ${session.session_id}; do not merge edited exports`);
        }
      }
      // Periodic downloads overlap. Keep the most complete observation, not the
      // one with the most completed missions (which would discard failed work).
      const rank = s => (s.raw_events?.length ?? 0) + (s.feature_timeseries?.length ?? 0);
      if (!old || rank(session) > rank(old) || (rank(session) === rank(old) &&
          Date.parse(session.export_date) > Date.parse(old.export_date))) sessions.set(session.session_id, session);
    }
  }
  return { sessions: [...sessions.values()], source_sha256 };
}

export function auditCollection(sessions) {
  const reports = sessions.map(s => ({ session_id: s.session_id, student_id: s.student_id, ...inspectCollection(s) }));
  return { session_count: sessions.length, participant_count: new Set(sessions.map(s => s.student_id)).size,
    proxy_category_support: [0, 1, 2].map(i => reports.reduce((n, r) => n + r.proxy_category_support[i], 0)),
    reports, note: "A clean capture audit does not establish model accuracy or adequate participant diversity." };
}

export function assessmentSamples(sessions, assessments, { schema = "10f" } = {}) {
  if (!["10f", RESEARCH_SCHEMA].includes(schema)) throw Error("Unsupported feature schema");
  const samples = [], excluded = [], ids = new Set();
  const index = new Map(sessions.map(s => [s.session_id, s]));
  for (const a of assessments) {
    if (!a.assessment_id || ids.has(a.assessment_id)) throw Error("Missing or duplicate assessment_id");
    ids.add(a.assessment_id);
    const reject = reason => excluded.push({ assessment_id: a.assessment_id, reason });
    const session = index.get(a.session_id);
    if (!session || !a.student_id || session.student_id !== a.student_id) { reject("unmatched_participant_or_session"); continue; }
    if (a.purpose !== "model_target" || a.status !== "scored" || a.assistance !== "none" ||
        !a.rubric_version || !a.task_id || !a.assessor_id) { reject("missing_scoring_provenance_or_not_model_target"); continue; }
    if (!Number.isFinite(a.score) || !Number.isFinite(a.max_score) || a.max_score <= 0 || a.score < 0 || a.score > a.max_score) {
      reject("invalid_score"); continue;
    }
    const zonedTime = value => typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
    const cutoff = zonedTime(a.started_at), end = zonedTime(a.finished_at);
    if (!Number.isFinite(cutoff) || !Number.isFinite(end) || end < cutoff) { reject("invalid_assessment_times"); continue; }
    if (session.source_type !== "recorded" || !session.collection?.independent_of_inference ||
        JSON.stringify(session.feature_names) !== JSON.stringify(FEATURE_NAMES)) { reject("requires_current_recorded_collection"); continue; }
    const snapshots = (session.feature_timeseries ?? []).filter(s => s.timestamp_ms < cutoff);
    const window = snapshots.slice(-20);
    if (window.length < 20 || cutoff - window.at(-1).timestamp_ms > 15000 ||
        window.some((s, i) => s.context?.phase !== "gameplay" || s.context?.game_speed !== 1 ||
          !Array.isArray(s.vector) || s.vector.length !== 10 || !s.vector.every(Number.isFinite) ||
          !Number.isFinite(s.timestamp_ms) || (i && (s.timestamp_ms <= window[i-1].timestamp_ms || s.timestamp_ms - window[i-1].timestamp_ms > 7500)))) {
      reject("requires_20_contiguous_normal_speed_gameplay_snapshots_immediately_before_assessment"); continue;
    }
    let x = window.map(s => [...s.vector]);
    const recentWindow = snapshots.slice(-21);
    if (schema === RESEARCH_SCHEMA) {
      try { x = recentSequence(recentWindow); }
      catch (error) { reject(error.message); continue; }
    }
    samples.push({ source_type: "recorded", label_source: "independent_scored_task",
      student_id: a.student_id, session_id: a.session_id, assessment_id: a.assessment_id,
      task_id: a.task_id, rubric_version: a.rubric_version, assessor_id: a.assessor_id,
      input_start_ms: (schema === RESEARCH_SCHEMA ? recentWindow : window)[0].timestamp_ms, input_end_ms: window.at(-1).timestamp_ms,
      assessment_start_ms: cutoff, real_timesteps: 20, y: a.score / a.max_score,
      x });
  }
  return { samples, excluded, feature_names: schema === RESEARCH_SCHEMA ? RESEARCH_FEATURES : FEATURE_NAMES, feature_schema: schema,
    target: "Independent task score / maximum; not the legacy gameplay proxy",
    deployment_ready: false };
}
