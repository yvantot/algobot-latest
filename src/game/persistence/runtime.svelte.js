import { PersistenceController } from "./controller.js";
import { SaveStorage } from "./storage.js";
import { captureWorld, restoreWorld, newWorld } from "./world.js";
import { INVENTORY, PLAYER_DATA } from "../global/global.js";
import { farmChallengeRewards } from "../challenges/records.js";
import { inspectIdentity } from "./ownership.js";
import { SaveError } from "./schema.js";
import { saveResearchSession, recordTransition, clearResearch, importResearch, projectResearch } from "./research.js";
import { dataLogger, normalizeStoredSession } from "../ml/data-logger.js";
import { telemetry } from "../ml/telemetry.js";
import { STUDY_PROTOCOL } from "../ml/study-protocol.js";
import { k } from "../../lib/kaplay.js";
import { version } from "../../../package.json";
import { onPersistenceChange } from "./signals.js";
import { inspectLegacyResearch } from "./legacy-research.js";

export const saveStatus = $state({ phase: "loading", savedAt: null, error: null, notice: "" });
export const persistence = new PersistenceController({
  storage: new SaveStorage(), capture: captureWorld, restore: restoreWorld, fresh: newWorld,
  pause: () => { if (k) k.debug.timeScale = 0; }, gameVersion: version,
  notify: status => Object.assign(saveStatus, status),
});
let autosave, heartbeat, debounce, lockRelease;
export function currentOwner({ create = false } = {}) {
  const owner = inspectIdentity(location.search, localStorage, STUDY_PROTOCOL.id);
  return owner ?? (create ? { participantId: `p_${crypto.randomUUID()}`, identityKind: "browser_local_pseudonym", studyProtocolVersion: null } : null);
}
async function holdLock() {
  if (lockRelease || !navigator.locks) return;
  await new Promise((resolve, reject) => {
    navigator.locks.request("algobot-playthrough-writer", { ifAvailable: true }, async lock => {
      if (!lock) { reject(Object.assign(Error("Another tab is using this farm. Close it first."), { code: "conflict" })); return; }
      await new Promise(release => { lockRelease = release; persistence.exclusiveLock = true; resolve(); });
    }).catch(reject);
  });
}
export function requestSave() {
  clearTimeout(debounce);
  debounce = setTimeout(() => persistence.checkpoint().catch(() => {}), 50);
}
onPersistenceChange(requestSave);
export async function startPlaythrough(options = {}) {
  try {
  await holdLock();
  await persistence.acquire();
  await initializeResearch({ recover: !!options.recoverResearch });
  if (!options.newGame) await reconcileIdentity();
  const owner = currentOwner({ create: options.newGame });
  if (!owner) throw Error("Restore this farm's participant identity, or choose New Game.");
  const identityIntent = options.newGame ? { owner, priorId: localStorage.getItem("algobot_participant_id"), priorSource: localStorage.getItem("algobot_participant_id_source") } : null;
  const save = await persistence.start(owner, { ...options, identityIntent });
  if (options.newGame) {
    await reconcileIdentity();
  }
  clearInterval(autosave); clearInterval(heartbeat);
  autosave = setInterval(() => persistence.checkpoint().catch(() => {}), 2000);
  heartbeat = setInterval(() => persistence.storage.heartbeat(persistence.writer).catch(error => {
    if (error.code === "conflict") { persistence.ready = false; persistence.pause(); }
    persistence.report("error", error);
  }), 5000);
  return save;
  } catch (error) {
    persistence.ready = false; persistence.pause();
    await persistence.storage.release(persistence.writer).catch(() => {});
    lockRelease?.(); lockRelease = null; persistence.exclusiveLock = false;
    throw error;
  }
}
async function reconcileIdentity() {
  const intent = persistence.root?.research.identityIntent;
  if (!intent) return;
  const requested = new URLSearchParams(location.search).get("study_participant");
  const id = localStorage.getItem("algobot_participant_id"), source = localStorage.getItem("algobot_participant_id_source");
  if (requested && requested !== intent.owner.participantId || ![intent.priorId, intent.owner.participantId].includes(id) || ![intent.priorSource, intent.owner.identityKind].includes(source))
    throw new SaveError("owner", "The pending New Game identity conflicts with this participant. Restore the matching identity or confirm another New Game.");
  localStorage.setItem("algobot_participant_id", intent.owner.participantId);
  localStorage.setItem("algobot_participant_id_source", intent.owner.identityKind);
  await persistence.research(research => { delete research.identityIntent; });
}
async function initializeResearch({ recover = false } = {}) {
  if (!persistence.root.research.imported) {
    const legacy = inspectLegacyResearch(localStorage, normalizeStoredSession);
    if (legacy.errors.length && !recover) throw new SaveError("legacy_research", "Some research records are unreadable. Export them, or back them up here and continue. The original records will be kept.");
    await persistence.research(research => {
      if (legacy.errors.length) {
        research.legacyBackups ??= [];
        research.legacyBackups.push({ id: crypto.randomUUID(), savedAt: Date.now(), bytes: legacy.bytes, errors: legacy.errors });
        research.exposureHistoryUnavailable = legacy.exposureHistoryUnavailable;
      }
      importResearch(research, legacy.sessions, legacy.exposures);
    });
  }
  dataLogger.persistence = {
    sessions: () => Object.values(persistence.root.research.sessions),
    backups: () => persistence.root.research.legacyBackups ?? [],
    save: session => persistence.research(research => saveResearchSession(research, session)).then(syncResearch),
    clear: async () => {
      await persistence.research(research => clearResearch(research));
      localStorage.removeItem("algobot_raw_sessions");
      await syncResearch();
    },
  };
}
async function syncResearch() {
  try {
    const pending = Object.values(persistence.root.research.operations).filter(operation => !operation.delivered).map(operation => operation.id);
    if (await projectResearch(persistence.root, localStorage) && pending.length) await persistence.research(research => {
      for (const id of pending) if (research.operations[id]) research.operations[id].delivered = true;
    });
  }
  catch (error) { saveStatus.notice = `Farm saved. Research compatibility storage could not sync: ${error.message}`; }
}
export function wasExposed(participant, task) {
  if (persistence.root?.research.exposureHistoryUnavailable) throw new SaveError("research_history", "Challenge history needs repair before starting challenges. You can keep farming and export the backed-up records from Dev Tools.");
  return !!persistence.root?.research.exposures[JSON.stringify([participant, task])];
}
export async function assessmentTransition(kind, mutate) {
  if (!persistence.ready || persistence.busy) throw new SaveError("busy", "Wait for the current save to finish.");
  const before = captureWorld(), attempts = structuredClone(telemetry.challengeAttempts), raw = [...telemetry.rawEvents];
  const speed = k.debug.timeScale; k.debug.timeScale = 0;
  try {
    const result = await persistence.boundary(mutate, (research, result, save) => {
      const assessment = result.assessment;
      recordTransition(research, { id: `${kind}:${assessment.assessment_id}:${assessment.submissions.length}`, kind, assessment,
        session: dataLogger.buildSessionExport(), playthroughId: save.playthroughId, revision: save.revision,
        recoveryGeneration: save.recoveryGeneration,
        exposureKey: kind === "opened" ? JSON.stringify([assessment.student_id, assessment.task_id]) : null });
    });
    await syncResearch(); return result;
  } catch (error) {
    INVENTORY.coins = before.economy.coins;
    INVENTORY.coinAnimationVersion = (INVENTORY.coinAnimationVersion ?? 0) + 1;
    Object.assign(INVENTORY.crops, before.economy.crops);
    PLAYER_DATA.exp = before.economy.exp; PLAYER_DATA.level = Math.floor(before.economy.exp / 100);
    farmChallengeRewards.clear(); for (const key of before.challengeRewards) farmChallengeRewards.add(key);
    INVENTORY.updateUI(); PLAYER_DATA.updateUI();
    const existing = new Map(telemetry.challengeAttempts.map(attempt => [attempt.assessment_id, attempt]));
    telemetry.challengeAttempts = attempts.map(saved => Object.assign(existing.get(saved.assessment_id) ?? {}, saved));
    telemetry.rawEvents = raw;
    saveStatus.notice = `Activity was not saved: ${error.message}`;
    throw error;
  } finally { k.debug.timeScale = speed; }
}
if (typeof window !== "undefined") {
  for (const event of ["pointerup", "input", "change"]) window.addEventListener(event, requestSave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) requestSave(); });
  window.addEventListener("pagehide", () => {
    persistence.checkpoint().catch(() => {});
    persistence.storage.release(persistence.writer).catch(() => {});
    lockRelease?.(); lockRelease = null; persistence.exclusiveLock = false;
  });
}
