import { SAVE_VERSION, QUEST_PATH_VERSION, SaveError, validateSave } from "./schema.js";
import { requireOwner } from "./ownership.js";
import { interruptAssessments } from "./research.js";

export class PersistenceController {
  constructor({ storage, capture, restore, fresh, pause, notify = () => {}, now = Date.now, gameVersion = "1" }) {
    Object.assign(this, { storage, capture, restore, fresh, pause, notify, now, gameVersion });
    this.writer = crypto.randomUUID(); this.revision = 0; this.current = null;
    this.root = null; this.ready = false; this.busy = false; this.tail = Promise.resolve();
    this.status = { phase: "loading", savedAt: null, error: null };
  }
  report(phase, error = null) { this.status = { phase, savedAt: this.current?.savedAt ?? null, error }; this.notify(this.status); }
  async inspect() {
    try { this.root = await this.storage.read(); this.report("menu"); return this.root; }
    catch (error) { this.report("error", error); throw error; }
  }
  enqueue(operation) {
    const result = this.tail.then(operation);
    this.tail = result.catch(error => { this.report("error", error); if (error.code === "conflict") { this.ready = false; this.pause(); } });
    return result;
  }
  async acquire() { this.revision = await this.storage.acquire(this.writer, { exclusiveLock: !!this.exclusiveLock }); this.root = await this.storage.read(); }
  envelope(payload, owner = this.current.owner, playthroughId = this.current.playthroughId) {
    return validateSave({ schemaVersion: SAVE_VERSION, questPathVersion: QUEST_PATH_VERSION, gameVersion: this.gameVersion,
      playthroughId, owner, revision: (this.current?.revision ?? 0) + 1, savedAt: this.now(),
      recoveryGeneration: playthroughId === this.current?.playthroughId ? this.current.recoveryGeneration : 0, payload });
  }
  async write(save, options) {
    this.report("saving");
    this.revision = await this.storage.checkpoint(this.writer, this.revision, save, { ...options, onCommit: root => { this.root = root; } });
    this.current = save; this.report("saved");
    return save;
  }
  async start(owner, { newGame = false, recover = false, identityIntent = null } = {}) {
    if (this.busy) throw new SaveError("busy", "A game transition is already running.");
    this.busy = true; this.ready = false; this.pause();
    const old = this.current;
    try {
      await this.tail; await this.acquire();
      this.report("loading");
      if (newGame) {
        await this.fresh();
        const save = this.envelope(this.capture(), owner, crypto.randomUUID());
        await this.write(save, { replace: true, research: research => {
          if (this.root.active) interruptAssessments(research, this.root.active.playthroughId, this.now());
          if (identityIntent) research.identityIntent = identityIntent;
        } });
      } else {
        const save = validateSave(recover ? this.root.previous : this.root.active);
        requireOwner(save.owner, owner);
        if (recover && (!Number.isSafeInteger(this.root.floor) || save.revision < this.root.floor || save.playthroughId !== this.root.active?.playthroughId)) throw new SaveError("recovery", "This backup predates a recorded assessment or belongs to another farm.");
        if (recover) {
          save.payload.exclusions = [...new Set([...(save.payload.exclusions ?? []), "checkpoint_recovery"])];
          save.recoveryGeneration++;
          save.revision = Math.max(save.revision, this.root.active?.revision ?? 0) + 1;
        }
        if (save.payload.ui.entryScreen === "demonstration") save.payload.ui.entryScreen = save.payload.tutorial.active ? "onboarding" : null;
        await this.restore(save.payload); this.current = save;
        const interrupted = Object.values(this.root.research.assessments).some(a => a.playthroughId === save.playthroughId && a.status === "in_progress");
        if (recover || interrupted) await this.write(this.envelope(this.capture()), { boundary: true,
          research: research => interruptAssessments(research, save.playthroughId, this.now()) });
      }
      this.ready = true; this.report("saved");
      return this.current;
    } catch (error) {
      this.current = old;
      if (old) { try { await this.restore(old.payload); } catch { /* The committed checkpoint remains available from the menu. */ } }
      this.report("error", error); throw error;
    } finally { this.busy = false; }
  }
  checkpoint({ required = false } = {}) {
    if (!this.ready || this.busy) return required
      ? Promise.reject(new SaveError(this.busy ? "busy" : "not_ready", "The farm could not be saved. Finish the current transition or reload before continuing."))
      : this.tail;
    try { this.pendingPayload = this.capture(); }
    catch (error) { this.report("error", error); return Promise.reject(error); }
    if (this.checkpointPromise) return this.checkpointPromise;
    this.checkpointPromise = this.enqueue(async () => {
      while (this.pendingPayload) {
        const payload = this.pendingPayload; this.pendingPayload = null;
        await this.write(this.envelope(payload));
      }
    }).finally(() => { this.checkpointPromise = null; });
    return this.checkpointPromise;
  }
  research(change) {
    return this.enqueue(async () => {
      this.revision = await this.storage.update(this.writer, this.revision, root => change(root.research), root => { this.root = root; });
    });
  }
  async boundary(mutate, research) {
    if (!this.ready || this.busy) throw new SaveError("busy", "Wait for the current save to finish.");
    this.busy = true;
    try {
      await this.tail;
      const value = mutate();
      const save = this.envelope(this.capture());
      await this.enqueue(() => this.write(save, { boundary: true, research: data => research(data, value, save) }));
      return value;
    } finally { this.busy = false; }
  }
}
