import { cleanReport, safeText } from '../../upload-worker/error-format.js';
const KEY = 'algobot_error_outbox_v1';
export function createErrorReporter({ config, context = () => ({}), storage, fetchImpl = globalThis.fetch,
  now = Date.now, uuid = () => crypto.randomUUID() } = {}) {
  let queue = [], pending = false, nextAttempt = 0, failures = 0;
  let windowStart = now(), accepted = 0;
  const seen = new Map();
  try { const saved = JSON.parse(storage?.getItem(KEY) ?? '[]'); if (Array.isArray(saved)) queue = saved.slice(-20).map(cleanReport).filter(Boolean); } catch { /* Storage failures must not prevent in-memory reporting. */ }
  const persist = () => { try { storage?.setItem(KEY, JSON.stringify(queue)); } catch { /* Keep the bounded queue in memory when browser storage is full. */ } };
  async function flush() {
    if (!config || pending || !queue.length || now() < nextAttempt) return;
    pending = true; nextAttempt = now() + 10000;
    const item = queue[0];
    try {
      const response = await fetchImpl(new URL('/errors', config.url), { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Study-Token': config.token },
        body: JSON.stringify(item), signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        if ([400, 413].includes(response.status)) { queue.shift(); persist(); }
        throw Error('Diagnostic delivery failed');
      }
      queue.shift(); failures = 0; persist();
    } catch { failures++; nextAttempt = now() + Math.min(300000, 30000 * 2 ** Math.min(failures, 4)); }
    finally { pending = false; }
  }
  function report(kind, error) {
    try {
      if (!config) return;
      const timestamp = now();
      if (timestamp - windowStart >= 3600000) { windowStart = timestamp; accepted = 0; seen.clear(); }
      const message = safeText(typeof error === 'string' ? error : error?.message || 'Unknown error').replaceAll(config.token, '[redacted]');
      const fingerprint = kind + ':' + message;
      if (accepted >= 10 || queue.length >= 20 || (seen.has(fingerprint) && timestamp - seen.get(fingerprint) < 300000)) return;
      const details = context();
      const item = cleanReport({ ...details, id: uuid(), kind, timestamp: new Date(timestamp).toISOString(), message,
        stack: typeof error?.stack === 'string' ? error.stack.split('\n').filter(line => /^\s*at /.test(line)).slice(0, 6).join('\n').replaceAll(config.token, '[redacted]') : '' });
      if (!item) return;
      accepted++; seen.set(fingerprint, timestamp); queue.push(item); persist(); void flush();
    } catch { /* Error reporting must never interrupt gameplay. */ }
  }
  return { report, flush, pendingCount: () => queue.length };
}
let active;
export function reportGameError(kind, error) { active?.report(kind, error); }
export function startErrorReporting({ target = window, ...options }) {
  const reporter = createErrorReporter(options); active = reporter;
  const onError = event => reporter.report(event.error || event.message ? 'javascript' : 'resource', event.error || event.message || 'Game resource failed to load');
  const onRejection = event => reporter.report('promise', event.reason);
  const flush = () => { void reporter.flush(); };
  target.addEventListener('error', onError, true);
  target.addEventListener('unhandledrejection', onRejection);
  target.addEventListener('online', flush);
  const timer = setInterval(flush, 10000); flush();
  return () => { clearInterval(timer); target.removeEventListener('error', onError, true); target.removeEventListener('unhandledrejection', onRejection); target.removeEventListener('online', flush); if (active === reporter) active = undefined; };
}
