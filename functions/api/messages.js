import {
  generateId,
  hashPassword,
  jsonResponse,
  normalizeEmail,
  normalizeUsername,
  readJsonBody,
} from "./auth/_utils.js";
import { runMigrations, SCHEMA_USER_VERSION } from "./admin/migrate.js";
import { recordOnlinePing, setUnreadCount, touchConversationVersions } from "./chat_state.js";
import { createRequestTiming } from "./_timing.js";

const SUPPORT_TYPE = "support";
const DM_TYPE = "dm";
const DIRECT_PREFIX = "dm:";
const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@admin.local";
const ADMIN_DISPLAY_NAME = "B\u1ea1ch Kim";
const MEDIA_TOKEN_TTL_SEC = 24 * 60 * 60;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const DEFAULT_WELCOME_MESSAGE = "Hi {name}! I'm the admin. This chat is for support and questions.";
const SLOW_QUERY_MS = 300;
const CHAT_SCHEMA_VERSION = SCHEMA_USER_VERSION;

const MEDIA_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const IMAGE_TYPE_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let signingKeyCache = { secret: "", key: null };
let chatSchemaReady = false;
const AUTO_MIGRATE_LOCK_MS = 15000;
let autoMigratePromise = null;
let autoMigrateLockUntil = 0;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toIso(seconds) {
  return new Date(Number(seconds) * 1000).toISOString();
}

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw;
}

function sortPairIds(userA, userB) {
  const left = normalizeId(userA);
  const right = normalizeId(userB);
  if (!left || !right) return ["", ""];
  const bothNumeric = /^\d+$/.test(left) && /^\d+$/.test(right);
  if (bothNumeric) {
    return Number(left) <= Number(right) ? [left, right] : [right, left];
  }
  return String(left).localeCompare(String(right)) <= 0 ? [left, right] : [right, left];
}

export function buildConversationPairKey(userA, userB) {
  const [first, second] = sortPairIds(userA, userB);
  return first && second ? `${first}:${second}` : "";
}

function sanitizeUserKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function parseTimestampToSeconds(value) {
  if (value == null || value === "") return null;
  const rawText = String(value);
  const numeric = /^\d+(\.\d+)?$/.test(rawText) ? Number(rawText) : Number.NaN;
  if (Number.isFinite(numeric)) {
    if (numeric > 1000000000000) return Math.floor(numeric / 1000);
    if (numeric > 10000000000) return Math.floor(numeric / 1000);
    return Math.floor(numeric);
  }
  const parsed = Date.parse(rawText);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function parseLimit(value, fallback = 20, min = 10, max = 50) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function isLikelyUrl(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return true;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return true;
  return raw.startsWith("/media/") || raw.startsWith("/m/");
}

function shouldKeepMediaCaption(text, mediaUrl) {
  const body = String(text || "").trim();
  if (!body) return false;
  if (mediaUrl && body === String(mediaUrl).trim()) return false;
  return !isLikelyUrl(body);
}

const NO_STORE_HEADERS = "no-store, no-cache, must-revalidate";

function withNoStore(response) {
  if (response && response.headers && typeof response.headers.set === "function") {
    response.headers.set("cache-control", NO_STORE_HEADERS);
    response.headers.set("pragma", "no-cache");
  }
  return response;
}

function errorResponse(code, status, detail) {
  const payload = { ok: false, error: code };
  if (detail) payload.detail = detail;
  return withNoStore(jsonResponse(payload, status));
}

function chatSchemaErrorResponse(error) {
  const code = String((error && error.message) || "");
  if (code === "CHAT_SCHEMA_MIGRATION_REQUIRED" || code === "CHAT_SCHEMA_MISSING") {
    const currentVersion = Number.isFinite(error && error.currentVersion) ? error.currentVersion : undefined;
    const requiredVersion = Number.isFinite(error && error.requiredVersion) ? error.requiredVersion : CHAT_SCHEMA_VERSION;
    return withNoStore(
      jsonResponse(
        {
          ok: false,
          error: "CHAT_SCHEMA_MIGRATION_REQUIRED",
          next: "/api/admin/migrate",
          currentVersion,
          requiredVersion,
        },
        409
      )
    );
  }
  return null;
}

function isChatSchemaError(code) {
  return code === "CHAT_SCHEMA_MIGRATION_REQUIRED" || code === "CHAT_SCHEMA_MISSING";
}

function shouldAutoMigrate(env) {
  const raw = String((env && (env.AUTO_MIGRATE || env.CHAT_AUTO_MIGRATE)) || "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function readUserVersion(db) {
  if (!db) return 0;
  try {
    const row = await db.prepare("PRAGMA user_version").first();
    const value = row && (row.user_version ?? row.userVersion);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

async function setUserVersion(db, value) {
  if (!db) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  const safeValue = Math.max(0, Math.floor(parsed));
  try {
    await db.prepare(`PRAGMA user_version = ${safeValue}`).run();
  } catch (error) {}
}

async function runAutoMigrate(db, env) {
  if (!db || !shouldAutoMigrate(env)) return null;
  const now = Date.now();
  if (autoMigratePromise) return autoMigratePromise;
  if (now < autoMigrateLockUntil) return null;
  autoMigrateLockUntil = now + AUTO_MIGRATE_LOCK_MS;
  autoMigratePromise = (async () => {
    try {
      return await runMigrations(db, { migrationId: "auto-chat" });
    } finally {
      autoMigratePromise = null;
    }
  })();
  return autoMigratePromise;
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

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

export function getSessionUser(request, env) {
  if (!request) return null;
  const headers = request.headers;
  const id = normalizeId(headers.get("x-user-id") || headers.get("x-user") || "");
  if (!id) return null;
  const email = headers.get("x-user-email") || "";
  const name = headers.get("x-user-name") || "";
  const avatar = headers.get("x-user-avatar") || "";
  const username = headers.get("x-user-username") || "";
  const role = headers.get("x-user-role") || "";
  return { id, email, name, avatar, username, role };
}

function getAdminCredentials(env) {
  const webUser = env && typeof env.ADMIN_WEB_USER === "string" ? env.ADMIN_WEB_USER : "";
  const webPass = env && typeof env.ADMIN_WEB_PASS === "string" ? env.ADMIN_WEB_PASS : "";
  if (webUser && webPass) {
    return { user: webUser.trim(), pass: String(webPass) };
  }
  const panelUser = env && typeof env.ADMIN_PANEL_USER === "string" ? env.ADMIN_PANEL_USER : "";
  const panelPass = env && typeof env.ADMIN_PANEL_PASS === "string" ? env.ADMIN_PANEL_PASS : "";
  if (!panelUser || !panelPass) return null;
  return { user: panelUser.trim(), pass: String(panelPass) };
}

export function isAdminHeaderAuthorized(request, env) {
  if (!request) return false;
  const creds = getAdminCredentials(env);
  if (!creds) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  if (!headerUser || !headerPass) return false;
  return safeEqual(headerUser, creds.user) && safeEqual(headerPass, creds.pass);
}

export async function resolveAdminAccess(db, env, request, candidateId) {
  const adminAuth = isAdminHeaderAuthorized(request, env);
  const sessionUser = getSessionUser(request, env);
  if (!db) return { adminAuth, sessionUser, isAdmin: false, admin: null };

  if (adminAuth) {
    const admin = await ensureAdminUser(db, env);
    return { adminAuth, sessionUser, isAdmin: Boolean(admin), admin };
  }

  let isAdmin = false;
  const candidate = normalizeId((sessionUser && sessionUser.id) || candidateId || "");
  if (candidate) {
    const row = await findUserRow(db, candidate);
    if (row && isAdminRole(row.role)) isAdmin = true;
  }
  if (isAdmin) {
    const admin = await ensureAdminUser(db, env);
    return { adminAuth, sessionUser, isAdmin: Boolean(admin), admin };
  }

  return { adminAuth, sessionUser, isAdmin: false, admin: null };
}

function getMediaSigningSecret(env) {
  const secret = env && typeof env.MEDIA_SIGNING_SECRET === "string" ? env.MEDIA_SIGNING_SECRET.trim() : "";
  return String(secret || "").trim();
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

async function verifyMediaToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "INVALID_TOKEN" };
  const payloadB64 = parts[0];
  const signatureB64 = parts[1];
  if (!payloadB64 || !signatureB64) return { ok: false, error: "INVALID_TOKEN" };
  const expected = await signMediaPayload(payloadB64, secret);
  if (!expected || !safeEqual(expected, signatureB64)) return { ok: false, error: "INVALID_TOKEN" };
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToText(payloadB64));
  } catch (error) {
    return { ok: false, error: "INVALID_TOKEN" };
  }
  const keyValue =
    typeof payload.key === "string" && payload.key
      ? payload.key
      : typeof payload.k === "string" && payload.k
        ? payload.k
        : "";
  if (!keyValue) return { ok: false, error: "INVALID_TOKEN" };
  return { ok: true, key: keyValue, exp: payload.exp };
}

function extractMediaTokenFromUrl(mediaUrl) {
  const raw = String(mediaUrl || "").trim();
  if (!raw) return "";
  let token = raw;
  const marker = "/media/";
  if (raw.includes(marker)) {
    try {
      const parsed = new URL(raw, "https://local.invalid");
      const path = parsed.pathname || "";
      const idx = path.lastIndexOf(marker);
      if (idx !== -1) token = path.slice(idx + marker.length);
    } catch (error) {
      const idx = raw.lastIndexOf(marker);
      if (idx !== -1) token = raw.slice(idx + marker.length);
    }
  }
  try {
    token = decodeURIComponent(token);
  } catch (error) {}
  return token;
}

async function extractMediaKeyFromUrl(mediaUrl, env) {
  if (!mediaUrl) return "";
  const secret = getMediaSigningSecret(env);
  if (!secret) return "";
  const token = extractMediaTokenFromUrl(mediaUrl);
  if (!token) return "";
  const verified = await verifyMediaToken(token, secret);
  return verified.ok ? verified.key : "";
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

async function createSignedMediaToken(secret, key, exp) {
  if (!secret || !key) return "";
  const payloadB64 = base64UrlEncodeText(JSON.stringify({ k: key, exp }));
  const signature = await signMediaPayload(payloadB64, secret);
  if (!signature) return "";
  return `${payloadB64}.${signature}`;
}

function buildMediaUrl(requestUrl, token) {
  if (!token) return "";
  return new URL(`/media/${encodeURIComponent(token)}`, requestUrl).toString();
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

function sanitizeKeySegment(value) {
  const raw = String(value || "").trim();
  if (!raw) return "unknown";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getTableColumns(db, table) {
  if (!db || !table) return new Set();
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const columns = new Set();
    rows.forEach((row) => {
      if (row && row.name) columns.add(String(row.name));
    });
    return columns;
  } catch (error) {
    return new Set();
  }
}

async function getTableInfo(db, table) {
  if (!db || !table) return new Map();
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const info = new Map();
    rows.forEach((row) => {
      if (!row || !row.name) return;
      info.set(String(row.name), {
        name: String(row.name),
        type: row.type != null ? String(row.type) : "",
        pk: row.pk ? Number(row.pk) : 0,
        notnull: row.notnull ? Number(row.notnull) : 0,
        dflt: row.dflt_value ?? null,
      });
    });
    return info;
  } catch (error) {
    return new Map();
  }
}

function isIntegerPrimaryKey(info) {
  if (!info || !info.pk) return false;
  return /int/i.test(String(info.type || ""));
}

async function tableExists(db, table) {
  if (!db || !table) return false;
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .bind(table)
      .first();
    return Boolean(row && row.name);
  } catch (error) {
    return false;
  }
}

async function ensureTableColumns(db, table, defs) {
  if (!db || !table || !defs || !defs.length) return;
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

export async function ensureChatSchema(db) {
  if (!db) return;
  if (chatSchemaReady) return;

  if (!(await tableExists(db, "users"))) {
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL)"
      )
      .run();
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)").run();
  }

  await ensureTableColumns(db, "users", [
    { name: "email", def: "TEXT" },
    { name: "name", def: "TEXT" },
    { name: "avatar_url", def: "TEXT" },
    { name: "role", def: "TEXT DEFAULT 'user'" },
    { name: "created_at", def: "INTEGER" },
    { name: "welcome_sent_at", def: "INTEGER" },
  ]);

  const tableDefs = [
    {
      name: "conversations",
      required: ["id", "type", "created_at", "updated_at", "last_message_id", "last_message_at", "last_message_preview"],
      createSql: `
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT 'support',
          pair_key TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_message_id INTEGER,
          last_message_at INTEGER,
          last_message_preview TEXT
        );
      `,
    },
    {
      name: "conversation_participants",
      required: ["conversation_id", "user_id", "role", "last_read_message_id", "unread_count"],
      createSql: `
        CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          last_read_message_id INTEGER,
          unread_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (conversation_id, user_id)
        );
      `,
    },
    {
      name: "messages",
      required: ["id", "conversation_id", "sender_id", "type", "created_at", "media_key", "client_message_id"],
      createSql: `
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id TEXT NOT NULL,
          sender_id INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'text',
          text TEXT,
          media_key TEXT,
          client_message_id TEXT,
          created_at INTEGER NOT NULL
        );
      `,
    },
  ];

  for (const def of tableDefs) {
    const cols = await getTableColumns(db, def.name);
    if (!cols.size) {
      await db.prepare(def.createSql).run();
    }
  }

  const messageInfo = await getTableInfo(db, "messages");
  if (!messageInfo.size) throw new Error("CHAT_SCHEMA_MISSING");
  const idInfo = messageInfo.get("id");
  const messageColumns = await getTableColumns(db, "messages");
  const requiredMessageCols = ["conversation_id", "sender_id", "type", "created_at", "media_key", "client_message_id"];
  if (!idInfo || !isIntegerPrimaryKey(idInfo) || !requiredMessageCols.every((col) => messageColumns.has(col))) {
    throw new Error("CHAT_SCHEMA_MIGRATION_REQUIRED");
  }

  const conversationColumns = await getTableColumns(db, "conversations");
  const requiredConversationCols = ["pair_key", "last_message_id", "last_message_at", "last_message_preview"];
  if (!requiredConversationCols.every((col) => conversationColumns.has(col))) {
    throw new Error("CHAT_SCHEMA_MIGRATION_REQUIRED");
  }

  const participantColumns = await getTableColumns(db, "conversation_participants");
  const requiredParticipantCols = ["last_read_message_id", "unread_count"];
  if (!requiredParticipantCols.every((col) => participantColumns.has(col))) {
    throw new Error("CHAT_SCHEMA_MIGRATION_REQUIRED");
  }

  chatSchemaReady = true;
}

