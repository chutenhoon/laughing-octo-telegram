import {
  generateId,
  isValidEmail,
  jsonResponse,
  logError,
  normalizeEmail,
  normalizeUsername,
  readJsonBody,
} from "./auth/_utils.js";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MAX_THUMB_SIZE = 512 * 1024;
const MAX_STORIES = 4;
const MAX_TITLE_LENGTH = 80;
const STORY_TTL_DAYS = 30;
const STORY_TTL_MS = STORY_TTL_DAYS * 24 * 60 * 60 * 1000;
const ONLINE_WINDOW_SEC = 60;
const MEDIA_ACCESS_PUBLIC = "public";
const MEDIA_TOKEN_LENGTH = 18;
const MEDIA_TOKEN_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MEDIA_TOKEN_TTL_SEC = 24 * 60 * 60;
const PROFILE_STATS_CACHE_TTL_MS = 30000;
const PROFILE_STORIES_CACHE_TTL_MS = 30000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let signingKeyCache = { secret: "", key: null };
const profileStatsCache = new Map();
const profileStoriesCache = new Map();

const MEDIA_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function readCache(cache, key) {
  if (!cache || !key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(cache, key, value, ttlMs) {
  if (!cache || !key) return;
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function invalidateCache(cache, key) {
  if (!cache || !key) return;
  cache.delete(key);
}

function invalidateStoryCache(ownerId) {
  const key = ownerId != null ? String(ownerId) : "";
  if (!key) return;
  invalidateCache(profileStoriesCache, key);
}

function isDevEnv(env) {
  const mode = String(env && (env.ENVIRONMENT || env.NODE_ENV || env.ENV || env.DEBUG) || "").toLowerCase();
  return mode.includes("dev") || mode === "1" || mode === "true";
}

function logSlowQuery(label, startedAt, env) {
  const duration = Date.now() - startedAt;
  if (duration <= 300) return;
  if (!isDevEnv(env)) return;
  console.log(`[SLOW_QUERY] ${label} ${duration}ms`);
}

const FEATURED_MEDIA_SELECT =
  "user_id AS userId, slot, title, media_type AS mediaType, r2_key AS mediaKey, thumb_key AS thumbKey, thumb_type AS thumbType, thumb_size AS thumbSize, size, created_at AS createdAt, updated_at AS updatedAt";

function jsonError(error, status, where) {
  const payload = { ok: false, error };
  if (where) payload.where = where;
  return jsonResponse(payload, status);
}

function errorResponse(code, status, options = {}) {
  return jsonResponse(
    {
      ok: false,
      error: code,
      where: options.where || "",
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

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(textEncoder.encode(String(value)));
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

function getMediaSigningSecret(env) {
  const secret = env && typeof env.MEDIA_SIGNING_SECRET === "string" ? env.MEDIA_SIGNING_SECRET.trim() : "";
  return secret || "";
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

async function signMediaPayload(payloadB64, secret) {
  const key = await getSigningKey(secret);
  if (!key) return "";
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payloadB64));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function safeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySignedMediaToken(token, secret) {
  if (!token || !secret) return { ok: false };
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false };
  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  if (!payloadB64 || !signatureB64) return { ok: false };
  let expected = "";
  try {
    expected = await signMediaPayload(payloadB64, secret);
  } catch (error) {
    return { ok: false };
  }
  if (!expected || !safeEqual(signatureB64, expected)) return { ok: false };
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToText(payloadB64));
  } catch (error) {
    return { ok: false };
  }
  if (!payload) return { ok: false };
  const keyValue =
    typeof payload.key === "string" && payload.key
      ? payload.key
      : typeof payload.k === "string" && payload.k
        ? payload.k
        : "";
  if (!keyValue) return { ok: false };
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp)) return { ok: false };
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return { ok: true, key: keyValue, exp, kind };
}

async function createSignedMediaToken(secret, key, exp, kind) {
  if (!secret || !key) return "";
  const payload = { key, exp };
  if (kind) payload.kind = kind;
  const payloadB64 = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signMediaPayload(payloadB64, secret);
  if (!signature) return "";
  return `${payloadB64}.${signature}`;
}

function normalizeIdValue(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function normalizeSlotValue(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  if (raw >= 1 && raw <= 4) return Math.floor(raw);
  if (raw >= 0 && raw <= 3) return Math.floor(raw) + 1;
  return null;
}

function resolveUserIdValue(user, columns) {
  const hasId = columns && columns.has("id");
  if (!user) return { field: hasId ? "id" : "rowid", value: null };
  const rawId = user.id ?? null;
  const rawRowId = user.row_id ?? null;
  if (hasId) {
    const idValue = normalizeIdValue(rawId);
    if (idValue != null) return { field: "id", value: idValue };
    const rowValue = normalizeIdValue(rawRowId);
    if (rowValue != null) return { field: "id", value: rowValue };
    return { field: "id", value: null };
  }
  const rowValue = normalizeIdValue(rawRowId);
  return { field: "rowid", value: rowValue != null ? rowValue : rawId };
}

function normalizeIdentifierValue(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  return raw ? raw : "";
}

function getUserIdentifierSet(user, userColumns) {
  const ids = new Set();
  const push = (value) => {
    const normalized = normalizeIdentifierValue(value);
    if (normalized) ids.add(normalized);
  };
  if (!user) return [];
  push(user.id);
  push(user.user_id);
  push(user.userId);
  push(user.row_id);
  push(user.rowid);
  return Array.from(ids);
}

function normalizeIdentifierList(values) {
  const items = Array.isArray(values) ? values : values instanceof Set ? Array.from(values) : values ? [values] : [];
  const normalized = [];
  const seen = new Set();
  for (const value of items) {
    const cleaned = normalizeIdentifierValue(value);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    normalized.push(cleaned);
  }
  return normalized;
}

function getPrimaryUserId(user) {
  const idValue = normalizeIdentifierValue(user && user.id);
  if (idValue) return idValue;
  const rowValue = normalizeIdentifierValue(user && (user.row_id ?? user.rowid));
  if (rowValue) return rowValue;
  return normalizeIdentifierValue(user && (user.user_id ?? user.userId));
}

function getStoryRowTimestamp(row) {
  const updated = parseDateValue(row && (row.updatedAt || row.updated_at));
  if (updated) return updated.getTime();
  const created = parseDateValue(row && (row.createdAt || row.created_at));
  return created ? created.getTime() : 0;
}

function pickPreferredStoryRow(left, right) {
  if (!left) return right;
  if (!right) return left;
  return getStoryRowTimestamp(right) > getStoryRowTimestamp(left) ? right : left;
}

function getStoryRowTimestamps(row) {
  let createdAt = row && (row.createdAt || row.created_at) ? String(row.createdAt || row.created_at) : "";
  let updatedAt = row && (row.updatedAt || row.updated_at) ? String(row.updatedAt || row.updated_at) : "";
  if (!createdAt) createdAt = updatedAt || new Date().toISOString();
  if (!updatedAt) updatedAt = createdAt;
  return { createdAt, updatedAt };
}

function parseDateValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  const raw = String(value || "");
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    return new Date(num < 1e12 ? num * 1000 : num);
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEpochSeconds(value) {
  if (value == null || value === "") return null;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
}

function isOnlineNow(lastSeen) {
  const seconds = normalizeEpochSeconds(lastSeen);
  if (!seconds) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - seconds <= ONLINE_WINDOW_SEC;
}

function isExpiredDate(value) {
  const date = parseDateValue(value);
  if (!date) return false;
  return Date.now() - date.getTime() > STORY_TTL_MS;
}

function getBucketName(env) {
  const raw = env && typeof env.R2_PROFILE_BUCKET === "string" ? env.R2_PROFILE_BUCKET.trim() : "";
  return raw || "profile-media";
}

function buildMediaUrl(requestUrl, token) {
  if (!token) return "";
  return new URL(`/m/${encodeURIComponent(token)}`, requestUrl).toString();
}

function buildStoryMediaUrl(requestUrl, token) {
  if (!token) return "";
  const url = new URL("/api/media", requestUrl);
  url.searchParams.set("t", token);
  return url.toString();
}

function generateMediaToken(length = MEDIA_TOKEN_LENGTH) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let output = "";
  for (let i = 0; i < array.length; i += 1) {
    output += MEDIA_TOKEN_ALPHABET[array[i] % MEDIA_TOKEN_ALPHABET.length];
  }
  return output;
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  if (!title) return "";
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return title.slice(0, MAX_TITLE_LENGTH);
}

function normalizeMediaType(contentType, fallback) {
  const raw = String(contentType || fallback || "").toLowerCase();
  if (raw.startsWith("video/") || raw === "video") return "video";
  return "image";
}

function hasVideoPermission(user) {
  if (!user) return false;
  const raw = user.can_upload_video ?? user.canUploadVideo ?? null;
  return raw === true || raw === 1 || raw === "1";
}

function getStoryUploadPolicy(user) {
  const roleValue = String(user && user.role ? user.role : "").toLowerCase();
  const isAdmin = roleValue === "admin";
  const allowVideo = isAdmin || hasVideoPermission(user);
  return {
    isAdmin,
    allowVideo,
    maxImageBytes: isAdmin ? Infinity : MAX_IMAGE_SIZE,
    maxVideoBytes: isAdmin ? Infinity : MAX_VIDEO_SIZE,
    maxThumbBytes: isAdmin ? Infinity : MAX_THUMB_SIZE,
  };
}

function getExtension(contentType, fileName) {
  const byType = MEDIA_EXTENSIONS[contentType];
  if (byType) return byType;
  const name = String(fileName || "").trim();
  const idx = name.lastIndexOf(".");
  if (idx !== -1 && idx < name.length - 1) {
    return name.slice(idx + 1).toLowerCase();
  }
  return "bin";
}

function sanitizeKeySegment(value, fallback) {
  const raw = String(value || "").trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, "");
  if (cleaned) return cleaned;
  const fallbackValue = String(fallback || "").trim();
  const fallbackClean = fallbackValue.replace(/[^a-zA-Z0-9._-]/g, "");
  return fallbackClean || "user";
}

function buildProfileObjectKey(userRef, fileName, extension) {
  const safeUser = sanitizeKeySegment(userRef);
  const safeExt = extension || "bin";
  const mediaId = generateId();
  return `profile/${safeUser}/${mediaId}.${safeExt}`;
}

