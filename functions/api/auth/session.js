const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = "bk_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;
let signingCache = { secret: "", key: null };

function getSessionSecret(env) {
  const raw = env && typeof env.SESSION_SECRET === "string" ? env.SESSION_SECRET : "";
  return String(raw || "").trim();
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(encoder.encode(String(value)));
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
  return decoder.decode(base64UrlDecodeToBytes(value));
}

async function getSigningKey(secret) {
  if (!secret) return null;
  if (signingCache.key && signingCache.secret === secret) return signingCache.key;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
  signingCache = { secret, key };
  return key;
}

async function signPayload(payloadB64, secret) {
  const key = await getSigningKey(secret);
  if (!key) return "";
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function parseCookies(header) {
  const output = {};
  const raw = String(header || "");
  if (!raw) return output;
  raw.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    output[key] = value;
  });
  return output;
}

function buildCookie(token, options = {}) {
  const maxAge = Math.max(0, Math.floor(options.maxAge || 0));
  const expiresAt = options.expiresAt || (maxAge ? new Date(Date.now() + maxAge * 1000) : null);
  const parts = [`${SESSION_COOKIE}=${token}`];
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("SameSite=Strict");
  parts.push("Secure");
  if (maxAge) parts.push(`Max-Age=${maxAge}`);
  if (expiresAt) parts.push(`Expires=${expiresAt.toUTCString()}`);
  return parts.join("; ");
}

export function buildSessionCookie(user, env, options = {}) {
  return createSessionCookie(user, env, options);
}

export async function createSessionCookie(user, env, options = {}) {
  const secret = getSessionSecret(env);
  if (!secret) return null;
  if (!user || user.id == null || String(user.id).trim() === "") return null;
  const ttl = Number.isFinite(options.ttlSeconds) ? Math.max(60, Math.floor(options.ttlSeconds)) : DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;
  const payload = {
    uid: String(user.id),
    role: user.role ? String(user.role) : "user",
    username: user.username ? String(user.username) : "",
    email: user.email ? String(user.email) : "",
    name: user.display_name || user.name ? String(user.display_name || user.name) : "",
    avatar: user.avatar_url || user.avatar ? String(user.avatar_url || user.avatar) : "",
    exp,
  };
  const payloadB64 = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(payloadB64, secret);
  if (!signature) return null;
  const token = `${payloadB64}.${signature}`;
  const cookie = buildCookie(token, { maxAge: ttl, expiresAt: new Date(exp * 1000) });
  return { token, cookie, exp, payload };
}

export function buildLogoutCookie() {
  const past = new Date(0);
  return buildCookie("", { maxAge: 0, expiresAt: past });
}

export async function getSessionUser(request, env) {
  if (!request) return null;
  const secret = getSessionSecret(env);
  if (!secret) return null;
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const token = cookies[SESSION_COOKIE] || "";
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0];
  const signature = parts[1];
  if (!payloadB64 || !signature) return null;
  const expected = await signPayload(payloadB64, secret);
  if (!expected || !safeEqual(signature, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToText(payloadB64));
  } catch (error) {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const exp = Number(payload.exp || 0);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;
  const id = payload.uid != null ? String(payload.uid) : "";
  if (!id) return null;
  return {
    id,
    role: payload.role ? String(payload.role) : "user",
    username: payload.username ? String(payload.username) : "",
    email: payload.email ? String(payload.email) : "",
    name: payload.name ? String(payload.name) : "",
    display_name: payload.name ? String(payload.name) : "",
    avatar: payload.avatar ? String(payload.avatar) : "",
    avatar_url: payload.avatar ? String(payload.avatar) : "",
  };
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
