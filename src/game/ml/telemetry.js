// Telemetry Collection Module for CS1 Logic Wall & DDA Research
// Tracks student behavior metrics across the 5 CS1 Curriculum Milestones:
// 1. Sequential Algorithm (order & step execution)
// 2. Conditional Algorithm (if-else state reactivity)
// 3. Looping (Iteration efficiency)
// 4. Greedy Algorithm (priority harvest & decision choice)
// 5. Dynamic Programming / State Optimization (future planning & event response)
//
// Expanded for ML Pipeline: 10-feature vector, raw event stream, quest attempt tracking.

export const CS1_STAGES = {
  SEQUENTIAL: 1,
  CONDITIONAL: 2,
  LOOPING: 3,
  GREEDY: 4,
  STATE_OPTIMIZATION: 5,
};

class TelemetryTracker {
  constructor() {
    this.resetSession();
  }

  resetSession() {
    this.startTime = Date.now();
    this.lastActionTime = Date.now();

    // Session Identity
    this.sessionId = crypto.randomUUID();
    this.sessionStartTime = Date.now();
    this.participantId = "anonymous";

    // Overall Metrics
    this.totalInterpreterSteps = 0;
    this.errorCount = 0;
    this.resetCount = 0;
    this.codeEditsCount = 0;
    this.idleTimeSeconds = 0;
    this.questsCompleted = 0;

    // Stage 1: Sequential Algorithm Metrics
    this.sequentialSequence = []; // tracks action history e.g. ['till', 'plant', 'water', 'harvest']
    this.sequentialCorrectCount = 0;
    this.sequentialOrderErrors = 0;

    // Stage 2: Conditional Algorithm Metrics
    this.ifEvaluations = 0;
    this.ifTrueBranches = 0;
    this.ifFalseBranches = 0;
    this.checkBeforeActionCount = 0; // checked is_harvestable before harvest

    // Stage 3: Looping Metrics
    this.forLoopExecutions = 0;
    this.whileLoopExecutions = 0;
    this.unrolledRedundantActions = 0; // manual repetitive commands instead of a loop

    // Stage 4: Greedy Algorithm Metrics
    this.optimalHarvestChoices = 0; // harvested crop closest to spoilage / highest value
    this.suboptimalHarvestChoices = 0;

    // Stage 5: Dynamic Programming / State Optimization Metrics
    this.eventResponseTimes = []; // ms between bug/fire event and extinguish/kill_bug action
    this.cropsHarvestedFresh = 0;
    this.cropsSpoiled = 0;

    // --- New ML Pipeline Fields ---

    // Code execution tracking (Feature 7: code execution success rate)
    this.codeRunCount = 0;
    this.codeRunSuccessCount = 0;

    // Hint tracking (Feature 8: hint consumption rate)
    this.hintsShown = 0;

    // Editor mode (metadata only, NOT an ML feature)
    this.editorMode = "blockly"; // "blockly" | "text"

    // Quest attempt tracking (for proficiency label generation)
    this.questAttempts = {}; // { questKey: { startTime, errors, resets, codeRuns, hintsShown, completed } }
    this.activeQuestKey = null;

    // DDA action log
    this.ddaActionsLog = []; // [{ timestamp, actionId, stage }]

    // Raw event stream (immutable, for future re-processing)
    this.rawEvents = [];

    // Telemetry Buffer for RNN Model (Sliding Window of Feature Vectors)
    this.historyBuffer = [];
    this.bufferMaxSize = 20;

    // Computed Scores (0.0 to 1.0)
    this.frustrationScore = 0.0;
    this.flowScore = 0.5;
    this.currentStage = CS1_STAGES.SEQUENTIAL;
  }

  // --- Session Management ---

  setParticipantId(id) {
    this.participantId = id;
  }

  getSessionId() {
    return this.sessionId;
  }

  // --- Raw Event Stream ---

  _logRawEvent(type, data = {}) {
    this.rawEvents.push({
      t: Date.now() - this.sessionStartTime,
      event: type,
      ...data,
    });
  }

