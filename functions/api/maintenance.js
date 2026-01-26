import { jsonResponse, readJsonBody } from "./auth/_utils.js";

const SETTING_ID = "maintenance";
const DEFAULT_MESSAGE = "Bao tri he thong, xin loi vi su bat tien nay.";
const DEFAULT_DURATION_HOURS = 1;
const MIN_DURATION_HOURS = 0.1;
const CACHE_URL = "https://maintenance-config.internal/v1";
const CACHE_TTL = 1000;
const ALLOWED_SCOPES = new Set([
  "home",
  "products",
  "services",
  "tasks_market",
  "task_posting",
  "seller_panel",
  "profile",
  "checkout",
  "admin_panel",
  "all",
]);

let memoryCache = { value: null, expiresAt: 0 };

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

function getAdminPanelKeys(env) {
  const user = env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER ? env.ADMIN_PANEL_USER : env.ADMIN_AUTH_KEY;
  const pass = env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS ? env.ADMIN_PANEL_PASS : env.ADMIN_PANEL_KEY;
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
}

function normalizeBool(value) {
  return value === true || value === 1 || String(value || "") === "true";
}

function parseTimestamp(value) {
  if (!value && value !== 0) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value || "").trim();
  if (!str) return null;
  const asNum = Number(str);
  if (Number.isFinite(asNum)) return asNum;
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDurationHours(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeRouteLocks(input) {
  const locks = {};
  if (!input) return locks;
  if (Array.isArray(input)) {
    input.forEach((scope) => {
      const key = String(scope || "").trim();
      if (key && ALLOWED_SCOPES.has(key)) locks[key] = true;
    });
    return locks;
  }
  if (typeof input === "object") {
    Object.entries(input).forEach(([key, value]) => {
      if (!ALLOWED_SCOPES.has(key)) return;
      if (normalizeBool(value)) locks[key] = true;
    });
  }
  return locks;
}

function normalizeConfig(input, nowMs, options = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : DEFAULT_MESSAGE;
  const version = Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0;
  let globalEnabled = normalizeBool(raw.globalEnabled);

  const rawRouteLocks = raw.routeLocks || raw.routes;
  let routeLocks = normalizeRouteLocks(rawRouteLocks);

  const legacyScopes = Array.isArray(raw.scopes)
    ? raw.scopes.map((scope) => String(scope || "").trim()).filter((scope) => scope && ALLOWED_SCOPES.has(scope))
    : [];
  const legacyEnabled = normalizeBool(raw.enabled);
  if (legacyEnabled && !rawRouteLocks) {
    if (!legacyScopes.length || legacyScopes.includes("all")) {
      globalEnabled = true;
    } else {
      routeLocks = normalizeRouteLocks(legacyScopes);
    }
  }

  if (routeLocks.all) {
    globalEnabled = true;
    delete routeLocks.all;
  }

  let startAt = parseTimestamp(raw.startAt);
  let endAt = parseTimestamp(raw.endAt);
  const durationHours = parseDurationHours(raw.durationHours ?? raw.duration ?? raw.hours);
  const safeDuration = durationHours && durationHours >= MIN_DURATION_HOURS ? durationHours : DEFAULT_DURATION_HOURS;
  const hasRouteLocks = Object.keys(routeLocks).length > 0;
  const activeCandidate = globalEnabled || hasRouteLocks;

  let needsPersist = false;
  if (!endAt && activeCandidate && options.setDefaultsForActive) {
    const baseStart = startAt && startAt > 0 ? startAt : nowMs;
    startAt = baseStart;
    endAt = baseStart + safeDuration * 60 * 60 * 1000;
    if (options.trackDefaults) needsPersist = true;
  }

  if (activeCandidate && options.enforceFutureEnd && (!endAt || endAt <= nowMs)) {
    const baseStart = nowMs;
    startAt = baseStart;
    endAt = baseStart + safeDuration * 60 * 60 * 1000;
  }

  if (!activeCandidate) {
    startAt = startAt && Number.isFinite(startAt) ? startAt : null;
    endAt = endAt && Number.isFinite(endAt) ? endAt : null;
  }

  const expired = Boolean(endAt && nowMs >= endAt);
  const active = activeCandidate && !expired;

  return {
    globalEnabled,
    message,
    startAt,
    endAt,
    routeLocks,
    version,
    active,
    expired,
    _needsPersist: needsPersist,
  };
}

function stripComputed(config) {
  const { active, expired, _needsPersist, ...rest } = config || {};
  return rest;
}

async function readRawConfig(db) {
  if (!db) return {};
  const row = await db.prepare("SELECT value_json FROM system_settings WHERE id = ? LIMIT 1").bind(SETTING_ID).first();
  if (!row || !row.value_json) return {};
  try {
    return JSON.parse(row.value_json);
  } catch (error) {
    return {};
  }
}

async function readConfig(db, nowMs, context) {
  const now = nowMs || Date.now();
  if (memoryCache.value && now < memoryCache.expiresAt) return memoryCache.value;
  if (typeof caches !== "undefined") {
    const cache = caches.default;
    const cacheKey = new Request(CACHE_URL);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = await cached.json().catch(() => null);
      if (data && typeof data === "object") {
        memoryCache = { value: data, expiresAt: now + CACHE_TTL };
        return data;
      }
    }
  }
  const raw = await readRawConfig(db);
  const normalized = normalizeConfig(raw, now, { setDefaultsForActive: true, trackDefaults: true });
  memoryCache = { value: normalized, expiresAt: now + CACHE_TTL };
  if (context && typeof caches !== "undefined") {
    const cacheKey = new Request(CACHE_URL);
    const response = new Response(JSON.stringify(normalized), {
      headers: { "content-type": "application/json", "cache-control": "max-age=1" },
    });
    context.waitUntil(caches.default.put(cacheKey, response));
  }
  return normalized;
}

