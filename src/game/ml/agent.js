// TensorFlow.js In-Browser RNN (LSTM) + Deep Q-Network (DQN) Agent
// Models student proficiency across the 5 CS1 curriculum milestones and selects adaptive DDA actions.

import * as tf from "@tensorflow/tfjs";
import { telemetry } from "./telemetry.js";
import { dda, DDA_ACTIONS } from "./dda.js";

class MLDiffAgent {
  constructor() {
    this.isInitialized = false;
    this.lstmModel = null;
    this.dqnModel = null;
    this.predictedProficiency = 0.5; // 0.0 (High Logic Wall Struggle) to 1.0 (Mastery)
    this.predictedQValues = [0, 0, 0, 0, 0];
    this.lastAction = DDA_ACTIONS.NORMAL;
    this.epsilon = 0.15; // exploration rate
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 1. Build LSTM Proficiency Encoder Model
      // Sequence input: 20 timesteps x 7 features
      const lstmInput = tf.input({ shape: [20, 7] });
      const lstmLayer = tf.layers.lstm({ units: 16, returnSequences: false }).apply(lstmInput);
      const denseEncoder = tf.layers.dense({ units: 8, activation: "relu" }).apply(lstmLayer);
      const proficiencyOutput = tf.layers.dense({ units: 1, activation: "sigmoid" }).apply(denseEncoder);

      this.lstmModel = tf.model({ inputs: lstmInput, outputs: proficiencyOutput });
      this.lstmModel.compile({ optimizer: tf.train.adam(0.01), loss: "meanSquaredError" });

      // 2. Build DQN Action Selection Policy Network
      // Input: [ProficiencyScore, StageNormalized, FrustrationScore, FlowScore] (4 features)
      const dqnInput = tf.input({ shape: [4] });
      const dqnHidden1 = tf.layers.dense({ units: 16, activation: "relu" }).apply(dqnInput);
      const dqnHidden2 = tf.layers.dense({ units: 16, activation: "relu" }).apply(dqnHidden1);
      const qValuesOutput = tf.layers.dense({ units: 5, activation: "linear" }).apply(dqnHidden2);

      this.dqnModel = tf.model({ inputs: dqnInput, outputs: qValuesOutput });
      this.dqnModel.compile({ optimizer: tf.train.adam(0.005), loss: "meanSquaredError" });

      this.isInitialized = true;
      console.log("🤖 TensorFlow.js RNN + DQN DDA Agent initialized in browser!");
    } catch (err) {
      console.warn("TF.js initialization warning:", err);
    }
  }

  // Perform inference forward pass
  async updateAndPredict(stage = 1) {
    if (!this.isInitialized) await this.init();

    try {
      // 1. Extract telemetry sliding window
      const sequence = telemetry.getLSTMInputTensor(); // [20, 7]
      const lstmTensor = tf.tensor3d([sequence], [1, 20, 7]);

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
      const stateTensor = tf.tensor2d([stateArr], [1, 4]);

      // Predict Q-Values for the 5 DDA actions
      const qPred = this.dqnModel.predict(stateTensor);
      const qValues = Array.from(await qPred.data());
      this.predictedQValues = qValues.map((v) => Number(v.toFixed(3)));
      tf.dispose([stateTensor, qPred]);

      // 3. Epsilon-Greedy Action Selection
      let selectedAction;
      if (Math.random() < this.epsilon) {
        selectedAction = Math.floor(Math.random() * 5); // Explore random action
      } else {
        selectedAction = qValues.indexOf(Math.max(...qValues)); // Exploit best Q-value
      }

      this.lastAction = selectedAction;
      dda.applyAction(selectedAction, stage);

      return {
        proficiency: this.predictedProficiency,
        qValues: this.predictedQValues,
        action: selectedAction,
      };
    } catch (err) {
      console.error("DDA prediction error:", err);
      return {
        proficiency: 0.5,
        qValues: [0, 0, 0, 0, 0],
        action: DDA_ACTIONS.NORMAL,
      };
    }
  }
}

export const mlAgent = new MLDiffAgent();