  // --- Stage 1 Tracking ---
  recordBotAction(actionType) {
    this.lastActionTime = Date.now();
    this.sequentialSequence.push(actionType);
    if (this.sequentialSequence.length > 4) {
      this.sequentialSequence.shift();
    }

    // Check valid sequential farming pipeline: till -> plant -> water -> harvest
    const seqStr = this.sequentialSequence.join("->");
    if (seqStr.includes("till->plant->water->harvest")) {
      this.sequentialCorrectCount++;
    }

    this._logRawEvent("bot_action", { action: actionType });
  }

  recordOrderError(type) {
    this.sequentialOrderErrors++;
    this.errorCount++;
    this._recordQuestError();
    this.updateEmotionScores();
    this._logRawEvent("order_error", { type });
  }

  // --- Stage 2 Tracking ---
  recordIfCondition(evaluatedResult) {
    this.ifEvaluations++;
    if (evaluatedResult) {
      this.ifTrueBranches++;
    } else {
      this.ifFalseBranches++;
    }
    this._logRawEvent("if_condition", { result: evaluatedResult });
  }

  recordCheckBeforeAction() {
    this.checkBeforeActionCount++;
    this._logRawEvent("check_before_action");
  }

  // --- Stage 3 Tracking ---
  recordLoopExecution(type) {
    if (type === "for") this.forLoopExecutions++;
    if (type === "while") this.whileLoopExecutions++;
    this._logRawEvent("loop_execution", { type });
  }

  recordRedundantCommand() {
    this.unrolledRedundantActions++;
    this._logRawEvent("redundant_command");
  }

  // --- Stage 4 Tracking ---
  recordGreedyChoice(isOptimal) {
    if (isOptimal) {
      this.optimalHarvestChoices++;
    } else {
      this.suboptimalHarvestChoices++;
    }
    this._logRawEvent("greedy_choice", { optimal: isOptimal });
  }

  // --- Stage 5 Tracking ---
  recordEventResponse(responseTimeMs) {
    this.eventResponseTimes.push(responseTimeMs);
    this._logRawEvent("event_response", { responseMs: responseTimeMs });
  }

  recordCropHarvestOutcome(isSpoiled) {
    if (isSpoiled) {
      this.cropsSpoiled++;
    } else {
      this.cropsHarvestedFresh++;
    }
    this.updateEmotionScores();
    this._logRawEvent("crop_outcome", { spoiled: isSpoiled });
  }

  recordInterpreterStep() {
    this.totalInterpreterSteps++;
  }

  recordCodeReset() {
    this.resetCount++;
    this._recordQuestReset();
    this.updateEmotionScores();
    this._logRawEvent("code_reset");
  }

  recordCodeEdit() {
    this.codeEditsCount++;
  }

  recordError(errorMessage = "") {
    this.errorCount++;
    this._recordQuestError();
    this.updateEmotionScores();
    this._logRawEvent("error", { message: errorMessage });
  }

  setStage(stage) {
    this.currentStage = stage;
    this._logRawEvent("stage_change", { stage });
  }

  // --- New ML Pipeline Methods ---

  // Code run tracking (Feature 7)
  recordCodeRun(success) {
    this.codeRunCount++;
    if (success) this.codeRunSuccessCount++;
    this._recordQuestCodeRun();
    this._logRawEvent("code_run", { success });
  }

  // Hint tracking (Feature 8)
  recordHintShown(hintText = "") {
    this.hintsShown++;
    this._recordQuestHint();
    this._logRawEvent("hint_shown", { hint: hintText });
  }

  // Editor mode (metadata only)
  recordEditorMode(mode) {
    this.editorMode = mode;
    this._logRawEvent("editor_mode", { mode });
  }

  // DDA action logging
  recordDDAAction(actionId, stage) {
    this.ddaActionsLog.push({
      timestamp: Date.now() - this.sessionStartTime,
      actionId,
      stage,
    });
    this._logRawEvent("dda_action", { actionId, stage });
  }

  // --- Quest Attempt Tracking ---

