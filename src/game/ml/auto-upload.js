export const AUTO_UPLOAD_INTERVAL_MS = 60000;

export function startAutoUpload({ upload, onError, onSuccess = () => {}, enabled = () => true,
  windowTarget = globalThis.window, documentTarget = globalThis.document,
  schedule = setInterval, cancel = clearInterval }) {
  let pending = null, stopped = false;
  function send() {
    if (stopped || !enabled()) return Promise.resolve();
    if (pending) return pending;
    pending = Promise.resolve().then(upload).then(onSuccess, onError).finally(() => { pending = null; });
    return pending;
  }
  const visible = () => { if (documentTarget.visibilityState === 'visible') void send(); };
  const online = () => { void send(); };
  const timer = schedule(send, AUTO_UPLOAD_INTERVAL_MS);
  windowTarget.addEventListener('online', online);
  documentTarget.addEventListener('visibilitychange', visible);
  return { send, stop() {
    stopped = true; cancel(timer);
    windowTarget.removeEventListener('online', online);
    documentTarget.removeEventListener('visibilitychange', visible);
  } };
}
