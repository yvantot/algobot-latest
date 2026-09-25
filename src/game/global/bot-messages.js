const farms = new WeakMap();

export function joinBotInbox(farm, id) {
  let channel = farms.get(farm);
  if (!channel) farms.set(farm, channel = {inboxes:new Map(),nextId:0});
  const {inboxes} = channel;
  const queue = [];
  let active=true, sentId=null, receipt=null;
  inboxes.set(id, queue);
  return {
    send(target, value) {
      if (!active) throw Error("This bot has left the farm.");
      if (!Number.isInteger(target) || !inboxes.has(target)) throw Error("That bot is not on this farm.");
      if (!["string", "number", "boolean"].includes(typeof value) ||
          (typeof value === "number" && !Number.isFinite(value)) || String(value).length > 200) {
        throw Error("Send text (up to 200 characters), a finite number, or true/false.");
      }
      const destination = inboxes.get(target);
      if (destination.length >= 32) throw Error("That bot's inbox is full. Receive its messages first.");
      sentId=++channel.nextId;
      destination.push({id:sentId,sender:id,value});
      return true;
    },
    hasMessage: () => active && queue.length > 0,
    receive() { receipt=active&&queue.length?queue.shift():null; return receipt?.value ?? ""; },
    sentId: () => sentId,
    receipt: () => receipt,
    leave() { active=false;receipt=null;if (inboxes.get(id) === queue) inboxes.delete(id); queue.length = 0; },
  };
}
