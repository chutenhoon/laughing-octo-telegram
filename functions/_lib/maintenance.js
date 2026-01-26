const SETTING_ID = "maintenance";
const DEFAULT_MESSAGE = "Bảo trì hệ thống, xin lỗi vì sự bất tiện này.";
const DEFAULT_DURATION_HOURS = 1;
const MIN_DURATION_HOURS = 1 / 60;

export const MAINTENANCE_CACHE_KEY = "https://internal.polyflux/maintenance-config";

export const MAINTENANCE_ROUTE_KEYS = [
  "home",
  "products",
  "services",
  "tasks_market",
  "task_posting",
  "seller_panel",
  "seller_public",
  "payments",
  "profile",
  "profile.overview",
  "profile.orders",
  "profile.favorites",
  "profile.following",
  "profile.history",
  "profile.withdraw",
  "profile.tasks",
  "profile.notifications",
  "profile.badges",
  "profile.security",
  "profile.chat",
];

const ROUTE_KEY_SET = new Set(MAINTENANCE_ROUTE_KEYS);

const normalizeBoolean = (value) => value === true || value === 1 || value === "1" || String(value || "") === "true";

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toMs = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

export const normalizeRouteLocks = (value) => {
  const locks = {};
  const raw = value && typeof value === "object" ? value : null;
  const asArray = Array.isArray(value) ? value : null;
  MAINTENANCE_ROUTE_KEYS.forEach((key) => {
    if (asArray) {
      locks[key] = asArray.includes(key);
      return;
    }
    locks[key] = raw ? normalizeBoolean(raw[key]) : false;
  });
  return locks;
};

const extractLegacyScopes = (value) => {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => item)
    .map((item) => (item === "checkout" ? "payments" : item))
    .filter((item) => item === "all" || ROUTE_KEY_SET.has(item));
};

export const normalizeMaintenanceConfig = (input, nowMs = Date.now()) => {
  const raw = input && typeof input === "object" ? input : {};
  const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : DEFAULT_MESSAGE;
  let globalEnabled = null;
  if (Object.prototype.hasOwnProperty.call(raw, "globalEnabled")) {
    globalEnabled = normalizeBoolean(raw.globalEnabled);
  } else if (Object.prototype.hasOwnProperty.call(raw, "enabled")) {
    globalEnabled = normalizeBoolean(raw.enabled);
  }

  const scopes = extractLegacyScopes(raw.scopes);
  let routeLocks = normalizeRouteLocks(raw.routeLocks);
  if (scopes.length) {
    if (scopes.includes("all")) {
      if (globalEnabled === null) globalEnabled = true;
    } else {
      routeLocks = normalizeRouteLocks(scopes);
    }
  }

  const version = Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0;
  const startAt = toIso(raw.startAt);
  const endAt = toIso(raw.endAt);

  return {
    globalEnabled: globalEnabled === true,
    message,
    startAt,
    endAt,
    routeLocks,
    version,
    updatedAtMs: nowMs,
  };
};

export const hasRouteLocks = (routeLocks) =>
  Boolean(routeLocks && Object.values(routeLocks).some((value) => value === true));

const parseDurationHours = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < MIN_DURATION_HOURS) return MIN_DURATION_HOURS;
  return parsed;
};

const buildConfigPayload = (config) => ({
  globalEnabled: Boolean(config.globalEnabled),
  message: config.message || DEFAULT_MESSAGE,
  startAt: config.startAt || null,
  endAt: config.endAt || null,
  routeLocks: normalizeRouteLocks(config.routeLocks),
  version: Number.isFinite(Number(config.version)) ? Number(config.version) : 0,
});

export async function readMaintenanceConfig(db, { nowMs = Date.now(), autoExpire = true } = {}) {
  if (!db) return buildConfigPayload(normalizeMaintenanceConfig({}, nowMs));
  const row = await db.prepare("SELECT value_json FROM system_settings WHERE id = ? LIMIT 1").bind(SETTING_ID).first();
  if (!row || !row.value_json) return buildConfigPayload(normalizeMaintenanceConfig({}, nowMs));
  let parsed = null;
  try {
    parsed = JSON.parse(row.value_json);
  } catch (error) {
    parsed = null;
  }
  let config = buildConfigPayload(normalizeMaintenanceConfig(parsed || {}, nowMs));
  const hasLocks = config.globalEnabled || hasRouteLocks(config.routeLocks);
  const endAtMs = toMs(config.endAt);
  const startAtMs = toMs(config.startAt);
  let shouldWrite = false;
  if (hasLocks) {
    if (!endAtMs) {
      const nextStart = nowMs;
      const nextEnd = nowMs + DEFAULT_DURATION_HOURS * 60 * 60 * 1000;
      config.startAt = toIso(nextStart);
      config.endAt = toIso(nextEnd);
      config.version = nowMs;
      shouldWrite = true;
    } else if (autoExpire && endAtMs <= nowMs) {
      config = buildConfigPayload({
        ...config,
        globalEnabled: false,
        routeLocks: normalizeRouteLocks({}),
        startAt: null,
        endAt: null,
        version: nowMs,
      });
      shouldWrite = true;
    } else if (!startAtMs) {
      config.startAt = toIso(nowMs);
      config.version = nowMs;
      shouldWrite = true;
    }
  } else if (config.startAt || config.endAt) {
    config.startAt = null;
    config.endAt = null;
    config.version = nowMs;
    shouldWrite = true;
  }

  if (shouldWrite) {
    await writeMaintenanceConfig(db, config);
  }
  return config;
}

