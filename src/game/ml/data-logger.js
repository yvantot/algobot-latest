// Data Logger — Session-level data collection and export for ML training pipeline.
// Captures complete gameplay sessions with dual-layer logging:
// 1. Raw event stream (immutable, for future re-processing)
// 2. Engineered feature snapshots (periodic, can be regenerated from raw)
//
// Supports JSON and CSV export with dataset versioning.

import { telemetry } from "./telemetry.js";
import { mlAgent } from "./agent.js";

class DataLogger {
  constructor() {
    this.storageKey = "algobot_sessions";
    this.rawStorageKey = "algobot_raw_sessions";
    this.datasetVersion = "v1";
  }

  // --- Session Export ---

  /**
   * Builds a complete session export object from current telemetry state.
   * Call this at session end (beforeunload) or on manual export.
   */
  buildSessionExport() {
    const summary = telemetry.getSessionSummary();
    const questAttempts = telemetry.getQuestAttempts();
    const featureSnapshots = telemetry.getFeatureSnapshots();
    const ddaLog = telemetry.getDDALog();
    const rawEvents = telemetry.getRawEvents();
    const agentState = mlAgent.getAgentState();
    const replayBuffer = mlAgent.getReplayBuffer();

    return {
      // Metadata
      dataset_version: this.datasetVersion,
      export_date: new Date().toISOString(),
      feature_schema_version: "10f",
      label_formula: "0.40*completion + 0.25*(1-errors) + 0.20*(1-resets) + 0.15*(1-hints)",

      // Session identity
      student_id: summary.participantId,
      session_id: summary.sessionId,
      start_time: summary.startTime,
      duration_minutes: summary.durationMinutes,
      editor_mode_primary: summary.editorMode,
      dda_mode: agentState.mode,

      // Quest attempts with proficiency labels
      quest_attempts: Object.entries(questAttempts).map(([key, attempt]) => ({
        quest_key: key,
        stage: attempt.stage || telemetry.currentStage,
        start_time: attempt.startTime ? new Date(attempt.startTime).toISOString() : null,
        end_time: attempt.endTime ? new Date(attempt.endTime).toISOString() : null,
        duration_seconds: attempt.durationSeconds || 0,
        completed: attempt.completed,
        errors: attempt.errors,
        resets: attempt.resets,
        code_runs: attempt.codeRuns,
        hints_shown: attempt.hintsShown,
        dda_action: attempt.ddaAction || 0,
        feature_vector_start: attempt.featureVectorAtStart || [],
        feature_vector_end: attempt.featureVectorAtEnd || [],
        proficiency_label: attempt.proficiencyLabel || null,
      })),

      // Feature time series (for LSTM training)
      feature_timeseries: featureSnapshots,

      // DDA action log
      dda_log: ddaLog,

      // DQN experience tuples (for offline DQN training)
      replay_buffer: replayBuffer,

      // Raw event stream (immutable — for future re-processing)
      raw_events: rawEvents,

      // Session summary statistics
      summary: {
        total_quests_attempted: Object.keys(questAttempts).length,
        total_quests_completed: Object.values(questAttempts).filter(a => a.completed).length,
        total_errors: summary.totalErrors,
        total_resets: summary.totalResets,
        total_code_runs: summary.totalCodeRuns,
        code_run_success_rate: summary.codeRunSuccessRate,
        total_hints_shown: summary.totalHintsShown,
        max_stage_reached: summary.currentStage,
        avg_frustration: summary.avgFrustration,
        avg_flow: summary.avgFlow,
        total_interpreter_steps: summary.totalSteps,
        replay_buffer_size: replayBuffer.length,
        agent_episode_count: agentState.episodeCount,
      },
    };
  }

  // --- Persistence ---

  /**
   * Save current session to localStorage (lightweight — no raw events).
   * Used by beforeunload handler for automatic persistence.
   */
  saveSessionLight() {
    try {
      const sessionData = {
        summary: telemetry.getSessionSummary(),
        questAttempts: telemetry.getQuestAttempts(),
        featureSnapshots: telemetry.getFeatureSnapshots(),
        ddaLog: telemetry.getDDALog(),
        rawEventCount: telemetry.getRawEvents().length,
        agentState: mlAgent.getAgentState(),
      };
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      stored.push(sessionData);
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
      return true;
    } catch (e) {
      console.warn("Failed to save session data:", e);
      return false;
    }
  }

