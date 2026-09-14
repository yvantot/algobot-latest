// Bootstrap DDA Controller
// Deterministic adaptive difficulty mechanism used during the data collection phase.
// Produces the same 5-action output interface as the DQN, using handcrafted thresholds
// derived from telemetry scores. This is an intentional research phase — not a replacement
// for ML — that generates representative gameplay data before models are trained.

import { DDA_ACTIONS } from "./dda.js";

/**
 * Computes the Bootstrap DDA action based on current telemetry state and CS1 stage.
 * @param {object} telemetryState - The telemetry tracker instance
 * @param {number} stage - Current CS1 curriculum stage (1-5)
 * @returns {number} DDA action ID (0-4)
 */
export function computeBootstrapAction(telemetryState, stage, proficiency = null) {
  const {
    frustrationScore,
    flowScore,
    errorCount,
    resetCount,
    optimalHarvestChoices,
    suboptimalHarvestChoices,
  } = telemetryState;

  // Logic Wall Detection: student is struggling — provide scaffolding
  // High frustration OR excessive errors combined with multiple resets
  if (frustrationScore > 0.5 || (errorCount > 5 && resetCount > 2) ||
      (Number.isFinite(proficiency) && proficiency < 0.3)) {
    return DDA_ACTIONS.SCAFFOLD;
  }

  // High Proficiency Detection: student is breezing through — increase challenge
  // High flow, low frustration, very few errors
  const readyForChallenge = Number.isFinite(proficiency)
    ? proficiency > 0.7 && flowScore > 0.6
    : flowScore > 0.75;
  if (readyForChallenge && frustrationScore < 0.15 && errorCount <= 1) {
    return DDA_ACTIONS.CHALLENGE;
  }

  // Greedy Algorithm Guidance: student is in stage 4+ and making suboptimal harvest decisions
  if (stage >= 4 && suboptimalHarvestChoices > optimalHarvestChoices && (optimalHarvestChoices + suboptimalHarvestChoices) > 0) {
    return DDA_ACTIONS.GREEDY_GUIDE;
  }

  // State Optimization: student is in stage 5 with moderate performance
  if (stage >= 5 && flowScore > 0.4 && flowScore < 0.75) {
    return DDA_ACTIONS.STATE_OPTIMIZE;
  }

  // Default: no intervention needed
  return DDA_ACTIONS.NORMAL;
}
