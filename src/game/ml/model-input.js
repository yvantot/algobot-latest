// This order and transformation match training/prepare_dataset.py. Preserve the
// original feature definitions when using the already-trained model weights.
export const FEATURE_NAMES = [
  "error_rate", "execution_speed", "iteration_usage", "condition_reactivity",
  "greedy_efficiency", "yield_quality", "frustration", "code_success_rate",
  "hint_consumption_rate", "normalized_completion_time",
];
export const FEATURE_COUNT = FEATURE_NAMES.length;
export const SEQUENCE_LENGTH = 20;

export function validateScaler(scaler) {
  for (const key of ["feature_min", "feature_range"]) {
    if (!Array.isArray(scaler?.[key]) || scaler[key].length !== FEATURE_COUNT ||
        scaler[key].some(value => !Number.isFinite(value))) {
      throw new Error(`Invalid LSTM scaler ${key}`);
    }
  }
  if (scaler.feature_range.some(value => value <= 0)) {
    throw new Error("LSTM scaler ranges must be positive");
  }
  if (JSON.stringify(scaler.feature_names) !== JSON.stringify(FEATURE_NAMES)) {
    throw new Error("LSTM scaler feature order does not match telemetry");
  }
  return scaler;
}

export function normalizeSequence(sequence, scaler) {
  validateScaler(scaler);
  if (sequence.length !== SEQUENCE_LENGTH) throw new Error("Invalid LSTM sequence length");
  return sequence.map(vector => {
    if (!Array.isArray(vector) || vector.length !== FEATURE_COUNT ||
        vector.some(value => !Number.isFinite(value))) {
      throw new Error("Invalid LSTM feature vector");
    }
    // Do not clip: Python training uses this exact min-max transformation,
    // including zero padding. Inputs outside training ranges remain outside [0, 1].
    return vector.map((value, i) => (value - scaler.feature_min[i]) / scaler.feature_range[i]);
  });
}
