export const COLLECTION_INTERVAL_MS = 5000;

// Research sampling must continue even when inference is unavailable or disabled.
export function startCollection({ tracker, getContext, schedule = setInterval, cancel = clearInterval }) {
  tracker.collectionEnabled = true;
  tracker.getCollectionContext = getContext;
  function tick() {
    const context = getContext();
    tracker.setCollectionContext(context);
    if (["gameplay", "guided_practice"].includes(context.phase)) tracker.sampleCollection();
  }
  tick();
  const timer = schedule(tick, COLLECTION_INTERVAL_MS);
  return () => { cancel(timer); tracker.getCollectionContext = null; };
}
