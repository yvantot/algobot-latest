// Repeated predictions of the same mode must not restart a dismissed notice.
export function createTransientNotice(show, { duration = 6500, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let last = "";
  let timer;
  return {
    update(message) {
      if (message === last) return false;
      last = message;
      cancel(timer);
      show(message);
      if (message) timer = schedule(() => show(""), duration);
      return Boolean(message);
    },
    dispose() { cancel(timer); },
  };
}
