import { cleanReport } from './error-format.js';
export async function receiveError(request, env, reply) {
  if (!env.STUDY_TOKEN || request.headers.get('X-Study-Token') !== env.STUDY_TOKEN) return reply(403, {error:'bad token'});
  if (!request.body) return reply(400, {error:'missing report'});
  const reader = request.body.getReader();
  let length = 0; const chunks = [];
  try {
    while (true) {
      const {done,value} = await reader.read(); if(done) break;
      length += value.byteLength;
      if(length > 8192) { await reader.cancel(); return reply(413,{error:'report too large'}); }
      chunks.push(value);
    }
    const body = new Uint8Array(length); let offset=0;
    for(const chunk of chunks) { body.set(chunk,offset); offset+=chunk.length; }
    const report = cleanReport(JSON.parse(new TextDecoder().decode(body)));
    if (!report) return reply(400, {error:'invalid report'});
    console.error({event:'game_client_error', report_id:report.id, participant_code:report.participant,
      session_id:report.session, kind:report.kind, build:report.build, message:report.message,
      stack:report.stack, occurred_at:report.timestamp, timestamp:new Date().toISOString()});
    return reply(200, {ok:true});
  } catch { return reply(400, {error:'invalid report'}); }
}
