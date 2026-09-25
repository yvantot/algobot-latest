const farms = new WeakMap();

export function joinBotInbox(farm, id) {
  let inboxes = farms.get(farm);
  if (!inboxes) farms.set(farm, inboxes = new Map());
  const queue = [];
  inboxes.set(id, queue);
  return {
    send(target, value) {
      if (!Number.isInteger(target) || !inboxes.has(target)) throw Error("That bot is not on this farm.");
      if (!["string", "number", "boolean"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value)) || String(value).length > 200) {
        throw Error("Send text (up to 200 characters), a finite number, or true/false.");
      }
      const destination = inboxes.get(target);
      if (destination.length >= 32) throw Error("That bot's inbox is full. Receive its messages first.");
      destination.push(value);
      return true;
    },
    hasMessage: () => queue.length > 0,
    receive: () => queue.length ? queue.shift() : "",
    leave() { if (inboxes.get(id) === queue) inboxes.delete(id); queue.length = 0; },
  };
}