async function checkChatSchema(db) {
  if (!db) return { ok: false, error: "CHAT_SCHEMA_MISSING" };
  const userColumns = await getTableColumns(db, "users");
  if (!userColumns.size) return { ok: false, error: "CHAT_SCHEMA_MISSING" };
  const messageInfo = await getTableInfo(db, "messages");
  if (!messageInfo.size) return { ok: false, error: "CHAT_SCHEMA_MISSING" };
  const idInfo = messageInfo.get("id");
  const messageColumns = await getTableColumns(db, "messages");
  const requiredMessageCols = [
    "conversation_id",
    "sender_id",
    "type",
    "text",
    "created_at",
    "media_key",
    "client_message_id",
  ];
  if (!idInfo || !isIntegerPrimaryKey(idInfo) || !requiredMessageCols.every((col) => messageColumns.has(col))) {
    return { ok: false, error: "CHAT_SCHEMA_MIGRATION_REQUIRED" };
  }

  const conversationColumns = await getTableColumns(db, "conversations");
  if (!conversationColumns.size) return { ok: false, error: "CHAT_SCHEMA_MISSING" };
  const requiredConversationCols = [
    "id",
    "type",
    "pair_key",
    "created_at",
    "updated_at",
    "last_message_id",
    "last_message_at",
    "last_message_preview",
  ];
  if (!requiredConversationCols.every((col) => conversationColumns.has(col))) {
    return { ok: false, error: "CHAT_SCHEMA_MIGRATION_REQUIRED" };
  }

  const participantColumns = await getTableColumns(db, "conversation_participants");
  if (!participantColumns.size) return { ok: false, error: "CHAT_SCHEMA_MISSING" };
  const requiredParticipantCols = ["conversation_id", "user_id", "role", "last_read_message_id", "unread_count"];
  if (!requiredParticipantCols.every((col) => participantColumns.has(col))) {
    return { ok: false, error: "CHAT_SCHEMA_MIGRATION_REQUIRED" };
  }

  return { ok: true };
}

function buildChatSchemaError(code, currentVersion) {
  const error = new Error(code);
  if (Number.isFinite(currentVersion)) error.currentVersion = currentVersion;
  error.requiredVersion = CHAT_SCHEMA_VERSION;
  return error;
}

export async function ensureChatSchemaReady(db, env) {
  const currentVersion = await readUserVersion(db);
  if (chatSchemaReady && currentVersion >= CHAT_SCHEMA_VERSION) {
    return { ok: true, currentVersion };
  }

  const check = await checkChatSchema(db);
  if (check.ok) {
    if (currentVersion < CHAT_SCHEMA_VERSION) {
      await setUserVersion(db, CHAT_SCHEMA_VERSION);
      chatSchemaReady = true;
      return { ok: true, currentVersion: CHAT_SCHEMA_VERSION };
    }
    chatSchemaReady = true;
    return { ok: true, currentVersion };
  }

  if (shouldAutoMigrate(env)) {
    await runAutoMigrate(db, env);
    const nextVersion = await readUserVersion(db);
    const postCheck = await checkChatSchema(db);
    if (postCheck.ok) {
      if (nextVersion < CHAT_SCHEMA_VERSION) {
        await setUserVersion(db, CHAT_SCHEMA_VERSION);
      }
      chatSchemaReady = true;
      return { ok: true, migrated: true, currentVersion: Math.max(nextVersion, CHAT_SCHEMA_VERSION) };
    }
    throw buildChatSchemaError(postCheck.error || "CHAT_SCHEMA_MIGRATION_REQUIRED", nextVersion);
  }

  throw buildChatSchemaError(check.error || "CHAT_SCHEMA_MIGRATION_REQUIRED", currentVersion);
}

async function findUserRow(db, ref) {
  const input = normalizeId(ref);
  if (!db || !input) return null;
  const columns = await getTableColumns(db, "users");
  if (!columns.size) return null;
  const info = await getTableInfo(db, "users");
  const idInfo = info.get("id");
  const idIsInteger = idInfo ? isIntegerPrimaryKey(idInfo) : false;

  const conditions = [];
  const binds = [];
  if (columns.has("id") && (!idIsInteger || /^\d+$/.test(input))) {
    conditions.push("id = ?");
    binds.push(input);
  }
  const email = normalizeEmail(input);
  if (columns.has("email") && email) {
    conditions.push("lower(email) = ?");
    binds.push(email);
  }
  const username = normalizeUsername(input);
  if (columns.has("username") && username) {
    conditions.push("lower(username) = ?");
    binds.push(username);
  }
  if (!conditions.length) return null;
  const select = ["rowid AS row_id"];
  if (columns.has("id")) select.push("id");
  if (columns.has("email")) select.push("email");
  if (columns.has("username")) select.push("username");
  if (columns.has("display_name")) select.push("display_name");
  if (columns.has("name")) select.push("name");
  if (columns.has("avatar_url")) select.push("avatar_url");
  if (columns.has("role")) select.push("role");
  let row = await db
    .prepare(`SELECT ${select.join(", ")} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`)
    .bind(...binds)
    .first();
  if (!row && /^\d+$/.test(input)) {
    row = await db.prepare(`SELECT ${select.join(", ")} FROM users WHERE rowid = ? LIMIT 1`).bind(input).first();
  }
  if (!row) return null;
  if (columns.has("id") && row.id == null && row.row_id != null) {
    try {
      await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(String(row.row_id), row.row_id).run();
      row.id = String(row.row_id);
    } catch (error) {}
  }
  return row;
}

