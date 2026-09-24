// Canonical session persistence/export. Legacy lightweight records are preserved
// and marked incomplete: missing raw events and timestamps cannot be recovered.
import { telemetry } from "./telemetry.js";
import { mlAgent } from "./agent.js";
import { FEATURE_NAMES } from "./model-input.js";
import { COLLECTION_INTERVAL_MS } from "./collection.js";
import { inspectCollection } from "./collection-quality.js";
import { sealDataset } from "./export-integrity.js";
import { RESEARCH_SCHEMA, RESEARCH_FEATURES } from "./research-features.js";
import { clearParticipant } from "./participant.js";
import { CHALLENGE_STORAGE } from "../challenges/catalog.js";

const LABEL_FORMULA = "0.40*completion + 0.25*(1-min(1,errors/10)) + 0.20*(1-min(1,resets/5)) + 0.15*(1-min(1,hints/5))";
const toISO = value => value ? new Date(value).toISOString() : null;

function exportAttempt(key, attempt, fallbackStage, observedAt = null, ended = false) {
  return {
    quest_key: key,
    stage: attempt.stage ?? fallbackStage,
    start_time: toISO(attempt.startTime),
    end_time: toISO(attempt.endTime),
    start_time_inferred: attempt.startTimeInferred ?? false,
    duration_seconds: attempt.durationSeconds ?? 0,
    completed: Boolean(attempt.completed),
    observation_status: attempt.completed ? "completed" : ended ? "censored_at_session_end" : "in_progress",
    observed_until: toISO(attempt.endTime ?? observedAt),
    observed_duration_seconds: attempt.startTime && observedAt
      ? Math.max(0, ((attempt.endTime ?? observedAt) - attempt.startTime) / 1000) : null,
    context_at_start: attempt.contextAtStart ?? null,
    errors: attempt.errors ?? 0,
    resets: attempt.resets ?? 0,
    code_runs: attempt.codeRuns ?? 0,
    hints_shown: attempt.hintsShown ?? 0,
    dda_action: attempt.ddaAction ?? 0,
    feature_vector_start: attempt.featureVectorAtStart ?? [],
    feature_vector_end: attempt.featureVectorAtEnd ?? [],
    proficiency_label: attempt.proficiencyLabel ?? null,
  };
}

