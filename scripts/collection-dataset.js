import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inspectCollection } from "../src/game/ml/collection-quality.js";
import { FEATURE_NAMES } from "../src/game/ml/model-input.js";
import { RESEARCH_SCHEMA, RESEARCH_FEATURES, recentSequence } from "../src/game/ml/research-features.js";
import { CHALLENGES, challengeRules, challengeMaxScore } from "../src/game/challenges/catalog.js";

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
      if (old) for (const previous of old.challenge_attempts ?? []) {
        const current = session.challenge_attempts?.find(a => a.assessment_id === previous.assessment_id);
        if (!current) continue;
        for (const key of ["started_at", "task_id", "rubric_version", "first_exposure"]) {
          if (previous[key] !== current[key]) throw Error(`Conflicting challenge provenance for ${session.session_id}`);
        }
        for (let i = 0; i < Math.min(previous.submissions?.length ?? 0, current.submissions?.length ?? 0); i++) {
          if (JSON.stringify(previous.submissions[i]) !== JSON.stringify(current.submissions[i])) throw Error(`Conflicting challenge submission for ${session.session_id}`);
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
    challenge_targets: CHALLENGES.map(task => {
      const result = challengeSamples(sessions, task.id);
      return { task_id: task.id, title: task.title, ...result.participation, excluded: result.excluded };
    }),
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
    const standardChallenge = a.assistance === "standard_in_game" && ["algobot-live-cases-2.0", "algobot-live-cases-3.0"].includes(a.assessor_id);
    if (a.purpose !== "model_target" || a.status !== "scored" || (a.assistance !== "none" && !standardChallenge) ||
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

export function challengeSamples(sessions, taskId = "ready-row-v3") {
  const developerSessions = sessions.filter(s => s.source_type === "developer_test");
  sessions = sessions.filter(s => s.source_type !== "developer_test");
  const attempts = sessions.flatMap(session => (session.challenge_attempts ?? []).map(attempt => ({ ...attempt,
    student_id: session.student_id, session_id: session.session_id })));
  attempts.sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const seen = new Set(), assessments = [], excluded = [];
  for (const attempt of attempts) {
    if (attempt.task_id !== taskId) continue;
    const key = JSON.stringify([attempt.student_id, attempt.task_id]);
    const reject = reason => excluded.push({ assessment_id: attempt.assessment_id, reason });
    if (seen.has(key)) { reject("repeat_exposure_practice_only"); continue; }
    seen.add(key);
    if (!attempt.first_exposure) { reject("previously_exposed_to_task"); continue; }
    if (attempt.status !== "scored") { reject("unfinished_challenge_not_a_zero_score"); continue; }
    const first = attempt.submissions?.[0];
    if (!first || first.score !== attempt.score || first.submitted_at !== attempt.finished_at || first.assistance !== attempt.assistance) {
      reject("first_submission_provenance_mismatch"); continue;
    }
    const task = CHALLENGES.find(task => task.id === taskId);
    const keys = task && challengeRules(task).map(rule => rule.key);
    if (!task || attempt.rubric_version !== task.rubric || attempt.max_score !== challengeMaxScore(task) ||
        first.max_score !== attempt.max_score || !Array.isArray(first.cases) || first.cases.length !== task.cases.length ||
        first.cases.some(row => keys.some(key => typeof row?.checks?.[key] !== "boolean")) ||
        first.cases.reduce((sum, row) => sum + keys.filter(key => row.checks[key]).length, 0) !== attempt.score) {
      reject("challenge_rubric_or_case_score_mismatch"); continue;
    }
    assessments.push(attempt);
  }
  const result = assessmentSamples(sessions, assessments, { schema: RESEARCH_SCHEMA });
  const participantCount = values => new Set(values).size;
  const taskAttempts = attempts.filter(a => a.task_id === taskId);
  const prerequisite = CHALLENGES.find(task => task.id === taskId)?.prerequisite;
  const total = participantCount(sessions.map(s => s.student_id));
  const submitted = participantCount(taskAttempts.filter(a => a.status === "scored").map(a => a.student_id));
  return { ...result, excluded: [...excluded, ...result.excluded], task_id: taskId,
    participation: { developer_sessions_excluded: developerSessions.length, participants_in_exports: total,
      participants_completed_prerequisite: participantCount(sessions.filter(s => s.quest_attempts?.some(a => a.quest_key === prerequisite && a.completed)).map(s => s.student_id)),
      participants_opened_task: participantCount(taskAttempts.map(a => a.student_id)),
      participants_never_opened_task: total - participantCount(taskAttempts.map(a => a.student_id)),
      participants_submitted: submitted, participants_without_submission: total - submitted,
      participants_with_usable_first_score: participantCount(result.samples.map(s => s.student_id)),
      unfinished_attempts: taskAttempts.filter(a => a.status !== "scored").length },
    target: "First submission score on a fixed in-game programming task; not a validated general programming-skill measure" };
}