async function writeConfig(db, config, version) {
  if (!db) return;
  const payload = JSON.stringify({ ...stripComputed(config), version });
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO system_settings (id, value_json, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at"
    )
    .bind(SETTING_ID, payload, now, now)
    .run();
}

function isAuthorized(request, env, body) {
  const keys = getAdminPanelKeys(env);
  if (!keys) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  const bodyUser = body && body.adminUser ? body.adminUser : body && body.admin_user ? body.admin_user : "";
  const bodyPass = body && body.adminPass ? body.adminPass : body && body.admin_pass ? body.admin_pass : "";
  const user = headerUser || bodyUser;
  const pass = headerPass || bodyPass;
  return safeEqual(user, keys.authKey) && safeEqual(pass, keys.panelKey);
}

function jsonWithHeaders(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...(headers || {}) },
  });
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const now = Date.now();
    let config = await readConfig(db, now, context);
    if (config && config._needsPersist) {
      const nextVersion = (Number(config.version) || 0) + 1;
      await writeConfig(db, config, nextVersion);
      config = { ...config, version: nextVersion, _needsPersist: false };
      memoryCache = { value: config, expiresAt: now + CACHE_TTL };
      if (typeof caches !== "undefined") {
        const cacheKey = new Request(CACHE_URL);
        const response = new Response(JSON.stringify(config), {
          headers: { "content-type": "application/json", "cache-control": "max-age=1" },
        });
        context.waitUntil(caches.default.put(cacheKey, response));
      }
    }
    const publicConfig = { ...config };
    delete publicConfig._needsPersist;
    return jsonWithHeaders(
      { ok: true, config: publicConfig, serverTime: now },
      200,
      { "cache-control": "private, max-age=0, must-revalidate" }
    );
  } catch (error) {
    console.error("MAINTENANCE_GET_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const body = await readJsonBody(context.request);
    if (!body) return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
    if (!isAuthorized(context.request, context?.env, body)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const rawConfig = body.config && typeof body.config === "object" ? body.config : body;
    const existing = await readRawConfig(db);
    const existingVersion = Number.isFinite(Number(existing.version)) ? Number(existing.version) : 0;
    const now = Date.now();
    const normalized = normalizeConfig(rawConfig, now, { setDefaultsForActive: true, enforceFutureEnd: true });
    const nextVersion = existingVersion + 1;
    await writeConfig(db, normalized, nextVersion);
    const output = { ...normalized, version: nextVersion };
    delete output._needsPersist;
    memoryCache = { value: output, expiresAt: now + CACHE_TTL };
    if (typeof caches !== "undefined") {
      const cacheKey = new Request(CACHE_URL);
      const response = new Response(JSON.stringify(output), {
        headers: { "content-type": "application/json", "cache-control": "max-age=1" },
      });
      context.waitUntil(caches.default.put(cacheKey, response));
    }
    return jsonResponse({ ok: true, config: output, serverTime: now }, 200);
  } catch (error) {
    console.error("MAINTENANCE_POST_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
