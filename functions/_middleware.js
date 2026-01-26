import {
  MAINTENANCE_CACHE_KEY,
  getRouteKeyForPath,
  hasRouteLocks,
  isMaintenanceActive,
  readMaintenanceConfig,
} from "./_lib/maintenance.js";

const MAINTENANCE_PATH = "/maintenance";
const CACHE_TTL_SECONDS = 1;
const MAINTENANCE_COOKIE_KEY = "bk_maint_key";
const ADMIN_BYPASS_COOKIE = "bk_admin";
const MAINTENANCE_COOKIE_MAX_AGE = 180;

const ALLOWLIST_PREFIXES = [
  "/api/admin",
  "/api/maintenance",
  "/api/ping",
  "/api/status",
  "/polyfluxdev2026",
  MAINTENANCE_PATH,
];

const STATIC_PREFIXES = [
  "/asset/",
  "/assets/",
  "/audio/",
  "/picture/",
  "/components/",
  "/data/",
];

const STATIC_FILES = new Set([
  "/favicon.ico",
  "/site.webmanifest",
  "/sw.js",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
]);

const STATIC_EXTENSIONS = /\.(?:css|js|mjs|json|png|jpg|jpeg|webp|gif|svg|ico|mp4|webm|mp3|wav|woff2?|ttf|otf)$/i;

const isAllowlistedPath = (pathname) => {
  if (!pathname) return false;
  if (STATIC_FILES.has(pathname)) return true;
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return ALLOWLIST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const buildRedirectUrl = (requestUrl) => new URL(MAINTENANCE_PATH, requestUrl.origin);

const parseCookies = (header) => {
  const jar = {};
  if (!header) return jar;
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    jar[key] = rest.join("=");
  });
  return jar;
};

const safeEqual = (left, right) => {
  const a = String(left || "");
  const b = String(right || "");
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const getAdminPanelKeys = (env) => {
  const user = env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER ? env.ADMIN_PANEL_USER : env.ADMIN_AUTH_KEY;
  const pass = env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS ? env.ADMIN_PANEL_PASS : env.ADMIN_PANEL_KEY;
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
};

const isAdminRequest = (request, env) => {
  if (!request) return false;
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const cookieBypass = String(cookies[ADMIN_BYPASS_COOKIE] || "").toLowerCase();
  if (cookieBypass === "1" || cookieBypass === "true") return true;
  const keys = getAdminPanelKeys(env);
  if (!keys) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  if (!headerUser || !headerPass) return false;
  return safeEqual(headerUser, keys.authKey) && safeEqual(headerPass, keys.panelKey);
};

const buildMaintenanceCookie = (value, requestUrl) => {
  const parts = [`${MAINTENANCE_COOKIE_KEY}=${encodeURIComponent(value || "")}`, `Max-Age=${MAINTENANCE_COOKIE_MAX_AGE}`, "Path=/", "SameSite=Lax"];
  if (requestUrl && requestUrl.protocol === "https:") parts.push("Secure");
  return parts.join("; ");
};

const getCachedConfig = async (env, ctx) => {
  if (!env || !env.DB || typeof caches === "undefined" || !caches.default) {
    return readMaintenanceConfig(env?.DB);
  }
  const cache = caches.default;
  const cacheKey = new Request(MAINTENANCE_CACHE_KEY);
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return await cached.json();
    } catch (error) {
      // fall through
    }
  }
  const config = await readMaintenanceConfig(env.DB);
  const response = new Response(JSON.stringify(config), {
    headers: {
      "content-type": "application/json",
      "cache-control": `max-age=${CACHE_TTL_SECONDS}`,
    },
  });
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }
  return config;
};

export async function onRequest(context) {
  try {
    const request = context.request;
    const url = new URL(request.url);
    const pathname = url.pathname || "/";

    if (request.method === "OPTIONS") {
      return context.next();
    }

    if (isAllowlistedPath(pathname)) {
      return context.next();
    }

    if (isAdminRequest(request, context?.env)) {
      return context.next();
    }

    let config = null;
    try {
      config = await getCachedConfig(context.env, context);
    } catch (error) {
      return context.next();
    }
    if (!config || (!config.globalEnabled && !hasRouteLocks(config.routeLocks))) {
      return context.next();
    }

    if (!isMaintenanceActive(config, Date.now())) {
      return context.next();
    }

    const routeKey = getRouteKeyForPath(pathname);
    if (!config.globalEnabled) {
      if (!routeKey) return context.next();
      const routeLocks = config.routeLocks || {};
      const parentProfileLocked = routeLocks.profile === true;
      if (routeKey === "profile.chat") {
        if (!routeLocks["profile.chat"]) return context.next();
      } else if (routeKey === "profile") {
        if (!parentProfileLocked) return context.next();
      } else if (routeKey.startsWith("profile.")) {
        if (!parentProfileLocked && !routeLocks[routeKey]) return context.next();
      } else if (!routeLocks[routeKey]) {
        return context.next();
      }
    }

    const redirectUrl = buildRedirectUrl(url);
    const response = new Response(null, {
      status: 302,
      headers: {
        location: redirectUrl.toString(),
        "cache-control": "no-store",
      },
    });
    if (routeKey) {
      response.headers.append("set-cookie", buildMaintenanceCookie(routeKey, url));
    }
    return response;
  } catch (error) {
    return context.next();
  }
}
