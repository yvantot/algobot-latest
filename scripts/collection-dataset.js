import { challengeSamples } from "../src/game/ml/challenge-quality.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateDataset, makePlan } from "./training-core.js";
import { inspectCollection } from "../src/game/ml/collection-quality.js";
import { ALL_CHALLENGES as CHALLENGES } from "../src/game/challenges/catalog.js";

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
        for (const key of ["started_at", "task_id", "rubric_version", "assessor_id", "crop_profile", "first_exposure"]) {
          if (previous[key] !== current[key]) throw Error(`Conflicting challenge provenance for ${session.session_id}`);
        }
        for (let i = 0; i < Math.min(previous.submissions?.length ?? 0, current.submissions?.length ?? 0); i++) {
          if (JSON.stringify(previous.submissions[i]) !== JSON.stringify(current.submissions[i])) throw Error(`Conflicting challenge submission for ${session.session_id}`);
        }
      }
      if (!old) { sessions.set(session.session_id, session); continue; }
      const a = old.challenge_attempts ?? [], b = session.challenge_attempts ?? [];
      for (let i=0;i<Math.min(a.length,b.length);i++) {
        if(a[i].assessment_id!==b[i].assessment_id) throw Error(`Conflicting challenge order for ${session.session_id}`);
      }
      const extent = s => [s.raw_events?.length ?? 0, s.feature_timeseries?.length ?? 0,
        s.challenge_attempts?.length ?? 0, ...Array.from({length:Math.max(a.length,b.length)},(_,i)=>s.challenge_attempts?.[i]?.submissions?.length ?? 0)];
      const before=extent(old), after=extent(session);
      const extendsOld=after.every((n,i)=>n>=before[i]), extendsNew=before.every((n,i)=>n>=after[i]);
      if(!extendsOld&&!extendsNew) throw Error(`Conflicting incomplete histories for ${session.session_id}; neither export contains the other`);
      const selected=extendsOld&&(!extendsNew||Date.parse(session.export_date)>Date.parse(old.export_date))?session:old;
      // A developer exclusion must never disappear when overlapping files are read.
      const reasons=[...new Set([...(old.research_exclusion_reasons??[]),...(session.research_exclusion_reasons??[])])];
      sessions.set(session.session_id, {...selected,
        ...(old.source_type==="developer_test"||session.source_type==="developer_test"?{source_type:"developer_test"}:{}),
        ...(reasons.length?{research_exclusion_reasons:reasons}:{})});
    }
  }
  return { sessions: [...sessions.values()], source_sha256 };
}

export function summarizeTrainingReadiness(data) {
  const samples = data.samples;
  let compatible = false, canPlan = false, reason = null;
  try { validateDataset(data); compatible = true; makePlan(data); canPlan = true; }
  catch (error) { reason = error.message; }
  const cutoffs = [.3, .6];
  const support = [0, 0, 0];
  for (const sample of samples) support[sample.y < cutoffs[0] ? 0 : sample.y < cutoffs[1] ? 1 : 2]++;
  return {
    usable_samples: samples.length,
    usable_participants: new Set(samples.map(sample => sample.student_id)).size,
    dataset_compatible: compatible,
    can_create_holdout_plan: canPlan,
    blocking_reason: reason,
    normalized_score_counts: Object.fromEntries([...new Set(samples.map(sample => sample.y))].sort((a,b)=>a-b).map(score=>[score,samples.filter(sample=>sample.y===score).length])),
    target_category_support: support, cutoffs, cutoff_status: "provisional",
    constant_features: samples.length ? data.feature_names.filter((_, index) => {
      const first = samples[0].x[0][index];
      return samples.every(sample => sample.x.every(row => row[index] === first));
    }) : [],
    note: "The holdout gate is a software minimum, not evidence of sufficient study size or deployment readiness. Category counts refer to scored targets, not gameplay proxy labels.",
  };
}

export function auditCollection(sessions) {
  const reports = sessions.map(s => ({ session_id: s.session_id, student_id: s.student_id, ...inspectCollection(s) }));
  return { session_count: sessions.length, participant_count: new Set(sessions.map(s => s.student_id)).size,
    build_provenance: {
      dirty_sessions: sessions.filter(session=>session.build?.dirty===true).length,
      sessions_without_version: sessions.filter(session=>!session.build?.version).length,
      sessions_without_source_fingerprint: sessions.filter(session=>!session.build?.source_sha256).length,
      source_fingerprints: [...new Set(sessions.map(session=>session.build?.source_sha256).filter(Boolean))],
      versions: [...new Set(sessions.map(session=>session.build?.version).filter(Boolean))],
      commits: [...new Set(sessions.map(session=>session.build?.commit).filter(Boolean))],
      note: "Dirty or incomplete build metadata limits reproducibility; do not rewrite recorded provenance to match the current build.",
    },
    model_cohorts: [...new Set(sessions.map(s => s.agent_state?.modelId ?? "legacy-or-unidentified"))].map(id => ({
      model_id: id, sessions: sessions.filter(s => (s.agent_state?.modelId ?? "legacy-or-unidentified") === id).length,
      note: "A model change alters collection conditions. Review cohorts before pooling; this field is not a training feature.",
    })),
    proxy_category_support: [0, 1, 2].map(i => reports.reduce((n, r) => n + r.proxy_category_support[i], 0)),
    challenge_targets: CHALLENGES.map(task => {
      const result = challengeSamples(sessions, task.id);
      return { task_id: task.id, title: task.title, ...result.participation, training_readiness: summarizeTrainingReadiness(result), excluded: result.excluded };
    }),
    reports, note: "A clean capture audit does not establish model accuracy or adequate participant diversity." };
}

export { assessmentSamples, challengeSamples } from "../src/game/ml/challenge-quality.js";
