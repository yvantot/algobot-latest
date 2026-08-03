// A/B Experimental Evaluator
// Assigns participants to experimental conditions and tracks which DDA mode they experience.
// Used during the thesis evaluation phase to compare Bootstrap DDA vs ML DDA.

/**
 * Assigns a participant to an experimental condition based on their anonymous ID.
 * Uses a simple hash for balanced group assignment.
 *
 * @param {string} participantId - Anonymous participant ID (e.g. "Participant_001")
 * @returns {"bootstrap_dda" | "ml_dda"} The assigned condition
 */
export function assignCondition(participantId) {
  const hash = [...participantId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? "bootstrap_dda" : "ml_dda";
}

/**
 * Returns a human-readable label for the assigned condition.
 * @param {string} condition - The condition identifier
 * @returns {string} Display label
 */
export function getConditionLabel(condition) {
  return condition === "bootstrap_dda"
    ? "Group A (Bootstrap DDA)"
    : "Group B (ML DDA)";
}
