import { normalizeUsername } from "../api/auth/_utils.js";

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

async function resolveMediaId(db, token) {
  const cols = await getTableColumns(db, "media_tokens");
  if (!cols.has("token") || !cols.has("media_id")) return "";
  const row = await db.prepare("SELECT media_id FROM media_tokens WHERE token = ? LIMIT 1").bind(token).first();
  return row && row.media_id ? String(row.media_id) : "";
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

function applyMediaHeaders(headers, object, contentType, key) {
  if (object && typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  const resolvedType = contentType || headers.get("content-type") || guessContentTypeFromKey(key) || "application/octet-stream";
  headers.set("content-type", resolvedType);
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "no-store");
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db || !bucket) return new Response("Not found", { status: 404 });
    const token = context?.params?.token ? String(context.params.token) : "";
    if (!/^[A-Za-z0-9]{12,32}$/.test(token)) {
      return new Response("Not found", { status: 404 });
    }
    const mediaId = await resolveMediaId(db, token);
    if (!mediaId) return new Response("Not found", { status: 404 });
    const media = await loadMedia(db, mediaId);
    if (!media) return new Response("Not found", { status: 404 });
    if (String(media.accessLevel).toLowerCase() !== "public") {
      const viewerId = await resolveViewerId(db, context.request);
      if (!viewerId || String(viewerId) !== String(media.ownerId || "")) {
        return new Response("Forbidden", { status: 403 });
      }
    }
    const rangeHeader = context?.request?.headers?.get("range") || "";
    if (rangeHeader) {
      const head = await bucket.head(media.r2Key);
      if (!head) return new Response("Not found", { status: 404 });
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
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      const contentType = object.httpMetadata?.contentType || head.httpMetadata?.contentType || media.contentType;
      applyMediaHeaders(headers, object, contentType, media.r2Key);
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(length));
      return new Response(object.body, { status: 206, headers });
    }
    const object = await bucket.get(media.r2Key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    const contentType = object.httpMetadata?.contentType || media.contentType;
    applyMediaHeaders(headers, object, contentType, media.r2Key);
    if (Number.isFinite(object.size)) {
      headers.set("content-length", String(object.size));
    }
    return new Response(object.body, { headers });
  } catch (error) {
    return new Response("Not found", { status: 404 });
  }
}