  /**
   * Get count of stored sessions.
   */
  getSessionCount() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      return stored.length;
    } catch {
      return 0;
    }
  }

  // --- Export: JSON ---

  /**
   * Export all stored sessions as a downloadable JSON file.
   * Includes the current active session.
   */
  exportAllSessionsJSON() {
    const currentSession = this.buildSessionExport();
    const storedSessions = JSON.parse(localStorage.getItem(this.storageKey) || "[]");

    const exportData = {
      dataset_version: this.datasetVersion,
      export_date: new Date().toISOString(),
      participant_count: new Set([
        currentSession.student_id,
        ...storedSessions.map(s => s.summary?.participantId || "unknown"),
      ]).size,
      session_count: storedSessions.length + 1,
      feature_schema_version: "10f",
      label_formula: currentSession.label_formula,
      sessions: [...storedSessions, currentSession],
    };

    this._downloadFile(
      JSON.stringify(exportData, null, 2),
      `algobot_dataset_${this.datasetVersion}_${Date.now()}.json`,
      "application/json"
    );
  }

  // --- Export: CSV (flattened quest attempts) ---

  /**
   * Export quest attempts as a flattened CSV for Python preprocessing.
   * Each row = one quest attempt with features and proficiency label.
   */
  exportQuestCSV() {
    const currentSession = this.buildSessionExport();
    const storedSessions = JSON.parse(localStorage.getItem(this.storageKey) || "[]");

    // CSV header
    const headers = [
      "student_id", "session_id", "quest_key", "stage",
      "duration_seconds", "completed", "errors", "resets",
      "code_runs", "hints_shown", "dda_action", "dda_mode",
      "proficiency_label",
      "f0_error_rate", "f1_exec_speed", "f2_iteration_usage",
      "f3_condition_reactivity", "f4_greedy_efficiency", "f5_yield_quality",
      "f6_frustration", "f7_code_success_rate", "f8_hint_rate", "f9_completion_time",
    ];

    const rows = [headers.join(",")];

    // Process current session
    for (const qa of currentSession.quest_attempts) {
      const fv = qa.feature_vector_end || new Array(10).fill(0);
      rows.push([
        currentSession.student_id,
        currentSession.session_id,
        qa.quest_key,
        qa.stage,
        qa.duration_seconds.toFixed(1),
        qa.completed ? 1 : 0,
        qa.errors,
        qa.resets,
        qa.code_runs,
        qa.hints_shown,
        qa.dda_action,
        currentSession.dda_mode,
        qa.proficiency_label ?? "",
        ...fv.map(v => (typeof v === "number" ? v.toFixed(4) : "0")),
      ].join(","));
    }

    // Process stored sessions (limited data — may not have full quest attempt details)
    for (const session of storedSessions) {
      if (session.questAttempts) {
        for (const [key, qa] of Object.entries(session.questAttempts)) {
          const fv = qa.featureVectorAtEnd || new Array(10).fill(0);
          rows.push([
            session.summary?.participantId || "unknown",
            session.summary?.sessionId || "unknown",
            key,
            qa.stage || 1,
            (qa.durationSeconds || 0).toFixed(1),
            qa.completed ? 1 : 0,
            qa.errors || 0,
            qa.resets || 0,
            qa.codeRuns || 0,
            qa.hintsShown || 0,
            qa.ddaAction || 0,
            "bootstrap",
            qa.proficiencyLabel ?? "",
            ...fv.map(v => (typeof v === "number" ? v.toFixed(4) : "0")),
          ].join(","));
        }
      }
    }

    this._downloadFile(
      rows.join("\n"),
      `algobot_quests_${this.datasetVersion}_${Date.now()}.csv`,
      "text/csv"
    );
  }

  // --- Export: Replay Buffer (for offline DQN training) ---

  exportReplayBufferJSON() {
    const buffer = mlAgent.getReplayBuffer();
    this._downloadFile(
      JSON.stringify(buffer, null, 2),
      `algobot_replay_buffer_${Date.now()}.json`,
      "application/json"
    );
  }

  // --- Clear ---

  clearAllData() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.rawStorageKey);
    localStorage.removeItem("algobot_replay_buffer");
    console.log("🗑️ All stored session data cleared");
  }

  // --- Utility ---

  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const dataLogger = new DataLogger();
