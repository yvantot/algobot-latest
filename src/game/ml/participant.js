export function resolveParticipant(search, storage, makeId = () => `p_${crypto.randomUUID()}`) {
  const requested = new URLSearchParams(search).get("study_participant");
  if (requested !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(requested)) {
    throw Error("Use a participant code with 1-64 letters, numbers, underscores or hyphens.");
  }
  const stored = storage.getItem("algobot_participant_id");
  const id = requested || stored || makeId();
  storage.setItem("algobot_participant_id", id);
  const source = requested ? "researcher_assigned_code"
    : stored ? storage.getItem("algobot_participant_id_source") || "browser_local_pseudonym" : "browser_local_pseudonym";
  storage.setItem("algobot_participant_id_source", source);
  return { id, source };
}

export function clearParticipant(storage, browser = globalThis.window) {
  storage.removeItem("algobot_participant_id");
  storage.removeItem("algobot_participant_id_source");
  // Otherwise reloading the same URL immediately restores the cleared code.
  if (browser) {
    const url = new URL(browser.location.href);
    if (url.searchParams.has("study_participant")) {
      url.searchParams.delete("study_participant");
      browser.history.replaceState(browser.history.state, "", url.href);
    }
  }
}
