// Telemetry Collection Module for CS1 Logic Wall & DDA Research
// Tracks student behavior metrics across the 5 CS1 Curriculum Milestones:
// 1. Sequential Algorithm (order & step execution)
// 2. Conditional Algorithm (if-else state reactivity)
// 3. Looping (Iteration efficiency)
// 4. Greedy Algorithm (priority harvest & decision choice)
// 5. Dynamic Programming / State Optimization (future planning & event response)

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

    // Telemetry Buffer for RNN Model (Sliding Window of Feature Vectors)
    this.historyBuffer = [];
    this.bufferMaxSize = 20;

    // Computed Scores (0.0 to 1.0)
    this.frustrationScore = 0.0;
    this.flowScore = 0.5;
    this.currentStage = CS1_STAGES.SEQUENTIAL;
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
  }

  recordOrderError(type) {
    this.sequentialOrderErrors++;
    this.errorCount++;
    this.updateEmotionScores();
  }

  // --- Stage 2 Tracking ---
  recordIfCondition(evaluatedResult) {
    this.ifEvaluations++;
    if (evaluatedResult) {
      this.ifTrueBranches++;
    } else {
      this.ifFalseBranches++;
    }
  }

  recordCheckBeforeAction() {
    this.checkBeforeActionCount++;
  }

  // --- Stage 3 Tracking ---
  recordLoopExecution(type) {
    if (type === "for") this.forLoopExecutions++;
    if (type === "while") this.whileLoopExecutions++;
  }

  recordRedundantCommand() {
    this.unrolledRedundantActions++;
  }

  // --- Stage 4 Tracking ---
  recordGreedyChoice(isOptimal) {
    if (isOptimal) {
      this.optimalHarvestChoices++;
    } else {
      this.suboptimalHarvestChoices++;
    }
  }

  // --- Stage 5 Tracking ---
  recordEventResponse(responseTimeMs) {
    this.eventResponseTimes.push(responseTimeMs);
  }

  recordCropHarvestOutcome(isSpoiled) {
    if (isSpoiled) {
      this.cropsSpoiled++;
    } else {
      this.cropsHarvestedFresh++;
    }
    this.updateEmotionScores();
  }

  recordInterpreterStep() {
    this.totalInterpreterSteps++;
  }

  recordCodeReset() {
    this.resetCount++;
    this.updateEmotionScores();
  }

  recordCodeEdit() {
    this.codeEditsCount++;
  }

  recordError(errorMessage = "") {
    this.errorCount++;
    this.updateEmotionScores();
  }

  setStage(stage) {
    this.currentStage = stage;
  }

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

  // Extract temporal feature vector X_t for the RNN Proficiency Encoder (7 features)
  getFeatureVector() {
    const elapsedMinutes = Math.max(0.1, (Date.now() - this.startTime) / 60000);
    const stepsPerMin = this.totalInterpreterSteps / elapsedMinutes;
    const totalHarvests = Math.max(1, this.cropsHarvestedFresh + this.cropsSpoiled);

    return [
      Math.min(1.0, this.errorCount / 10),                            // Feature 0: Error Rate
      Math.min(1.0, stepsPerMin / 200),                              // Feature 1: Execution Speed
      Math.min(1.0, (this.forLoopExecutions + this.whileLoopExecutions) / 5), // Feature 2: Iteration Usage
      Math.min(1.0, this.ifEvaluations / 10),                         // Feature 3: Condition Reactivity
      Math.min(1.0, this.optimalHarvestChoices / totalHarvests),       // Feature 4: Greedy Priority Efficiency
      Math.min(1.0, this.cropsHarvestedFresh / totalHarvests),         // Feature 5: Yield Quality Ratio
      this.frustrationScore,                                          // Feature 6: Frustration Indicator
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

  // Returns array of shape [1, bufferMaxSize, 7] padded if buffer is shorter
  getLSTMInputTensor() {
    const sequence = [...this.historyBuffer];
    while (sequence.length < this.bufferMaxSize) {
      sequence.unshift([0, 0, 0, 0, 0, 0, 0]); // zero-pad start
    }
    return sequence;
  }
}

export const telemetry = new TelemetryTracker();