export function buildUserProfile(row, fallbackId) {
  if (!row) return null;
  const role = row.role || "user";
  const idValue = row.id ?? row.row_id ?? fallbackId;
  const displayName = row.display_name || row.name || row.username || "";
  const profile = {
    id: idValue != null ? String(idValue) : "",
    email: row.email || "",
    username: row.username || "",
    display_name: displayName,
    name: row.name || displayName,
    avatar_url: row.avatar_url || "",
    avatar: row.avatar_url || "",
    role,
    is_admin: isAdminRole(role),
    verified: isAdminRole(role),
  };
  return profile;
}

export async function ensureUser(sessionUser, db, options = {}) {
  if (!db || !sessionUser) return null;
  const allowAdmin = options && options.allowAdmin === true;
  const ref = normalizeId(sessionUser.id || sessionUser.email || sessionUser.username);
  if (!ref) return null;
  const columns = await getTableColumns(db, "users");
  if (!columns.size) return null;
  const info = await getTableInfo(db, "users");
  const idInfo = info.get("id");
  const idIsInteger = idInfo ? isIntegerPrimaryKey(idInfo) : false;

  const existing = await findUserRow(db, ref);
  if (existing) {
    const updates = [];
    const binds = [];
    const push = (col, value) => {
      if (!columns.has(col)) return;
      if (value == null || value === "") return;
      const current = existing[col];
      if (String(current || "") === String(value || "")) return;
      updates.push(`${col} = ?`);
      binds.push(value);
      existing[col] = value;
    };
    push("email", sessionUser.email ? normalizeEmail(sessionUser.email) : "");
    push("username", sessionUser.username ? normalizeUsername(sessionUser.username) : "");
    push("name", sessionUser.name || "");
    push("display_name", sessionUser.name || sessionUser.display_name || "");
    push("avatar_url", sessionUser.avatar || sessionUser.avatar_url || "");
    if (allowAdmin && sessionUser.role && isAdminRole(sessionUser.role)) {
      push("role", "admin");
    }
    if (updates.length) {
      const whereField = columns.has("id") ? "id" : "rowid";
      const whereValue = existing.id ?? existing.row_id;
      try {
        await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE ${whereField} = ?`).bind(...binds, whereValue).run();
      } catch (error) {}
    }
    return String(existing.id ?? existing.row_id ?? ref);
  }

  const required = new Set();
  info.forEach((col) => {
    if (!col || !col.name) return;
    if (col.pk) return;
    if (col.notnull && (col.dflt == null || String(col.dflt) === "")) {
      required.add(col.name);
    }
  });

  const emailValue = sessionUser.email ? normalizeEmail(sessionUser.email) : "";
  const usernameValue = sessionUser.username ? normalizeUsername(sessionUser.username) : "";
  const baseFromEmail = emailValue ? emailValue.split("@")[0] : "";
  const safeBase = sanitizeUserKey(usernameValue || baseFromEmail || ref) || "user";

  const insertCols = [];
  const binds = [];
  const colIndex = new Map();
  const pushValue = (col, value, force) => {
    if (!columns.has(col)) return;
    const shouldInclude = force || (value != null && value !== "");
    if (!shouldInclude) return;
    insertCols.push(col);
    binds.push(value != null && value !== "" ? value : "");
    colIndex.set(col, binds.length - 1);
  };

  const canSetId = columns.has("id") && (!idIsInteger || /^\d+$/.test(ref));
  if (canSetId) pushValue("id", ref, false);

  let nextEmail = emailValue;
  let nextUsername = usernameValue;
  if (!nextEmail && required.has("email")) {
    nextEmail = `${safeBase}@local.invalid`;
  }
  if (!nextUsername && required.has("username")) {
    nextUsername = safeBase;
  }

  pushValue("email", nextEmail, required.has("email"));
  pushValue("username", nextUsername, required.has("username"));
  const displayValue = sessionUser.name || sessionUser.display_name || safeBase;
  pushValue("name", sessionUser.name || "", required.has("name"));
  pushValue("display_name", displayValue, required.has("display_name"));
  pushValue("avatar_url", sessionUser.avatar || sessionUser.avatar_url || "", required.has("avatar_url"));
  if (columns.has("role")) {
    const roleValue = allowAdmin && sessionUser.role && isAdminRole(sessionUser.role) ? "admin" : "user";
    pushValue("role", roleValue, required.has("role"));
  }
  if (columns.has("created_at")) {
    pushValue("created_at", nowSeconds(), required.has("created_at"));
  }

  if (required.has("password_hash") || required.has("password_salt")) {
    const seed = generateId();
    const hashed = await hashPassword(seed);
    pushValue("password_hash", hashed.hash, required.has("password_hash"));
    pushValue("password_salt", hashed.salt, required.has("password_salt"));
  }

  info.forEach((col) => {
    if (!col || !col.name || !required.has(col.name)) return;
    if (insertCols.includes(col.name)) return;
    const type = String(col.type || "").toLowerCase();
    const fallback = /int|real|floa|doub/.test(type) ? 0 : "";
    pushValue(col.name, fallback, true);
  });

  if (!insertCols.length) return null;
  const placeholders = insertCols.map(() => "?").join(", ");
  let inserted = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.prepare(`INSERT INTO users (${insertCols.join(", ")}) VALUES (${placeholders})`).bind(...binds).run();
      inserted = true;
      break;
    } catch (error) {
      const message = String((error && error.message) || "").toLowerCase();
      if (!message.includes("unique")) break;
      const suffix = Math.random().toString(36).slice(2, 6);
      if (colIndex.has("email")) {
        binds[colIndex.get("email")] = `${safeBase}-${suffix}@local.invalid`;
      }
      if (colIndex.has("username")) {
        binds[colIndex.get("username")] = `${safeBase}-${suffix}`;
      }
    }
  }
  if (!inserted) return null;

  const row = await findUserRow(db, ref);
  return row ? String(row.id ?? row.row_id ?? ref) : null;
}

export async function ensureAdminUser(db, env) {
  const session = {
    id: "",
    email: ADMIN_EMAIL,
    name: ADMIN_DISPLAY_NAME,
    username: ADMIN_USERNAME,
    role: "admin",
  };
  const id = await ensureUser(session, db, { allowAdmin: true });
  if (!id) return null;
  try {
    const columns = await getTableColumns(db, "users");
    if (columns.has("role")) {
      await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind("admin", id).run();
    }
  } catch (error) {}
  const row = await findUserRow(db, id);
  const profile = buildUserProfile(row, id);
  if (profile) {
    profile.role = "admin";
    profile.is_admin = true;
    profile.verified = true;
  }
  return { id, profile };
}

export async function createWelcomeMessageForNewUser(db, env, user, options = {}) {
  if (!db || !user) return { ok: false, error: "INVALID_INPUT" };
  await ensureChatSchemaReady(db, env);
  await ensureTableColumns(db, "users", [{ name: "welcome_sent_at", def: "INTEGER" }]);

  const userId = await ensureUser(
    {
      id: user.id || user.userId,
      email: user.email || "",
      username: user.username || "",
      name: user.name || user.display_name || "",
      avatar: user.avatar || user.avatar_url || "",
    },
    db
  );
  if (!userId) return { ok: false, error: "USER_NOT_FOUND" };

  const admin = await ensureAdminUser(db, env);
  if (!admin) return { ok: false, error: "ADMIN_NOT_FOUND" };

  const columns = await getTableColumns(db, "users");
  const whereField = columns.has("id") ? "id" : "rowid";
  if (columns.has("welcome_sent_at")) {
    try {
      const row = await db
        .prepare(`SELECT welcome_sent_at FROM users WHERE ${whereField} = ? LIMIT 1`)
        .bind(userId)
        .first();
      const sentAt = row && row.welcome_sent_at != null ? Number(row.welcome_sent_at) : 0;
      if (sentAt > 0) return { ok: true, skipped: true };
    } catch (error) {}
  }

  const conversationId = await ensureDirectConversation(db, userId, admin.id);
  if (!conversationId) return { ok: false, error: "CONVERSATION_FAILED" };

  const nameValue = String(user.username || user.name || user.display_name || "there").trim() || "there";
  const template = String(options.text || DEFAULT_WELCOME_MESSAGE);
  const text = template.replace("{name}", nameValue).trim();
  const clientMessageId = `welcome:${userId}`;
  const inserted = await createMessage(db, conversationId, admin.id, "text", text, null, clientMessageId);
  if (!inserted || !inserted.ok) return { ok: false, error: inserted && inserted.error ? inserted.error : "DB_WRITE_FAILED" };
  touchConversationVersions([userId, admin.id]);

  if (columns.has("welcome_sent_at")) {
    try {
      await db.prepare(`UPDATE users SET welcome_sent_at = ? WHERE ${whereField} = ?`).bind(nowSeconds(), userId).run();
    } catch (error) {}
  }

  return { ok: true, conversationId, message: inserted.message };
}

export function buildDirectConversationId(userA, userB) {
  const pairKey = buildConversationPairKey(userA, userB);
  return pairKey ? `${DIRECT_PREFIX}${pairKey}` : "";
}

function parseDirectConversationId(value) {
  const raw = String(value || "");
  if (!raw.startsWith(DIRECT_PREFIX)) return null;
  const body = raw.slice(DIRECT_PREFIX.length);
  const parts = body.split(":");
  if (parts.length !== 2) return null;
  const userA = normalizeId(parts[0]);
  const userB = normalizeId(parts[1]);
  if (!userA || !userB) return null;
  return { userA, userB };
}

async function getConversationRow(db, conversationId) {
  if (!db || !conversationId) return null;
  try {
    return await db
      .prepare(
        "SELECT id, type, pair_key, created_at, updated_at, last_message_id, last_message_at, last_message_preview FROM conversations WHERE id = ? LIMIT 1"
      )
      .bind(conversationId)
      .first();
  } catch (error) {
    return null;
  }
}

export async function getConversationParticipants(db, conversationId) {
  if (!db || !conversationId) return [];
  try {
    const result = await db
      .prepare("SELECT user_id, role, last_read_message_id, unread_count FROM conversation_participants WHERE conversation_id = ?")
      .bind(conversationId)
      .all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    return rows
      .filter((row) => row && row.user_id)
      .map((row) => ({
        userId: String(row.user_id),
        role: row.role ? String(row.role) : "user",
        lastReadMessageId: row.last_read_message_id != null ? Number(row.last_read_message_id) : null,
        unreadCount: row.unread_count != null ? Number(row.unread_count) : 0,
      }));
  } catch (error) {
    return [];
  }
}

async function refreshUnreadCount(db, userId) {
  if (!db || !userId) return null;
  try {
    const row = await db
      .prepare("SELECT COALESCE(SUM(unread_count), 0) AS total FROM conversation_participants WHERE user_id = ?")
      .bind(userId)
      .first();
    const total = row && row.total != null ? Number(row.total) : 0;
    if (Number.isFinite(total)) return setUnreadCount(userId, total);
  } catch (error) {}
  return null;
}

async function addParticipants(db, conversationId, participants) {
  if (!db || !conversationId || !participants || !participants.length) return;
  for (const participant of participants) {
    if (!participant || !participant.userId) continue;
    const role = participant.role || "user";
    try {
      await db
        .prepare("INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)")
        .bind(conversationId, participant.userId, role)
        .run();
    } catch (error) {}
  }
}

async function ensureConversationPairKey(db, conversationId, pairKey) {
  if (!db || !conversationId || !pairKey) return;
  try {
    await db
      .prepare("UPDATE conversations SET pair_key = ? WHERE id = ? AND (pair_key IS NULL OR pair_key = '')")
      .bind(pairKey, conversationId)
      .run();
  } catch (error) {}
}

async function ensureConversationType(db, conversationId, type) {
  if (!db || !conversationId || !type) return;
  try {
    await db.prepare("UPDATE conversations SET type = ? WHERE id = ? AND type != ?").bind(type, conversationId, type).run();
  } catch (error) {}
}

async function findConversationByPairKey(db, pairKey) {
  if (!db || !pairKey) return null;
  try {
    return await db
      .prepare(
        "SELECT id, type, pair_key, updated_at FROM conversations WHERE pair_key = ? ORDER BY (type = ?) DESC, updated_at DESC LIMIT 1"
      )
      .bind(pairKey, SUPPORT_TYPE)
      .first();
  } catch (error) {
    return null;
  }
}

async function findConversationByParticipants(db, userA, userB) {
  if (!db) return null;
  const left = normalizeId(userA);
  const right = normalizeId(userB);
  if (!left || !right) return null;
  try {
    return await db
      .prepare(
        "SELECT c.id, c.type, c.pair_key, c.updated_at FROM conversations c JOIN conversation_participants a ON a.conversation_id = c.id AND a.user_id = ? JOIN conversation_participants b ON b.conversation_id = c.id AND b.user_id = ? ORDER BY (c.type = ?) DESC, c.updated_at DESC LIMIT 1"
      )
      .bind(left, right, SUPPORT_TYPE)
      .first();
  } catch (error) {
    return null;
  }
}

async function createConversation(db, conversationId, type, pairKey) {
  const now = nowSeconds();
  try {
    if (pairKey) {
      await db
        .prepare("INSERT INTO conversations (id, type, pair_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(conversationId, type || SUPPORT_TYPE, pairKey, now, now)
        .run();
    } else {
      await db
        .prepare("INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .bind(conversationId, type || SUPPORT_TYPE, now, now)
        .run();
    }
    return true;
  } catch (error) {
    return false;
  }
}

export async function getOrCreateSupportConversation(db, userId, adminId) {
  if (!db || !userId || !adminId) return null;
  const pairKey = buildConversationPairKey(userId, adminId);
  let existing = pairKey ? await findConversationByPairKey(db, pairKey) : null;
  if (!existing) existing = await findConversationByParticipants(db, userId, adminId);
  if (existing && existing.id) {
    const existingId = String(existing.id);
    if (pairKey) await ensureConversationPairKey(db, existingId, pairKey);
    await ensureConversationType(db, existingId, SUPPORT_TYPE);
    await addParticipants(db, existingId, [
      { userId, role: "user" },
      { userId: adminId, role: "admin" },
    ]);
    return existingId;
  }
  const conversationId = generateId();
  const created = await createConversation(db, conversationId, SUPPORT_TYPE, pairKey);
  if (!created) {
    const fallback = pairKey ? await findConversationByPairKey(db, pairKey) : null;
    const fallbackRow = fallback || (await findConversationByParticipants(db, userId, adminId));
    if (!fallbackRow || !fallbackRow.id) return null;
    const existingId = String(fallbackRow.id);
    if (pairKey) await ensureConversationPairKey(db, existingId, pairKey);
    await ensureConversationType(db, existingId, SUPPORT_TYPE);
    await addParticipants(db, existingId, [
      { userId, role: "user" },
      { userId: adminId, role: "admin" },
    ]);
    return existingId;
  }
  await addParticipants(db, conversationId, [
    { userId, role: "user" },
    { userId: adminId, role: "admin" },
  ]);
  return conversationId;
}

async function ensureDirectConversation(db, userId, adminId) {
  return getOrCreateSupportConversation(db, userId, adminId);
}

export async function getOrCreateDmConversation(db, userA, userB) {
  if (!db || !userA || !userB) return null;
  const pairKey = buildConversationPairKey(userA, userB);
  if (!pairKey) return null;
  let existing = await findConversationByPairKey(db, pairKey);
  if (!existing) existing = await findConversationByParticipants(db, userA, userB);
  if (existing && existing.id) {
    const existingId = String(existing.id);
    await ensureConversationPairKey(db, existingId, pairKey);
    await addParticipants(db, existingId, [
      { userId: userA, role: "user" },
      { userId: userB, role: "user" },
    ]);
    return existingId;
  }
  const conversationId = buildDirectConversationId(userA, userB);
  if (!conversationId) return null;
  const created = await createConversation(db, conversationId, DM_TYPE, pairKey);
  if (!created) {
    const fallback = await findConversationByPairKey(db, pairKey);
    const fallbackRow = fallback || (await findConversationByParticipants(db, userA, userB));
    if (!fallbackRow || !fallbackRow.id) return null;
    const existingId = String(fallbackRow.id);
    await ensureConversationPairKey(db, existingId, pairKey);
    await addParticipants(db, existingId, [
      { userId: userA, role: "user" },
      { userId: userB, role: "user" },
    ]);
    return existingId;
  }
  await addParticipants(db, conversationId, [
    { userId: userA, role: "user" },
    { userId: userB, role: "user" },
  ]);
  return conversationId;
}

async function ensureDmParticipants(db, conversationId, participants) {
  if (participants && participants.length) return participants;
  const parsed = parseDirectConversationId(conversationId);
  if (!parsed) return participants;
  const userA = await ensureUser({ id: parsed.userA }, db);
  const userB = await ensureUser({ id: parsed.userB }, db);
  if (!userA || !userB) return participants;
  await addParticipants(db, conversationId, [
    { userId: userA, role: "user" },
    { userId: userB, role: "user" },
  ]);
  return await getConversationParticipants(db, conversationId);
}

function buildPairKeyFromParticipants(participants) {
  if (!Array.isArray(participants)) return "";
  const ids = [];
  for (const participant of participants) {
    const id = normalizeId(participant && participant.userId);
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= 2) break;
  }
  if (ids.length < 2) return "";
  return buildConversationPairKey(ids[0], ids[1]);
}

async function buildMessagePayload(row, participants, requestUrl, secret) {
  if (!row) return null;
  const senderId = row.sender_id ? String(row.sender_id) : "";
  let recipientId = "";
  if (participants && participants.length) {
    const other = participants.find((p) => String(p.userId) !== senderId);
    if (other) recipientId = other.userId;
  }
  const kind = row.type ? String(row.type) : "text";
  let mediaUrl = "";
  if (row.media_key && secret) {
    const exp = nowSeconds() + MEDIA_TOKEN_TTL_SEC;
    const token = await createSignedMediaToken(secret, String(row.media_key), exp);
    mediaUrl = token ? buildMediaUrl(requestUrl, token) : "";
  }
  const body = kind === "text" ? row.text || "" : mediaUrl || row.text || "";
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId,
    recipientId,
    clientMessageId: row.client_message_id || "",
    client_message_id: row.client_message_id || "",
    body,
    bodyType: kind,
    type: kind,
    mediaId: "",
    mediaUrl,
    createdAt: toIso(row.created_at),
  };
}

async function collectMessages(db, conversationId, options) {
  if (!db || !conversationId) return { rows: [], hasMore: false };
  const where = ["conversation_id = ?"];
  const binds = [conversationId];
  const beforeValue = Number.parseInt(String(options.before || ""), 10);
  const sinceValue = Number.parseInt(String(options.since || ""), 10);
  const hasBefore = Number.isFinite(beforeValue) && beforeValue > 0;
  const hasSince = !hasBefore && Number.isFinite(sinceValue) && sinceValue > 0;
  if (hasBefore) {
    where.push("id < ?");
    binds.push(beforeValue);
  } else if (hasSince) {
    where.push("id > ?");
    binds.push(sinceValue);
  }
  const limit = parseLimit(options.limit, 30, 20, 50);
  const effectiveLimit = limit + 1;
  const orderBy = hasSince ? "id ASC" : "id DESC";
  const sql = `SELECT id, conversation_id, sender_id, type, text, media_key, client_message_id, created_at FROM messages WHERE ${
    where.join(" AND ")
  } ORDER BY ${orderBy} LIMIT ${effectiveLimit}`;
  try {
    const result = await db.prepare(sql).bind(...binds).all();
    let rows = result && Array.isArray(result.results) ? result.results : [];
    let hasMore = false;
    if (rows.length > limit) {
      hasMore = true;
      rows = rows.slice(0, limit);
    }
    if (!hasSince) {
      rows = rows.slice().reverse();
    }
    return { rows, hasMore };
  } catch (error) {
    return { rows: [], hasMore: false };
  }
}

async function findMessageByClientId(db, conversationId, clientMessageId) {
  if (!db || !conversationId || !clientMessageId) return null;
  try {
    return await db
      .prepare(
        "SELECT id, conversation_id, sender_id, type, text, media_key, client_message_id, created_at FROM messages WHERE conversation_id = ? AND client_message_id = ? LIMIT 1"
      )
      .bind(conversationId, clientMessageId)
      .first();
  } catch (error) {
    return null;
  }
}

function buildMessagePreview(kind, text) {
  if (kind === "image") return "Ảnh";
  if (kind && kind !== "text") return "Tệp";
  return text || "";
}

async function createMessage(db, conversationId, senderId, kind, text, mediaKey, clientMessageId) {
  if (!db || !conversationId || !senderId) return { error: "INVALID_INPUT", status: 400 };
  if (clientMessageId) {
    const existing = await findMessageByClientId(db, conversationId, clientMessageId);
    if (existing) return { ok: true, message: existing, duplicate: true };
  }
  const createdAt = nowSeconds();
  let messageId = null;
  try {
    const result = await db
      .prepare(
        "INSERT INTO messages (conversation_id, sender_id, type, text, media_key, client_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(conversationId, senderId, kind, text || null, mediaKey || null, clientMessageId || null, createdAt)
      .run();
    messageId = result && result.meta ? result.meta.last_row_id : null;
  } catch (error) {
    const message = String((error && error.message) || "").toLowerCase();
    if (message.includes("unique") && clientMessageId) {
      const existing = await findMessageByClientId(db, conversationId, clientMessageId);
      if (existing) return { ok: true, message: existing, duplicate: true };
      return { error: "CONFLICT", status: 409 };
    }
    return { error: "DB_WRITE_FAILED", status: 500 };
  }

  if (messageId == null) return { error: "DB_WRITE_FAILED", status: 500 };

  const preview = buildMessagePreview(kind, text);
  try {
    const updates = [
      db
        .prepare(
          "UPDATE conversations SET last_message_id = ?, last_message_at = ?, last_message_preview = ?, updated_at = ? WHERE id = ?"
        )
        .bind(messageId, createdAt, preview, createdAt, conversationId),
      db
        .prepare("UPDATE conversation_participants SET unread_count = unread_count + 1 WHERE conversation_id = ? AND user_id != ?")
        .bind(conversationId, senderId),
      db
        .prepare(
          "UPDATE conversation_participants SET last_read_message_id = ?, unread_count = 0 WHERE conversation_id = ? AND user_id = ?"
        )
        .bind(messageId, conversationId, senderId),
    ];
    if (typeof db.batch === "function") {
      await db.batch(updates);
    } else {
      for (const update of updates) {
        await update.run();
      }
    }
  } catch (error) {}

  const row = {
    id: messageId,
    conversation_id: conversationId,
    sender_id: senderId,
    type: kind,
    text: text || null,
    media_key: mediaKey || null,
    client_message_id: clientMessageId || null,
    created_at: createdAt,
  };
  return { ok: true, message: row };
}

async function uploadMedia(db, env, requestUrl, file, meta) {
  const bucket = env && env.R2_MESSAGES;
  if (!bucket) return { error: "R2_NOT_CONFIGURED", status: 500, detail: "R2_MESSAGES" };
  const secret = getMediaSigningSecret(env);
  if (!secret) return { error: "MEDIA_SIGNING_NOT_CONFIGURED", status: 500 };

  if (!file || (typeof file.stream !== "function" && typeof file.arrayBuffer !== "function")) {
    return { error: "INVALID_FILE", status: 400 };
  }
  let size = Number(file.size || 0);
  let body = null;
  if (typeof file.stream === "function") {
    body = file.stream();
  } else if (typeof file.arrayBuffer === "function") {
    const buffer = new Uint8Array(await file.arrayBuffer());
    body = buffer;
    size = Number(size || buffer.byteLength || 0);
  }
  if (!body) return { error: "INVALID_FILE", status: 400 };
  if (!size) return { error: "INVALID_FILE", status: 400 };
  if (size > MAX_IMAGE_SIZE) return { error: "PAYLOAD_TOO_LARGE", status: 400 };
  const contentType = file.type || "";
  const ext = getExtension(contentType, file.name || "");
  const resolvedType = contentType || IMAGE_TYPE_BY_EXT[ext] || "application/octet-stream";
  const safeConversation = sanitizeKeySegment(meta && meta.conversationId ? meta.conversationId : "unknown");
  const mediaId = generateId();
  const r2Key = `messages/${safeConversation}/${mediaId}.${ext}`;

  try {
    await bucket.put(r2Key, body, {
      httpMetadata: { contentType: resolvedType },
    });
  } catch (error) {
    return { error: "UPLOAD_FAILED", status: 502 };
  }

  const createdAt = nowSeconds();
  const exp = createdAt + MEDIA_TOKEN_TTL_SEC;
  const token = await createSignedMediaToken(secret, r2Key, exp);
  const mediaUrl = token ? buildMediaUrl(requestUrl, token) : "";
  return {
    ok: true,
    mediaId,
    mediaUrl,
    mediaKey: r2Key,
    r2Key,
    mime: resolvedType,
    size,
    width: meta && meta.width ? meta.width : null,
    height: meta && meta.height ? meta.height : null,
  };
}

async function parseBase64Payload(body) {
  const data = body && (body.data || body.file || body.base64 || body.body || "");
  if (!data) return null;
  const raw = String(data);
  let mime = body && body.mime ? String(body.mime) : "";
  let base64 = raw;
  if (raw.startsWith("data:")) {
    const match = raw.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    mime = match[1];
    base64 = match[2];
  }
  if (!mime) mime = "application/octet-stream";
  let buffer;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    buffer = bytes;
  } catch (error) {
    return null;
  }
  const name = body && body.filename ? String(body.filename) : "upload.bin";
  return { buffer, size: buffer.byteLength, type: mime, name };
}

async function uploadMediaFromBuffer(db, env, requestUrl, file, meta) {
  if (!file || !file.buffer) return { error: "INVALID_FILE", status: 400 };
  const bucket = env && env.R2_MESSAGES;
  if (!bucket) return { error: "R2_NOT_CONFIGURED", status: 500, detail: "R2_MESSAGES" };
  const secret = getMediaSigningSecret(env);
  if (!secret) return { error: "MEDIA_SIGNING_NOT_CONFIGURED", status: 500 };

  const buffer = file.buffer;
  const size = Number(file.size || buffer.byteLength || 0);
  if (!size) return { error: "INVALID_FILE", status: 400 };
  if (size > MAX_IMAGE_SIZE) return { error: "PAYLOAD_TOO_LARGE", status: 400 };
  const contentType = file.type || "";
  const ext = getExtension(contentType, file.name || "");
  const resolvedType = contentType || IMAGE_TYPE_BY_EXT[ext] || "application/octet-stream";
  const safeConversation = sanitizeKeySegment(meta && meta.conversationId ? meta.conversationId : "unknown");
  const mediaId = generateId();
  const r2Key = `messages/${safeConversation}/${mediaId}.${ext}`;

  try {
    await bucket.put(r2Key, buffer, { httpMetadata: { contentType: resolvedType } });
  } catch (error) {
    return { error: "UPLOAD_FAILED", status: 502 };
  }

  const createdAt = nowSeconds();
  const exp = createdAt + MEDIA_TOKEN_TTL_SEC;
  const token = await createSignedMediaToken(secret, r2Key, exp);
  const mediaUrl = token ? buildMediaUrl(requestUrl, token) : "";
  return {
    ok: true,
    mediaId,
    mediaUrl,
    mediaKey: r2Key,
    r2Key,
    mime: resolvedType,
    size,
    width: meta && meta.width ? meta.width : null,
    height: meta && meta.height ? meta.height : null,
  };
}

async function resolveConversationForUpload(db, env, request, data) {
  const wantsAdmin =
    String(data.asAdmin || data.as_admin || "").toLowerCase() === "true" ||
    String(data.asAdmin || data.as_admin || "").toLowerCase() === "1" ||
    String(data.senderRole || data.sender_role || "").toLowerCase() === "admin";

  const adminAccess = await resolveAdminAccess(db, env, request, wantsAdmin ? data.senderId || data.sender_id || "" : "");
  const sessionUser = adminAccess.sessionUser;
  const isAdmin = adminAccess.isAdmin;

  if (wantsAdmin && !isAdmin) return { error: "FORBIDDEN", status: 403 };

  const rawConversationId = normalizeId(data.conversationId || data.conversation_id || "");
  if (rawConversationId) return { conversationId: rawConversationId };

  const rawUserId = normalizeId(data.userId || data.user_id || "");
  const rawSenderId = normalizeId(data.senderId || data.sender_id || "");
  const rawRecipientId = normalizeId(data.recipientId || data.recipient_id || "");

  let admin = null;
  if (isAdmin) {
    admin = adminAccess.admin || (await ensureAdminUser(db, env));
    if (!admin) return { error: "ADMIN_NOT_CONFIGURED", status: 500 };
  }

  if (rawRecipientId) {
    if (isAdmin) {
      const userId = await ensureUser({ id: rawRecipientId }, db);
      if (!userId) return { error: "USER_NOT_FOUND", status: 404 };
      const conversationId = await getOrCreateSupportConversation(db, userId, admin.id);
      return conversationId ? { conversationId } : { error: "CONVERSATION_FAILED", status: 500 };
    }
    const senderId = await ensureUser({ id: rawSenderId || rawUserId || (sessionUser && sessionUser.id) }, db);
    const recipientId = await ensureUser({ id: rawRecipientId }, db);
    if (!senderId || !recipientId) return { error: "USER_NOT_FOUND", status: 404 };
    const conversationId = await getOrCreateDmConversation(db, senderId, recipientId);
    return conversationId ? { conversationId } : { error: "CONVERSATION_FAILED", status: 500 };
  }

  if (rawUserId && sessionUser && sessionUser.id && normalizeId(sessionUser.id) !== rawUserId) {
    const senderId = await ensureUser({ id: sessionUser.id }, db);
    const recipientId = await ensureUser({ id: rawUserId }, db);
    if (senderId && recipientId) {
      const conversationId = await getOrCreateDmConversation(db, senderId, recipientId);
      if (conversationId) return { conversationId };
    }
  }

  if (rawUserId) {
    const userId = await ensureUser({ id: rawUserId }, db);
    if (!userId) return { error: "USER_NOT_FOUND", status: 404 };
    if (!admin) {
      admin = await ensureAdminUser(db, env);
      if (!admin) return { error: "ADMIN_NOT_CONFIGURED", status: 500 };
    }
    const conversationId = await getOrCreateSupportConversation(db, userId, admin.id);
    return conversationId ? { conversationId } : { error: "CONVERSATION_FAILED", status: 500 };
  }

  return { error: "INVALID_INPUT", status: 400 };
}

export async function handleUploadOnly(context, form) {
  try {
    const db = context?.env?.DB;
    if (!db) return errorResponse("DB_NOT_CONFIGURED", 500);
    await ensureChatSchemaReady(db, context.env);

    const payload = form || (await context.request.formData());
    const file = payload.get("file");
    const width = Number(payload.get("width") || payload.get("w") || 0) || null;
    const height = Number(payload.get("height") || payload.get("h") || 0) || null;
    const conversationId = payload.get("conversationId") || payload.get("conversation_id") || "";

    const resolution = await resolveConversationForUpload(db, context.env, context.request, {
      conversationId,
      userId: payload.get("userId") || payload.get("user_id") || "",
      senderId: payload.get("senderId") || payload.get("sender_id") || "",
      recipientId: payload.get("recipientId") || payload.get("recipient_id") || "",
      asAdmin: payload.get("asAdmin") || payload.get("as_admin") || "",
      senderRole: payload.get("senderRole") || payload.get("sender_role") || "",
    });
    if (resolution.error) return errorResponse(resolution.error, resolution.status || 400);

    const upload = await uploadMedia(db, context.env, context.request.url, file, {
      width,
      height,
      conversationId: resolution.conversationId,
    });
    if (!upload.ok) return errorResponse(upload.error, upload.status || 500, upload.detail || "");

    const response = jsonResponse(
      {
        ok: true,
        media: {
          id: upload.mediaId,
          url: upload.mediaUrl,
          size: upload.size,
          width: upload.width,
          height: upload.height,
        },
        mediaId: upload.mediaId,
        mediaUrl: upload.mediaUrl,
        mediaKey: upload.mediaKey || upload.r2Key || "",
        url: upload.mediaUrl,
      },
      200
    );
    return withNoStore(response);
  } catch (error) {
    const schemaResponse = chatSchemaErrorResponse(error);
    if (schemaResponse) return schemaResponse;
    return errorResponse("INTERNAL", 500, (error && error.message) || "");
  }
}

async function handleUploadOnlyJson(context, body) {
  try {
    const db = context?.env?.DB;
    if (!db) return errorResponse("DB_NOT_CONFIGURED", 500);
    await ensureChatSchemaReady(db, context.env);

    const file = await parseBase64Payload(body || {});
    if (!file) return errorResponse("INVALID_FILE", 400);
    const width = Number(body.width || body.w || 0) || null;
    const height = Number(body.height || body.h || 0) || null;

    const resolution = await resolveConversationForUpload(db, context.env, context.request, {
      conversationId: body.conversationId || body.conversation_id || "",
      userId: body.userId || body.user_id || "",
      senderId: body.senderId || body.sender_id || "",
      recipientId: body.recipientId || body.recipient_id || "",
      asAdmin: body.asAdmin || body.as_admin || "",
      senderRole: body.senderRole || body.sender_role || "",
    });
    if (resolution.error) return errorResponse(resolution.error, resolution.status || 400);

    const upload = await uploadMediaFromBuffer(db, context.env, context.request.url, file, {
      width,
      height,
      conversationId: resolution.conversationId,
    });
    if (!upload.ok) return errorResponse(upload.error, upload.status || 500, upload.detail || "");

    const response = jsonResponse(
      {
        ok: true,
        media: {
          id: upload.mediaId,
          url: upload.mediaUrl,
          size: upload.size,
          width: upload.width,
          height: upload.height,
        },
        mediaId: upload.mediaId,
        mediaUrl: upload.mediaUrl,
        mediaKey: upload.mediaKey || upload.r2Key || "",
        url: upload.mediaUrl,
      },
      200
    );
    return withNoStore(response);
  } catch (error) {
    const schemaResponse = chatSchemaErrorResponse(error);
    if (schemaResponse) return schemaResponse;
    return errorResponse("INTERNAL", 500, (error && error.message) || "");
  }
}

async function handleMultipartMessage(context, form) {
  const db = context?.env?.DB;
  if (!db) return errorResponse("DB_NOT_CONFIGURED", 500);
  await ensureChatSchemaReady(db, context.env);

  const file = form.get("file");
  const width = Number(form.get("width") || form.get("w") || 0) || null;
  const height = Number(form.get("height") || form.get("h") || 0) || null;
  const clientMessageId = String(form.get("clientMessageId") || form.get("client_message_id") || "").trim();
  const rawConversationId = normalizeId(form.get("conversationId") || form.get("conversation_id") || "");
  const rawUserId = normalizeId(form.get("userId") || form.get("user_id") || "");
  const rawSenderId = normalizeId(form.get("senderId") || form.get("sender_id") || "");
  const rawRecipientId = normalizeId(form.get("recipientId") || form.get("recipient_id") || "");
  const wantsAdmin =
    String(form.get("asAdmin") || form.get("as_admin") || "").toLowerCase() === "true" ||
    String(form.get("asAdmin") || form.get("as_admin") || "").toLowerCase() === "1" ||
    String(form.get("senderRole") || form.get("sender_role") || "").toLowerCase() === "admin";

  const adminAccess = await resolveAdminAccess(db, context.env, context.request, wantsAdmin ? rawSenderId : "");
  const sessionUser = adminAccess.sessionUser;
  const isAdmin = adminAccess.isAdmin;
  if (wantsAdmin && !isAdmin) return errorResponse("FORBIDDEN", 403);

  let conversationId = rawConversationId;
  let conversationType = "";
  let participants = [];
  let admin = null;

  if (conversationId) {
    let conversation = await getConversationRow(db, conversationId);
    if (!conversation) {
      const parsed = parseDirectConversationId(conversationId);
      if (!parsed) return errorResponse("NOT_FOUND", 404);
      const userA = await ensureUser({ id: parsed.userA }, db);
      const userB = await ensureUser({ id: parsed.userB }, db);
      if (!userA || !userB) return errorResponse("USER_NOT_FOUND", 404);
      const pairKey = buildConversationPairKey(userA, userB);
      const created = await createConversation(db, conversationId, DM_TYPE, pairKey);
      if (!created) {
        const fallback = pairKey ? await findConversationByPairKey(db, pairKey) : null;
        const fallbackRow = fallback || (await findConversationByParticipants(db, userA, userB));
        if (!fallbackRow || !fallbackRow.id) return errorResponse("CONVERSATION_FAILED", 500);
        conversationId = String(fallbackRow.id);
        conversation = { type: fallbackRow.type || DM_TYPE, pair_key: fallbackRow.pair_key || pairKey };
      } else {
        await addParticipants(db, conversationId, [
          { userId: userA, role: "user" },
          { userId: userB, role: "user" },
        ]);
        conversation = { type: DM_TYPE, pair_key: pairKey };
      }
    }
    conversationType = conversation.type || SUPPORT_TYPE;
    participants = await getConversationParticipants(db, conversationId);
    participants = await ensureDmParticipants(db, conversationId, participants);
    const resolvedPairKey = (conversation && conversation.pair_key) || buildPairKeyFromParticipants(participants);
    if (resolvedPairKey) await ensureConversationPairKey(db, conversationId, resolvedPairKey);
  } else if (rawRecipientId) {
    if (isAdmin) {
      admin = adminAccess.admin || (await ensureAdminUser(db, context.env));
      if (!admin) return errorResponse("ADMIN_NOT_CONFIGURED", 500);
      const userId = await ensureUser({ id: rawRecipientId }, db);
      if (!userId) return errorResponse("USER_NOT_FOUND", 404);
      conversationId = await getOrCreateSupportConversation(db, userId, admin.id);
      conversationType = SUPPORT_TYPE;
    } else {
      const senderId = await ensureUser({ id: rawSenderId || rawUserId || (sessionUser && sessionUser.id) }, db);
      const recipientId = await ensureUser({ id: rawRecipientId }, db);
      if (!senderId || !recipientId) return errorResponse("USER_NOT_FOUND", 404);
      conversationId = await getOrCreateDmConversation(db, senderId, recipientId);
      conversationType = DM_TYPE;
    }
    participants = await getConversationParticipants(db, conversationId);
  } else if (rawUserId) {
    const userId = await ensureUser({ id: rawUserId }, db);
    if (!userId) return errorResponse("USER_NOT_FOUND", 404);
    admin = await ensureAdminUser(db, context.env);
    if (!admin) return errorResponse("ADMIN_NOT_CONFIGURED", 500);
    conversationId = await getOrCreateSupportConversation(db, userId, admin.id);
    conversationType = SUPPORT_TYPE;
    participants = await getConversationParticipants(db, conversationId);
  } else {
    return errorResponse("INVALID_INPUT", 400);
  }

  let adminId = "";
  if (conversationType === SUPPORT_TYPE) {
    if (!admin) admin = await ensureAdminUser(db, context.env);
    adminId = admin ? admin.id : "";
    if (adminId) {
      const hasAdmin = participants.some((p) => String(p.userId) === String(adminId));
      if (!hasAdmin) {
        await addParticipants(db, conversationId, [{ userId: adminId, role: "admin" }]);
        participants = await getConversationParticipants(db, conversationId);
      }
    }
  }

  const requesterId = normalizeId(rawUserId || rawSenderId || (sessionUser && sessionUser.id));
  if (!isAdmin && requesterId) {
    const allowed = participants.some((p) => String(p.userId) === String(requesterId));
    if (!allowed) return errorResponse("FORBIDDEN", 403);
  }

  let senderId = "";
  if (conversationType === SUPPORT_TYPE) {
    const userParticipant = participants.find((p) => String(p.userId) !== String(adminId));
    const userId = userParticipant ? userParticipant.userId : rawUserId || rawRecipientId || "";
    senderId = isAdmin ? adminId : userId;
  } else {
    senderId = requesterId || (participants[0] && participants[0].userId) || "";
  }

  if (!senderId) return errorResponse("INVALID_INPUT", 400);

  const upload = await uploadMedia(db, context.env, context.request.url, file, {
    width,
    height,
    conversationId,
  });
  if (!upload.ok) return errorResponse(upload.error, upload.status || 500, upload.detail || "");

  const insert = await createMessage(db, conversationId, senderId, "image", "", upload.mediaKey, clientMessageId);
  if (!insert.ok) return errorResponse(insert.error, insert.status || 500, insert.detail || "");
  touchConversationVersions(participants.map((participant) => participant.userId));
  const refreshTask = Promise.all(participants.map((participant) => refreshUnreadCount(db, participant.userId))).catch(
    () => {}
  );
  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(refreshTask);
  }

  const secret = getMediaSigningSecret(context.env);
  const payload = await buildMessagePayload(insert.message, participants, context.request.url, secret);
  const response = jsonResponse(
    {
      ok: true,
      message: payload,
      mediaId: upload.mediaId,
      mediaUrl: (payload && payload.mediaUrl) || upload.mediaUrl,
      mediaKey: upload.mediaKey || upload.r2Key || "",
    },
    200
  );
  return withNoStore(response);
}

export async function onRequestGet(context) {
  const timing = createRequestTiming(context?.env, "/api/messages", { slowQueryMs: SLOW_QUERY_MS });
  const db = context?.env?.DB;
  if (!db) return await timing.finalize(errorResponse("DB_NOT_CONFIGURED", 500), db);
  const dbTimed = timing.wrapDb(db);

  try {
    await ensureChatSchemaReady(dbTimed, context.env);

    const url = new URL(context.request.url);
    let conversationId = normalizeId(url.searchParams.get("conversationId") || url.searchParams.get("conversation_id") || "");
    if (!conversationId) return await timing.finalize(errorResponse("INVALID_INPUT", 400, "conversationId"), db);

    const queryUserId = normalizeId(url.searchParams.get("userId") || url.searchParams.get("user_id") || "");
    const queryAdminId = normalizeId(url.searchParams.get("adminId") || url.searchParams.get("admin_id") || "");
    const adminAccess = await resolveAdminAccess(dbTimed, context.env, context.request, queryAdminId);
    const sessionUser = adminAccess.sessionUser;
    const isAdmin = adminAccess.isAdmin;

    let conversation = await getConversationRow(dbTimed, conversationId);
    if (!conversation) {
      const parsed = parseDirectConversationId(conversationId);
      if (!parsed) return await timing.finalize(errorResponse("NOT_FOUND", 404), db);
      const userA = await ensureUser({ id: parsed.userA }, dbTimed);
      const userB = await ensureUser({ id: parsed.userB }, dbTimed);
      if (!userA || !userB) return await timing.finalize(errorResponse("USER_NOT_FOUND", 404), db);
      const pairKey = buildConversationPairKey(userA, userB);
      const created = await createConversation(dbTimed, conversationId, DM_TYPE, pairKey);
      if (!created) {
        const fallback = pairKey ? await findConversationByPairKey(dbTimed, pairKey) : null;
        const fallbackRow = fallback || (await findConversationByParticipants(dbTimed, userA, userB));
        if (!fallbackRow || !fallbackRow.id) return await timing.finalize(errorResponse("CONVERSATION_FAILED", 500), db);
        conversationId = String(fallbackRow.id);
        conversation = { id: conversationId, type: fallbackRow.type || DM_TYPE, pair_key: fallbackRow.pair_key || pairKey };
      } else {
        await addParticipants(dbTimed, conversationId, [
          { userId: userA, role: "user" },
          { userId: userB, role: "user" },
        ]);
        conversation = { id: conversationId, type: DM_TYPE, pair_key: pairKey };
      }
    }

    let participants = await getConversationParticipants(dbTimed, conversationId);
    participants = await ensureDmParticipants(dbTimed, conversationId, participants);
    const resolvedPairKey = (conversation && conversation.pair_key) || buildPairKeyFromParticipants(participants);
    if (resolvedPairKey) await ensureConversationPairKey(dbTimed, conversationId, resolvedPairKey);
    let adminRef = null;
    if (conversation.type === SUPPORT_TYPE) {
      adminRef = adminAccess.admin || (await ensureAdminUser(dbTimed, context.env));
      const adminId = adminRef && adminRef.id ? adminRef.id : "";
      if (adminId) {
        const hasAdmin = participants.some((p) => String(p.userId) === String(adminId));
        if (!hasAdmin) {
          await addParticipants(dbTimed, conversationId, [{ userId: adminId, role: "admin" }]);
          participants = await getConversationParticipants(dbTimed, conversationId);
        }
      }
    }
    if (!isAdmin) {
      const requesterId = normalizeId(queryUserId || (sessionUser && sessionUser.id));
      if (requesterId) {
        const allowed = participants.some((p) => String(p.userId) === String(requesterId));
        if (!allowed) return await timing.finalize(errorResponse("FORBIDDEN", 403), db);
      }
    }

    const messageResult = await collectMessages(dbTimed, conversationId, {
      before: url.searchParams.get("before"),
      since: url.searchParams.get("since"),
      limit: url.searchParams.get("limit"),
    });
    const rows = messageResult.rows;
    const secret = getMediaSigningSecret(context.env);
    const messages = await Promise.all(rows.map((row) => buildMessagePayload(row, participants, context.request.url, secret)));

    const isHistoryPage = Boolean(url.searchParams.get("before"));
    const viewerId = normalizeId(isAdmin ? queryAdminId || (sessionUser && sessionUser.id) : queryUserId || (sessionUser && sessionUser.id));
    if (!isHistoryPage && viewerId) {
      const latestId = conversation && conversation.last_message_id != null ? Number(conversation.last_message_id) : null;
      const fallbackId = rows.length ? Number(rows[rows.length - 1].id) : null;
      const lastReadId = Number.isFinite(latestId) && latestId > 0 ? latestId : fallbackId;
      if (Number.isFinite(lastReadId) && lastReadId > 0) {
        try {
          await dbTimed
            .prepare(
              "UPDATE conversation_participants SET last_read_message_id = ?, unread_count = 0 WHERE conversation_id = ? AND user_id = ?"
            )
            .bind(lastReadId, conversationId, viewerId)
            .run();
          await refreshUnreadCount(dbTimed, viewerId);
          touchConversationVersions([viewerId]);
        } catch (error) {}
      }
    }

    let adminProfile = null;
    let userProfile = null;
    let adminId = "";
    let userId = "";
    if (conversation.type === SUPPORT_TYPE) {
      const admin = adminRef || (await ensureAdminUser(dbTimed, context.env));
      adminId = admin ? admin.id : "";
      if (admin && admin.profile) adminProfile = admin.profile;
      const userParticipant = participants.find((p) => String(p.userId) !== String(adminId));
      userId = userParticipant ? userParticipant.userId : queryUserId || (sessionUser && sessionUser.id) || "";
      if (userId) {
        const row = await findUserRow(dbTimed, userId);
        userProfile = buildUserProfile(row, userId);
      }
    } else {
      const requesterId = normalizeId(queryUserId || (sessionUser && sessionUser.id));
      userId = requesterId || (participants[0] && participants[0].userId) || "";
      const other = participants.find((p) => String(p.userId) !== String(userId));
      if (other) {
        const row = await findUserRow(dbTimed, other.userId);
        userProfile = buildUserProfile(row, other.userId);
      }
    }

    const response = jsonResponse(
      {
        ok: true,
        conversationId,
        adminId: adminId || "",
        admin: adminProfile,
        userId: userId || "",
        user: userProfile,
        messages,
        hasMore: messageResult.hasMore === true,
        has_more: messageResult.hasMore === true,
        serverTime: new Date().toISOString(),
      },
      200
    );
    withNoStore(response);
    return await timing.finalize(response, db);
  } catch (error) {
    const schemaResponse = chatSchemaErrorResponse(error);
    if (schemaResponse) return await timing.finalize(schemaResponse, db);
    return await timing.finalize(errorResponse("INTERNAL", 500, (error && error.message) || ""), db);
  }
}

export async function onRequestPost(context) {
  const timing = createRequestTiming(context?.env, "/api/messages", { slowQueryMs: SLOW_QUERY_MS });
  const db = context?.env?.DB;
  if (!db) return await timing.finalize(errorResponse("DB_NOT_CONFIGURED", 500), db);
  const dbTimed = timing.wrapDb(db);
  const timedContext = { ...context, env: { ...context.env, DB: dbTimed } };

  try {
    await ensureChatSchemaReady(dbTimed, context.env);

    const contentType = context?.request?.headers?.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      let form;
      try {
        form = await context.request.formData();
      } catch (error) {
        return await timing.finalize(errorResponse("INVALID_FORM", 400), db);
      }
      const response = await handleMultipartMessage(timedContext, form);
      return await timing.finalize(response, db);
    }

    const body = await readJsonBody(context.request);
    if (!body) return await timing.finalize(errorResponse("INVALID_INPUT", 400), db);

    const rawConversationId = normalizeId(body.conversationId || body.conversation_id || "");
    const rawUserId = normalizeId(body.userId || body.user_id || "");
    const rawSenderId = normalizeId(body.senderId || body.sender_id || "");
    const rawRecipientId = normalizeId(body.recipientId || body.recipient_id || "");
    const clientMessageId = String(body.clientMessageId || body.client_message_id || "").trim();

    const senderRole = String(body.senderRole || body.sender_role || "").toLowerCase();
    const asAdminValue = String(body.asAdmin || body.as_admin || "").toLowerCase();
    const wantsAdmin = senderRole === "admin" || asAdminValue === "true" || asAdminValue === "1" || (!rawUserId && !!rawSenderId);
    const adminAccess = await resolveAdminAccess(dbTimed, context.env, context.request, wantsAdmin ? rawSenderId : "");
    const sessionUser = adminAccess.sessionUser;
    const isAdmin = adminAccess.isAdmin;
    if (wantsAdmin && !isAdmin) return await timing.finalize(errorResponse("FORBIDDEN", 403), db);

    const kind = String(body.kind || body.bodyType || body.body_type || body.type || "text").toLowerCase();
    const messageKind = kind === "image" || kind === "file" ? kind : "text";
    const text = String(body.text || body.body || body.message || "").trim();
    const mediaUrl = String(body.mediaUrl || body.media_url || "").trim();
    let mediaKey = String(body.mediaKey || body.media_key || "").trim();

    if (messageKind === "text" && !text) return await timing.finalize(errorResponse("INVALID_INPUT", 400), db);
    if (messageKind !== "text") {
      if (!mediaKey && mediaUrl) {
        mediaKey = await extractMediaKeyFromUrl(mediaUrl, context.env);
      }
      if (!mediaKey && !mediaUrl) return await timing.finalize(errorResponse("INVALID_INPUT", 400), db);
      if (!mediaKey) return await timing.finalize(errorResponse("INVALID_MEDIA", 400), db);
    }

    let conversationId = rawConversationId;
    let conversationType = "";
    let participants = [];
    let admin = null;

    if (conversationId) {
      let conversation = await getConversationRow(dbTimed, conversationId);
      if (!conversation) {
        const parsed = parseDirectConversationId(conversationId);
        if (!parsed) return await timing.finalize(errorResponse("NOT_FOUND", 404), db);
        const userA = await ensureUser({ id: parsed.userA }, dbTimed);
        const userB = await ensureUser({ id: parsed.userB }, dbTimed);
        if (!userA || !userB) return await timing.finalize(errorResponse("USER_NOT_FOUND", 404), db);
        const pairKey = buildConversationPairKey(userA, userB);
        const created = await createConversation(dbTimed, conversationId, DM_TYPE, pairKey);
        if (!created) {
          const fallback = pairKey ? await findConversationByPairKey(dbTimed, pairKey) : null;
          const fallbackRow = fallback || (await findConversationByParticipants(dbTimed, userA, userB));
          if (!fallbackRow || !fallbackRow.id) return await timing.finalize(errorResponse("CONVERSATION_FAILED", 500), db);
          conversationId = String(fallbackRow.id);
          conversation = { type: fallbackRow.type || DM_TYPE, pair_key: fallbackRow.pair_key || pairKey };
        } else {
          await addParticipants(dbTimed, conversationId, [
            { userId: userA, role: "user" },
            { userId: userB, role: "user" },
          ]);
          conversation = { type: DM_TYPE, pair_key: pairKey };
        }
      }
      conversationType = conversation.type || SUPPORT_TYPE;
      participants = await getConversationParticipants(dbTimed, conversationId);
      participants = await ensureDmParticipants(dbTimed, conversationId, participants);
      const resolvedPairKey = (conversation && conversation.pair_key) || buildPairKeyFromParticipants(participants);
      if (resolvedPairKey) await ensureConversationPairKey(dbTimed, conversationId, resolvedPairKey);
    } else if (rawRecipientId) {
      if (isAdmin) {
        admin = adminAccess.admin || (await ensureAdminUser(dbTimed, context.env));
        if (!admin) return await timing.finalize(errorResponse("ADMIN_NOT_CONFIGURED", 500), db);
        const userId = await ensureUser({ id: rawRecipientId }, dbTimed);
        if (!userId) return await timing.finalize(errorResponse("USER_NOT_FOUND", 404), db);
        conversationId = await getOrCreateSupportConversation(dbTimed, userId, admin.id);
        conversationType = SUPPORT_TYPE;
      } else {
        const senderId = await ensureUser({ id: rawSenderId || rawUserId || (sessionUser && sessionUser.id) }, dbTimed);
        const recipientId = await ensureUser({ id: rawRecipientId }, dbTimed);
        if (!senderId || !recipientId) return await timing.finalize(errorResponse("USER_NOT_FOUND", 404), db);
        conversationId = await getOrCreateDmConversation(dbTimed, senderId, recipientId);
        conversationType = DM_TYPE;
      }
      participants = await getConversationParticipants(dbTimed, conversationId);
    } else if (rawUserId) {
      const userId = await ensureUser({ id: rawUserId }, dbTimed);
      if (!userId) return await timing.finalize(errorResponse("USER_NOT_FOUND", 404), db);
      admin = await ensureAdminUser(dbTimed, context.env);
      if (!admin) return await timing.finalize(errorResponse("ADMIN_NOT_CONFIGURED", 500), db);
      conversationId = await getOrCreateSupportConversation(dbTimed, userId, admin.id);
      conversationType = SUPPORT_TYPE;
      participants = await getConversationParticipants(dbTimed, conversationId);
    } else {
      return await timing.finalize(errorResponse("INVALID_INPUT", 400), db);
    }

    if (!conversationId) return await timing.finalize(errorResponse("CONVERSATION_FAILED", 500), db);

    let adminId = "";
    if (conversationType === SUPPORT_TYPE) {
      if (!admin) admin = await ensureAdminUser(dbTimed, context.env);
      adminId = admin ? admin.id : "";
      if (adminId) {
        const hasAdmin = participants.some((p) => String(p.userId) === String(adminId));
        if (!hasAdmin) {
          await addParticipants(dbTimed, conversationId, [{ userId: adminId, role: "admin" }]);
          participants = await getConversationParticipants(dbTimed, conversationId);
        }
      }
    }

    const requesterId = normalizeId(rawUserId || rawSenderId || (sessionUser && sessionUser.id));
    if (!isAdmin && requesterId) {
      const allowed = participants.some((p) => String(p.userId) === String(requesterId));
      if (!allowed) return await timing.finalize(errorResponse("FORBIDDEN", 403), db);
    }

    let senderId = "";
    let recipientId = "";
    if (conversationType === SUPPORT_TYPE) {
      const userParticipant = participants.find((p) => String(p.userId) !== String(adminId));
      const userId = userParticipant ? userParticipant.userId : rawUserId || rawRecipientId || "";
      if (isAdmin) {
        senderId = adminId;
        recipientId = userId;
      } else {
        senderId = userId;
        recipientId = adminId;
      }
    } else {
      senderId = requesterId || (participants[0] && participants[0].userId) || "";
      if (rawRecipientId) {
        recipientId = rawRecipientId;
      } else {
        const other = participants.find((p) => String(p.userId) !== String(senderId));
        recipientId = other ? other.userId : "";
      }
    }

    if (!senderId) return await timing.finalize(errorResponse("INVALID_INPUT", 400), db);

    const senderAliases = [];
    if (sessionUser && sessionUser.username) senderAliases.push(sessionUser.username);
    if (sessionUser && sessionUser.email) senderAliases.push(sessionUser.email);
    if (rawUserId && rawUserId !== senderId) senderAliases.push(rawUserId);
    if (rawSenderId && rawSenderId !== senderId) senderAliases.push(rawSenderId);
    recordOnlinePing(senderId, { aliases: senderAliases });
    if (recipientId) {
      const recipientAliases = [];
      if (rawRecipientId && rawRecipientId !== recipientId) recipientAliases.push(rawRecipientId);
      recordOnlinePing(recipientId, { aliases: recipientAliases });
    }

    let messageText = "";
    if (messageKind === "text") {
      messageText = text;
    } else if (shouldKeepMediaCaption(text, mediaUrl)) {
      messageText = text;
    }
    const insert = await createMessage(
      dbTimed,
      conversationId,
      senderId,
      messageKind,
      messageText,
      mediaKey || null,
      clientMessageId || null
    );
    if (!insert.ok) return await timing.finalize(errorResponse(insert.error, insert.status || 500, insert.detail || ""), db);

    touchConversationVersions(participants.map((participant) => participant.userId));
    const refreshTask = Promise.all(participants.map((participant) => refreshUnreadCount(dbTimed, participant.userId))).catch(
      () => {}
    );
    if (context && typeof context.waitUntil === "function") {
      context.waitUntil(refreshTask);
    }

    const inserted = insert.message || {};
    const messageId = inserted.id != null ? String(inserted.id) : "";
    const createdAt = inserted.created_at != null ? toIso(inserted.created_at) : new Date().toISOString();
    const response = jsonResponse(
      {
        ok: true,
        messageId,
        message_id: messageId,
        clientMessageId: clientMessageId || inserted.client_message_id || "",
        client_message_id: clientMessageId || inserted.client_message_id || "",
        createdAt,
        created_at: createdAt,
        serverTime: new Date().toISOString(),
      },
      200
    );
    withNoStore(response);
    return await timing.finalize(response, db);
  } catch (error) {
    const schemaResponse = chatSchemaErrorResponse(error);
    if (schemaResponse) return await timing.finalize(schemaResponse, db);
    return await timing.finalize(errorResponse("INTERNAL", 500, (error && error.message) || ""), db);
  }
}

export async function onRequestPostUpload(context) {
  const contentType = context?.request?.headers?.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    let form;
    try {
      form = await context.request.formData();
    } catch (error) {
      return errorResponse("INVALID_FORM", 400);
    }
    return await handleUploadOnly(context, form);
  }
  if (contentType.includes("application/json")) {
    const body = await readJsonBody(context.request);
    if (!body) return errorResponse("INVALID_INPUT", 400);
    return await handleUploadOnlyJson(context, body);
  }
  return errorResponse("INVALID_FORM", 400);
}
