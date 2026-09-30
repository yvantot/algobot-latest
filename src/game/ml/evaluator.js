// Optional study-allocation helper, currently not connected to the game.
// It neither enforces a treatment nor proves a balanced/randomized assignment.
// Research exports record the actual runtime mode separately (including hybrid).

/**
 * Assigns a participant to an experimental condition based on their anonymous ID.
 * Uses deterministic ID parity; allocation can be imbalanced and must be reviewed
 * as part of a study protocol before use. This is not evidence of an A/B trial.
 *
 * @param {string} participantId - Anonymous participant ID (e.g. "Participant_001")
 * @returns {"bootstrap_dda" | "ml_dda"} The assigned condition
 */
export function assignCondition(participantId) {
  if (typeof participantId !== "string" || !participantId.trim()) {
    throw new Error("An anonymous participant ID is required for allocation");
  }
  const hash = [...participantId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? "bootstrap_dda" : "ml_dda";
}

/**
 * Returns a human-readable label for the assigned condition.
 * @param {string} condition - The condition identifier
 * @returns {string} Display label
 */
export function getConditionLabel(condition) {
  if (condition === "bootstrap_dda") return "Group A (Bootstrap DDA)";
  if (condition === "ml_dda") return "Group B (ML DDA)";
  if (condition === "hybrid") return "LSTM + rule policy (not an A/B assignment)";
  return "Unassigned";
}
