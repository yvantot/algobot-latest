// TensorFlow.js In-Browser RNN (LSTM) + Deep Q-Network (DQN) Agent
// Models student proficiency across the 5 CS1 curriculum milestones and selects adaptive DDA actions.
//
// Two operating modes:
// - "bootstrap": Uses Bootstrap DDA (deterministic rules) while collecting experience tuples.
//                 Models exist in memory but are bypassed. No pretrained weights available.
// - "ml":        Uses trained LSTM for proficiency prediction and trained DQN for action selection.
//                 Activates automatically when pretrained models are found at /models/lstm/ and /models/dqn/.

import * as tf from "@tensorflow/tfjs";
import { telemetry } from "./telemetry.js";
import { dda, DDA_ACTIONS } from "./dda.js";
import { computeBootstrapAction } from "./dda-bootstrap.js";

// Feature dimensions (must match telemetry.js getFeatureVector output)
const FEATURE_COUNT = 10;
const SEQUENCE_LENGTH = 20;
const DQN_STATE_SIZE = 4;
const DQN_ACTION_COUNT = 5;

class MLDiffAgent {
  constructor() {
    this.isInitialized = false;
    this.lstmModel = null;
    this.dqnModel = null;
    this.predictedProficiency = 0.5; // 0.0 (High Logic Wall Struggle) to 1.0 (Mastery)
    this.predictedQValues = [0, 0, 0, 0, 0];
    this.lastAction = DDA_ACTIONS.NORMAL;
    this.epsilon = 0.15; // exploration rate (only used in ML mode)

    // Bootstrap/ML mode
    this.mode = "bootstrap"; // "bootstrap" | "ml"
    this.pretrainedLSTM = false;
    this.pretrainedDQN = false;

    // Experience replay buffer (for offline DQN training export)
    this.replayBuffer = [];
    this.replayBufferMax = 500;
    this.episodeCount = 0;

    // Episode tracking for reward computation
    this.prevState = null;
    this.prevAction = null;
    this.episodeStarted = false;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 1. Try to load pretrained LSTM model
      try {
        this.lstmModel = await tf.loadLayersModel("/models/lstm/model.json");
        this.pretrainedLSTM = true;
        console.log("📦 Pretrained LSTM model loaded");
      } catch {
        // No pretrained model — build fresh network (bootstrap mode)
        const lstmInput = tf.input({ shape: [SEQUENCE_LENGTH, FEATURE_COUNT] });
        const lstmLayer = tf.layers.lstm({ units: 16, returnSequences: false }).apply(lstmInput);
        const denseEncoder = tf.layers.dense({ units: 8, activation: "relu" }).apply(lstmLayer);
        const proficiencyOutput = tf.layers.dense({ units: 1, activation: "sigmoid" }).apply(denseEncoder);

        this.lstmModel = tf.model({ inputs: lstmInput, outputs: proficiencyOutput });
        this.lstmModel.compile({ optimizer: tf.train.adam(0.01), loss: "meanSquaredError" });
        console.log("🔧 No pretrained LSTM — built fresh network");
      }

      // 2. Try to load pretrained DQN model
      try {
        this.dqnModel = await tf.loadLayersModel("/models/dqn/model.json");
        this.pretrainedDQN = true;
        console.log("📦 Pretrained DQN model loaded");
      } catch {
        // Build fresh DQN
        const dqnInput = tf.input({ shape: [DQN_STATE_SIZE] });
        const dqnHidden1 = tf.layers.dense({ units: 16, activation: "relu" }).apply(dqnInput);
        const dqnHidden2 = tf.layers.dense({ units: 16, activation: "relu" }).apply(dqnHidden1);
        const qValuesOutput = tf.layers.dense({ units: DQN_ACTION_COUNT, activation: "linear" }).apply(dqnHidden2);

        this.dqnModel = tf.model({ inputs: dqnInput, outputs: qValuesOutput });
        this.dqnModel.compile({ optimizer: tf.train.adam(0.005), loss: "meanSquaredError" });
        console.log("🔧 No pretrained DQN — built fresh network");
      }

      // 3. Determine operating mode
      this.mode = (this.pretrainedLSTM && this.pretrainedDQN) ? "ml" : "bootstrap";

      // 4. Load persisted replay buffer from localStorage
      this._loadReplayBuffer();

      this.isInitialized = true;
      const modeLabel = this.mode === "ml" ? "🤖 ML Mode" : "🔧 Bootstrap Mode";
      console.log(`${modeLabel} — TensorFlow.js RNN + DQN DDA Agent initialized in browser!`);
    } catch (err) {
      console.warn("TF.js initialization warning:", err);
    }
  }

  // Perform inference forward pass or bootstrap DDA action
  async updateAndPredict(stage = 1) {
    if (!this.isInitialized) await this.init();

    try {
      if (this.mode === "bootstrap") {
        return this._bootstrapUpdate(stage);
      } else {
        return this._mlUpdate(stage);
      }
    } catch (err) {
      console.error("DDA prediction error:", err);
      return {
        proficiency: 0.5,
        qValues: [0, 0, 0, 0, 0],
        action: DDA_ACTIONS.NORMAL,
        mode: this.mode,
      };
    }
  }

  // --- Bootstrap Mode ---
  _bootstrapUpdate(stage) {
    // Use deterministic Bootstrap DDA
    const action = computeBootstrapAction(telemetry, stage);
    this.lastAction = action;
    dda.applyAction(action, stage);

    // Record DDA action in telemetry
    telemetry.recordDDAAction(action, stage);

    // Build state vector for experience tuple (even though we're not training)
    const stateArr = [
      0.5, // proficiency unknown in bootstrap mode
      stage / 5.0,
      telemetry.frustrationScore,
      telemetry.flowScore,
    ];

    // Record experience tuple for future offline DQN training
    this._recordExperience(stateArr, action, stage);

    // Still sample history for LSTM buffer building
    telemetry.sampleHistory();

    return {
      proficiency: null,
      qValues: null,
      action,
      mode: "bootstrap",
    };
  }

  // --- ML Mode ---
  async _mlUpdate(stage) {
    // 1. Extract telemetry sliding window
    const sequence = telemetry.getLSTMInputTensor(); // [20, 10]
    const lstmTensor = tf.tensor3d([sequence], [1, SEQUENCE_LENGTH, FEATURE_COUNT]);

    // Predict Student Proficiency via LSTM
    const profPred = this.lstmModel.predict(lstmTensor);
    const profVal = (await profPred.data())[0];
    this.predictedProficiency = Number(profVal.toFixed(3));
    tf.dispose([lstmTensor, profPred]);

    // 2. Construct State Tensor for DQN: [Proficiency, Stage/5, Frustration, Flow]
    const stateArr = [
      this.predictedProficiency,
      stage / 5.0,
      telemetry.frustrationScore,
      telemetry.flowScore,
    ];
    const stateTensor = tf.tensor2d([stateArr], [1, DQN_STATE_SIZE]);

    // Predict Q-Values for the 5 DDA actions
    const qPred = this.dqnModel.predict(stateTensor);
    const qValues = Array.from(await qPred.data());
    this.predictedQValues = qValues.map((v) => Number(v.toFixed(3)));
    tf.dispose([stateTensor, qPred]);

    // 3. Action selection (greedy — no exploration in deployed ML mode)
    const selectedAction = qValues.indexOf(Math.max(...qValues));
    this.lastAction = selectedAction;
    dda.applyAction(selectedAction, stage);

    // Record DDA action in telemetry
    telemetry.recordDDAAction(selectedAction, stage);

    // Record experience tuple (for evaluation and potential retraining)
    this._recordExperience(stateArr, selectedAction, stage);

    // Sample history
    telemetry.sampleHistory();

    return {
      proficiency: this.predictedProficiency,
      qValues: this.predictedQValues,
      action: selectedAction,
      mode: "ml",
    };
  }

  // --- Experience Replay Buffer ---

  _recordExperience(currentState, action, stage) {
    if (this.prevState !== null && this.prevAction !== null) {
      // Compute reward for the previous action
      const reward = this._computeReward(this.prevState, this.prevAction, currentState);
      const done = false;

      this.replayBuffer.push({
        state: [...this.prevState],
        action: this.prevAction,
        reward: Number(reward.toFixed(4)),
        nextState: [...currentState],
        done,
        stage,
        timestamp: Date.now(),
      });

      // Trim buffer if too large
      if (this.replayBuffer.length > this.replayBufferMax) {
        this.replayBuffer.shift();
      }

      this.episodeCount++;

      // Persist periodically
      if (this.episodeCount % 10 === 0) {
        this._persistReplayBuffer();
      }
    }

    // Save current state for next experience tuple
    this.prevState = [...currentState];
    this.prevAction = action;
  }

  _computeReward(prevState, action, currentState) {
    let reward = 0;

    // Flow improvement: reward maintaining/increasing flow
    const flowDelta = currentState[3] - prevState[3]; // index 3 = flow
    reward += flowDelta * 2.0;

    // Frustration reduction: reward reducing frustration
    const frustDelta = currentState[2] - prevState[2]; // index 2 = frustration
    reward -= frustDelta * 2.0;

    // Penalty for scaffolding a proficient student (if proficiency is known)
    if (action === DDA_ACTIONS.SCAFFOLD && prevState[0] > 0.7) {
      reward -= 0.5;
    }

    // Penalty for challenging a struggling student
    if (action === DDA_ACTIONS.CHALLENGE && prevState[0] < 0.3) {
      reward -= 0.5;
    }

    // Quest completion bonus is added via telemetry events, not here
    // (handled separately when quest_complete fires)

    return Math.max(-2.0, Math.min(2.0, reward)); // clamp
  }

  // Add a quest completion bonus to the most recent experience
  addQuestCompletionReward() {
    if (this.replayBuffer.length > 0) {
      const lastExp = this.replayBuffer[this.replayBuffer.length - 1];
      lastExp.reward = Math.min(2.0, lastExp.reward + 1.0);
    }
  }

  _persistReplayBuffer() {
    try {
      // Store only the last 200 experiences to avoid localStorage limits
      const toStore = this.replayBuffer.slice(-200);
      localStorage.setItem("algobot_replay_buffer", JSON.stringify(toStore));
    } catch {
      // localStorage full or unavailable — non-critical
    }
  }

  _loadReplayBuffer() {
    try {
      const stored = localStorage.getItem("algobot_replay_buffer");
      if (stored) {
        this.replayBuffer = JSON.parse(stored);
        console.log(`📥 Loaded ${this.replayBuffer.length} replay experiences from localStorage`);
      }
    } catch {
      // ignore
    }
  }

  // --- Export Methods (for training pipeline) ---

  getReplayBuffer() {
    return [...this.replayBuffer];
  }

  getAgentState() {
    return {
      mode: this.mode,
      pretrainedLSTM: this.pretrainedLSTM,
      pretrainedDQN: this.pretrainedDQN,
      episodeCount: this.episodeCount,
      replayBufferSize: this.replayBuffer.length,
      predictedProficiency: this.predictedProficiency,
      lastAction: this.lastAction,
      epsilon: this.epsilon,
    };
  }
}

export const mlAgent = new MLDiffAgent();
