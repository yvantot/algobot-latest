// Browser LSTM proficiency estimates with an explicit rule-based difficulty policy.
// Missing/incompatible models or scaler use the explicit deterministic fallback.
import * as tf from "@tensorflow/tfjs";
import { telemetry } from "./telemetry.js";
import { dda, DDA_ACTIONS } from "./dda.js";
import { recentPolicyState, StableDifficultyPolicy } from "./recent-policy.js";
import { FEATURE_COUNT, SEQUENCE_LENGTH, validateScaler, normalizeSequence } from "./model-input.js";
import { RESEARCH_SCHEMA, recentSequence, validateResearchScaler, scaleResearchSequence } from "./research-features.js";


function validateModel(model, inputShape, outputSize) {
  if (model.inputs?.length !== 1 || model.outputs?.length !== 1 ||
      JSON.stringify(model.inputs[0].shape.slice(1)) !== JSON.stringify(inputShape) ||
      model.outputs[0].shape.length !== 2 || model.outputs[0].shape[1] !== outputSize) {
    throw new Error("Pretrained model shape does not match the runtime feature/action schema");
  }
}

function validExperience(exp) {
  return exp && [exp.state, exp.nextState].every(state =>
    Array.isArray(state) && state.length === 4 && state.every(Number.isFinite)) &&
    Number.isInteger(exp.action) && exp.action >= 0 && exp.action < 5 &&
    Number.isFinite(exp.reward) && typeof exp.done === "boolean";
}