function buildStoryObjectKey(userRef, slot, fileName, extension) {
  const safeUser = sanitizeKeySegment(userRef);
  const rawName = String(fileName || "upload").trim();
  const cleaned = rawName.replace(/[^a-zA-Z0-9._-]/g, "");
  const baseName = cleaned || (extension ? `upload.${extension}` : "upload");
  const finalName = baseName.includes(".") || !extension ? baseName : `${baseName}.${extension}`;
  const mediaId = generateId();
  const ext = finalName.includes(".") ? finalName.split(".").pop() : extension || "bin";
  return `story/${safeUser}/${mediaId}.${ext}`;
}

function buildStoryThumbKey(userRef, slot, extension) {
  const safeUser = sanitizeKeySegment(userRef);
  const safeExt = extension || "jpg";
  const mediaId = generateId();
  return `story/${safeUser}/thumb-${mediaId}.${safeExt}`;
}

function isSafeStoryKey(value) {
  const key = String(value || "");
  if (!key.startsWith("story/")) return false;
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) return false;
  return true;
}

function extractMediaIdFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/[?&](?:id|mediaId)=([^&]+)/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return match[1];
    }
  }
  return "";
}

function extractTokenFromQuery(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/[?&](?:t|token)=([^&]+)/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return match[1];
    }
  }
  return "";
}

function extractMediaTokenFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/m\/([^/]+)/i);
    if (match && match[1]) return match[1];
  } catch (error) {}
  const match = raw.match(/\/m\/([^/?#]+)/i);
  return match && match[1] ? match[1] : "";
}

function extractStoryTokenFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const tokenParam = url.searchParams.get("t") || url.searchParams.get("token") || "";
    if (tokenParam) return tokenParam;
    const match = url.pathname.match(/\/media\/([^/]+)/i);
    if (match && match[1]) return match[1];
  } catch (error) {}
  const tokenParam = extractTokenFromQuery(raw);
  if (tokenParam) return tokenParam;
  const match = raw.match(/\/media\/([^/?#]+)/i);
  return match && match[1] ? match[1] : "";
}

async function resolveStoryKeyFromUrl(value, env) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isSafeStoryKey(raw)) return raw;
  const secret = getMediaSigningSecret(env);
  if (!secret) return "";
  const token =
    extractTokenFromQuery(raw) ||
    extractStoryTokenFromUrl(raw) ||
    extractMediaTokenFromUrl(raw) ||
    (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw) ? raw : "");
  if (!token) return "";
  const verified = await verifySignedMediaToken(token, secret);
  if (!verified.ok) return "";
  const now = Math.floor(Date.now() / 1000);
  if (verified.exp <= now) return "";
  if (!isSafeStoryKey(verified.key)) return "";
  return verified.key;
}

async function getUserColumns(db) {
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    logError("PROFILE_SCHEMA_ERROR", error);
    return new Set();
  }
}

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

async function ensureUserColumns(db, columns) {
  if (!db) return false;
  const defs = [
    { name: "id", def: "INTEGER" },
    { name: "username", def: "TEXT" },
    { name: "display_name", def: "TEXT" },
    { name: "avatar_url", def: "TEXT" },
    { name: "badge", def: "TEXT" },
    { name: "title", def: "TEXT" },
    { name: "rank", def: "TEXT" },
    { name: "role", def: "TEXT DEFAULT 'buyer'" },
    { name: "seller_approved", def: "INTEGER DEFAULT 0" },
    { name: "task_approved", def: "INTEGER DEFAULT 0" },
    { name: "can_post_tasks", def: "INTEGER DEFAULT 0" },
    { name: "can_upload_video", def: "INTEGER DEFAULT 0" },
    { name: "status", def: "TEXT DEFAULT 'active'" },
    { name: "followers", def: "INTEGER DEFAULT 0" },
    { name: "following", def: "INTEGER DEFAULT 0" },
    { name: "follower_count", def: "INTEGER DEFAULT 0" },
    { name: "following_count", def: "INTEGER DEFAULT 0" },
    { name: "created_at", def: "INTEGER" },
    { name: "updated_at", def: "INTEGER" },
    { name: "last_seen_at", def: "INTEGER" },
    { name: "last_login_at", def: "INTEGER" },
  ];
  let changed = false;
  for (const def of defs) {
    if (columns.has(def.name)) continue;
    try {
      await db.prepare(`ALTER TABLE users ADD COLUMN ${def.name} ${def.def}`).run();
      columns.add(def.name);
      changed = true;
    } catch (error) {}
  }
  return changed;
}

async function ensureUserIdIndex(db, columns) {
  if (!db || !columns || !columns.has("id")) return;
  try {
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id ON users(id)").run();
  } catch (error) {}
}

async function ensureProfileTables(db) {
  if (!db) return;
  const defs = [
    `CREATE TABLE IF NOT EXISTS media_metadata (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      r2_bucket TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      access_level TEXT NOT NULL DEFAULT 'public',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      width INTEGER,
      height INTEGER,
      duration_seconds REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (r2_bucket, r2_key),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );`,
    `CREATE TABLE IF NOT EXISTS media_tokens (
      token TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS profile_stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      slot INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'image',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (user_id, slot),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS profile_featured_media (
      user_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      title TEXT,
      media_type TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      thumb_key TEXT,
      thumb_type TEXT,
      thumb_size INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, slot)
    );`,
    `CREATE TABLE IF NOT EXISTS profile_story_media (
      userId TEXT NOT NULL,
      slot INTEGER NOT NULL,
      title TEXT,
      mediaKey TEXT NOT NULL,
      mediaType TEXT NOT NULL,
      thumbKey TEXT,
      thumb_url TEXT,
      thumbType TEXT,
      thumbSize INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (userId, slot)
    );`,
  ];
  for (const sql of defs) {
    try {
      await db.prepare(sql).run();
    } catch (error) {}
  }
}

