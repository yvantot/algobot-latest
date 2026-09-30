// Receives research dataset uploads from the game and stores them in R2.
// Students can only write. Listing and downloading require ADMIN_TOKEN, which
// never ships in the game.
import { MAX_UPLOAD_BYTES, SAFE_ID, readLimited, decodeUpload } from "./dataset.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    const cors = {
      ...(allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Study-Token, X-Participant, X-Session",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (status, body) => Response.json(body, { status, headers: cors });

    if (origin && !allowed.includes(origin)) return reply(403, { error: "origin not allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "POST" && url.pathname === "/upload") return upload(request, env, reply);
    if (request.method === "GET" && url.pathname.startsWith("/admin/")) return admin(request, env, url);
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
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_UPLOAD_BYTES) return reply(413, { error: "too large" });
  let body, hash;
  try {
    body = await readLimited(request.body, MAX_UPLOAD_BYTES);
    if (!body.byteLength) return reply(413, { error: "empty upload" });
    ({ hash } = await decodeUpload(body, { participant, session }));
  } catch (error) { return reply(error.status === 413 ? 413 : 400, { error: error.status === 413 ? "too large" : "invalid sealed gzip dataset" }); }

  // Immutable content keys preserve newer snapshots even when older requests retry.
  const key = `${env.ROUND}/${participant}/${session}--${hash}.json.gz`;
  const stored = await env.DATA.put(key, body, {
    onlyIf: new Headers({ "If-None-Match": "*" }),
    httpMetadata: { contentType: "application/gzip" },
    customMetadata: { receivedAt: new Date().toISOString() },
  });
  return reply(200, { ok: true, key, duplicate: stored === null });
}

async function admin(request, env, url) {
  if (!env.ADMIN_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
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
