import { jsonResponse, normalizeUsername } from "./auth/_utils.js";

const CONTENT_TYPE_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let signingKeyCache = { secret: "", key: null };

async function getTableColumns(db, table) {
  if (!db || !table) return new Set();
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    return new Set();
  }
}

async function resolveViewerId(db, request) {
  const headerRef = request.headers.get("x-user-id") || request.headers.get("x-user-ref") || "";
  const url = new URL(request.url);
  const queryRef = url.searchParams.get("userId") || url.searchParams.get("user") || "";
  const ref = String(headerRef || queryRef || "").trim();
  if (!ref || !db) return "";
  if (/^\d+$/.test(ref)) return ref;
  const username = normalizeUsername(ref);
  if (!username) return "";
  const row = await db.prepare("SELECT COALESCE(id, rowid) AS resolved_id FROM users WHERE lower(username) = ? LIMIT 1").bind(username).first();
  return row && row.resolved_id != null ? String(row.resolved_id) : "";
}

async function loadMedia(db, mediaId) {
  const cols = await getTableColumns(db, "media_metadata");
  if (!cols.size) return null;
  const select = ["r2_key", "content_type", "owner_user_id"];
  if (cols.has("access_level")) select.push("access_level");
  const row = await db
    .prepare(`SELECT ${select.join(", ")} FROM media_metadata WHERE id = ? LIMIT 1`)
    .bind(mediaId)
    .first();
  if (!row) return null;
  return {
    r2Key: row.r2_key,
    contentType: row.content_type || "application/octet-stream",
    ownerId: row.owner_user_id || "",
    accessLevel: row.access_level || "public",
  };
}

function guessContentTypeFromKey(key) {
  const name = String(key || "");
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === name.length - 1) return "";
  const ext = name.slice(idx + 1).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] || "";
}

function base64UrlDecodeToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized + "=".repeat(4 - padding) : normalized;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeToText(value) {
  return textDecoder.decode(base64UrlDecodeToBytes(value));
}

async function getSigningKey(secret) {
  if (!secret) return null;
  if (signingKeyCache.key && signingKeyCache.secret === secret) return signingKeyCache.key;
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  signingKeyCache = { secret, key };
  return key;
}

async function signPayload(payloadB64, secret) {
  const key = await getSigningKey(secret);
  if (!key) return "";
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payloadB64));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isSafeMediaKey(value) {
  const key = String(value || "");
  if (!(key.startsWith("story/") || key.startsWith("messages/"))) return false;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) return false;
  return true;
}

async function verifySignedToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "INVALID_TOKEN" };
  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  if (!payloadB64 || !signatureB64) return { ok: false, error: "INVALID_TOKEN" };
  let expected = "";
  try {
    expected = await signPayload(payloadB64, secret);
  } catch (error) {
    return { ok: false, error: "SIGNATURE_FAILED" };
  }
  if (!expected || !timingSafeEqual(signatureB64, expected)) return { ok: false, error: "INVALID_TOKEN" };
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToText(payloadB64));
  } catch (error) {
    return { ok: false, error: "INVALID_TOKEN" };
  }
  const keyValue =
    payload && typeof payload.key === "string" && payload.key
      ? payload.key
      : payload && typeof payload.k === "string" && payload.k
        ? payload.k
        : "";
  if (!keyValue) return { ok: false, error: "INVALID_TOKEN" };
  const exp = Number(payload && payload.exp);
  if (!Number.isFinite(exp)) return { ok: false, error: "INVALID_TOKEN" };
  const kind = payload && typeof payload.kind === "string" ? payload.kind : "";
  return { ok: true, key: keyValue, exp, kind };
}