  recordQuestStart(questKey) {
    if (this.questAttempts[questKey]) return; // Already tracking this quest
    this.questAttempts[questKey] = {
      startTime: Date.now(),
      errors: 0,
      resets: 0,
      codeRuns: 0,
      hintsShown: 0,
      completed: false,
      featureVectorAtStart: this.getFeatureVector(),
    };
    this.activeQuestKey = questKey;
    this._logRawEvent("quest_start", { quest: questKey });
  }

  recordQuestComplete(questKey) {
    if (!this.questAttempts[questKey]) {
      // Quest was completed without being explicitly started — create a retroactive entry
      this.questAttempts[questKey] = {
        startTime: this.sessionStartTime,
        errors: 0,
        resets: 0,
        codeRuns: 0,
        hintsShown: 0,
        completed: false,
        featureVectorAtStart: new Array(10).fill(0),
      };
    }
    const attempt = this.questAttempts[questKey];
    attempt.completed = true;
    attempt.endTime = Date.now();
    attempt.durationSeconds = (attempt.endTime - attempt.startTime) / 1000;
    attempt.featureVectorAtEnd = this.getFeatureVector();
    attempt.proficiencyLabel = this._computeProficiencyLabel(attempt);
    attempt.ddaAction = this.ddaActionsLog.length > 0
      ? this.ddaActionsLog[this.ddaActionsLog.length - 1].actionId
      : 0;
    attempt.stage = this.currentStage;

    this.questsCompleted++;
    this._logRawEvent("quest_complete", { quest: questKey, label: attempt.proficiencyLabel });
  }

  // Internal: accumulate per-quest metrics from session-wide events
  _recordQuestError() {
    if (this.activeQuestKey && this.questAttempts[this.activeQuestKey]) {
      this.questAttempts[this.activeQuestKey].errors++;
    }
  }

  _recordQuestReset() {
    if (this.activeQuestKey && this.questAttempts[this.activeQuestKey]) {
      this.questAttempts[this.activeQuestKey].resets++;
    }
  }

  _recordQuestCodeRun() {
    if (this.activeQuestKey && this.questAttempts[this.activeQuestKey]) {
      this.questAttempts[this.activeQuestKey].codeRuns++;
    }
  }

  _recordQuestHint() {
    if (this.activeQuestKey && this.questAttempts[this.activeQuestKey]) {
      this.questAttempts[this.activeQuestKey].hintsShown++;
    }
  }

  // Proficiency label: 40% completion + 25% (1 - errors) + 20% (1 - resets) + 15% (1 - hints)
  _computeProficiencyLabel(attempt) {
    const completionScore = attempt.completed ? 1.0 : 0.0;
    const errorPenalty = Math.min(1.0, attempt.errors / 10);
    const retryPenalty = Math.min(1.0, attempt.resets / 5);
    const hintPenalty = Math.min(1.0, attempt.hintsShown / 5);

    const label = 0.40 * completionScore
      + 0.25 * (1 - errorPenalty)
      + 0.20 * (1 - retryPenalty)
      + 0.15 * (1 - hintPenalty);

    return Number(label.toFixed(4));
  }

  // --- Emotion Scores ---

  updateEmotionScores() {
    // Frustration increases with frequent errors, rapid resets, and spoiled crops
    const recentErrors = this.errorCount;
    const recentResets = this.resetCount;
    const spoiled = this.cropsSpoiled;
    const totalHarvests = this.cropsHarvestedFresh + spoiled;

    let frustration = 0;
    if (recentErrors > 5) frustration += 0.3;
    if (recentResets > 3) frustration += 0.3;
    if (totalHarvests > 0 && spoiled / totalHarvests > 0.4) frustration += 0.3;

    this.frustrationScore = Math.min(1.0, frustration);

    // Flow score increases with smooth execution and steady quest progress
    let flow = 0.5;
    if (this.sequentialCorrectCount > 2) flow += 0.15;
    if (this.ifEvaluations > 3) flow += 0.15;
    if (this.forLoopExecutions > 1) flow += 0.15;
    if (this.frustrationScore > 0.5) flow -= 0.3;

    this.flowScore = Math.max(0.0, Math.min(1.0, flow));
  }

