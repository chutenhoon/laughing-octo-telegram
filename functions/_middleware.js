import {
  MAINTENANCE_CACHE_KEY,
  getRouteKeyForPath,
  hasRouteLocks,
  isMaintenanceActive,
  readMaintenanceConfig,
} from "./_lib/maintenance.js";

const MAINTENANCE_PATH = "/maintenance";
const CACHE_TTL_SECONDS = 1;

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

const buildRedirectUrl = (requestUrl, sectionKey) => {
  const url = new URL(MAINTENANCE_PATH, requestUrl.origin);
  if (sectionKey) {
    url.searchParams.set("section", sectionKey);
  }
  return url;
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
  const request = context.request;
  const url = new URL(request.url);
  const pathname = url.pathname || "/";

  if (request.method === "OPTIONS") {
    return context.next();
  }

  if (isAllowlistedPath(pathname)) {
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
  if (!config.globalEnabled && (!routeKey || !config.routeLocks?.[routeKey])) {
    return context.next();
  }

  const redirectUrl = buildRedirectUrl(url, routeKey);
  const response = Response.redirect(redirectUrl.toString(), 302);
  response.headers.set("cache-control", "no-store");
  return response;
}