function parseRangeHeader(value, size) {
  if (!value || !Number.isFinite(size)) return null;
  const match = String(value).match(/bytes=(\d*)-(\d*)/i);
  if (!match) return null;
  const startText = match[1];
  const endText = match[2];
  let start = startText ? Number(startText) : null;
  let end = endText ? Number(endText) : null;
  if (start == null && end == null) return null;
  if (start == null) {
    const length = end;
    if (!Number.isFinite(length) || length <= 0) return null;
    start = Math.max(size - length, 0);
    end = size - 1;
  } else {
    if (!Number.isFinite(start) || start < 0) return null;
    if (end == null || !Number.isFinite(end) || end >= size) {
      end = size - 1;
    }
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

const CACHE_CONTROL = "public, max-age=604800, immutable";
const SIGNED_CACHE_CONTROL = "private, no-store";

function applyMediaHeaders(headers, object, contentType, key, head, cacheControl) {
  if (object && typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  const resolvedType = contentType || headers.get("content-type") || guessContentTypeFromKey(key) || "application/octet-stream";
  headers.set("content-type", resolvedType);
  const etag = (object && object.etag) || (head && head.etag);
  if (etag) headers.set("etag", etag);
  const uploaded = (object && object.uploaded) || (head && head.uploaded);
  if (uploaded) {
    const uploadedAt = uploaded instanceof Date ? uploaded : new Date(uploaded);
    if (!Number.isNaN(uploadedAt.getTime())) {
      headers.set("last-modified", uploadedAt.toUTCString());
    }
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", cacheControl || CACHE_CONTROL);
  headers.set("content-disposition", "inline");
}

async function serveSignedToken(context, rawToken) {
  const env = context?.env;
  const secret = env && typeof env.MEDIA_SIGNING_SECRET === "string" ? env.MEDIA_SIGNING_SECRET.trim() : "";
  if (!secret) return jsonResponse({ ok: false, error: "MEDIA_SIGNING_NOT_CONFIGURED" }, 503);
  let token = rawToken;
  try {
    token = decodeURIComponent(rawToken);
  } catch (error) {}
  const verified = await verifySignedToken(token, secret);
  if (!verified.ok) return jsonResponse({ ok: false, error: verified.error || "INVALID_TOKEN" }, 401);
  if (!isSafeMediaKey(verified.key)) return jsonResponse({ ok: false, error: "INVALID_KEY" }, 401);
  const now = Math.floor(Date.now() / 1000);
  if (verified.exp <= now) return jsonResponse({ ok: false, error: "TOKEN_EXPIRED" }, 403);

  const isMessageKey = verified.key.startsWith("messages/");
  const bucket = isMessageKey ? env?.R2_MESSAGES : env?.R2_PROFILE;
  if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);

  const rangeHeader = context?.request?.headers?.get("range") || "";
  if (rangeHeader) {
    const head = await bucket.head(verified.key);
    if (!head) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
    const size = Number(head.size || 0);
    const range = parseRangeHeader(rangeHeader, size);
    if (!range) {
      const headers = new Headers();
      headers.set("content-range", `bytes */${size}`);
      headers.set("accept-ranges", "bytes");
      return new Response(null, { status: 416, headers });
    }
    const length = range.end - range.start + 1;
    const object = await bucket.get(verified.key, { range: { offset: range.start, length } });
    if (!object) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
    const headers = new Headers();
    const contentType = object.httpMetadata?.contentType || head.httpMetadata?.contentType || "application/octet-stream";
    applyMediaHeaders(headers, object, contentType, verified.key, head, SIGNED_CACHE_CONTROL);
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  const object = await bucket.get(verified.key);
  if (!object) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
  const headers = new Headers();
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  applyMediaHeaders(headers, object, contentType, verified.key, undefined, SIGNED_CACHE_CONTROL);
  if (Number.isFinite(object.size)) {
    headers.set("content-length", String(object.size));
  }
  return new Response(object.body, { headers });
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const signedToken = url.searchParams.get("t") || url.searchParams.get("token") || "";
    if (signedToken) {
      return await serveSignedToken(context, signedToken);
    }
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db || !bucket) return jsonResponse({ ok: false, error: "MEDIA_NOT_AVAILABLE" }, 503);
    const mediaId = url.searchParams.get("id") || url.searchParams.get("mediaId") || "";
    if (!mediaId) return jsonResponse({ ok: false, error: "MISSING_MEDIA_ID" }, 400);

    const media = await loadMedia(db, mediaId);
    if (!media) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
    if (String(media.accessLevel).toLowerCase() !== "public") {
      const viewerId = await resolveViewerId(db, context.request);
      if (!viewerId || String(viewerId) !== String(media.ownerId || "")) {
        return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
      }
    }

    const rangeHeader = context?.request?.headers?.get("range") || "";
    if (rangeHeader) {
      const head = await bucket.head(media.r2Key);
      if (!head) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
      const size = Number(head.size || 0);
      const range = parseRangeHeader(rangeHeader, size);
      if (!range) {
        const headers = new Headers();
        headers.set("content-range", `bytes */${size}`);
        headers.set("accept-ranges", "bytes");
        return new Response(null, { status: 416, headers });
      }
      const length = range.end - range.start + 1;
      const object = await bucket.get(media.r2Key, { range: { offset: range.start, length } });
      if (!object) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
      const headers = new Headers();
      const contentType = object.httpMetadata?.contentType || head.httpMetadata?.contentType || media.contentType;
      applyMediaHeaders(headers, object, contentType, media.r2Key, head);
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(length));
      return new Response(object.body, { status: 206, headers });
    }

    const object = await bucket.get(media.r2Key);
    if (!object) return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
    const headers = new Headers();
    const contentType = object.httpMetadata?.contentType || media.contentType;
    applyMediaHeaders(headers, object, contentType, media.r2Key);
    if (Number.isFinite(object.size)) {
      headers.set("content-length", String(object.size));
    }
    return new Response(object.body, { headers });
  } catch (error) {
    return jsonResponse({ ok: false, error: "MEDIA_NOT_FOUND" }, 404);
  }
}
