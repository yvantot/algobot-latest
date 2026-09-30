export function legacyResearchBytes(storage) {
  return Object.fromEntries(["algobot_sessions", "algobot_challenge_exposure_v1", "algobot_raw_sessions", "algobot_replay_buffer"]
    .map(key => [key, storage.getItem(key)]));
}

export function inspectLegacyResearch(storage, normalize) {
  const bytes = legacyResearchBytes(storage), errors = [];
  let sessions = [], exposures = {}, exposureHistoryUnavailable = false;
  try {
    const records = JSON.parse(bytes.algobot_sessions ?? "[]");
    if (!Array.isArray(records)) throw Error("Expected a list of sessions.");
    records.forEach((record, index) => {
      try {
        if (!record || typeof record !== "object" || Array.isArray(record)) throw Error("Invalid session record.");
        const session = normalize(record);
        session.session_id ??= `legacy-import-${index}`;
        if (typeof session.session_id !== "string") throw Error("Invalid session ID.");
        sessions.push(session);
      } catch (error) { errors.push(`Session ${index}: ${error.message}`); }
    });
  } catch (error) { errors.push(`Session history: ${error.message}`); }
  try {
    exposures = JSON.parse(bytes.algobot_challenge_exposure_v1 ?? "{}");
    if (!exposures || typeof exposures !== "object" || Array.isArray(exposures)) throw Error("Invalid challenge history.");
    for (const [key, value] of Object.entries(exposures)) {
      const identity = JSON.parse(key);
      if (!Array.isArray(identity) || identity.length !== 2 || !identity.every(id => typeof id === "string") || typeof value !== "boolean") throw Error("Invalid challenge history entry.");
    }
  } catch (error) {
    errors.push(`Challenge history: ${error.message}`);
    exposures = {}; exposureHistoryUnavailable = true;
  }
  return { bytes, errors, sessions, exposures, exposureHistoryUnavailable };
}
