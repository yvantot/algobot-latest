const key = event => JSON.stringify(event);
export const uniqueEvents = events => [...new Map(events.map(event => [key(event), event])).values()];
export const eventPrefix = (before, after) => before.length <= after.length && before.every((event, i) => key(event) === key(after[i]));

// Older IndexedDB saves collapsed identical events. Accept only that exact
// representation difference, retaining the cloud's original events and order.
export function extendEventHistory(before, after) {
  if (eventPrefix(before, after)) return after;
  const oldUnique = uniqueEvents(before), newUnique = uniqueEvents(after);
  if (!eventPrefix(oldUnique, newUnique)) return null;
  const known = new Set(oldUnique.map(key));
  return [...before, ...after.filter(event => !known.has(key(event)))];
}
