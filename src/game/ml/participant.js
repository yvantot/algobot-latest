export function resolveParticipant(search, storage, makeId = () => `p_${crypto.randomUUID()}`) {
  const requested = new URLSearchParams(search).get("study_participant");
  if (requested !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(requested)) {
    throw Error("Use a participant code with 1-64 letters, numbers, underscores or hyphens.");
  }
  const stored = storage.getItem("algobot_participant_id");
  const id = requested || stored || makeId();
  storage.setItem("algobot_participant_id", id);
  if (requested) storage.setItem("algobot_participant_id_source", "researcher_assigned_code");
  return { id, source: requested ? "researcher_assigned_code"
    : storage.getItem("algobot_participant_id_source") || "browser_local_pseudonym" };
}