  // --- Feature Vector (10 features) for LSTM Proficiency Encoder ---

  getFeatureVector() {
    const elapsedMinutes = Math.max(0.1, (Date.now() - this.startTime) / 60000);
    const stepsPerMin = this.totalInterpreterSteps / elapsedMinutes;
    const totalHarvests = Math.max(1, this.cropsHarvestedFresh + this.cropsSpoiled);
    const totalRuns = Math.max(1, this.codeRunCount);

    // Expected completion time per quest stage (seconds) — used for Feature 9 normalization
    const expectedTimeByStage = { 1: 120, 2: 180, 3: 240, 4: 300, 5: 360 };
    const expectedTime = expectedTimeByStage[this.currentStage] || 180;
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;

    return [
      Math.min(1.0, this.errorCount / 10),                                     // Feature 0: Error Rate
      Math.min(1.0, stepsPerMin / 200),                                        // Feature 1: Execution Speed
      Math.min(1.0, (this.forLoopExecutions + this.whileLoopExecutions) / 5),   // Feature 2: Iteration Usage
      Math.min(1.0, this.ifEvaluations / 10),                                  // Feature 3: Condition Reactivity
      Math.min(1.0, this.optimalHarvestChoices / totalHarvests),                // Feature 4: Greedy Priority Efficiency
      Math.min(1.0, this.cropsHarvestedFresh / totalHarvests),                  // Feature 5: Yield Quality Ratio
      this.frustrationScore,                                                    // Feature 6: Frustration Indicator
      Math.min(1.0, this.codeRunSuccessCount / totalRuns),                      // Feature 7: Code Execution Success Rate
      Math.min(1.0, this.hintsShown / 10),                                     // Feature 8: Hint Consumption Rate
      Math.min(1.0, elapsedSeconds / expectedTime),                            // Feature 9: Normalized Completion Time
    ];
  }

  // Sample current snapshot and append to sliding window buffer for LSTM
  sampleHistory() {
    const vector = this.getFeatureVector();
    this.historyBuffer.push(vector);
    if (this.historyBuffer.length > this.bufferMaxSize) {
      this.historyBuffer.shift();
    }
    return this.historyBuffer;
  }

  // Returns array of shape [bufferMaxSize, 10] padded if buffer is shorter
  getLSTMInputTensor() {
    const featureCount = 10;
    const sequence = [...this.historyBuffer];
    while (sequence.length < this.bufferMaxSize) {
      sequence.unshift(new Array(featureCount).fill(0)); // zero-pad start
    }
    return sequence;
  }

  // --- Export Methods (for data-logger.js consumption) ---

  getSessionSummary() {
    return {
      sessionId: this.sessionId,
      participantId: this.participantId,
      startTime: new Date(this.sessionStartTime).toISOString(),
      durationMinutes: Number(((Date.now() - this.sessionStartTime) / 60000).toFixed(2)),
      editorMode: this.editorMode,
      currentStage: this.currentStage,
      totalSteps: this.totalInterpreterSteps,
      totalErrors: this.errorCount,
      totalResets: this.resetCount,
      totalCodeRuns: this.codeRunCount,
      codeRunSuccessRate: this.codeRunCount > 0 ? Number((this.codeRunSuccessCount / this.codeRunCount).toFixed(3)) : 0,
      totalHintsShown: this.hintsShown,
      questsCompleted: this.questsCompleted,
      avgFrustration: Number(this.frustrationScore.toFixed(3)),
      avgFlow: Number(this.flowScore.toFixed(3)),
    };
  }

  getQuestAttempts() {
    return { ...this.questAttempts };
  }

  getRawEvents() {
    return [...this.rawEvents];
  }

  getFeatureSnapshots() {
    return this.historyBuffer.map((vector, i) => ({
      index: i,
      vector: [...vector],
      stage: this.currentStage,
    }));
  }

  getDDALog() {
    return [...this.ddaActionsLog];
  }
}

export const telemetry = new TelemetryTracker();
