import { SaveError, validateSave } from "./schema.js";

export const emptyDatabase = () => ({ active: null, previous: null, floor: 0, revision: 0, lease: null,
  research: { sessions: {}, assessments: {}, operations: {}, tombstones: {}, exposures: {}, epoch: 0, imported: false } });
function storageError(error) {
  if (error instanceof SaveError) return error;
  return new SaveError(error?.name === "QuotaExceededError" ? "quota" : "storage", "Farm storage is unavailable. Your last committed save has been preserved.", error);
}
export class SaveStorage {
  constructor({ indexedDB = globalThis.indexedDB, name = "algobot-playthrough-v1", now = Date.now, fault = () => {} } = {}) {
    Object.assign(this, { indexedDB, name, now, fault });
  }
  async open() {
    if (this.db) return this.db;
    if (!this.indexedDB) throw new SaveError("storage", "This browser does not allow farm storage.");
    return new Promise((resolve, reject) => {
      let request;
      try { request = this.indexedDB.open(this.name, 1); } catch (error) { reject(storageError(error)); return; }
      let rejected = false;
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onblocked = () => { rejected = true; reject(new SaveError("blocked", "Close other game tabs to update farm storage.")); };
      request.onerror = () => reject(storageError(request.error));
      request.onsuccess = () => {
        if (rejected) { request.result.close(); return; }
        this.db = request.result;
        this.db.onversionchange = () => { this.db?.close(); this.db = null; };
        resolve(this.db);
      };
    });
  }
  async transaction(change = null) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("state", change ? "readwrite" : "readonly");
      const store = tx.objectStore("state");
      const read = store.get("root");
      let result, failure;
      read.onsuccess = () => {
        try {
          this.fault("read", tx);
          const root = read.result ?? emptyDatabase();
          result = change ? change(root) : root;
          if (change) { this.fault("before-write", tx); store.put(root, "root"); this.fault("after-write", tx); }
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(storageError(failure ?? tx.error));
    });
  }
  read() { return this.transaction(); }
  acquire(writer) {
    return this.transaction(root => {
      if (root.lease && root.lease.writer !== writer && root.lease.until > this.now()) throw new SaveError("conflict", "Another tab is using this farm. Close it before continuing.");
      root.lease = { writer, until: this.now() + 15000 };
      return root.revision;
    });
  }
  release(writer) { return this.transaction(root => { if (root.lease?.writer === writer) root.lease = null; }); }
  update(writer, revision, change) {
    return this.transaction(root => {
      if (root.revision !== revision || root.lease?.writer !== writer || root.lease.until <= this.now()) throw new SaveError("conflict", "Another tab changed this farm. Reload before continuing.");
      change(root);
      root.revision++;
      root.lease.until = this.now() + 15000;
      return root.revision;
    });
  }
  heartbeat(writer) { return this.transaction(root => {
    if (root.lease?.writer !== writer || root.lease.until <= this.now()) throw new SaveError("conflict", "The farm writer expired. Reload before continuing.");
    root.lease.until = this.now() + 15000;
  }); }
  checkpoint(writer, revision, save, { replace = false, boundary = false, research = null } = {}) {
    const detached = validateSave(save);
    return this.update(writer, revision, root => {
      if (!replace && root.active && (root.active.playthroughId !== detached.playthroughId || detached.revision <= root.active.revision)) throw new SaveError("conflict", "Stale farm checkpoint.");
      root.previous = replace ? null : boundary ? detached : root.active;
      root.active = detached;
      if (replace) root.floor = 0;
      if (boundary) root.floor = detached.revision;
      research?.(root.research);
    });
  }
  close() { this.db?.close(); this.db = null; }
}