export function normalizeStoredSession(session) {
  if (session.session_id && Array.isArray(session.quest_attempts)) return structuredClone(session);
  const summary = session.summary || {};
  return {
    dataset_version: "v1",
    feature_schema_version: "10f",
    telemetry_revision: "legacy",
    label_formula: LABEL_FORMULA,
    student_id: summary.participantId ?? "unknown",
    session_id: summary.sessionId ?? null,
    start_time: summary.startTime ?? null,
    duration_minutes: summary.durationMinutes ?? 0,
    editor_mode_primary: summary.editorMode ?? "unknown",
    dda_mode: session.agentState?.mode ?? "unknown",
    quest_attempts: Object.entries(session.questAttempts || {}).map(([key, attempt]) =>
      exportAttempt(key, attempt, summary.currentStage ?? 1)),
    feature_timeseries: structuredClone(session.featureSnapshots || []),
    dda_log: structuredClone(session.ddaLog || []),
    replay_buffer: [],
    raw_events: [],
    data_quality: {
      legacy_lightweight_record: true,
      raw_events_available: false,
      recorded_raw_event_count: session.rawEventCount ?? null,
      timestamps_available: false,
    },
    summary: structuredClone(summary),
  };
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  // Participant IDs and other strings must not become executable spreadsheet formulas.
  if (typeof value === "string" && /^[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export class DataLogger {
  constructor() {
    this.storageKey = "algobot_sessions";
    this.rawStorageKey = "algobot_raw_sessions";
    this.datasetVersion = "v4";
    this.clearedSessionIds = new Set();
    this.lastPersistenceError = null;
    // A failed save must survive a return to the menu and the next telemetry
    // reset. Keep immutable per-session snapshots in memory until persistence
    // succeeds or the user explicitly clears research data.
    this.pendingSessions = new Map();
  }

  buildSessionExport() {
    const summary = telemetry.getSessionSummary();
    const attempts = telemetry.getQuestAttempts();
    const agentState = mlAgent.getAgentState();
    const session = {
      dataset_version: this.datasetVersion,
      export_date: new Date().toISOString(),
      feature_schema_version: "10f",
      telemetry_revision: "v4-recent-counters",
      build: typeof __BUILD_PROVENANCE__ === "undefined" ? { commit: "unknown", dirty: null } : __BUILD_PROVENANCE__,
      research_features: { schema: RESEARCH_SCHEMA, names: RESEARCH_FEATURES, snapshots_required: 21 },
      source_type: telemetry.researchExclusionReasons.length ? "developer_test" : "recorded",
      research_exclusion_reasons: [...telemetry.researchExclusionReasons],
      feature_names: FEATURE_NAMES,
      collection: { interval_ms: COLLECTION_INTERVAL_MS, independent_of_inference: telemetry.collectionEnabled,
        browser_timer_not_exact: true, participant_id_source: telemetry.participantIdSource },
      end_time: toISO(telemetry.sessionEndTime),
      introduction_version: summary.introductionVersion,
      label_formula: LABEL_FORMULA,
      label_interpretation: "Gameplay heuristic; not an independent algorithmic-logic assessment",
      student_id: summary.participantId,
      session_id: summary.sessionId,
      start_time: summary.startTime,
      duration_minutes: summary.durationMinutes,
      editor_mode_primary: summary.editorMode,
      dda_mode: agentState.mode,
      agent_state: agentState,
      quest_attempts: Object.entries(attempts).map(([key, attempt]) => exportAttempt(key, attempt, summary.currentStage,
        telemetry.sessionEndTime ?? Date.now(), telemetry.sessionEndTime !== null)),
      feature_timeseries: telemetry.getFeatureSnapshots(),
      dda_log: telemetry.getDDALog(),
      raw_events: telemetry.getRawEvents(),
      challenge_attempts: structuredClone(telemetry.challengeAttempts),
      data_quality: { legacy_lightweight_record: false, raw_events_available: true, timestamps_available: true },
      summary: {
        total_quests_attempted: Object.keys(attempts).length,
        total_quests_completed: Object.values(attempts).filter(attempt => attempt.completed).length,
        total_errors: summary.totalErrors,
        total_resets: summary.totalResets,
        total_code_runs: summary.totalCodeRuns,
        code_run_success_rate: summary.codeRunSuccessRate,
        total_hints_shown: summary.totalHintsShown,
        max_stage_reached: summary.maxStageReached,
        avg_frustration: summary.avgFrustration,
        avg_flow: summary.avgFlow,
        emotion_sample_count: summary.emotionSampleCount,
        total_interpreter_steps: summary.totalSteps,
        agent_episode_count: agentState.episodeCount,
      },
    };
    session.data_quality.collection_audit = inspectCollection(session);
    return session;
  }

  _readStoredSessions() {
    const stored = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
    if (!Array.isArray(stored) || stored.some(session => !session || typeof session !== "object")) {
      throw new Error("Saved session data is malformed; existing storage was preserved");
    }
    return stored;
  }

  // Kept for existing callers; now saves the complete canonical record and upserts
  // by session ID so periodic, unload and return-to-menu saves do not duplicate it.
  saveSessionLight() {
    if (this.clearedSessionIds.has(telemetry.sessionId)) return true;
    try {
      const current = this.buildSessionExport();
      this.pendingSessions.set(current.session_id, structuredClone(current));
      const stored = this._readStoredSessions();
      for (const pending of this.pendingSessions.values()) {
        const index = stored.findIndex(session => (session.session_id ?? session.summary?.sessionId) === pending.session_id);
        if (index < 0) stored.push(pending);
        else stored[index] = pending;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
      this.pendingSessions.clear();
      this.lastPersistenceError = null;
      return true;
    } catch (error) {
      this.lastPersistenceError = error.message;
      console.warn("Failed to save complete research session; export before closing:", error);
      return false;
    }
  }

  getSessionCount() {
    const ids = new Set(this.pendingSessions.keys());
    try {
      const sessions = this._readStoredSessions();
      sessions.forEach((session, index) => ids.add(session.session_id ?? session.summary?.sessionId ?? `legacy-${index}`));
    } catch { /* Failed saves still remain available in pendingSessions. */ }
    return ids.size;
  }

  buildDatasetExport() {
    const current = this.buildSessionExport();
    const sessions = new Map();
    const storageErrors = [];
    const unconvertedRecords = [];
    let unparsedStoredSessions = null;
    try {
      this._readStoredSessions().forEach((stored, index) => {
        try {
          const session = normalizeStoredSession(stored);
          sessions.set(session.session_id ?? `legacy-${index}`, session);
        } catch (error) {
          unconvertedRecords.push(stored);
          storageErrors.push(`Stored record ${index}: ${error.message}`);
        }
      });
    } catch (error) {
      storageErrors.push(error.message);
      // Preserve the original storage bytes inside the JSON download when they
      // can still be read. Never overwrite corrupt storage during recovery.
      try { unparsedStoredSessions = localStorage.getItem(this.storageKey); } catch { /* Storage access denied. */ }
    }
    if (storageErrors.length) this.lastPersistenceError = storageErrors.join("; ");
    for (const pending of this.pendingSessions.values()) {
      sessions.set(pending.session_id, structuredClone(pending));
    }
    if (!this.clearedSessionIds.has(current.session_id)) sessions.set(current.session_id, current);
    const records = [...sessions.values()];
    return {
      dataset_version: this.datasetVersion,
      export_date: new Date().toISOString(),
      participant_count: new Set(records.map(session => session.student_id)).size,
      session_count: records.length,
      feature_schema_version: "10f",
      label_formula: LABEL_FORMULA,
      data_quality: {
        stored_sessions_fully_readable: storageErrors.length === 0,
        storage_read_errors: storageErrors,
        pending_unpersisted_session_count: this.pendingSessions.size,
      },
      ...(unparsedStoredSessions !== null ? { unparsed_stored_sessions_backup: unparsedStoredSessions } : {}),
      ...(unconvertedRecords.length ? { unconverted_stored_records: unconvertedRecords } : {}),
      sessions: records,
    };
  }

  async exportAllSessionsJSON() {
    const dataset = await sealDataset(this.buildDatasetExport());
    this._downloadFile(JSON.stringify(dataset, null, 2),
      `algobot_dataset_${this.datasetVersion}_${Date.now()}.json`, "application/json");
    return `${dataset.session_count} sessions exported in one JSON file`;
  }

  buildQuestCSV() {
    const headers = [
      "student_id", "session_id", "quest_key", "stage", "duration_seconds", "completed", "errors", "resets",
      "code_runs", "hints_shown", "dda_action", "dda_mode", "proficiency_label", "f0_error_rate", "f1_exec_speed",
      "f2_iteration_usage", "f3_condition_reactivity", "f4_greedy_efficiency", "f5_yield_quality", "f6_frustration",
      "f7_code_success_rate", "f8_hint_rate", "f9_completion_time",
    ];
    const rows = [headers];
    for (const session of this.buildDatasetExport().sessions) {
      for (const attempt of session.quest_attempts) {
        const features = Array.from({ length: 10 }, (_, i) => {
          const value = attempt.feature_vector_end?.[i];
          return Number.isFinite(value) ? value.toFixed(4) : "";
        });
        rows.push([
          session.student_id, session.session_id, attempt.quest_key, attempt.stage,
          Number(attempt.duration_seconds ?? 0).toFixed(1), attempt.completed ? 1 : 0,
          attempt.errors, attempt.resets, attempt.code_runs, attempt.hints_shown, attempt.dda_action,
          session.dda_mode, attempt.proficiency_label ?? "", ...features,
        ]);
      }
    }
    return rows.map(row => row.map(csvCell).join(",")).join("\n");
  }

  exportQuestCSV() {
    this._downloadFile(this.buildQuestCSV(), `algobot_quests_${this.datasetVersion}_${Date.now()}.csv`, "text/csv");
  }

  exportReplayBufferJSON() {
    this._downloadFile(JSON.stringify(mlAgent.getReplayBuffer(), null, 2),
      `algobot_replay_buffer_${Date.now()}.json`, "application/json");
  }

  clearAllData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.rawStorageKey);
    localStorage.removeItem("algobot_replay_buffer");
    localStorage.removeItem(CHALLENGE_STORAGE);
    clearParticipant(localStorage);
    this.pendingSessions.clear();
    this.clearedSessionIds.add(telemetry.sessionId);
    mlAgent.replayBuffer = [];
    mlAgent.prevState = null;
    mlAgent.prevAction = null;
    mlAgent.pendingCompletionReward = 0;
    return "Research data and participant ID cleared. Reload to start with a new participant.";
  }

  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export const dataLogger = new DataLogger();
