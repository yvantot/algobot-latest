let listener = null;
export function onPersistenceChange(callback) { listener = callback; }
export function persistenceChanged() { listener?.(); }
