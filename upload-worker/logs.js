const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const reasons = new Set(['origin_not_allowed', 'invalid_upload_token', 'invalid_identity', 'unexpected_failure', 'storage_unavailable']);

export function normalizeErrors(events) {
  const failures = new Map();
  for (const event of events) {
    const source = event.source ?? {};
    const outcome = event.$workers?.outcome;
    const application = source.event === 'research_upload_failed';
    if (!application && !['exceededCpu', 'exceededMemory', 'exception', 'canceled', 'unknown'].includes(outcome)) continue;
    const requestId = String(event.$metadata?.requestId ?? '').slice(0, 100);
    const date = new Date(event.timestamp ?? source.timestamp);
    if (!Number.isFinite(date.getTime())) continue;
    const timestamp = date.toISOString();
    const participant = source.participant_code ?? event.$workers?.event?.request?.headers?.['x-participant'];
    const item = {
      timestamp, requestId,
      participant: SAFE_ID.test(participant ?? '') ? participant : null,
      reason: application ? (reasons.has(source.reason) ? source.reason : 'upload_failed') : ({ exceededCpu: 'Worker CPU limit exceeded', exceededMemory: 'Worker memory limit exceeded', exception: 'Worker exception', canceled: 'Request canceled', unknown: 'Unknown Worker failure' })[outcome],
      status: application && Number.isInteger(source.status) ? source.status : null,
    };
    const key = requestId || timestamp + item.reason;
    if (!failures.has(key) || application) failures.set(key, item);
  }
  return [...failures.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function readErrors(env, requestedHours, fetcher = fetch) {
  if (!env.OBSERVABILITY_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return Response.json({ error: 'Live logs are not connected. Add OBSERVABILITY_TOKEN to the upload Worker with Workers Observability Write/Edit permission.' }, { status: 503 });
  const hours = [1, 24, 72].includes(Number(requestedHours)) ? Number(requestedHours) : 24;
  try {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/observability/telemetry/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.OBSERVABILITY_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ queryId: 'algobot-collection-errors', dry: true, view: 'events', limit: 500,
        parameters: { needle: { value: 'error' }, filters: [{ key: '$metadata.service', operation: 'eq', type: 'string', value: 'algobot-upload' }] },
        timeframe: { from: Date.now() - hours * 3600000, to: Date.now() } }),
    });
    if (!response.ok) throw Error('query failed');
    const body = await response.json();
    if (!body.success || !Array.isArray(body.result?.events?.events)) throw Error('invalid response');
    const events = body.result.events.events;
    return Response.json({ errors: normalizeErrors(events), limited: events.length >= 500 });
  } catch {
    return Response.json({ error: 'Cloudflare logs could not be queried. Check the OBSERVABILITY_TOKEN permission and try again.' }, { status: 503 });
  }
}