export async function writeMaintenanceConfig(db, config) {
  if (!db) return;
  const payload = JSON.stringify(buildConfigPayload(config || {}));
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO system_settings (id, value_json, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at"
    )
    .bind(SETTING_ID, payload, now, now)
    .run();
}

export const applyMaintenanceUpdate = (current, input, nowMs = Date.now()) => {
  const base = buildConfigPayload(normalizeMaintenanceConfig(current || {}, nowMs));
  const raw = input && typeof input === "object" ? input : {};
  const next = buildConfigPayload(base);

  if (Object.prototype.hasOwnProperty.call(raw, "message")) {
    const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : DEFAULT_MESSAGE;
    next.message = message;
  }

  if (Object.prototype.hasOwnProperty.call(raw, "globalEnabled") || Object.prototype.hasOwnProperty.call(raw, "enabled")) {
    next.globalEnabled = normalizeBoolean(raw.globalEnabled != null ? raw.globalEnabled : raw.enabled);
  }

  if (Object.prototype.hasOwnProperty.call(raw, "routeLocks") || Object.prototype.hasOwnProperty.call(raw, "scopes")) {
    if (raw.routeLocks) {
      next.routeLocks = normalizeRouteLocks(raw.routeLocks);
    } else {
      const scopes = extractLegacyScopes(raw.scopes);
      if (scopes.includes("all")) {
        next.globalEnabled = true;
        next.routeLocks = normalizeRouteLocks({});
      } else {
        next.routeLocks = normalizeRouteLocks(scopes);
      }
    }
  }

  const hasLocks = next.globalEnabled || hasRouteLocks(next.routeLocks);
  const wasActive = base.globalEnabled || hasRouteLocks(base.routeLocks);
  const currentEnd = toMs(base.endAt);
  const currentStart = toMs(base.startAt);
  const durationHours = parseDurationHours(raw.durationHours ?? raw.duration ?? raw.hours);

  if (!hasLocks) {
    next.startAt = null;
    next.endAt = null;
  } else if (durationHours != null) {
    const startMs = nowMs;
    const endMs = nowMs + durationHours * 60 * 60 * 1000;
    next.startAt = toIso(startMs);
    next.endAt = toIso(endMs);
  } else if (!wasActive || !currentEnd || currentEnd <= nowMs) {
    const startMs = nowMs;
    const endMs = nowMs + DEFAULT_DURATION_HOURS * 60 * 60 * 1000;
    next.startAt = toIso(startMs);
    next.endAt = toIso(endMs);
  } else {
    next.startAt = toIso(currentStart || nowMs);
    next.endAt = toIso(currentEnd);
  }

  next.version = nowMs;
  return next;
};

export const isMaintenanceActive = (config, nowMs = Date.now()) => {
  if (!config) return false;
  const hasLocks = config.globalEnabled || hasRouteLocks(config.routeLocks);
  if (!hasLocks) return false;
  const endAtMs = toMs(config.endAt);
  if (!endAtMs) return true;
  return endAtMs > nowMs;
};

export const getRouteKeyForPath = (pathname) => {
  let rawPath = pathname || "";
  try {
    rawPath = decodeURIComponent(rawPath);
  } catch (error) {
    rawPath = pathname || "";
  }
  const path = rawPath.replace(/\\/g, "/").toLowerCase();
  if (!path || path === "/" || path === "/index.html") return "home";
  if (path.startsWith("/sanpham")) return "products";
  if (path.startsWith("/dichvu")) return "services";
  if (path.startsWith("/nhiemvu/tao")) return "task_posting";
  if (path.startsWith("/nhiemvu")) return "tasks_market";
  if (path.startsWith("/seller/panel") || path.startsWith("/seller/tasks") || path.startsWith("/seller/join")) return "seller_panel";
  if (path.startsWith("/seller/")) return "seller_public";
  if (path.startsWith("/checkout") || path.startsWith("/proof")) return "payments";
  if (path.startsWith("/profile/messages")) return "profile.chat";
  if (path.startsWith("/profile/orders")) return "profile.orders";
  if (path.startsWith("/profile/favorites")) return "profile.favorites";
  if (path.startsWith("/profile/following")) return "profile.following";
  if (path.startsWith("/profile/history") || path.startsWith("/profile/logins")) return "profile.history";
  if (path.startsWith("/profile/topups")) return "profile.withdraw";
  if (path.startsWith("/profile/tasks")) return "profile.tasks";
  if (path.startsWith("/profile/notifications")) return "profile.notifications";
  if (path.startsWith("/profile/badges")) return "profile.badges";
  if (path.startsWith("/profile/security")) return "profile.security";
  if (path.startsWith("/profile/public") || path.startsWith("/profile/shops")) return "profile.overview";
  if (path.startsWith("/profile")) return "profile.overview";
  if (path === "/u" || path.startsWith("/u/")) return "profile.overview";
  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot")) return "profile";
  return null;
};

export const getMaintenanceDefaultMessage = () => DEFAULT_MESSAGE;
