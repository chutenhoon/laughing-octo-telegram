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
const SAFE_FROM_MAP = {
  task_posting: "/nhiemvu/tao/",
  tasks_market: "/nhiemvu/",
  seller_panel: "/seller/panel/",
  profile: "/profile/",
  checkout: "/checkout/",
  products: "/sanpham/",
  services: "/dichvu/",
  home: "/",
};
const SAFE_FROM_ORDER = [
  "task_posting",
  "tasks_market",
  "seller_panel",
  "profile",
  "checkout",
  "products",
  "services",
  "home",
];

let memoryCache = { value: null, expiresAt: 0 };

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

function normalizeConfig(raw, nowMs) {
  const data = raw && typeof raw === "object" ? raw : {};
  let globalEnabled = normalizeBool(data.globalEnabled);
  const rawRouteLocks = data.routeLocks || data.routes;
  let routeLocks = normalizeRouteLocks(rawRouteLocks);
  const legacyScopes = Array.isArray(data.scopes)
    ? data.scopes.map((scope) => String(scope || "").trim()).filter((scope) => scope && ALLOWED_SCOPES.has(scope))
    : [];
  const legacyEnabled = normalizeBool(data.enabled);
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
  const startAt = parseTimestamp(data.startAt);
  const endAt = parseTimestamp(data.endAt);
  const expired = Boolean(endAt && nowMs >= endAt);
  return {
    globalEnabled,
    routeLocks,
    startAt,
    endAt,
    expired,
    message: typeof data.message === "string" ? data.message : "",
  };
}

async function readConfigFromDb(env, nowMs) {
  const db = env && env.DB;
  if (!db) return normalizeConfig({}, nowMs);
  const row = await db.prepare("SELECT value_json FROM system_settings WHERE id = ? LIMIT 1").bind("maintenance").first();
  if (!row || !row.value_json) return normalizeConfig({}, nowMs);
  try {
    return normalizeConfig(JSON.parse(row.value_json), nowMs);
  } catch (error) {
    return normalizeConfig({}, nowMs);
  }
}

async function getMaintenanceConfig(env, context) {
  const now = Date.now();
  if (memoryCache.value && now < memoryCache.expiresAt) return memoryCache.value;
  if (typeof caches !== "undefined") {
    const cacheKey = new Request(CACHE_URL);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = await cached.json().catch(() => null);
      if (data && typeof data === "object") {
        memoryCache = { value: data, expiresAt: now + CACHE_TTL };
        return data;
      }
    }
  }
  const config = await readConfigFromDb(env, now);
  memoryCache = { value: config, expiresAt: now + CACHE_TTL };
  if (context && typeof caches !== "undefined") {
    const cacheKey = new Request(CACHE_URL);
    const response = new Response(JSON.stringify(config), {
      headers: { "content-type": "application/json", "cache-control": "max-age=1" },
    });
    context.waitUntil(caches.default.put(cacheKey, response));
  }
  return config;
}

function safeDecodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch (error) {
    return pathname;
  }
}

function getPathScopes(pathname) {
  const rawPath = safeDecodePath(pathname || "");
  const path = rawPath.replace(/\\/g, "/").toLowerCase();
  const scopes = new Set();
  if (!path || path === "/" || path.endsWith("/index.html")) scopes.add("home");
  if (path.includes("/sanpham/")) scopes.add("products");
  if (path.includes("/dichvu/")) scopes.add("services");
  if (path.includes("/profile/")) scopes.add("profile");
  if (path.includes("/checkout/")) scopes.add("checkout");
  if (path.includes("/seller/panel/")) scopes.add("seller_panel");
  if (path.includes("/seller/tasks/")) {
    scopes.add("seller_panel");
    scopes.add("task_posting");
  }
  if (path.includes("/nhiemvu/tao/") || path.endsWith("/nhiemvu/tao")) scopes.add("task_posting");
  if (path.includes("/nhiemvu/") && !path.includes("/nhiemvu/tao")) scopes.add("tasks_market");
  return scopes;
}

function isAllowlisted(pathname) {
  const path = (pathname || "").toLowerCase();
  if (path === "/maintenance" || path.startsWith("/maintenance/")) return true;
  if (path === "/polyfluxdev2026" || path.startsWith("/polyfluxdev2026/")) return true;
  if (path === "/api/maintenance") return true;
  if (path === "/api/admin" || path.startsWith("/api/admin/")) return true;
  if (path.startsWith("/asset/") || path.startsWith("/assets/")) return true;
  if (path === "/favicon.ico") return true;
  if (path === "/site.webmanifest") return true;
  if (path === "/apple-touch-icon.png") return true;
  if (path === "/android-chrome-192x192.png") return true;
  if (path === "/android-chrome-512x512.png") return true;
  if (path === "/favicon-16x16.png") return true;
  if (path === "/favicon-32x32.png") return true;
  if (path === "/sw.js") return true;
  return false;
}

function resolveSafeFrom(scopes) {
  if (!scopes || !scopes.size) return "/";
  for (const scope of SAFE_FROM_ORDER) {
    if (scopes.has(scope)) return SAFE_FROM_MAP[scope];
  }
  return "/";
}

function isMaintenanceActive(config, pathname, nowMs) {
  if (!config) return false;
  if (config.endAt && nowMs >= config.endAt) return false;
  if (config.globalEnabled) return true;
  const routeLocks = config.routeLocks && typeof config.routeLocks === "object" ? config.routeLocks : {};
  if (routeLocks.all) return true;
  const scopes = getPathScopes(pathname);
  for (const scope of scopes) {
    if (routeLocks[scope]) return true;
  }
  return false;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isAllowlisted(pathname)) return context.next();

  const config = await getMaintenanceConfig(env, context);
  const now = Date.now();
  if (!isMaintenanceActive(config, pathname, now)) return context.next();

  const scopes = getPathScopes(pathname);
  const safeFrom = resolveSafeFrom(scopes);
  const redirectUrl = new URL("/maintenance", url.origin);
  if (safeFrom) redirectUrl.searchParams.set("from", safeFrom);
  return Response.redirect(redirectUrl.toString(), 302);
}
