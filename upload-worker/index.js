// Receives research dataset uploads from the game and stores them in R2.
// Students can only write. Listing and downloading require ADMIN_TOKEN, which
// never ships in the game.
import { dashboardHTML, dashboardCSS, dashboardJS } from './dashboard.js';
import { readErrors } from './logs.js';
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const assets = { '/': [dashboardHTML, 'text/html'], '/dashboard.css': [dashboardCSS, 'text/css'], '/dashboard.js': [dashboardJS, 'application/javascript'] };
      if (Object.hasOwn(assets, url.pathname)) return new Response(assets[url.pathname][0], { headers: { ...PRIVATE_HEADERS, 'Content-Type': assets[url.pathname][1] + '; charset=utf-8' } });
      if (url.pathname.startsWith('/admin/')) {
        let response;
        try { response = await admin(request, env, url); }
        catch { response = Response.json({ error: 'Collection service unavailable. Try refreshing shortly.' }, { status: 503 }); }
        for (const [key, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(key, value);
        return response;
      }
    }
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    const cors = {
      ...(allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Study-Token, X-Participant, X-Session",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) => {
      if (status >= 400 && request.method === "POST" && url.pathname === "/upload") {
        const participant = request.headers.get("X-Participant") ?? "";
        const session = request.headers.get("X-Session") ?? "";
        console.error({ event: "research_upload_failed", participant_code: SAFE_ID.test(participant) ? participant : null,
          session_id: SAFE_ID.test(session) ? session : null, identity_source: "request_headers",
          round: SAFE_ID.test(env.ROUND ?? "") ? env.ROUND : null, status,
          reason: uploadFailureReason(body.error), timestamp: new Date().toISOString() });
      }
      return Response.json(body, { status, headers: cors });
    };

    if (origin && !allowed.includes(origin)) return reply(403, { error: "origin not allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "POST" && url.pathname === "/upload") {
      try { return await upload(request, env, reply); }
      catch { return reply(503, { error: "unexpected upload failure" }); }
    }
    return reply(404, { error: "not found" });
  },
};

async function upload(request, env, reply) {
  if (!env.STUDY_TOKEN || request.headers.get("X-Study-Token") !== env.STUDY_TOKEN) {
    return reply(403, { error: "bad token" });
  }
  const participant = request.headers.get("X-Participant") ?? "";
  const session = request.headers.get("X-Session") ?? "";
  if (!SAFE_ID.test(participant) || !SAFE_ID.test(session)) {
    return reply(400, { error: "bad participant or session id" });
  }
  console.info({ event: "research_upload_started", participant_code: participant, session_id: session,
    identity_source: "request_headers", round: env.ROUND, timestamp: new Date().toISOString() });
  const key = `${env.ROUND}/${participant}/data.json.gz`;
  try {
    await env.DATA.put(key, request.body, {
      httpMetadata: { contentType: "application/gzip" },
      customMetadata: { receivedAt: new Date().toISOString(), storageFormat: "raw_player_upload_v1" },
    });
    console.info({ event: "research_upload_stored", participant_code: participant, session_id: session,
      identity_source: "request_headers", round: env.ROUND, timestamp: new Date().toISOString() });
    return reply(200, { ok: true, key });
  } catch {
    return reply(503, { error: "Storage temporarily unavailable; retry shortly." });
  }
}

async function admin(request, env, url) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (url.pathname === '/admin/errors') return readErrors(env, url.searchParams.get('hours'));
  if (url.pathname === "/admin/list") {
    const objects = [];
    let cursor;
    do {
      const page = await env.DATA.list({ prefix: url.searchParams.get("prefix") ?? "", cursor });
      for (const object of page.objects) objects.push({ key: object.key, size: object.size, uploaded: object.uploaded });
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ objects });
  }
  if (url.pathname === "/admin/file") {
    const object = await env.DATA.get(url.searchParams.get("key") ?? "");
    if (!object) return Response.json({ error: "not found" }, { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": "application/gzip" } });
  }
  return Response.json({ error: "not found" }, { status: 404 });
}

function uploadFailureReason(message) {
  const reasons = {
    "origin not allowed": "origin_not_allowed", "bad token": "invalid_upload_token",
    "bad participant or session id": "invalid_identity",
    "unexpected upload failure": "unexpected_failure",
  };
  return Object.hasOwn(reasons, message) ? reasons[message] : "storage_unavailable";
}