export class MLDiffAgent {
  constructor({ loadModel = path => tf.loadLayersModel(path, { requestInit: { cache: "no-store" } }), loadScaler = async () => {
    const response = await fetch("/models/lstm/scaler_params.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`LSTM scaler unavailable (${response.status})`);
    return response.json();
  } } = {}) {
    this._loadModel = loadModel;
    this._loadScaler = loadScaler;
    this.isInitialized = false;
    this._initPromise = null;
    this._updatePromise = null;
    this.lstmModel = null;
    this.scaler = null;
    this.mode = "bootstrap";
    this.pretrainedLSTM = false;
    this.fallbackReason = null;
    this.replayBuffer = [];
    this.replayBufferMax = 500;
    this._sessionGeneration = 0;
    this.resetSession();
  }

  resetSession() {
    this.difficultyPolicy = new StableDifficultyPolicy();
    this._sessionGeneration++;
    this._sessionEnded = false;
    this.sessionId = telemetry.getSessionId();
    this.episodeCount = 0;
    this.prevState = null;
    this.prevAction = null;
    this.prevMode = null;
    this.pendingCompletionReward = 0;
    this.predictedProficiency = null;
    this.predictionAvailable = false;
    this.observationReason = null;
    this.lastAction = DDA_ACTIONS.NORMAL;
    dda.applyAction(DDA_ACTIONS.NORMAL);
  }

  async init() {
    if (this.isInitialized) return;
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    const failures = [];
    try {
      const scaler = await this._loadScaler();
      this.scaler = scaler?.feature_schema === RESEARCH_SCHEMA ? validateResearchScaler(scaler) : validateScaler(scaler);
    } catch (error) { failures.push(`Scaler: ${error.message}`); }
    try {
      const revision = this.scaler?.model_id ? `?v=${encodeURIComponent(this.scaler.model_id)}` : "";
      this.lstmModel = await this._loadModel(`/models/lstm/model.json${revision}`);
      validateModel(this.lstmModel, [SEQUENCE_LENGTH, this.scaler?.feature_schema === RESEARCH_SCHEMA ? 12 : FEATURE_COUNT], 1);
      this.pretrainedLSTM = true;
    } catch (error) {
      this.lstmModel?.dispose();
      this.lstmModel = null;
      failures.push(`LSTM: ${error.message}`);
    }
    this.mode = this.pretrainedLSTM && this.scaler
      ? "hybrid"
      : "bootstrap";
    this.fallbackReason = failures.join("; ") || null;
    this._loadReplayBuffer();
    this.isInitialized = true;
    if (this.fallbackReason) console.warn(`DDA operating in ${this.mode} mode:`, this.fallbackReason);
  }

  // Coalesce overlapping updates so async inference cannot apply stale actions
  // out of order, double-sample telemetry, or interleave replay transitions.
  async updateAndPredict(stage = telemetry.currentStage) {
    if (this._sessionEnded) return null;
    if (this._updatePromise) return this._updatePromise;
    const generation = this._sessionGeneration;
    this._updatePromise = this._predict(stage, generation);
    try {
      return await this._updatePromise;
    } finally {
      this._updatePromise = null;
    }
  }

  async _predict(stage, generation) {
    await this.init();
    if (generation !== this._sessionGeneration || this._sessionEnded || !this._isGameplay()) return null;
    const safeStage = Number.isInteger(stage) && stage >= 1 && stage <= 5 ? stage : telemetry.currentStage;
    telemetry.sampleHistory();
    try {
      if (this.mode === "hybrid") return await this._mlUpdate(safeStage, generation);
    } catch (error) {
      if (generation !== this._sessionGeneration || this._sessionEnded || !this._isGameplay()) return null;
      this.mode = "bootstrap";
      this.fallbackReason = `Inference: ${error.message}`;
      console.warn("DDA inference failed; applying bootstrap fallback:", error);
    }
    return this._bootstrapUpdate(safeStage);
  }

  _bootstrapUpdate(stage) {
    this.predictionAvailable = false;
    this.predictedProficiency = null;
    const action = this._chooseAction(stage, null);
    const state = [0.5, stage / 5, telemetry.frustrationScore, telemetry.flowScore];
    this._applyDecision(state, action, stage);
    return { proficiency: null, action, mode: "bootstrap", fallbackReason: this.fallbackReason };
  }

  _isGameplay() {
    // Inference can finish after the player has opened an isolated challenge.
    const context=telemetry.getCollectionContext?.();
    return !context || (context.phase === "gameplay" && context.game_speed > 0);
  }

  async _predictValues(model, values, shape) {
    let input;
    let prediction;
    try {
      input = tf.tensor(values, shape);
      prediction = model.predict(input);
      if (Array.isArray(prediction)) throw new Error("Expected a single model output");
      const output = Array.from(await prediction.data());
      if (output.some(value => !Number.isFinite(value))) throw new Error("Model returned non-finite values");
      return output;
    } finally {
      tf.dispose([input, prediction].filter(Boolean));
    }
  }

  async _mlUpdate(stage, generation) {
    let sequence;
    if (this.scaler.feature_schema === RESEARCH_SCHEMA) {
      try {
        const snapshots = telemetry.getFeatureSnapshots().slice(-21);
        if (!snapshots.length || Date.now() - snapshots.at(-1).timestamp_ms > 7500) throw Error("Waiting for fresh gameplay observations");
        sequence = scaleResearchSequence(recentSequence(snapshots), this.scaler);
        this.observationReason = null;
      } catch (error) {
        this.observationReason = error.message;
        return { ...this._bootstrapUpdate(stage), observationReason: this.observationReason };
      }
    } else sequence = normalizeSequence(telemetry.getLSTMInputTensor(), this.scaler);
    // Keep decision diagnostics from the same observation as the LSTM input, even if
    // gameplay progresses while the GPU/backend resolves prediction.data().
    const frustration = telemetry.frustrationScore;
    const flow = telemetry.flowScore;
    const proficiencyValues = await this._predictValues(this.lstmModel, [sequence], [1, SEQUENCE_LENGTH, sequence[0].length]);
    if (proficiencyValues.length !== 1 || proficiencyValues[0] < 0 || proficiencyValues[0] > 1) {
      throw new Error("LSTM proficiency must be a scalar in [0, 1]");
    }
    const proficiency = proficiencyValues[0];
    const state = [proficiency, stage / 5, frustration, flow];
    if (generation !== this._sessionGeneration || this._sessionEnded || !this._isGameplay()) return null;
    this.predictedProficiency = proficiency;
    this.predictionAvailable = true;
    const action = this._chooseAction(stage, proficiency);
    this._applyDecision(state, action, stage);
    return { proficiency, action, mode: "hybrid", policySource: "rules", proficiencySource: "lstm" };
  }

  _chooseAction(stage, proficiency) {
    const now = Date.now() - telemetry.sessionStartTime;
    this.recentPerformance = recentPolicyState(telemetry.rawEvents, now);
    return this.difficultyPolicy.decide(this.recentPerformance, stage, proficiency, now);
  }

  _applyDecision(state, action, stage) {
    this.lastAction = action;
    dda.applyAction(action, stage);
    telemetry.recordDDAAction(action, stage, {
      mode: this.mode,
      policySource: "rules",
      proficiencySource: this.predictionAvailable ? "lstm" : "unknown",
      proficiency: this.predictionAvailable ? state[0] : null,
      predictionTarget: this.scaler?.feature_schema === RESEARCH_SCHEMA ? "independent_scored_task" : "legacy_gameplay_proxy",
      modelId: this.scaler?.model_id ?? "legacy-lstm",
      modelStatus: this.scaler?.model_status ?? "legacy",
      predictionTask: this.scaler?.task_id ?? null,
      policyVersion: "recent-window-v1",
      recentPerformance: this.recentPerformance,
    });
    // Only record a hint when its presentation is confirmed by the UI.
    this._recordExperience(state, action, stage);
  }

  _recordExperience(currentState, action, stage) {
    this._appendTransition(currentState, false);
    this.prevState = [...currentState];
    this.prevAction = action;
    this.prevMode = this.mode;
  }

  _appendTransition(currentState, done) {
    if (this.prevState === null || this.prevAction === null) return;
    const reward = Math.max(-2, Math.min(2,
      this._computeReward(this.prevState, this.prevAction, currentState) + this.pendingCompletionReward));
    this.pendingCompletionReward = 0;
    this.replayBuffer.push({
      session_id: this.sessionId,
      student_id: telemetry.participantId,
      mode: this.prevMode,
      state: [...this.prevState],
      action: this.prevAction,
      reward: Number(reward.toFixed(4)),
      nextState: [...currentState],
      done,
      stage: Math.round(this.prevState[1] * 5),
      timestamp: Date.now(),
    });
    if (this.replayBuffer.length > this.replayBufferMax) this.replayBuffer.shift();
    this.episodeCount++;
    this._persistReplayBuffer();
  }

  _computeReward(prevState, action, currentState) {
    let reward = (currentState[3] - prevState[3]) * 2 - (currentState[2] - prevState[2]) * 2;
    if (action === DDA_ACTIONS.SCAFFOLD && prevState[0] > 0.7) reward -= 0.5;
    if (action === DDA_ACTIONS.CHALLENGE && prevState[0] < 0.3) reward -= 0.5;
    return Math.max(-2, Math.min(2, reward));
  }

  addQuestCompletionReward() {
    // Completion belongs to the action currently being experienced, not the
    // already-finished transition at the end of the replay buffer.
    if (this.prevState !== null) this.pendingCompletionReward += 1;
  }

  endSession() {
    if (this._sessionEnded) return;
    this._sessionEnded = true;
    this._sessionGeneration++;
    telemetry.updateEmotionScores();
    if (this.prevState) {
      this._appendTransition([
        this.prevState[0], telemetry.currentStage / 5,
        telemetry.frustrationScore, telemetry.flowScore,
      ], true);
    }
    this.prevState = null;
    this.prevAction = null;
    this.pendingCompletionReward = 0;
    this._persistReplayBuffer();
  }

  _persistReplayBuffer() {
    try {
      localStorage.setItem("algobot_replay_buffer", JSON.stringify(this.replayBuffer));
    } catch (error) {
      console.warn("Replay persistence failed; export research data before closing:", error.message);
    }
  }

  _loadReplayBuffer() {
    try {
      const stored = JSON.parse(localStorage.getItem("algobot_replay_buffer") || "[]");
      this.replayBuffer = Array.isArray(stored) ? stored.filter(validExperience).slice(-this.replayBufferMax) : [];
    } catch {
      this.replayBuffer = [];
    }
  }

  getReplayBuffer({ sessionOnly = false } = {}) {
    return structuredClone(sessionOnly
      ? this.replayBuffer.filter(exp => exp.session_id === this.sessionId)
      : this.replayBuffer);
  }

  getAgentState() {
    return {
      mode: this.mode,
      pretrainedLSTM: this.pretrainedLSTM,
      scalerLoaded: Boolean(this.scaler),
      policySource: "rules",
      proficiencySource: this.predictionAvailable ? "lstm" : "unknown",
      observationReason: this.observationReason,
      predictionTarget: this.scaler?.feature_schema === RESEARCH_SCHEMA ? "independent_scored_task" : "legacy_gameplay_proxy",
      modelId: this.scaler?.model_id ?? "legacy-lstm",
      modelStatus: this.scaler?.model_status ?? "legacy",
      predictionTask: this.scaler?.task_id ?? null,
      fallbackReason: this.fallbackReason,
      episodeCount: this.episodeCount,
      replayBufferSize: this.replayBuffer.length,
      predictedProficiency: this.predictedProficiency,
      lastAction: this.lastAction,
    };
  }
}

export const mlAgent = new MLDiffAgent();
