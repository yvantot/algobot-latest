export const ERROR_KINDS = new Set(['javascript', 'promise', 'resource', 'save_load', 'research_save', 'challenge', 'upload']);
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export function safeText(value, limit = 500) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 8000)
    .replace(/https?:\/\/[^\s)]+/g, value => value.split(/[?#]/)[0])
    .replace(/(?:Bearer\s+\S+|(?:token|password|secret|authorization)\s*[:=]\s*\S+)/gi, '[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/["'`][^"'`]*["'`]/g, '[quoted text]')
    .slice(0, limit);
}
export function cleanReport(value) {
  if (!value || !ERROR_KINDS.has(value.kind) || !ID.test(value.id ?? '')) return null;
  const date = new Date(value.timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return { id: value.id, kind: value.kind, timestamp: date.toISOString(),
    participant: ID.test(value.participant ?? '') ? value.participant : null,
    session: ID.test(value.session ?? '') ? value.session : null,
    build: safeText(value.build, 80), message: safeText(value.message),
    stack: safeText(value.stack, 1000) };
}
