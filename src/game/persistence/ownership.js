import { SaveError, validateOwner } from "./schema.js";

export function inspectIdentity(search, storage, protocolVersion = null) {
  const requested = new URLSearchParams(search).get("study_participant");
  if (requested !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(requested)) throw new SaveError("identity", "Use a participant code with 1–64 letters, numbers, underscores or hyphens.");
  const participantId = requested || storage.getItem("algobot_participant_id");
  if (!participantId) return null;
  const identityKind = requested ? "researcher_assigned_code" : storage.getItem("algobot_participant_id_source") || "browser_local_pseudonym";
  return validateOwner({ participantId, identityKind, studyProtocolVersion: identityKind === "researcher_assigned_code" ? protocolVersion : null });
}
export function requireOwner(saved, requested) {
  if (!requested || ["participantId", "identityKind", "studyProtocolVersion"].some(key => saved[key] !== requested[key]))
    throw new SaveError("owner", "This farm belongs to a different participant or study context. Restore the matching identity or choose New Game.");
}