async function ensureTableColumns(db, table, defs) {
  if (!db) return;
  const cols = await getTableColumns(db, table);
  if (!cols.size) return;
  for (const def of defs) {
    if (cols.has(def.name)) continue;
    try {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${def.name} ${def.def}`).run();
      cols.add(def.name);
    } catch (error) {}
  }
}

async function ensureStoryMediaColumns(db) {
  await ensureTableColumns(db, "profile_featured_media", [
    { name: "user_id", def: "TEXT" },
    { name: "slot", def: "INTEGER" },
    { name: "title", def: "TEXT" },
    { name: "media_type", def: "TEXT" },
    { name: "r2_key", def: "TEXT" },
    { name: "thumb_key", def: "TEXT" },
    { name: "thumb_type", def: "TEXT" },
    { name: "thumb_size", def: "INTEGER DEFAULT 0" },
    { name: "size", def: "INTEGER DEFAULT 0" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ]);
}

async function ensureMediaTokensTable(db) {
  if (!db) return;
  try {
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS media_tokens (token TEXT PRIMARY KEY, media_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE)"
      )
      .run();
  } catch (error) {}
}

async function ensureMediaToken(db, mediaId) {
  if (!db || !mediaId) return null;
  let cols = await getTableColumns(db, "media_tokens");
  if (!cols.has("token") || !cols.has("media_id")) {
    await ensureMediaTokensTable(db);
    cols = await getTableColumns(db, "media_tokens");
  }
  if (!cols.has("token") || !cols.has("media_id")) return null;
  const existing = await db.prepare("SELECT token FROM media_tokens WHERE media_id = ? LIMIT 1").bind(mediaId).first();
  if (existing && existing.token) return String(existing.token);
  const createdAt = Math.floor(Date.now() / 1000);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = generateMediaToken();
    const result = await db
      .prepare("INSERT OR IGNORE INTO media_tokens (token, media_id, created_at) VALUES (?, ?, ?)")
      .bind(token, mediaId, createdAt)
      .run();
    if (result && result.meta && result.meta.changes) return token;
  }
  const fallback = await db.prepare("SELECT token FROM media_tokens WHERE media_id = ? LIMIT 1").bind(mediaId).first();
  return fallback && fallback.token ? String(fallback.token) : null;
}

async function resolveMediaId(db, value) {
  const mediaId = extractMediaIdFromUrl(value);
  if (mediaId) return mediaId;
  const token = extractMediaTokenFromUrl(value);
  if (!token || !db) return "";
  const cols = await getTableColumns(db, "media_tokens");
  if (!cols.has("token") || !cols.has("media_id")) return "";
  const row = await db.prepare("SELECT media_id FROM media_tokens WHERE token = ? LIMIT 1").bind(token).first();
  return row && row.media_id ? String(row.media_id) : "";
}

async function insertMediaMetadata(db, info) {
  const cols = await getTableColumns(db, "media_metadata");
  if (!cols.size) return;
  const columns = [];
  const binds = [];
  const push = (name, value) => {
    if (!cols.has(name)) return;
    columns.push(name);
    binds.push(value);
  };
  push("id", info.id);
  push("owner_user_id", info.ownerUserId);
  push("r2_bucket", info.bucket);
  push("r2_key", info.r2Key);
  push("content_type", info.contentType);
  push("access_level", info.accessLevel);
  push("size_bytes", info.size);
  push("checksum", info.checksum);
  push("width", info.width);
  push("height", info.height);
  push("duration_seconds", info.duration);
  push("created_at", info.createdAt);
  if (!columns.length) return;
  const placeholders = columns.map(() => "?").join(", ");
  await db.prepare(`INSERT INTO media_metadata (${columns.join(", ")}) VALUES (${placeholders})`).bind(...binds).run();
}

async function getStoryMediaRow(db, userIds, slot) {
  const identifiers = normalizeIdentifierList(userIds);
  if (!db || !identifiers.length || !Number.isFinite(slot)) return null;
  const placeholders = identifiers.map(() => "?").join(", ");
  const row = await db
    .prepare(
      `SELECT ${FEATURED_MEDIA_SELECT} FROM profile_featured_media WHERE user_id IN (${placeholders}) AND slot = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1`
    )
    .bind(...identifiers, slot)
    .first();
  return row || null;
}

async function getStoryMediaRows(db, userIds) {
  const identifiers = normalizeIdentifierList(userIds);
  if (!db || !identifiers.length) return [];
  const placeholders = identifiers.map(() => "?").join(", ");
  const rows = await db
    .prepare(`SELECT ${FEATURED_MEDIA_SELECT} FROM profile_featured_media WHERE user_id IN (${placeholders}) ORDER BY slot ASC`)
    .bind(...identifiers)
    .all();
  return Array.isArray(rows.results) ? rows.results : [];
}

async function upsertStoryMedia(db, record) {
  if (!db || !record) return;
  const now = record.updatedAt || new Date().toISOString();
  const createdAt = record.createdAt || now;
  const thumbKey = record.thumbKey || record.thumbUrl || record.thumb_url || "";
  await db
    .prepare(
      "INSERT INTO profile_featured_media (user_id, slot, title, media_type, r2_key, thumb_key, thumb_type, thumb_size, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, slot) DO UPDATE SET title = excluded.title, media_type = excluded.media_type, r2_key = excluded.r2_key, thumb_key = excluded.thumb_key, thumb_type = excluded.thumb_type, thumb_size = excluded.thumb_size, size = excluded.size, updated_at = excluded.updated_at"
    )
    .bind(
      record.userId,
      record.slot,
      record.title || "",
      record.mediaType,
      record.mediaKey,
      thumbKey,
      record.thumbType || "",
      Number(record.thumbSize || 0),
      Number(record.size || 0),
      createdAt,
      now
    )
    .run();
}

async function deleteStoryMediaRow(db, userId, slot) {
  if (!db || !userId || !Number.isFinite(slot)) return;
  await db.prepare("DELETE FROM profile_featured_media WHERE user_id = ? AND slot = ?").bind(userId, slot).run();
}

async function normalizeStoryOwnerRows(db, rows, ownerId) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];
  const primaryId = normalizeIdentifierValue(ownerId);
  if (!primaryId) return rows;
  const bySlot = new Map();
  let needsMigration = false;
  for (const row of rows) {
    const slot = Number(row.slot);
    if (!Number.isFinite(slot)) continue;
    const existing = bySlot.get(slot);
    if (!existing) {
      bySlot.set(slot, row);
    } else {
      const preferred = pickPreferredStoryRow(existing, row);
      if (preferred !== existing) {
        bySlot.set(slot, preferred);
      }
      needsMigration = true;
    }
    const rowOwner = normalizeIdentifierValue(row.userId || row.user_id);
    if (rowOwner && rowOwner !== primaryId) needsMigration = true;
  }
  if (!needsMigration) return rows;

  for (const row of bySlot.values()) {
    const slot = Number(row.slot);
    if (!Number.isFinite(slot)) continue;
    const mediaKey = row.mediaKey || row.media_key || "";
    if (!mediaKey) continue;
    const mediaType = String(row.mediaType || row.media_type || "image").toLowerCase() === "video" ? "video" : "image";
    const thumbKey = row.thumbKey || row.thumb_key || "";
    const thumbType = row.thumbType || row.thumb_type || "";
    const thumbSize = Number(row.thumbSize || row.thumb_size || 0);
    const size = Number(row.size || 0);
    const timestamps = getStoryRowTimestamps(row);
    await upsertStoryMedia(db, {
      userId: primaryId,
      slot,
      title: row.title || "",
      mediaKey,
      mediaType,
      thumbKey,
      thumbType,
      thumbSize,
      size,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    });
  }

  for (const row of rows) {
    const slot = Number(row.slot);
    if (!Number.isFinite(slot)) continue;
    const rowOwner = normalizeIdentifierValue(row.userId || row.user_id);
    if (rowOwner && rowOwner !== primaryId) {
      await deleteStoryMediaRow(db, rowOwner, slot);
    }
  }

  const normalized = Array.from(bySlot.values()).map((row) => ({ ...row, userId: primaryId }));
  normalized.sort((a, b) => Number(a.slot) - Number(b.slot));
  return normalized;
}

function buildUserSelect(columns) {
  const list = ["rowid AS row_id"];
  const fields = [
    "id",
    "email",
    "username",
    "display_name",
    "badge",
    "rank",
    "title",
    "role",
    "can_upload_video",
    "avatar_url",
    "followers",
    "following",
    "follower_count",
    "following_count",
    "created_at",
    "createdAt",
    "registered_at",
    "registeredAt",
    "created_time",
    "createdTime",
    "created_on",
    "createdOn",
    "joined_at",
    "joinedAt",
    "last_seen_at",
  ];
  fields.forEach((field) => {
    if (columns.has(field)) list.push(field);
  });
  return list.join(", ");
}

async function resolveUser(db, raw, columns, options = {}) {
  const ref = String(raw || "").trim();
  if (!ref) return null;
  const normalized = normalizeUsername(ref);
  const email = normalizeEmail(ref);
  const isEmail = ref.includes("@") && isValidEmail(email);
  const allowId = options.allowId !== false;
  const allowEmail = options.allowEmail !== false;
  const userColumns = columns || (await getUserColumns(db));
  if (!userColumns.size) return null;
  const selectFields = buildUserSelect(userColumns);
  const conditions = [];
  const binds = [];
  if (allowId && userColumns.has("id")) {
    conditions.push("id = ?");
    binds.push(ref);
  }
  if (userColumns.has("username")) {
    conditions.push("lower(username) = ?");
    binds.push(normalized);
  }
  if (allowEmail && userColumns.has("email")) {
    conditions.push("lower(email) = ?");
    binds.push(email);
  }
  if (!conditions.length) return null;
  const user = await db
    .prepare(`SELECT ${selectFields} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`)
    .bind(...binds)
    .first();
  return user || null;
}

async function reloadUserState(db, ref, options = {}) {
  const columns = await getUserColumns(db);
  const user = await resolveUser(db, ref, columns, options);
  return { user, columns };
}

function formatUser(user, view = "full") {
  if (!user) return null;
  const lastSeen = user.last_seen_at ?? null;
  const createdValue = user.created_at ?? user.createdAt ?? null;
  const parsedCreated = parseDateValue(createdValue);
  const createdAt = parsedCreated && parsedCreated.getTime() > 0 ? createdValue : null;
  const videoPermission =
    user &&
    (user.can_upload_video === true ||
      user.can_upload_video === 1 ||
      user.can_upload_video === "1" ||
      user.canUploadVideo === true ||
      user.canUploadVideo === 1 ||
      user.canUploadVideo === "1");
  const followerCount =
    user && user.follower_count != null
      ? Number(user.follower_count || 0)
      : Number(user && user.followers != null ? user.followers : 0);
  const followingCount =
    user && user.following_count != null
      ? Number(user.following_count || 0)
      : Number(user && user.following != null ? user.following : 0);
  const roleValue = user.role || "";
  const isAdmin = String(roleValue).trim().toLowerCase() === "admin";
  const idValue = user.id ?? user.row_id ?? null;
  if (view === "chat") {
    return {
      id: idValue,
      username: user.username || "",
      display_name: user.display_name || "",
      avatar_url: user.avatar_url || "",
      role: roleValue,
      is_admin: isAdmin,
    };
  }
  if (view === "public") {
    return {
      id: idValue,
      username: user.username || "",
      display_name: user.display_name || "",
      badge: user.badge || "",
      role: roleValue,
      can_upload_video: videoPermission,
      canUploadVideo: videoPermission,
      avatar_url: user.avatar_url || "",
      followers: Number.isFinite(followerCount) ? followerCount : 0,
      following: Number.isFinite(followingCount) ? followingCount : 0,
      created_at: createdAt,
      createdAt,
      last_seen_at: lastSeen,
      is_online: isOnlineNow(lastSeen),
    };
  }
  return {
    id: idValue,
    email: user.email || "",
    username: user.username || "",
    display_name: user.display_name || "",
    badge: user.badge || "",
    rank: user.rank || "",
    title: user.title || "",
    role: roleValue,
    can_upload_video: videoPermission,
    canUploadVideo: videoPermission,
    avatar_url: user.avatar_url || "",
    followers: Number.isFinite(followerCount) ? followerCount : 0,
    following: Number.isFinite(followingCount) ? followingCount : 0,
    created_at: createdAt,
    createdAt,
    last_seen_at: lastSeen,
    is_online: isOnlineNow(lastSeen),
  };
}

async function ensureUserCreatedAt(db, user, columns) {
  if (!db || !user || !columns || !columns.has("created_at")) return;
  const createdRaw = user.created_at ?? null;
  const createdDate = parseDateValue(createdRaw);
  if (createdDate && createdDate.getTime() > 0) return;
  const fallbackValues = [
    user.createdAt,
    user.registered_at,
    user.registeredAt,
    user.created_time,
    user.createdTime,
    user.created_on,
    user.createdOn,
    user.joined_at,
    user.joinedAt,
  ];
  let fallbackValue = null;
  for (const value of fallbackValues) {
    if (value != null && value !== "") {
      fallbackValue = value;
      break;
    }
  }
  const fallbackDate = parseDateValue(fallbackValue);
  const resolvedId = user.id ?? user.row_id;
  if (resolvedId == null) return;
  const createdAt =
    fallbackDate && fallbackDate.getTime() > 0 ? Math.floor(fallbackDate.getTime() / 1000) : Math.floor(Date.now() / 1000);
  try {
    if (!columns.has("id") && user.row_id != null) {
      await db.prepare("UPDATE users SET created_at = ? WHERE rowid = ?").bind(createdAt, user.row_id).run();
    } else if (user.id == null && user.row_id != null) {
      await db.prepare("UPDATE users SET created_at = ? WHERE rowid = ?").bind(createdAt, user.row_id).run();
    } else {
      await db.prepare("UPDATE users SET created_at = ? WHERE id = ?").bind(createdAt, resolvedId).run();
    }
    user.created_at = createdAt;
    user.createdAt = createdAt;
  } catch (error) {
    logError("PROFILE_CREATED_AT_ERROR", error);
  }
  if (user.created_at == null || user.created_at === "") {
    user.created_at = createdAt;
    user.createdAt = createdAt;
  }
}

async function ensureUserId(db, user, columns) {
  if (!db || !user || !columns || !columns.has("id")) return;
  if (user.id != null || user.row_id == null) return;
  const resolvedId = user.row_id;
  try {
    await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(resolvedId, user.row_id).run();
    user.id = resolvedId;
  } catch (error) {
    logError("PROFILE_ID_BACKFILL_ERROR", error);
  }
}

async function getProfileStats(db, userId) {
  const stats = {
    purchased: null,
    sold: null,
    shopCount: null,
    shopId: null,
    topups: null,
    rank: null,
    totalBuys: null,
    totalSales: null,
    totalTopup: null,
    totalUsers: null,
  };
  if (!db || !userId) return stats;
  const WEIGHT_SALES = 3;
  const WEIGHT_BUYS = 2;
  const TOPUP_SCORE_SCALE = 10000;
  try {
    const [ordersColumns, shopsColumns, orderItemsColumns, transactionsColumns] = await Promise.all([
      getTableColumns(db, "orders"),
      getTableColumns(db, "shops"),
      getTableColumns(db, "order_items"),
      getTableColumns(db, "transactions"),
    ]);

    const orderSuccessFilters = [];
    if (ordersColumns.has("status")) {
      orderSuccessFilters.push("o.status IN ('completed', 'success', 'paid', 'delivered')");
    }
    if (ordersColumns.has("payment_status")) {
      orderSuccessFilters.push("o.payment_status IN ('paid', 'completed', 'success')");
    }
    const orderSuccessClause = orderSuccessFilters.length ? orderSuccessFilters.join(" AND ") : "";

    let shopId = null;
    if (shopsColumns.has("user_id") && shopsColumns.has("id")) {
      const orderBy = shopsColumns.has("created_at") ? "created_at DESC" : "rowid DESC";
      const row = await db
        .prepare(
          `SELECT COUNT(1) AS count, (SELECT id FROM shops WHERE user_id = ? ORDER BY ${orderBy} LIMIT 1) AS latest_id FROM shops WHERE user_id = ?`
        )
        .bind(userId, userId)
        .first();
      stats.shopCount = Number(row && row.count != null ? row.count : 0);
      shopId = row && row.latest_id != null ? row.latest_id : null;
    } else {
      const sellerColumns = await getTableColumns(db, "seller");
      if (sellerColumns.has("user_id")) {
        const orderBy = sellerColumns.has("created_at") ? "created_at DESC" : "rowid DESC";
        const row = await db
          .prepare(
            `SELECT COUNT(1) AS count, (SELECT id FROM seller WHERE user_id = ? ORDER BY ${orderBy} LIMIT 1) AS latest_id FROM seller WHERE user_id = ?`
          )
          .bind(userId, userId)
          .first();
        stats.shopCount = Number(row && row.count != null ? row.count : 0);
        shopId = row && row.latest_id != null ? row.latest_id : null;
      }
    }
    stats.shopId = shopId;

    const orderItemSuccessFilters = [];
    if (orderItemsColumns.has("fulfillment_status")) {
      orderItemSuccessFilters.push("oi.fulfillment_status IN ('completed', 'success', 'delivered')");
    }

    const metrics = new Map();
    const bump = (userKey, field, value) => {
      const key = String(userKey || "");
      if (!key) return;
      const current = metrics.get(key) || { buys: 0, sales: 0, topup: 0, topupCount: 0 };
      current[field] = Number(current[field] || 0) + Number(value || 0);
      metrics.set(key, current);
    };
    const bumpTopup = (userKey, total, count) => {
      const key = String(userKey || "");
      if (!key) return;
      const current = metrics.get(key) || { buys: 0, sales: 0, topup: 0, topupCount: 0 };
      current.topup = Number(current.topup || 0) + Number(total || 0);
      current.topupCount = Number(current.topupCount || 0) + Number(count || 0);
      metrics.set(key, current);
    };

    if (ordersColumns.has("buyer_user_id")) {
      const where = orderSuccessClause ? `WHERE ${orderSuccessClause}` : "";
      const rows = await db
        .prepare(`SELECT o.buyer_user_id AS user_id, COUNT(1) AS count FROM orders o ${where} GROUP BY o.buyer_user_id`)
        .all();
      (Array.isArray(rows.results) ? rows.results : []).forEach((row) => {
        bump(row.user_id, "buys", row.count);
      });
    }
    if (orderItemsColumns.has("shop_id") && shopsColumns.has("id") && shopsColumns.has("user_id")) {
      const salesFilters = [...orderItemSuccessFilters];
      let joinOrders = "";
      if (orderItemsColumns.has("order_id") && orderSuccessClause) {
        joinOrders = " JOIN orders o ON o.id = oi.order_id";
        salesFilters.push(orderSuccessClause);
      }
      const where = salesFilters.length ? `WHERE ${salesFilters.join(" AND ")}` : "";
      const rows = await db
        .prepare(
          `SELECT s.user_id AS user_id, COUNT(1) AS count FROM order_items oi JOIN shops s ON s.id = oi.shop_id${joinOrders} ${where} GROUP BY s.user_id`
        )
        .all();
      (Array.isArray(rows.results) ? rows.results : []).forEach((row) => {
        bump(row.user_id, "sales", row.count);
      });
    }
    if (transactionsColumns.has("user_id") && transactionsColumns.has("amount")) {
      const topupFilters = [];
      if (transactionsColumns.has("type")) topupFilters.push("t.type = 'topup'");
      if (transactionsColumns.has("status")) topupFilters.push("t.status IN ('posted', 'completed', 'success')");
      const where = topupFilters.length ? `WHERE ${topupFilters.join(" AND ")}` : "";
      const rows = await db
        .prepare(
          `SELECT t.user_id AS user_id, COUNT(1) AS count, COALESCE(SUM(t.amount), 0) AS total FROM transactions t ${where} GROUP BY t.user_id`
        )
        .all();
      (Array.isArray(rows.results) ? rows.results : []).forEach((row) => {
        bumpTopup(row.user_id, row.total, row.count);
      });
    } else if (transactionsColumns.has("user_id")) {
      const topupFilters = [];
      if (transactionsColumns.has("type")) topupFilters.push("t.type = 'topup'");
      if (transactionsColumns.has("status")) topupFilters.push("t.status IN ('posted', 'completed', 'success')");
      const where = topupFilters.length ? `WHERE ${topupFilters.join(" AND ")}` : "";
      const rows = await db
        .prepare(`SELECT t.user_id AS user_id, COUNT(1) AS count FROM transactions t ${where} GROUP BY t.user_id`)
        .all();
      (Array.isArray(rows.results) ? rows.results : []).forEach((row) => {
        bumpTopup(row.user_id, 0, row.count);
      });
    }

    const userEntry = metrics.get(String(userId)) || { buys: 0, sales: 0, topup: 0, topupCount: 0 };
    const canComputeBuys = ordersColumns.has("buyer_user_id");
    const canComputeSales = orderItemsColumns.has("shop_id") && shopsColumns.has("id") && shopsColumns.has("user_id");
    const canComputeTopups = transactionsColumns.has("user_id");
    const canComputeTopupTotal = transactionsColumns.has("user_id") && transactionsColumns.has("amount");
    if (canComputeBuys) {
      stats.purchased = userEntry.buys;
      stats.totalBuys = userEntry.buys;
    }
    if (canComputeSales) {
      stats.sold = userEntry.sales;
      stats.totalSales = userEntry.sales;
    }
    if (!canComputeSales && orderItemsColumns.has("seller_id") && shopId) {
      const salesFilters = [...orderItemSuccessFilters];
      let joinOrders = "";
      if (orderItemsColumns.has("order_id") && orderSuccessClause) {
        joinOrders = " JOIN orders o ON o.id = oi.order_id";
        salesFilters.push(orderSuccessClause);
      }
      const where = salesFilters.length ? ` AND ${salesFilters.join(" AND ")}` : "";
      const row = await db
        .prepare(`SELECT COUNT(1) AS count FROM order_items oi${joinOrders} WHERE oi.seller_id = ?${where}`)
        .bind(shopId)
        .first();
      const count = Number(row && row.count != null ? row.count : 0);
      stats.sold = count;
      stats.totalSales = count;
    }
    if (canComputeTopups) {
      stats.topups = userEntry.topupCount;
    }
    if (canComputeTopupTotal) {
      stats.totalTopup = userEntry.topup;
    }

    try {
      const totalRow = await db.prepare("SELECT COUNT(1) AS count FROM users").first();
      stats.totalUsers = Number(totalRow && totalRow.count != null ? totalRow.count : 0);
    } catch (error) {}

    const scoreFor = (entry) =>
      Number(entry.sales || 0) * WEIGHT_SALES +
      Number(entry.buys || 0) * WEIGHT_BUYS +
      Math.floor(Number(entry.topup || 0) / TOPUP_SCORE_SCALE);

    const userScore = scoreFor(userEntry);
    let higher = 0;
    metrics.forEach((entry) => {
      if (scoreFor(entry) > userScore) higher += 1;
    });
    if (metrics.size || stats.totalUsers != null) {
      stats.rank = higher + 1;
    }
  } catch (error) {
    logError("PROFILE_STATS_ERROR", error);
  }

  return stats;
}

function formatStats(stats, view) {
  if (!stats) return null;
  if (view === "public") {
    return {
      purchased: stats.purchased,
      sold: stats.sold,
      rank: stats.rank,
      shopCount: stats.shopCount,
      shopId: stats.shopId,
    };
  }
  return stats;
}

async function deleteMediaAssets(db, bucket, mediaIds, userId) {
  const ids = Array.isArray(mediaIds) ? mediaIds.filter(Boolean) : [];
  for (const mediaId of ids) {
    const media = await db
      .prepare("SELECT id, owner_user_id, r2_key FROM media_metadata WHERE id = ? LIMIT 1")
      .bind(mediaId)
      .first();
    if (!media) continue;
    if (userId && String(media.owner_user_id || "") !== String(userId)) continue;
    const refRow = await db
      .prepare("SELECT COUNT(1) AS count FROM profile_stories WHERE media_id = ?")
      .bind(mediaId)
      .first();
    const refCount = Number(refRow && refRow.count != null ? refRow.count : 0);
    if (refCount > 0) continue;
    if (bucket && media.r2_key) {
      try {
        await bucket.delete(media.r2_key);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }
    try {
      await db.prepare("DELETE FROM media_tokens WHERE media_id = ?").bind(mediaId).run();
    } catch (error) {}
    await db.prepare("DELETE FROM media_metadata WHERE id = ?").bind(mediaId).run();
  }
}

async function cleanupExpiredStories(db, bucket, userIds) {
  const identifiers = normalizeIdentifierList(userIds);
  if (!db || !identifiers.length) return;
  try {
    await ensureStoryMediaColumns(db);
    const placeholders = identifiers.map(() => "?").join(", ");
    const rows = await db
      .prepare(
        `SELECT user_id AS userId, slot, r2_key AS mediaKey, thumb_key AS thumbKey, created_at FROM profile_featured_media WHERE user_id IN (${placeholders})`
      )
      .bind(...identifiers)
      .all();
    const results = Array.isArray(rows.results) ? rows.results : [];
    const expired = results.filter((row) => isExpiredDate(row.created_at));
    if (!expired.length) return;
    for (const row of expired) {
      if (bucket && row.mediaKey) {
        try {
          await bucket.delete(row.mediaKey);
        } catch (error) {
          logError("PROFILE_MEDIA_DELETE_ERROR", error);
        }
      }
      if (bucket && row.thumbKey) {
        try {
          await bucket.delete(row.thumbKey);
        } catch (error) {
          logError("PROFILE_MEDIA_DELETE_ERROR", error);
        }
      }
      const rowOwner = normalizeIdentifierValue(row.userId);
      if (rowOwner) {
        await deleteStoryMediaRow(db, rowOwner, Number(row.slot));
      }
    }
  } catch (error) {
    logError("PROFILE_STORY_CLEANUP_ERROR", error);
  }
}

async function listStoryMedia(db, userIds, ownerId, requestUrl, env) {
  try {
    const identifiers = normalizeIdentifierList(userIds);
    if (!identifiers.length) return [];
    let rows = await getStoryMediaRows(db, identifiers);
    if (!rows.length) return [];
    const primaryId = normalizeIdentifierValue(ownerId);
    if (primaryId) {
      rows = await normalizeStoryOwnerRows(db, rows, primaryId);
    }
    rows = rows.slice().sort((a, b) => Number(a.slot) - Number(b.slot));
    const secret = getMediaSigningSecret(env);
    const now = Math.floor(Date.now() / 1000);
    const stories = [];
    for (const row of rows) {
      const mediaKey = row.mediaKey || row.media_key || row.mediakey || "";
      const mediaType = row.mediaType || row.media_type || row.mediatype || "";
      const rawThumbKey = row.thumbKey || row.thumb_key || row.thumbkey || "";
      let createdAt = row.createdAt || row.created_at || "";
      const updatedAt = row.updatedAt || row.updated_at || "";
      const rowOwnerId = normalizeIdentifierValue(row.userId || row.user_id || primaryId);
      if (!createdAt) {
        createdAt = updatedAt || new Date().toISOString();
        if (rowOwnerId) {
          try {
            await db
              .prepare("UPDATE profile_featured_media SET created_at = ? WHERE user_id = ? AND slot = ?")
              .bind(createdAt, rowOwnerId, row.slot)
              .run();
          } catch (error) {}
        }
      }
      let url = "";
      let thumbUrl = "";
      if (mediaKey && secret) {
        const token = await createSignedMediaToken(secret, mediaKey, now + MEDIA_TOKEN_TTL_SEC, "story");
        url = buildStoryMediaUrl(requestUrl, token);
      }
      const resolvedThumbKey = rawThumbKey && isSafeStoryKey(rawThumbKey) ? rawThumbKey : "";
      if (resolvedThumbKey && secret) {
        const token = await createSignedMediaToken(secret, resolvedThumbKey, now + MEDIA_TOKEN_TTL_SEC, "thumb");
        thumbUrl = token ? buildStoryMediaUrl(requestUrl, token) : "";
      }
      const createdDate = parseDateValue(createdAt);
      const expiresAtValue =
        createdDate && createdDate.getTime() > 0 ? new Date(createdDate.getTime() + STORY_TTL_MS).toISOString() : "";
      stories.push({
        slot: Number(row.slot) || 1,
        title: row.title || "",
        type: mediaType === "video" ? "video" : "image",
        size: Number(row.size || 0),
        createdAt,
        expiresAt: expiresAtValue,
        expires_at: expiresAtValue,
        updatedAt,
        url,
        mediaUrl: url,
        mediaKey,
        key: mediaKey,
        thumbKey: resolvedThumbKey || "",
        thumbUrl,
      });
    }
    return stories;
  } catch (error) {
    logError("PROFILE_STORY_MEDIA_LIST_ERROR", error);
    return [];
  }
}

function isInlineMediaUrl(value) {
  const raw = String(value || "");
  return raw.startsWith("data:") || raw.startsWith("blob:");
}

function validateStoryPayload(stories) {
  if (!Array.isArray(stories) || !stories.length) return { ok: true };
  for (const story of stories) {
    if (!story) return { ok: false, error: "STORY_DATA_INCOMPLETE" };
    const mediaKey = story.mediaKey || story.key || "";
    const url = story.mediaUrl || story.url || story.src || "";
    const createdAt = story.createdAt || story.created_at || story.date || "";
    if (!mediaKey || !url || !createdAt) return { ok: false, error: "STORY_DATA_INCOMPLETE" };
    if (isInlineMediaUrl(url)) return { ok: false, error: "STORY_DATA_INCOMPLETE" };
  }
  return { ok: true };
}

async function handleAvatarUpload(context, form) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_AVATAR_UPLOAD",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_AVATAR_UPLOAD",
        hint: "Set R2_PROFILE binding",
      });
    }

    const payload = form || (await context.request.formData());
    const file = payload.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return errorResponse("MISSING_FILE", 400, { where: "PROFILE_AVATAR_UPLOAD" });
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return errorResponse("EMPTY_FILE", 400, { where: "PROFILE_AVATAR_UPLOAD" });
    }

    const contentType = String(file.type || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return errorResponse("UNSUPPORTED_TYPE", 415, { where: "PROFILE_AVATAR_UPLOAD" });
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return errorResponse("FILE_TOO_LARGE", 413, { where: "PROFILE_AVATAR_UPLOAD" });
    }

    const userRef =
      payload.get("userId") ||
      payload.get("ownerId") ||
      payload.get("user_id") ||
      payload.get("id") ||
      "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_AVATAR_UPLOAD" });
    let userColumns = await getUserColumns(db);
    if (!userColumns.has("avatar_url")) {
      return errorResponse("AVATAR_NOT_SUPPORTED", 400, { where: "PROFILE_AVATAR_UPLOAD" });
    }
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_UPLOAD" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_UPLOAD" });
    const idInfo = resolveUserIdValue(user, userColumns);
    if (idInfo.value == null) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_UPLOAD" });
    const isAdmin = String(user.role || "").toLowerCase() === "admin";
    if (!isAdmin) return errorResponse("NOT_ELIGIBLE", 403, { where: "PROFILE_AVATAR_UPLOAD" });

    const previousMediaId = await resolveMediaId(db, user.avatar_url || "");
    const extension = getExtension(contentType, file.name).replace(/[^a-z0-9]/g, "");
    const safeExt = extension || "bin";
    const mediaId = generateId();
    const ownerId = String(idInfo.value);
    const r2Key = buildProfileObjectKey(userValue || ownerId, file.name, safeExt);
    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      logError("PROFILE_AVATAR_READ_ERROR", error);
      return errorResponse("READ_FAILED", 400, {
        where: "PROFILE_AVATAR_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }
    try {
      await bucket.put(r2Key, buffer, {
        httpMetadata: { contentType },
        customMetadata: { owner: ownerId, type: "avatar" },
      });
    } catch (error) {
      logError("PROFILE_R2_PUT_ERROR", error);
      return errorResponse("R2_WRITE_FAILED", 502, {
        where: "PROFILE_AVATAR_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }

    const bucketName = getBucketName(context.env);
    try {
      await insertMediaMetadata(db, {
        id: mediaId,
        ownerUserId: ownerId,
        bucket: bucketName,
        r2Key,
        contentType: contentType || "application/octet-stream",
        accessLevel: MEDIA_ACCESS_PUBLIC,
        size: Number(file.size || 0),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      logError("PROFILE_MEDIA_INSERT_ERROR", error);
      try {
        await bucket.delete(r2Key);
      } catch (deleteError) {
        logError("PROFILE_MEDIA_ROLLBACK_ERROR", deleteError);
      }
      return errorResponse("MEDIA_METADATA_FAILED", 500, {
        where: "PROFILE_AVATAR_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }

    const token = await ensureMediaToken(db, mediaId);
    if (!token) return errorResponse("MEDIA_TOKEN_UNAVAILABLE", 503, { where: "PROFILE_AVATAR_UPLOAD" });
    const avatarUrl = buildMediaUrl(context.request.url, token);
    try {
      await db.prepare(`UPDATE users SET avatar_url = ? WHERE ${idInfo.field} = ?`).bind(avatarUrl, idInfo.value).run();
    } catch (error) {
      logError("PROFILE_AVATAR_UPDATE_ERROR", error);
      return errorResponse("INTERNAL", 500, {
        where: "PROFILE_AVATAR_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }
    if (previousMediaId) {
      try {
        await deleteMediaAssets(db, bucket, [previousMediaId], ownerId);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }

    return jsonResponse(
      {
        ok: true,
        data: {
          id: mediaId,
          mediaId,
          media_id: mediaId,
          token,
          url: avatarUrl,
          size: Number(file.size || 0),
        },
        avatar: {
          id: mediaId,
          mediaId,
          media_id: mediaId,
          token,
          url: avatarUrl,
          size: Number(file.size || 0),
        },
      },
      200
    );
  } catch (error) {
    logError("PROFILE_AVATAR_UPLOAD_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_AVATAR_UPLOAD",
      message: error && error.message ? error.message : "",
    });
  }
}

async function handleAvatarRemove(context, body) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_AVATAR_REMOVE",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_AVATAR_REMOVE",
        hint: "Set R2_PROFILE binding",
      });
    }

    const payload = body || (await readJsonBody(context.request));
    if (!payload) return errorResponse("INVALID_BODY", 400, { where: "PROFILE_AVATAR_REMOVE" });

    const userRef = payload.userId || payload.ownerId || payload.user_id || payload.id || "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_AVATAR_REMOVE" });
    let userColumns = await getUserColumns(db);
    if (!userColumns.has("avatar_url")) {
      return errorResponse("AVATAR_NOT_SUPPORTED", 400, { where: "PROFILE_AVATAR_REMOVE" });
    }
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_REMOVE" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_REMOVE" });
    const idInfo = resolveUserIdValue(user, userColumns);
    if (idInfo.value == null) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_AVATAR_REMOVE" });
    const isAdmin = String(user.role || "").toLowerCase() === "admin";
    if (!isAdmin) return errorResponse("NOT_ELIGIBLE", 403, { where: "PROFILE_AVATAR_REMOVE" });

    const previousMediaId = await resolveMediaId(db, user.avatar_url || "");
    try {
      await db.prepare(`UPDATE users SET avatar_url = ? WHERE ${idInfo.field} = ?`).bind("", idInfo.value).run();
    } catch (error) {
      logError("PROFILE_AVATAR_REMOVE_ERROR", error);
      return errorResponse("INTERNAL", 500, {
        where: "PROFILE_AVATAR_REMOVE",
        message: error && error.message ? error.message : "",
      });
    }
    if (previousMediaId) {
      await deleteMediaAssets(db, bucket, [previousMediaId], String(idInfo.value));
    }

    return jsonResponse({ ok: true, data: { removed: true } }, 200);
  } catch (error) {
    logError("PROFILE_AVATAR_REMOVE_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_AVATAR_REMOVE",
      message: error && error.message ? error.message : "",
    });
  }
}

async function handleStoryUpload(context, form) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_UPLOAD",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_UPLOAD",
        hint: "Set R2_PROFILE binding",
      });
    }

    const signingSecret = getMediaSigningSecret(context.env);
    if (!signingSecret) {
      return errorResponse("MEDIA_SIGNING_NOT_CONFIGURED", 503, {
        where: "PROFILE_STORY_UPLOAD",
        hint: "Set MEDIA_SIGNING_SECRET",
      });
    }

    await ensureStoryMediaColumns(db);

    const payload = form || (await context.request.formData());
    const file = payload.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return errorResponse("MISSING_FILE", 400, { where: "PROFILE_STORY_UPLOAD" });
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return errorResponse("EMPTY_FILE", 400, { where: "PROFILE_STORY_UPLOAD" });
    }

    const userRef =
      payload.get("userId") ||
      payload.get("ownerId") ||
      payload.get("user_id") ||
      payload.get("id") ||
      "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_STORY_UPLOAD" });

    let userColumns = await getUserColumns(db);
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_UPLOAD" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_UPLOAD" });
    const ownerId = getPrimaryUserId(user);
    if (!ownerId) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_UPLOAD" });
    let identifiers = getUserIdentifierSet(user, userColumns);
    if (!identifiers.length) identifiers = [ownerId];
    const policy = getStoryUploadPolicy(user);

    const slot = normalizeSlotValue(payload.get("slot"));
    if (!slot) return errorResponse("INVALID_SLOT", 400, { where: "PROFILE_STORY_UPLOAD" });

    const title = normalizeTitle(payload.get("title"));
    const contentType = String(file.type || "").toLowerCase();
    const thumbFile = payload.get("thumb");
    const isVideo = contentType.startsWith("video/");
    const isImage = contentType.startsWith("image/");
    if (!isVideo && !isImage) {
      return errorResponse("UNSUPPORTED_TYPE", 415, { where: "PROFILE_STORY_UPLOAD" });
    }

    if (!policy.allowVideo && isVideo) {
      return errorResponse("NOT_ELIGIBLE", 403, { where: "PROFILE_STORY_UPLOAD" });
    }

    const maxBytes = isVideo ? policy.maxVideoBytes : policy.maxImageBytes;
    if (Number.isFinite(maxBytes) && file.size > maxBytes) {
      return errorResponse("FILE_TOO_LARGE", 413, { where: "PROFILE_STORY_UPLOAD" });
    }

    const extension = getExtension(contentType, file.name).replace(/[^a-z0-9]/g, "");
    const safeExt = extension || "bin";
    const r2Key = buildStoryObjectKey(ownerId, slot, file.name, safeExt);

    let thumbBuffer = null;
    let thumbKey = "";
    let thumbType = "";
    let thumbSize = 0;
    if (isVideo) {
      if (!thumbFile || typeof thumbFile.arrayBuffer !== "function") {
        return errorResponse("MISSING_THUMBNAIL", 400, { where: "PROFILE_STORY_UPLOAD" });
      }
      if (!Number.isFinite(thumbFile.size) || thumbFile.size <= 0) {
        return errorResponse("EMPTY_THUMBNAIL", 400, { where: "PROFILE_STORY_UPLOAD" });
      }
      const thumbContentType = String(thumbFile.type || "").toLowerCase();
      if (!thumbContentType.startsWith("image/")) {
        return errorResponse("INVALID_THUMBNAIL", 415, { where: "PROFILE_STORY_UPLOAD" });
      }
      const maxThumbBytes = policy.maxThumbBytes;
      if (Number.isFinite(maxThumbBytes) && thumbFile.size > maxThumbBytes) {
        return errorResponse("THUMB_TOO_LARGE", 413, { where: "PROFILE_STORY_UPLOAD" });
      }
      const thumbExt = getExtension(thumbContentType, thumbFile.name).replace(/[^a-z0-9]/g, "");
      thumbType = thumbContentType || "image/jpeg";
      thumbSize = Number(thumbFile.size || 0);
      thumbKey = buildStoryThumbKey(ownerId, slot, thumbExt || "jpg");
      try {
        thumbBuffer = await thumbFile.arrayBuffer();
      } catch (error) {
        logError("PROFILE_STORY_THUMB_READ_ERROR", error);
        return errorResponse("READ_FAILED", 400, {
          where: "PROFILE_STORY_UPLOAD",
          message: error && error.message ? error.message : "",
        });
      }
    }

    const existingRows = await getStoryMediaRows(db, identifiers);
    const normalizedRows = await normalizeStoryOwnerRows(db, existingRows, ownerId);
    const existingMap = new Map(normalizedRows.map((row) => [Number(row.slot), row]));
    const existing = existingMap.get(slot) || null;

    let buffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      logError("PROFILE_STORY_READ_ERROR", error);
      return errorResponse("READ_FAILED", 400, {
        where: "PROFILE_STORY_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }
    try {
      await bucket.put(r2Key, buffer, {
        httpMetadata: { contentType },
        customMetadata: { owner: ownerId, type: isVideo ? "video" : "image" },
      });
    } catch (error) {
      logError("PROFILE_R2_PUT_ERROR", error);
      return errorResponse("R2_WRITE_FAILED", 502, {
        where: "PROFILE_STORY_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }
    if (thumbBuffer && thumbKey) {
      try {
        await bucket.put(thumbKey, thumbBuffer, {
          httpMetadata: { contentType: thumbType },
          customMetadata: { owner: ownerId, type: "thumb" },
        });
      } catch (error) {
        logError("PROFILE_R2_THUMB_PUT_ERROR", error);
        try {
          await bucket.delete(r2Key);
        } catch (deleteError) {
          logError("PROFILE_MEDIA_ROLLBACK_ERROR", deleteError);
        }
        return errorResponse("THUMB_UPLOAD_FAILED", 502, {
          where: "PROFILE_STORY_UPLOAD",
          message: error && error.message ? error.message : "",
        });
      }
    }

    const now = new Date().toISOString();
    try {
      await upsertStoryMedia(db, {
        userId: ownerId,
        slot,
        title,
        mediaKey: r2Key,
        mediaType: isVideo ? "video" : "image",
        thumbKey: isVideo ? thumbKey : "",
        thumbUrl: isVideo ? thumbKey : "",
        thumbType: isVideo ? thumbType : "",
        thumbSize: isVideo ? thumbSize : 0,
        size: Number(file.size || 0),
        createdAt: existing && existing.createdAt ? existing.createdAt : now,
        updatedAt: now,
      });
    } catch (error) {
      logError("PROFILE_STORY_UPSERT_ERROR", error);
      try {
        await bucket.delete(r2Key);
        if (thumbKey) await bucket.delete(thumbKey);
      } catch (deleteError) {
        logError("PROFILE_MEDIA_ROLLBACK_ERROR", deleteError);
      }
      return errorResponse("DB_WRITE_FAILED", 500, {
        where: "PROFILE_STORY_UPLOAD",
        message: error && error.message ? error.message : "",
      });
    }

    if (existing && existing.mediaKey && existing.mediaKey !== r2Key) {
      try {
        await bucket.delete(existing.mediaKey);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }
    if (existing && existing.thumbKey && existing.thumbKey !== thumbKey) {
      try {
        await bucket.delete(existing.thumbKey);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }

    const exp = Math.floor(Date.now() / 1000) + MEDIA_TOKEN_TTL_SEC;
    const token = await createSignedMediaToken(signingSecret, r2Key, exp, "story");
    if (!token) {
      return errorResponse("MEDIA_SIGNING_FAILED", 500, {
        where: "PROFILE_STORY_UPLOAD",
        hint: "Check MEDIA_SIGNING_SECRET",
      });
    }
    const mediaUrl = buildStoryMediaUrl(context.request.url, token);
    let thumbUrl = "";
    if (thumbKey && signingSecret) {
      const thumbToken = await createSignedMediaToken(signingSecret, thumbKey, exp, "thumb");
      thumbUrl = thumbToken ? buildStoryMediaUrl(context.request.url, thumbToken) : "";
    }
    invalidateStoryCache(ownerId);

    return jsonResponse(
      {
        ok: true,
        data: {
          userId: ownerId,
          slot,
          title,
          type: isVideo ? "video" : "image",
          size: Number(file.size || 0),
          createdAt: existing && existing.createdAt ? existing.createdAt : now,
          updatedAt: now,
          mediaKey: r2Key,
          key: r2Key,
          mediaId: r2Key,
          media_id: r2Key,
          thumbKey: thumbKey || "",
          url: mediaUrl,
          mediaUrl,
          thumbUrl,
        },
        media: {
          url: mediaUrl,
          mediaUrl,
          thumbUrl,
          mediaKey: r2Key,
          key: r2Key,
          mediaId: r2Key,
          media_id: r2Key,
          thumbKey: thumbKey || "",
          type: isVideo ? "video" : "image",
          size: Number(file.size || 0),
          slot: slot - 1,
          title,
          createdAt: existing && existing.createdAt ? existing.createdAt : now,
        },
      },
      200
    );
  } catch (error) {
    logError("PROFILE_STORY_UPLOAD_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_STORY_UPLOAD",
      message: error && error.message ? error.message : "",
    });
  }
}

async function handleStoryThumbUpdate(context, form) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_THUMB",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_THUMB",
        hint: "Set R2_PROFILE binding",
      });
    }

    const signingSecret = getMediaSigningSecret(context.env);
    if (!signingSecret) {
      return errorResponse("MEDIA_SIGNING_NOT_CONFIGURED", 503, {
        where: "PROFILE_STORY_THUMB",
        hint: "Set MEDIA_SIGNING_SECRET",
      });
    }

    await ensureStoryMediaColumns(db);

    const payload = form || (await context.request.formData());
    const thumbFile = payload.get("thumb");
    if (!thumbFile || typeof thumbFile.arrayBuffer !== "function") {
      return errorResponse("MISSING_THUMBNAIL", 400, { where: "PROFILE_STORY_THUMB" });
    }
    if (!Number.isFinite(thumbFile.size) || thumbFile.size <= 0) {
      return errorResponse("EMPTY_THUMBNAIL", 400, { where: "PROFILE_STORY_THUMB" });
    }

    const userRef =
      payload.get("userId") ||
      payload.get("ownerId") ||
      payload.get("user_id") ||
      payload.get("id") ||
      "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_STORY_THUMB" });

    let userColumns = await getUserColumns(db);
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_THUMB" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_THUMB" });
    const ownerId = getPrimaryUserId(user);
    if (!ownerId) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_THUMB" });
    let identifiers = getUserIdentifierSet(user, userColumns);
    if (!identifiers.length) identifiers = [ownerId];
    const policy = getStoryUploadPolicy(user);
    if (!policy.allowVideo) {
      return errorResponse("NOT_ELIGIBLE", 403, { where: "PROFILE_STORY_THUMB" });
    }

    const slot = normalizeSlotValue(payload.get("slot"));
    if (!slot) return errorResponse("INVALID_SLOT", 400, { where: "PROFILE_STORY_THUMB" });

    const existingRows = await getStoryMediaRows(db, identifiers);
    const normalizedRows = await normalizeStoryOwnerRows(db, existingRows, ownerId);
    const existingMap = new Map(normalizedRows.map((row) => [Number(row.slot), row]));
    const existing = existingMap.get(slot) || null;
    const existingMediaKey = existing ? existing.mediaKey || existing.media_key || "" : "";
    const existingThumbKey = existing ? existing.thumbKey || existing.thumb_key || "" : "";
    if (!existing || !existingMediaKey) {
      return errorResponse("STORY_NOT_FOUND", 404, { where: "PROFILE_STORY_THUMB" });
    }
    const existingType = String(existing.mediaType || existing.media_type || "").toLowerCase();
    if (existingType !== "video") {
      return errorResponse("NOT_VIDEO", 400, { where: "PROFILE_STORY_THUMB" });
    }

    const thumbContentType = String(thumbFile.type || "").toLowerCase();
    if (!thumbContentType.startsWith("image/")) {
      return errorResponse("INVALID_THUMBNAIL", 415, { where: "PROFILE_STORY_THUMB" });
    }
    const maxThumbBytes = policy.maxThumbBytes;
    if (Number.isFinite(maxThumbBytes) && thumbFile.size > maxThumbBytes) {
      return errorResponse("THUMB_TOO_LARGE", 413, { where: "PROFILE_STORY_THUMB" });
    }

    const thumbExt = getExtension(thumbContentType, thumbFile.name).replace(/[^a-z0-9]/g, "");
    const thumbType = thumbContentType || "image/jpeg";
    const thumbSize = Number(thumbFile.size || 0);
    const thumbKey = buildStoryThumbKey(ownerId, slot, thumbExt || "jpg");

    let buffer;
    try {
      buffer = await thumbFile.arrayBuffer();
    } catch (error) {
      logError("PROFILE_STORY_THUMB_READ_ERROR", error);
      return errorResponse("READ_FAILED", 400, {
        where: "PROFILE_STORY_THUMB",
        message: error && error.message ? error.message : "",
      });
    }
    try {
      await bucket.put(thumbKey, buffer, {
        httpMetadata: { contentType: thumbType },
        customMetadata: { owner: ownerId, type: "thumb" },
      });
    } catch (error) {
      logError("PROFILE_R2_THUMB_PUT_ERROR", error);
      return errorResponse("THUMB_UPLOAD_FAILED", 502, {
        where: "PROFILE_STORY_THUMB",
        message: error && error.message ? error.message : "",
      });
    }

    const now = new Date().toISOString();
    try {
      await upsertStoryMedia(db, {
        userId: ownerId,
        slot,
        title: existing.title || "",
        mediaKey: existingMediaKey,
        mediaType: existingType,
        thumbKey,
        thumbUrl: thumbKey,
        thumbType,
        thumbSize,
        size: Number(existing.size || 0),
        createdAt: existing.createdAt || existing.created_at || now,
        updatedAt: now,
      });
    } catch (error) {
      logError("PROFILE_STORY_THUMB_UPSERT_ERROR", error);
      try {
        await bucket.delete(thumbKey);
      } catch (deleteError) {
        logError("PROFILE_MEDIA_ROLLBACK_ERROR", deleteError);
      }
      return errorResponse("DB_WRITE_FAILED", 500, {
        where: "PROFILE_STORY_THUMB",
        message: error && error.message ? error.message : "",
      });
    }

    if (existingThumbKey && existingThumbKey !== thumbKey) {
      try {
        await bucket.delete(existingThumbKey);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }

    const exp = Math.floor(Date.now() / 1000) + MEDIA_TOKEN_TTL_SEC;
    const token = await createSignedMediaToken(signingSecret, thumbKey, exp, "thumb");
    const thumbUrl = token ? buildStoryMediaUrl(context.request.url, token) : "";
    invalidateStoryCache(ownerId);

    return jsonResponse(
      {
        ok: true,
        data: { slot, thumbUrl },
        thumbUrl,
        slot,
      },
      200
    );
  } catch (error) {
    logError("PROFILE_STORY_THUMB_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_STORY_THUMB",
      message: error && error.message ? error.message : "",
    });
  }
}

async function handleStoryRemove(context, payload) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_REMOVE",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_REMOVE",
        hint: "Set R2_PROFILE binding",
      });
    }

    await ensureStoryMediaColumns(db);

    const body = payload || (await readJsonBody(context.request));
    if (!body) return errorResponse("INVALID_BODY", 400, { where: "PROFILE_STORY_REMOVE" });

    const userRef = body.userId || body.ownerId || body.user_id || body.id || "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_STORY_REMOVE" });

    let userColumns = await getUserColumns(db);
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_REMOVE" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_REMOVE" });
    const ownerId = getPrimaryUserId(user);
    if (!ownerId) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_REMOVE" });
    let identifiers = getUserIdentifierSet(user, userColumns);
    if (!identifiers.length) identifiers = [ownerId];
    const slot = normalizeSlotValue(body.slot);
    if (!slot) return errorResponse("INVALID_SLOT", 400, { where: "PROFILE_STORY_REMOVE" });
    const existingRows = await getStoryMediaRows(db, identifiers);
    const normalizedRows = await normalizeStoryOwnerRows(db, existingRows, ownerId);
    const existingMap = new Map(normalizedRows.map((row) => [Number(row.slot), row]));
    const existing = existingMap.get(slot) || null;
    if (existing && existing.mediaKey) {
      try {
        await bucket.delete(existing.mediaKey);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }
    if (existing && existing.thumbKey) {
      try {
        await bucket.delete(existing.thumbKey);
      } catch (error) {
        logError("PROFILE_MEDIA_DELETE_ERROR", error);
      }
    }
    await deleteStoryMediaRow(db, ownerId, slot);
    invalidateStoryCache(ownerId);

    return jsonResponse({ ok: true, data: { removed: true, slot } }, 200);
  } catch (error) {
    logError("PROFILE_STORY_REMOVE_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_STORY_REMOVE",
      message: error && error.message ? error.message : "",
    });
  }
}

async function handleSave(context, body) {
  try {
    const db = context?.env?.DB;
    const bucket = context?.env?.R2_PROFILE;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_SAVE",
        hint: "Set DB binding",
      });
    }
    if (!bucket) {
      return errorResponse("R2_NOT_CONFIGURED", 500, {
        where: "PROFILE_STORY_SAVE",
        hint: "Set R2_PROFILE binding",
      });
    }

    const payload = body || (await readJsonBody(context.request));
    if (!payload) return errorResponse("INVALID_BODY", 400, { where: "PROFILE_STORY_SAVE" });
    if (payload.avatar && (payload.avatar.remove === true || payload.avatar.action === "remove")) {
      return await handleAvatarRemove(context, payload);
    }

    const actionRaw = String(payload.action || payload.type || "").trim().toLowerCase();
    if (actionRaw === "avatar") {
      return errorResponse("INVALID_BODY", 400, { where: "PROFILE_AVATAR_UPLOAD" });
    }
    if (actionRaw === "remove" || actionRaw === "delete") {
      return await handleStoryRemove(context, payload);
    }

    const userRef = payload.userId || payload.ownerId || payload.user_id || payload.id || "";
    const userValue = String(userRef || "").trim();
    if (!userValue) return errorResponse("MISSING_USER", 400, { where: "PROFILE_STORY_SAVE" });

    await ensureStoryMediaColumns(db);
    let userColumns = await getUserColumns(db);
    let user = await resolveUser(db, userValue, userColumns);
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_SAVE" });
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userValue));
    if (!user) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_SAVE" });
    const ownerId = getPrimaryUserId(user);
    if (!ownerId) return errorResponse("USER_NOT_FOUND", 404, { where: "PROFILE_STORY_SAVE" });
    let identifiers = getUserIdentifierSet(user, userColumns);
    if (!identifiers.length) identifiers = [ownerId];
    const policy = getStoryUploadPolicy(user);

    const rawStories = Array.isArray(payload.stories) ? payload.stories : [];
    const existingRows = await getStoryMediaRows(db, identifiers);
    const normalizedRows = await normalizeStoryOwnerRows(db, existingRows, ownerId);
    const existingMap = new Map(normalizedRows.map((row) => [Number(row.slot), row]));
    const nextSlots = new Set();

    if (!rawStories.length) {
      for (const row of normalizedRows) {
        if (row.mediaKey) {
          try {
            await bucket.delete(row.mediaKey);
          } catch (error) {
            logError("PROFILE_MEDIA_DELETE_ERROR", error);
          }
        }
        await deleteStoryMediaRow(db, ownerId, Number(row.slot));
      }
      invalidateStoryCache(ownerId);
      return jsonResponse({ ok: true, data: { stories: [] }, stories: [] }, 200);
    }

    for (const item of rawStories) {
      const slot = normalizeSlotValue(item && item.slot);
      if (!slot) return errorResponse("INVALID_SLOT", 400, { where: "PROFILE_STORY_SAVE" });
      nextSlots.add(slot);

      const rawType = String(item && item.type ? item.type : "image").toLowerCase();
      const mediaType = rawType === "video" ? "video" : "image";
      if (!policy.allowVideo && mediaType === "video") {
        return errorResponse("NOT_ELIGIBLE", 403, { where: "PROFILE_STORY_SAVE" });
      }

      const explicitKey = String(item && (item.key || item.mediaKey || item.media_key || "") || "").trim();
      const mediaIdValue = String(item && (item.mediaId || item.media_id || "") || "").trim();
      const rawUrl = String(item && (item.mediaUrl || item.url || item.src || "") || "").trim();
      const existing = existingMap.get(slot);
      const existingKey =
        existing && (existing.mediaKey || existing.media_key) ? String(existing.mediaKey || existing.media_key) : "";
      const resolvedKey = !explicitKey && rawUrl ? await resolveStoryKeyFromUrl(rawUrl, context.env) : "";
      const mediaIdKey = mediaIdValue && isSafeStoryKey(mediaIdValue) ? mediaIdValue : "";
      const key = explicitKey || mediaIdKey || existingKey || resolvedKey;
      if (!key) return errorResponse("MISSING_MEDIA", 400, { where: "PROFILE_STORY_SAVE" });
      if (!isSafeStoryKey(key)) return errorResponse("INVALID_KEY", 400, { where: "PROFILE_STORY_SAVE" });
      const explicitThumbKey = String(item && (item.thumbKey || item.thumb_key || "") || "").trim();
      const thumbKey = explicitThumbKey || (existing && existing.thumbKey ? String(existing.thumbKey) : "");
      if (mediaType === "video" && !thumbKey) {
        return errorResponse("MISSING_THUMBNAIL", 400, { where: "PROFILE_STORY_SAVE" });
      }
      if (thumbKey && !isSafeStoryKey(thumbKey)) {
        return errorResponse("INVALID_THUMB", 400, { where: "PROFILE_STORY_SAVE" });
      }
      const resolvedThumbKey = mediaType === "video" ? thumbKey : "";
      const resolvedThumbType =
        mediaType === "video"
          ? String(
              (item && (item.thumbType || item.thumb_type)) ||
                (existing && (existing.thumbType || existing.thumb_type)) ||
                "image/jpeg"
            )
          : "";
      const resolvedThumbSize =
        mediaType === "video"
          ? Number(item && item.thumbSize ? item.thumbSize : existing && existing.thumbSize ? existing.thumbSize : 0)
          : 0;
      const now = new Date().toISOString();
      try {
        await upsertStoryMedia(db, {
          userId: ownerId,
          slot,
          title: normalizeTitle(item && item.title),
          mediaKey: key,
          mediaType,
          thumbKey: resolvedThumbKey,
          thumbType: resolvedThumbType,
          thumbSize: resolvedThumbSize,
          size: Number(item && item.size ? item.size : existing && existing.size ? existing.size : 0),
          createdAt: existing && existing.createdAt ? existing.createdAt : now,
          updatedAt: now,
        });
        if (existing && existing.thumbKey && existing.thumbKey !== resolvedThumbKey) {
          try {
            await bucket.delete(existing.thumbKey);
          } catch (error) {
            logError("PROFILE_MEDIA_DELETE_ERROR", error);
          }
        }
      } catch (error) {
        logError("PROFILE_STORY_SAVE_ERROR", error);
        return errorResponse("DB_WRITE_FAILED", 500, {
          where: "PROFILE_STORY_SAVE",
          message: error && error.message ? error.message : "",
        });
      }
    }

    for (const row of normalizedRows) {
      if (nextSlots.has(Number(row.slot))) continue;
      if (row.mediaKey) {
        try {
          await bucket.delete(row.mediaKey);
        } catch (error) {
          logError("PROFILE_MEDIA_DELETE_ERROR", error);
        }
      }
      if (row.thumbKey) {
        try {
          await bucket.delete(row.thumbKey);
        } catch (error) {
          logError("PROFILE_MEDIA_DELETE_ERROR", error);
        }
      }
      await deleteStoryMediaRow(db, ownerId, Number(row.slot));
    }

    const stories = await listStoryMedia(db, identifiers, ownerId, context.request.url, context.env);
    const validation = validateStoryPayload(stories);
    if (!validation.ok) {
      return errorResponse(validation.error, 500, { where: "PROFILE_STORY_SAVE" });
    }
    invalidateStoryCache(ownerId);
    return jsonResponse({ ok: true, data: { stories }, stories }, 200);
  } catch (error) {
    logError("PROFILE_SAVE_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_STORY_SAVE",
      message: error && error.message ? error.message : "",
    });
  }
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    await ensureProfileTables(db);
    await ensureTableColumns(db, "media_metadata", [
      { name: "owner_user_id", def: "TEXT" },
      { name: "r2_bucket", def: "TEXT" },
      { name: "r2_key", def: "TEXT" },
      { name: "content_type", def: "TEXT" },
      { name: "access_level", def: "TEXT DEFAULT 'public'" },
      { name: "created_at", def: "TEXT" },
    ]);
    await ensureTableColumns(db, "media_tokens", [
      { name: "token", def: "TEXT" },
      { name: "media_id", def: "TEXT" },
      { name: "created_at", def: "INTEGER" },
    ]);
    await ensureTableColumns(db, "profile_stories", [
      { name: "slot", def: "INTEGER DEFAULT 0" },
      { name: "title", def: "TEXT" },
      { name: "type", def: "TEXT DEFAULT 'image'" },
      { name: "created_at", def: "TEXT" },
      { name: "updated_at", def: "TEXT" },
    ]);
    const url = new URL(context.request.url);
    const viewParam = String(url.searchParams.get("view") || url.searchParams.get("mode") || "").trim().toLowerCase();
    const view = viewParam === "chat" || viewParam === "lite" ? "chat" : viewParam === "public" ? "public" : "full";
    const includeStories = view !== "chat";
    const includeStats = view !== "chat";
    const usernameRef = url.searchParams.get("u") || url.searchParams.get("username") || "";
    const userRef =
      usernameRef ||
      url.searchParams.get("id") ||
      url.searchParams.get("userId") ||
      url.searchParams.get("user_id") ||
      "";
    if (!userRef) return jsonResponse({ ok: false, error: "MISSING_USER" }, 400);
    if (usernameRef && usernameRef.includes("@")) {
      return jsonResponse({ ok: false, error: "INVALID_USERNAME" }, 400);
    }
    let userColumns = await getUserColumns(db);
    if (userColumns.size) {
      const changed = await ensureUserColumns(db, userColumns);
      if (changed) userColumns = await getUserColumns(db);
    }
    await ensureUserIdIndex(db, userColumns);
    if (!userColumns.size) return jsonResponse({ ok: false, error: "DB_NOT_READY" }, 500);
    let user = await resolveUser(db, userRef, userColumns, { allowId: !usernameRef, allowEmail: !usernameRef });
    if (!user) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
    await ensureUserId(db, user, userColumns);
    ({ user, columns: userColumns } = await reloadUserState(db, userRef, { allowId: !usernameRef, allowEmail: !usernameRef }));
    if (!user) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
    await ensureUserCreatedAt(db, user, userColumns);
    const ownerId = getPrimaryUserId(user);
    let identifiers = getUserIdentifierSet(user, userColumns);
    if (!identifiers.length && ownerId) identifiers = [ownerId];
    const bucket = context?.env?.R2_PROFILE;
    if (includeStories && identifiers.length) {
      await cleanupExpiredStories(db, bucket, identifiers);
    }
    let stories = [];
    if (includeStories && identifiers.length) {
      await ensureStoryMediaColumns(db);
      const storyCacheKey = ownerId != null ? String(ownerId) : identifiers[0] ? String(identifiers[0]) : "";
      const cachedStories = readCache(profileStoriesCache, storyCacheKey);
      if (cachedStories) {
        stories = cachedStories;
      } else {
        const startedAt = Date.now();
        stories = await listStoryMedia(db, identifiers, ownerId, context.request.url, context.env);
        logSlowQuery("profile.stories", startedAt, context.env);
        if (storyCacheKey) writeCache(profileStoriesCache, storyCacheKey, stories, PROFILE_STORIES_CACHE_TTL_MS);
      }
    }
    const statsUserId = ownerId || (identifiers.length ? identifiers[0] : null);
    let stats = null;
    if (includeStats && statsUserId) {
      const statsCacheKey = String(statsUserId);
      const cachedStats = readCache(profileStatsCache, statsCacheKey);
      if (cachedStats) {
        stats = cachedStats;
      } else {
        const startedAt = Date.now();
        stats = await getProfileStats(db, statsUserId);
        logSlowQuery("profile.stats", startedAt, context.env);
        writeCache(profileStatsCache, statsCacheKey, stats, PROFILE_STATS_CACHE_TTL_MS);
      }
    }
    if (user.avatar_url) {
      const avatarMediaId = await resolveMediaId(db, user.avatar_url);
      if (avatarMediaId) {
        const token = await ensureMediaToken(db, avatarMediaId);
        if (token) user.avatar_url = buildMediaUrl(context.request.url, token);
      }
    }
    return jsonResponse(
      {
        ok: true,
        user: formatUser(user, view),
        stories,
        stats: includeStats ? formatStats(stats, view) : null,
      },
      200
    );
  } catch (error) {
    logError("PROFILE_GET_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, {
        where: "PROFILE_POST",
        hint: "Set DB binding",
      });
    }
    await ensureProfileTables(db);
    await ensureTableColumns(db, "media_metadata", [
      { name: "owner_user_id", def: "TEXT" },
      { name: "r2_bucket", def: "TEXT" },
      { name: "r2_key", def: "TEXT" },
      { name: "content_type", def: "TEXT" },
      { name: "access_level", def: "TEXT DEFAULT 'public'" },
      { name: "created_at", def: "TEXT" },
    ]);
    await ensureTableColumns(db, "media_tokens", [
      { name: "token", def: "TEXT" },
      { name: "media_id", def: "TEXT" },
      { name: "created_at", def: "INTEGER" },
    ]);
    await ensureTableColumns(db, "profile_stories", [
      { name: "slot", def: "INTEGER DEFAULT 0" },
      { name: "title", def: "TEXT" },
      { name: "type", def: "TEXT DEFAULT 'image'" },
      { name: "created_at", def: "TEXT" },
      { name: "updated_at", def: "TEXT" },
    ]);
    await ensureStoryMediaColumns(db);
    let userColumns = await getUserColumns(db);
    if (userColumns.size) await ensureUserColumns(db, userColumns);
    await ensureUserIdIndex(db, userColumns);
    const contentType = context?.request?.headers?.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return errorResponse("UPLOAD_ENDPOINT_REQUIRED", 415, {
        where: "PROFILE_POST",
        hint: "Use /api/profile/upload",
      });
    }
    const body = await readJsonBody(context.request);
    if (!body) return errorResponse("INVALID_BODY", 400, { where: "PROFILE_POST" });
    return await handleSave(context, body);
  } catch (error) {
    logError("PROFILE_POST_ERROR", error);
    return errorResponse("INTERNAL", 500, {
      where: "PROFILE_POST_ERROR",
      message: error && error.message ? error.message : "",
    });
  }
}

export {
  ensureProfileTables,
  ensureTableColumns,
  ensureStoryMediaColumns,
  getUserColumns,
  ensureUserColumns,
  ensureUserIdIndex,
  handleAvatarUpload,
  handleStoryUpload,
  handleStoryThumbUpdate,
  handleStoryRemove,
};
