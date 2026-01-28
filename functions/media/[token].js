import { jsonResponse } from "../api/auth/_utils.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let signingKeyCache = { secret: "", key: null };

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

function errorResponse(code, status, options = {}) {
  return jsonResponse(
    {
      ok: false,
      error: code,
      where: "MEDIA_GET",
      hint: options.hint || "",
      message: options.message || "",
    },
    status
  );
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
  return base64UrlEncodeBytes(new Uint8Array(signature));
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
  if (!(key.startsWith("story/") || key.startsWith("messages/") || key.startsWith("store-avatar/"))) return false;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) return false;
  return true;
}

function guessContentTypeFromKey(key) {
  const name = String(key || "");
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === name.length - 1) return "";
  const ext = name.slice(idx + 1).toLowerCase();
  return CONTENT_TYPE_BY_EXT[ext] || "";
}

async function verifyToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "INVALID_TOKEN" };
  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  if (!payloadB64 || !signatureB64) return { ok: false, error: "INVALID_TOKEN" };

  let expected = "";
  try {
    expected = await signPayload(payloadB64, secret);
  } catch (error) {
    return { ok: false, error: "SIGNATURE_FAILED", message: error && error.message ? error.message : "" };
  }
  if (!expected || !timingSafeEqual(signatureB64, expected)) return { ok: false, error: "INVALID_TOKEN" };

  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToText(payloadB64));
  } catch (error) {
    return { ok: false, error: "INVALID_TOKEN" };
  }
  if (!payload) return { ok: false, error: "INVALID_TOKEN" };
  const keyValue =
    typeof payload.key === "string" && payload.key
      ? payload.key
      : typeof payload.k === "string" && payload.k
        ? payload.k
        : "";
  if (!keyValue) return { ok: false, error: "INVALID_TOKEN" };
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp)) return { ok: false, error: "INVALID_TOKEN" };

  const kind = typeof payload.kind === "string" ? payload.kind : "";
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

const CACHE_CONTROL = "private, no-store";

function applyMediaHeaders(headers, object, contentType, key, head) {
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
  headers.set("cache-control", CACHE_CONTROL);
  headers.set("content-disposition", "inline");
}

export async function onRequestGet(context) {
  try {
    const secret =
      context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
    if (!secret) {
      return errorResponse("MEDIA_SIGNING_NOT_CONFIGURED", 503, { hint: "Set MEDIA_SIGNING_SECRET" });
    }

    const rawToken = context && context.params && context.params.token ? String(context.params.token) : "";
    if (!rawToken) return errorResponse("MISSING_TOKEN", 400);

    let token = rawToken;
    try {
      token = decodeURIComponent(rawToken);
    } catch (error) {}

    const verified = await verifyToken(token, secret);
    if (!verified.ok) {
      return errorResponse(verified.error, 401, { message: verified.message || "" });
    }
    if (!isSafeMediaKey(verified.key)) return errorResponse("INVALID_KEY", 401);

    const now = Math.floor(Date.now() / 1000);
    if (verified.exp <= now) return errorResponse("TOKEN_EXPIRED", 403);

    const isMessageKey = verified.key.startsWith("messages/");
    const isStoreAvatarKey = verified.key.startsWith("store-avatar/");
    const bucket = isMessageKey ? context?.env?.R2_MESSAGES : isStoreAvatarKey ? context?.env?.R2_STORE_AVATARS : context?.env?.R2_PROFILE;
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        hint: isMessageKey ? "Set R2_MESSAGES binding" : isStoreAvatarKey ? "Set R2_STORE_AVATARS binding" : "Set R2_PROFILE binding",
      });
    }

    const rangeHeader = context?.request?.headers?.get("range") || "";
    if (rangeHeader) {
      const head = await bucket.head(verified.key);
      if (!head) return errorResponse("NOT_FOUND", 404);
      const size = Number(head.size || 0);
      const range = parseRangeHeader(rangeHeader, size);
      if (!range) {
        const headers = new Headers();
        headers.set("content-range", `bytes */${size}`);
        headers.set("accept-ranges", "bytes");
        return new Response(null, { status: 416, headers });
      }
      const length = range.end - range.start + 1;
      const object = await bucket.get(verified.key, {
        range: { offset: range.start, length },
      });
      if (!object) return errorResponse("NOT_FOUND", 404);
      const headers = new Headers();
      const contentType = object.httpMetadata?.contentType || head.httpMetadata?.contentType || "application/octet-stream";
      applyMediaHeaders(headers, object, contentType, verified.key, head);
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(length));
      return new Response(object.body, { status: 206, headers });
    }

    const object = await bucket.get(verified.key);
    if (!object) return errorResponse("NOT_FOUND", 404);
    const headers = new Headers();
    const contentType = object.httpMetadata?.contentType || "application/octet-stream";
    applyMediaHeaders(headers, object, contentType, verified.key);
    if (Number.isFinite(object.size)) {
      headers.set("content-length", String(object.size));
    }
    return new Response(object.body, { headers });
  } catch (error) {
    return errorResponse("INTERNAL", 500, { message: error && error.message ? error.message : "" });
  }
}
