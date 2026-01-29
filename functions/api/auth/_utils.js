const encoder = new TextEncoder();
export const MIN_PASSWORD_LENGTH = 6;
const USERNAME_REGEX = /^[a-z0-9._-]{3,20}$/;

export function jsonResponse(payload, status = 200) {
  let body = payload;
  if (payload && typeof payload === "object" && payload.ok === false && payload.status == null) {
    body = { ...payload, status };
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeUsername(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.toLowerCase() : "";
}

export function isValidUsername(value) {
  return USERNAME_REGEX.test(String(value || ""));
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function readJsonBody(request) {
  if (!request) return null;
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const hash = await hashWithSalt(password, salt);
  return { hash, salt };
}

export async function verifyPassword(password, saltValue, hashValue) {
  const salt = String(saltValue || "");
  const expected = String(hashValue || "");
  if (!salt || !expected) return false;
  const hash = await hashWithSalt(password, salt);
  return safeEqual(hash, expected);
}

export function logError(scope, error) {
  const message = error && error.message ? error.message : String(error);
  console.error(scope, message);
}

export function generateId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10, 16).join("")}`;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashWithSalt(password, salt) {
  const data = encoder.encode(`${salt}:${String(password || "")}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(buf));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
