function getProjectRoot() {
  const isFile = window.location.protocol === "file:";
  const path = window.location.pathname.replace(/\\/g, "/");
  const lower = path.toLowerCase();
  const markers = [
    "/products/",
    "/dichvu/",
    "/nhiemvu/",
    "/profile/",
    "/register/",
    "/forgot/",
    "/login/",
    "/checkout/",
    "/u/",
    "/seller/",
    "/polyfluxdev2026/",
    "/asset/",
    "/components/",
    "/data/",
    "/picture/",
  ];
  let idx = -1;
  markers.forEach((marker) => {
    const i = lower.indexOf(marker);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  });

  let basePath = path;
  if (idx !== -1) {
    basePath = path.slice(0, idx + 1);
  } else if (/\/index\.html$/i.test(path)) {
    basePath = path.replace(/\/index\.html$/i, "/");
  } else {
    basePath = path.replace(/[^/]*$/, "");
  }

  if (!basePath.endsWith("/")) basePath += "/";

  if (!isFile) {
    return window.location.origin + basePath;
  }

  const href = window.location.href;
  const prefix = href.slice(0, href.indexOf(path));
  return prefix + basePath;
}

function getRootPath() {
  if (window.location.protocol === "file:") return getProjectRoot();
  return "/";
}

const BK_ASSET_PATHS = {
  ADMIN_AVATAR_SRC: "/assets/avt-admin.png",
  LINK_PREVIEW_IMAGE: "/assets/logo-preview.png",
};

const BK_FALLBACK_SITE_URL = "https://polyflux.xyz";

function resolveAssetUrl(path) {
  const root = typeof getRootPath === "function" ? getRootPath() : "/";
  if (window.location.protocol !== "file:" && root === "/") return path;
  const base = root.endsWith("/") ? root : `${root}/`;
  return base + String(path || "").replace(/^\//, "");
}

function getSiteBaseUrl() {
  const candidates = [window.SITE_URL, window.PUBLIC_SITE_URL, window.BASE_URL];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().replace(/\/$/, "");
    }
  }
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return window.location.origin;
  }
  return BK_FALLBACK_SITE_URL;
}

function getAbsoluteUrl(path) {
  const base = getSiteBaseUrl();
  return `${base.replace(/\/$/, "")}/${String(path || "").replace(/^\//, "")}`;
}

function getAdminAvatarUrl() {
  return resolveAssetUrl(BK_ASSET_PATHS.ADMIN_AVATAR_SRC);
}

function getLinkPreviewUrl() {
  return getAbsoluteUrl(BK_ASSET_PATHS.LINK_PREVIEW_IMAGE);
}

function applyLinkPreviewMetaTags() {
  const previewUrl = getLinkPreviewUrl();
  if (!previewUrl) return;
  document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((meta) => {
    meta.setAttribute("content", previewUrl);
  });
}

function ensureBadgeStyles() {
  if (document.querySelector("style[data-bk-badge-style]")) return;
  if (document.querySelector('link[href*="base.css"]')) return;
  const style = document.createElement("style");
  style.setAttribute("data-bk-badge-style", "true");
  style.textContent = `
:root{--verified-badge-size:14px;--verified-badge-gap:4px;}
@media (min-width:768px){:root{--verified-badge-size:16px;--verified-badge-gap:6px;}}
.name-row{display:inline-flex;align-items:center;gap:var(--verified-badge-gap);min-width:0;max-width:100%;}
.name-text{min-width:0;}
.verified-badge{width:var(--verified-badge-size);height:var(--verified-badge-size);flex:0 0 var(--verified-badge-size);display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;}
.verified-badge svg{width:100%;height:100%;display:block;}
.verified-badge .verified-circle{fill:#2d7ff9;}
.verified-badge .verified-check{fill:#fff;}
`;
  document.head.appendChild(style);
}

function getProductDetailPath(productId) {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  const ref = productId ? String(productId).trim() : "";
  if (isFile) {
    const suffix = ref ? `?slug=${encodeURIComponent(ref)}` : "";
    return root + "products/[slug]/index.html" + suffix;
  }
  return ref ? `${root}products/${encodeURIComponent(ref)}` : `${root}products/`;
}

// Remove trailing /index.html from the current URL when served over HTTP(S)
function stripIndexFromLocation() {
  if (window.location.protocol === "file:") return;
  const url = new URL(window.location.href);
  if (/\/index\.html$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/index\.html$/i, "/");
    window.history.replaceState({}, "", url.toString());
  }
}

// Normalize anchor hrefs so navigation paths stay clean (no index.html in links)
function normalizeIndexLinks(isFile) {
  if (isFile) return;
  document.querySelectorAll("a[href]").forEach((a) => {
    const raw = (a.getAttribute("href") || "").trim();
    const lower = raw.toLowerCase();
    if (!raw || lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:") || lower.startsWith("tel:") || lower.startsWith("javascript:")) {
      return;
    }
    if (!/index\.html/i.test(raw)) return;
    const cleaned = raw.replace(/index\.html(?=[?#]|$)/i, "");
    a.setAttribute("href", cleaned === "" ? "./" : cleaned);
  });
}

function normalizeInternalLinks(isFile) {
  if (isFile) return;
  const routes = [
    "products/",
    "dichvu/",
    "nhiemvu/",
    "profile/",
    "login/",
    "register/",
    "forgot/",
    "checkout/",
    "seller/",
    "polyfluxdev2026/",
    "topup/",
    "topups/",
    "u/",
  ];
  document.querySelectorAll("a[href]").forEach((a) => {
    const raw = (a.getAttribute("href") || "").trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    if (
      lower.startsWith("http://") ||
      lower.startsWith("https://") ||
      lower.startsWith("mailto:") ||
      lower.startsWith("tel:") ||
      lower.startsWith("javascript:") ||
      lower.startsWith("#") ||
      raw.startsWith("/")
    ) {
      return;
    }
    const cleaned = raw.replace(/^(?:\.{1,2}\/)+/g, "");
    if (!cleaned) return;
    if (/^index\.html$/i.test(cleaned)) {
      a.setAttribute("href", "/");
      return;
    }
    const match = routes.some((route) => cleaned === route || cleaned.startsWith(route));
    if (match) {
      a.setAttribute("href", "/" + cleaned.replace(/^\/+/, ""));
    }
  });
}

// Hide stray large logo renders outside nav areas
function cleanupLogoArtifacts() {
  const logos = document.querySelectorAll('img[src*="logo.png" i]');
  logos.forEach((img) => {
    const inBrand = img.closest(".brand");
    const inMobile = img.closest(".mobile-brand");
    const inFloat = img.closest(".float-btn");
    const inSeller = img.closest(".seller-brand");

    if (inBrand || inMobile || inFloat || inSeller) {
      const rect = img.getBoundingClientRect();
      if (rect.width > 80 || rect.height > 80) {
        if (inMobile) {
          img.style.width = "28px";
          img.style.height = "28px";
        } else if (inSeller) {
          img.style.width = "28px";
          img.style.height = "28px";
        } else if (inFloat) {
          img.style.width = "26px";
          img.style.height = "26px";
        } else {
          img.style.width = "34px";
          img.style.height = "34px";
        }
        img.style.objectFit = "cover";
      }
      return;
    }

    img.style.display = "none";
    img.setAttribute("aria-hidden", "true");
  });
}

function lockViewportScale() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
  }

  const zoomKeys = new Set(["+", "=", "-", "_", "0"]);
  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    if (zoomKeys.has(event.key) || event.code === "NumpadAdd" || event.code === "NumpadSubtract" || event.code === "Numpad0") {
      event.preventDefault();
    }
  });

  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(
      type,
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );
  });

  document.documentElement.style.touchAction = "pan-x pan-y";
  if (document.body) document.body.style.touchAction = "pan-x pan-y";
}

const BK_AUTH_KEY = "bk_user";
const BK_ADMIN_COOKIE = "bk_admin";
const BK_MAINTENANCE_COOKIE = "bk_maint_key";
const BK_CURRENCY_COOKIE = "bk_currency_selected";
const BK_PING_INTERVAL = 30000;
const BK_PING_GRACE = 15000;
const BK_LANGUAGE_DEFAULT = "vi";
const BK_CURRENCY_LANGUAGE = {
  VND: "vi",
  USD: "en",
  KRW: "ko",
  JPY: "ja",
  CNY: "zh",
};

function setCookieValue(name, value, maxAgeSeconds) {
  if (typeof document === "undefined") return;
  const safeValue = encodeURIComponent(String(value || ""));
  let cookie = `${name}=${safeValue}; Path=/; SameSite=Lax`;
  if (typeof maxAgeSeconds === "number") {
    cookie += `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
  }
  if (typeof window !== "undefined" && window.location && window.location.protocol === "https:") {
    cookie += "; Secure";
  }
  document.cookie = cookie;
}



function syncCurrencyCookie(code) {
  if (!code) return;
  setCookieValue(BK_CURRENCY_COOKIE, code, 60 * 60 * 24 * 30);
}

function syncAdminCookie(auth) {
  const role = auth && auth.user && typeof auth.user.role === "string" ? auth.user.role.toLowerCase() : "";
  if (role === "admin") {
    setCookieValue(BK_ADMIN_COOKIE, "1", 60 * 60 * 6);
    return;
  }
  setCookieValue(BK_ADMIN_COOKIE, "", 0);
}

const BK_MAINTENANCE_PATH = "/maintenance";
const BK_MAINTENANCE_API_PATH = "/api/maintenance";
const BK_MAINTENANCE_CACHE_TTL_MS = 2000;
const BK_MAINTENANCE_MIN_BACKOFF_MS = 2000;
const BK_MAINTENANCE_MAX_BACKOFF_MS = 30000;
const BK_MAINTENANCE_COOKIE_TTL = 180;

const maintenanceCache = {
  config: null,
  etag: "",
  fetchedAt: 0,
  skewMs: 0,
  inFlight: null,
  nextAllowedAt: 0,
  failCount: 0,
};

let maintenanceLastPath = "";

const getMaintenanceApiUrl = () => {
  const root = typeof getRootPath === "function" ? getRootPath() : "/";
  if (!root || root === "/") return BK_MAINTENANCE_API_PATH;
  return `${root.replace(/\/$/, "")}${BK_MAINTENANCE_API_PATH}`;
};

const isMaintenanceBypassPath = (pathname) => {
  if (!pathname) return false;
  if (pathname.startsWith("/polyfluxdev2026")) return true;
  if (pathname.startsWith(BK_MAINTENANCE_PATH)) return true;
  return false;
};



const toMs = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const hasRouteLocks = (locks) => Boolean(locks && Object.values(locks).some((value) => value === true));

const getMaintenanceRouteKeyForPath = (pathname) => {
  let rawPath = pathname || "";
  try {
    rawPath = decodeURIComponent(rawPath);
  } catch (error) {
    rawPath = pathname || "";
  }
  const path = rawPath.replace(/\\/g, "/").toLowerCase();
  if (!path || path === "/" || path === "/index.html") return "home";
  if (path.startsWith("/products")) return "products";
  if (path.startsWith("/dichvu")) return "services";
  if (path.startsWith("/nhiemvu/tao")) return "task_posting";
  if (path.startsWith("/nhiemvu")) return "tasks_market";
  if (path.startsWith("/seller/panel") || path.startsWith("/seller/tasks") || path.startsWith("/seller/join")) return "seller_panel";
  if (path.startsWith("/shop") || path.startsWith("/gian-hang")) return "seller_public";
  if (path.startsWith("/checkout") || path.startsWith("/proof")) return "payments";
  if (path.startsWith("/profile/messages")) return "profile.chat";
  if (path.startsWith("/profile/orders")) return "profile.orders";
  if (path.startsWith("/profile/favorites")) return "profile.favorites";
  if (path.startsWith("/profile/following")) return "profile.following";
  if (path.startsWith("/profile/history") || path.startsWith("/profile/logins")) return "profile.history";
  if (path.startsWith("/profile/topups")) return "profile.withdraw";
  if (path.startsWith("/profile/tasks")) return "profile.tasks";
  if (path.startsWith("/profile/notifications")) return "profile.notifications";
  if (path.startsWith("/profile/shops")) return "profile.shops";
  if (path.startsWith("/profile/badges")) return "profile.badges";
  if (path.startsWith("/profile/security")) return "profile.security";
  if (path.startsWith("/profile/public")) return "profile.overview";
  if (path.startsWith("/profile")) return "profile.overview";
  if (path === "/u" || path.startsWith("/u/")) return "profile.overview";
  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot")) return "profile";
  return null;
};

const isMaintenanceActive = (config, nowMs) => {
  if (!config) return false;
  const hasLocks = config.globalEnabled || hasRouteLocks(config.routeLocks);
  if (!hasLocks) return false;
  const endAtMs = toMs(config.endAt);
  if (!endAtMs) return true;
  return endAtMs > nowMs;
};

const isRouteLocked = (config, routeKey) => {
  if (!config || !routeKey) return false;
  const locks = config.routeLocks || {};
  const parentProfileLocked = locks.profile === true;
  if (routeKey === "profile.chat") return locks["profile.chat"] === true;
  if (routeKey === "profile") return parentProfileLocked;
  if (routeKey.startsWith("profile.")) {
    if (parentProfileLocked) return true;
    return locks[routeKey] === true;
  }
  return locks[routeKey] === true;
};

const fetchMaintenanceConfig = (force) => {
  if (window.location.protocol === "file:") return Promise.resolve(null);
  const now = Date.now();
  if (maintenanceCache.inFlight) return maintenanceCache.inFlight;
  if (!force && maintenanceCache.config && now - maintenanceCache.fetchedAt < BK_MAINTENANCE_CACHE_TTL_MS) {
    return Promise.resolve(maintenanceCache.config);
  }
  if (!force && maintenanceCache.nextAllowedAt && now < maintenanceCache.nextAllowedAt) {
    return Promise.resolve(maintenanceCache.config);
  }
  const headers = {};
  if (maintenanceCache.etag) headers["if-none-match"] = maintenanceCache.etag;
  const url = getMaintenanceApiUrl();
  maintenanceCache.inFlight = fetch(url, { headers, cache: "no-cache" })
    .then(async (response) => {
      maintenanceCache.inFlight = null;
      const headerNow = Number(response.headers.get("x-server-now")) || 0;
      if (headerNow) maintenanceCache.skewMs = headerNow - Date.now();
      if (response.status === 304) {
        maintenanceCache.fetchedAt = Date.now();
        maintenanceCache.failCount = 0;
        return maintenanceCache.config;
      }
      const data = await response.json().catch(() => null);
      if (response.ok && data && data.config) {
        maintenanceCache.config = data.config;
        maintenanceCache.etag = response.headers.get("etag") || maintenanceCache.etag;
        maintenanceCache.fetchedAt = Date.now();
        if (data.serverNow) {
          maintenanceCache.skewMs = Number(data.serverNow) - Date.now();
        }
        maintenanceCache.failCount = 0;
        maintenanceCache.nextAllowedAt = 0;
        return maintenanceCache.config;
      }
      throw new Error("maintenance_fetch_failed");
    })
    .catch(() => {
      maintenanceCache.inFlight = null;
      maintenanceCache.failCount = Math.min(5, maintenanceCache.failCount + 1);
      const backoff = Math.min(
        BK_MAINTENANCE_MAX_BACKOFF_MS,
        BK_MAINTENANCE_MIN_BACKOFF_MS * Math.pow(2, Math.max(0, maintenanceCache.failCount - 1))
      );
      maintenanceCache.nextAllowedAt = Date.now() + backoff;
      return maintenanceCache.config;
    });
  return maintenanceCache.inFlight;
};

const redirectToMaintenance = (routeKey) => {
  if (routeKey && routeKey !== "global") {
    setCookieValue(BK_MAINTENANCE_COOKIE, routeKey, BK_MAINTENANCE_COOKIE_TTL);
  }
  if (window.location.pathname !== BK_MAINTENANCE_PATH) {
    window.location.replace(BK_MAINTENANCE_PATH);
  }
};

const checkMaintenanceForPath = async (pathname, force) => {
  if (!pathname || isMaintenanceBypassPath(pathname)) return;
  const config = await fetchMaintenanceConfig(force);
  if (!config) return;
  const now = Date.now() + maintenanceCache.skewMs;
  if (!isMaintenanceActive(config, now)) return;
  if (config.globalEnabled) {
    redirectToMaintenance("global");
    return;
  }
  const routeKey = getMaintenanceRouteKeyForPath(pathname);
  if (!routeKey) return;
  if (isRouteLocked(config, routeKey)) {
    redirectToMaintenance(routeKey);
  }
};

const scheduleMaintenanceCheck = (force) => {
  if (window.location.protocol === "file:") return;
  const pathname = window.location.pathname || "/";
  if (!force && pathname === maintenanceLastPath) return;
  maintenanceLastPath = pathname;
  checkMaintenanceForPath(pathname, force);
};

if (window.location.protocol !== "file:") {
  scheduleMaintenanceCheck(true);
  window.addEventListener("popstate", () => scheduleMaintenanceCheck(false));
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = function (...args) {
    const result = originalPushState(...args);
    scheduleMaintenanceCheck(false);
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState(...args);
    scheduleMaintenanceCheck(false);
    return result;
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleMaintenanceCheck(true);
    }
  });
}
const BK_I18N = {
  vi: {
    "nav.products": "S\u1ea3n ph\u1ea9m",
    "nav.services": "D\u1ecbch v\u1ee5",
    "nav.tasks": "Nhi\u1ec7m v\u1ee5",
    "nav.topups": "N\u1ea1p ti\u1ec1n",
    "menu.overview": "T\u1ed5ng quan t\u00e0i kho\u1ea3n",
    "menu.profile": "Trang c\u00e1 nh\u00e2n",
    "menu.manageShop": "Qu\u1ea3n l\u00fd shop",
    "menu.manageTasks": "Qu\u1ea3n l\u00fd nhi\u1ec7m v\u1ee5",
    "menu.orders": "\u0110\u01a1n h\u00e0ng",
    "menu.favorites": "Y\u00eau th\u00edch",
    "menu.following": "\u0110ang theo d\u00f5i",
    "menu.history": "L\u1ecbch s\u1eed t\u00e0i kho\u1ea3n",
    "menu.withdraw": "R\u00fat ti\u1ec1n",
    "menu.tasks": "Nhi\u1ec7m v\u1ee5",
    "menu.messages": "Tin nh\u1eafn",
    "menu.notifications": "Th\u00f4ng b\u00e1o",
    "menu.badges": "Danh hi\u1ec7u",
    "menu.security": "B\u1ea3o m\u1eadt 2FA",
    "menu.logout": "\u0110\u0103ng xu\u1ea5t",
    "cta.login": "\u0110\u0103ng nh\u1eadp",
    "cta.register": "\u0110\u0103ng k\u00fd",
    "auth.username.invalid": "Username ch\u1EC9 g\u1ED3m ch\u1EEF th\u01B0\u1EDDng, s\u1ED1 v\u00E0 d\u1EA5u . _ -, d\u00E0i 3-20 k\u00FD t\u1EF1.",
    "media.imageOnly": "Ch\u1EC9 h\u1ED7 tr\u1EE3 \u1EA3nh.",
    "media.imageTooLarge": "\u1EA2nh v\u01B0\u1EE3t qu\u00E1 2MB.",
    "cta.joinSeller": "Tham gia b\u00e1n h\u00e0ng",
    "cta.manageShop": "Qu\u1ea3n l\u00fd shop",
    "cta.manageTasks": "Qu\u1ea3n l\u00fd nhi\u1ec7m v\u1ee5",
    "currency.note": "T\u1ef7 gi\u00e1 t\u1ef1 \u0111\u1ed9ng c\u1eadp nh\u1eadt.",
    "footer.about": "Gi\u1edbi thi\u1ec7u polyflux.xyz",
    "footer.aboutDesc": "S\u00e0n giao d\u1ecbch t\u00e0i s\u1ea3n s\u1ed1 uy t\u00edn #1 tr\u00ean polyflux.xyz. Mua t\u00e0i kho\u1ea3n, email, c\u00f4ng c\u1ee5 v\u00e0 nhi\u1ec1u h\u01a1n v\u1edbi giao h\u00e0ng t\u1ee9c th\u00ec.",
    "footer.nav": "\u0110i\u1ec1u h\u01b0\u1edbng",
    "footer.products": "S\u1ea3n ph\u1ea9m",
    "footer.services": "D\u1ecbch v\u1ee5",
    "footer.tasksMarketplace": "Nhi\u1ec7m v\u1ee5 marketplace",
    "footer.account": "T\u00e0i kho\u1ea3n c\u1ee7a t\u00f4i",
    "footer.payments": "Thanh to\u00e1n & b\u1ea3o m\u1eadt",
    "footer.paymentDesc1": "20+ ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n, x\u1eed l\u00fd t\u1ef1 \u0111\u1ed9ng.",
    "footer.paymentDesc2": "L\u1ecbch s\u1eed \u0111\u01a1n h\u00e0ng minh b\u1ea1ch.",
    "footer.paymentDesc3": "2FA & c\u1ea3nh b\u00e1o \u0111\u0103ng nh\u1eadp kh\u1ea3 nghi.",
    "footer.join": "Tham gia b\u00e1n h\u00e0ng",
    "footer.joinDesc": "Mu\u1ed1n m\u1edf gian h\u00e0ng tr\u00ean polyflux.xyz?",
    "footer.joinBtn": "Tham gia b\u00e1n h\u00e0ng",
    "filter.title": "L\u1ecdc",
    "filter.descSubcategories": "Ch\u1ecdn 1 ho\u1eb7c nhi\u1ec1u danh m\u1ee5c con",
    "filter.descCategories": "Ch\u1ecdn 1 ho\u1eb7c nhi\u1ec1u danh m\u1ee5c",
    "filter.searchLabel": "T\u00ecm ki\u1ebfm",
    "filter.searchPlaceholder.product": "Nh\u1eadp t\u00ean s\u1ea3n ph\u1ea9m...",
    "filter.searchPlaceholder.service": "Nh\u1eadp t\u00ean d\u1ecbch v\u1ee5...",
    "filter.apply": "T\u00ecm ki\u1ebfm",
    "sort.popular": "Ph\u1ed5 bi\u1ebfn",
    "sort.rating": "\u0110\u00e1nh gi\u00e1",
    "sort.newest": "M\u1edbi nh\u1ea5t",
    "empty.noData": "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u, s\u1ebd hi\u1ec7n khi n\u1ed1i API.",
    "empty.adjustFilters": "B\u1ea1n c\u00f3 th\u1ec3 thay \u0111\u1ed5i b\u1ed9 l\u1ecdc ho\u1eb7c th\u1eed l\u1ea1i sau.",
    "empty.adjustCategory": "B\u1ea1n c\u00f3 th\u1ec3 thay \u0111\u1ed5i danh m\u1ee5c ho\u1eb7c th\u1eed t\u00ecm ki\u1ebfm kh\u00e1c.",
    "landing.featured.emptyTitle": "Ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m n\u1ed5i b\u1eadt",
    "landing.featured.emptyDesc": "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u, s\u1ebd hi\u1ec7n khi n\u1ed1i API.",
    "product.fallback.delivery": "T\u00e0i nguy\u00ean s\u1ed1, giao ngay sau thanh to\u00e1n.",
    "product.fallback.safe": "Giao d\u1ecbch an to\u00e0n, giao ngay.",
    "product.fallback.stockLeft": "C\u00f2n {count}",
    "product.fallback.outOfStock": "H\u1ebft h\u00e0ng",
    "product.action.view": "Xem chi ti\u1ebft",
    "service.fallback.short": "D\u1ecbch v\u1ee5 x\u1eed l\u00fd theo y\u00eau c\u1ea7u sau checkout.",
    "service.fallback.eta": "Th\u1eddi gian linh ho\u1ea1t",
    "task.fallback.short": "Nhi\u1ec7m v\u1ee5 marketplace d\u00e0nh cho c\u1ed9ng t\u00e1c vi\u00ean.",
    "task.status.open": "\u0110ang m\u1edf",
    "label.stock": "Kho",
    "label.sold": "\u0110\u00e3 b\u00e1n",
    "label.rating": "\u0110\u00e1nh gi\u00e1",
    "label.seller": "Ng\u01b0\u1eddi b\u00e1n",
    "label.type": "Lo\u1ea1i",
    "product.category.email": "Email",
    "product.category.tool": "Ph\u1ea7n m\u1ec1m",
    "product.category.account": "T\u00e0i kho\u1ea3n",
    "product.category.other": "Kh\u00e1c",
    "product.header.subtitle": "S\u1eafp x\u1ebfp theo nhu c\u1ea7u v\u00e0 ch\u1ecdn nhanh s\u1ea3n ph\u1ea9m ph\u00f9 h\u1ee3p.",
    "product.empty.noneInCategory": "Ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m trong danh m\u1ee5c n\u00e0y.",
    "product.subcategory.domainEmail": "Email T\u00ean mi\u1ec1n",
    "product.subcategory.otherEmail": "C\u00e1c lo\u1ea1i Email kh\u00e1c",
    "product.subcategory.toolFacebook": "Ph\u1ea7n m\u1ec1m Facebook",
    "product.subcategory.toolGoogle": "Ph\u1ea7n m\u1ec1m Google",
    "product.subcategory.toolYouTube": "Ph\u1ea7n m\u1ec1m YouTube",
    "product.subcategory.toolCrypto": "Ph\u1ea7n m\u1ec1m Ti\u1ec1n \u0111i\u1ec7n t\u1eed",
    "product.subcategory.toolPTC": "Ph\u1ea7n m\u1ec1m PTC",
    "product.subcategory.toolCaptcha": "Ph\u1ea7n m\u1ec1m Captcha",
    "product.subcategory.toolOffer": "Ph\u1ea7n m\u1ec1m Offer",
    "product.subcategory.toolPTU": "Ph\u1ea7n m\u1ec1m PTU",
    "product.subcategory.toolOther": "Ph\u1ea7n m\u1ec1m Kh\u00e1c",
    "product.subcategory.accFacebook": "T\u00e0i kho\u1ea3n Facebook",
    "product.subcategory.accBM": "T\u00e0i kho\u1ea3n Business Manager",
    "product.subcategory.accZalo": "T\u00e0i kho\u1ea3n Zalo",
    "product.subcategory.accTwitter": "T\u00e0i kho\u1ea3n Twitter",
    "product.subcategory.accTelegram": "T\u00e0i kho\u1ea3n Telegram",
    "product.subcategory.accInstagram": "T\u00e0i kho\u1ea3n Instagram",
    "product.subcategory.accShopee": "T\u00e0i kho\u1ea3n Shopee",
    "product.subcategory.accDiscord": "T\u00e0i kho\u1ea3n Discord",
    "product.subcategory.accTikTok": "T\u00e0i kho\u1ea3n TikTok",
    "product.subcategory.keyAntivirus": "Key Antivirus",
    "product.subcategory.accCapCut": "T\u00e0i kho\u1ea3n CapCut",
    "product.subcategory.keyWindows": "Key Windows",
    "product.subcategory.accOther": "T\u00e0i kho\u1ea3n Kh\u00e1c",
    "product.subcategory.giftCard": "Th\u1ebb Qu\u00e0 t\u1eb7ng",
    "product.subcategory.vps": "VPS",
    "product.subcategory.other": "Kh\u00e1c",
    "service.category.interaction": "D\u1ecbch v\u1ee5 T\u01b0\u01a1ng t\u00e1c",
    "service.category.software": "D\u1ecbch v\u1ee5 Ph\u1ea7n m\u1ec1m",
    "service.category.blockchain": "Blockchain",
    "service.category.other": "D\u1ecbch v\u1ee5 Kh\u00e1c",
    "service.header.subtitle": "S\u1eafp x\u1ebfp theo nhu c\u1ea7u v\u00e0 ch\u1ecdn nhanh d\u1ecbch v\u1ee5 ph\u00f9 h\u1ee3p.",
    "service.defaultName": "D\u1ecbch v\u1ee5",
    "service.filter.facebook": "D\u1ecbch v\u1ee5 Facebook",
    "service.filter.tiktok": "D\u1ecbch v\u1ee5 TikTok",
    "service.filter.google": "D\u1ecbch v\u1ee5 Google",
    "service.filter.telegram": "D\u1ecbch v\u1ee5 Telegram",
    "service.filter.shopee": "D\u1ecbch v\u1ee5 Shopee",
    "service.filter.discord": "D\u1ecbch v\u1ee5 Discord",
    "service.filter.twitter": "D\u1ecbch v\u1ee5 Twitter",
    "service.filter.youtube": "D\u1ecbch v\u1ee5 YouTube",
    "service.filter.zalo": "D\u1ecbch v\u1ee5 Zalo",
    "service.filter.instagram": "D\u1ecbch v\u1ee5 Instagram",
    "service.filter.otherInteraction": "D\u1ecbch v\u1ee5 T\u01b0\u01a1ng t\u00e1c Kh\u00e1c",
    "service.filter.codingTool": "D\u1ecbch v\u1ee5 L\u1eadp tr\u00ecnh C\u00f4ng c\u1ee5",
    "service.filter.design": "D\u1ecbch v\u1ee5 \u0110\u1ed3 h\u1ecda",
    "service.filter.video": "D\u1ecbch v\u1ee5 Video",
    "service.filter.otherTool": "D\u1ecbch v\u1ee5 C\u00f4ng c\u1ee5 Kh\u00e1c",
    "service.type.facebook": "Facebook",
    "service.type.tiktok": "TikTok",
    "service.type.google": "Google",
    "service.type.telegram": "Telegram",
    "service.type.shopee": "Shopee",
    "service.type.discord": "Discord",
    "service.type.twitter": "Twitter",
    "service.type.youtube": "YouTube",
    "service.type.zalo": "Zalo",
    "service.type.instagram": "Instagram",
    "service.type.otherInteraction": "T\u01b0\u01a1ng t\u00e1c kh\u00e1c",
    "service.type.codingTool": "L\u1eadp tr\u00ecnh",
    "service.type.design": "\u0110\u1ed3 h\u1ecda",
    "service.type.video": "Video",
    "service.type.otherTool": "C\u00f4ng c\u1ee5 kh\u00e1c",
    "seller.badge.verified": "\u0110\u00e3 X\u00e1c Th\u1ef1c",
    "seller.badge.merchant": "Th\u01b0\u01a1ng Nh\u00e2n B\u1eadc {tier}",
    "seller.badge.admin": "Admin",
    "task.board.title": "B\u1ea3ng \u0111\u0103ng b\u00e0i nhi\u1ec7m v\u1ee5",
    "task.board.subtitle": "Ng\u01b0\u1eddi d\u00f9ng \u0111\u0103ng y\u00eau c\u1ea7u, ng\u01b0\u1eddi kh\u00e1c c\u00f3 th\u1ec3 nh\u1eadn nhi\u1ec7m v\u1ee5 v\u00e0 li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp.",
    "task.empty.title": "Ch\u01b0a c\u00f3 b\u00e0i \u0111\u0103ng nhi\u1ec7m v\u1ee5.",
    "task.empty.desc": "H\u00e3y t\u1ea1o m\u1edbi \u0111\u1ec3 nh\u1eadn h\u1ed7 tr\u1ee3 nhanh.",
    "task.modal.title": "X\u00e1c nh\u1eadn nh\u1eadn nhi\u1ec7m v\u1ee5",
    "task.modal.text": "B\u1ea1n c\u00f3 ch\u1eafc ch\u1eafn nh\u1eadn nhi\u1ec7m v\u1ee5 n\u00e0y kh\u00f4ng?",
    "task.modal.cancel": "H\u1ee7y",
    "task.modal.confirm": "X\u00e1c nh\u1eadn",
    "task.pagination.page": "Trang {current} / {total}",
    "task.pagination.prev": "Trang tr\u01b0\u1edbc",
    "task.pagination.next": "Trang sau",
    "task.status.paid": "\u0110\u00e3 thanh to\u00e1n",
    "task.status.unpaid": "Ch\u01b0a thanh to\u00e1n",
    "task.action.accept": "Nh\u1eadn nhi\u1ec7m v\u1ee5",
    "task.action.accepted": "\u0110\u00e3 nh\u1eadn",
    "task.action.complete": "T\u00f4i \u0111\u00e3 ho\u00e0n th\u00e0nh",
    "task.action.chat": "Nh\u1eafn tin",
    "task.action.submitProof": "G\u1eedi b\u1eb1ng ch\u1ee9ng",
    "task.label.joined": "Tham gia",
    "task.label.deposited": "\u0110\u00e3 \u0111\u1eb7t",
    "task.label.quantity": "S\u1ed1 l\u01b0\u1ee3ng",
    "task.label.status": "Tr\u1ea1ng th\u00e1i",
    "task.label.expires": "H\u1ebft h\u1ea1n",
    "task.label.budget": "Ng\u00e2n s\u00e1ch",
    "task.label.proofImage": "\u1ea2nh ch\u1ee5p / b\u1eb1ng ch\u1ee9ng",
    "task.label.proofLink": "Link b\u1ed5 sung (tu\u1ef3 ch\u1ecdn)",
    "task.label.note": "Ghi ch\u00fa th\u00eam",
    "task.placeholder.proofLink": "https://...",
    "task.placeholder.note": "M\u00f4 t\u1ea3 nhanh b\u1eb1ng ch\u1ee9ng g\u1eedi k\u00e8m...",
    "task.note.mock": "Note: Ng\u01b0\u1eddi \u0111\u0103ng job duy\u1ec7t xong th\u00ec ti\u1ec1n s\u1ebd v\u1ec1 v\u00ed b\u1ea1n.",
    "task.toast.fullSlots": "\u0110\u00e3 h\u1ebft s\u1ed1 l\u01b0\u1ee3ng nh\u1eadn.",
    "task.toast.accepted": "\u0110\u00e3 nh\u1eadn nhi\u1ec7m v\u1ee5 th\u00e0nh c\u00f4ng.",
    "task.toast.proofRequired": "Vui l\u00f2ng \u0111\u00ednh k\u00e8m b\u1eb1ng ch\u1ee9ng ho\u1eb7c ghi ch\u00fa th\u00eam.",
    "task.toast.proofSubmitted": "\u0110\u00e3 g\u1eedi b\u1eb1ng ch\u1ee9ng.",
    "task.desc.empty": "Ch\u01b0a c\u00f3 m\u00f4 t\u1ea3 chi ti\u1ebft.",
    "task.title.default": "Nhi\u1ec7m v\u1ee5",
  },
  en: {
    "nav.products": "Products",
    "nav.services": "Services",
    "nav.tasks": "Tasks",
    "nav.topups": "Top up",
    "menu.overview": "Account overview",
    "menu.profile": "Profile",
    "menu.manageShop": "Manage shop",
    "menu.manageTasks": "Manage tasks",
    "menu.orders": "Orders",
    "menu.favorites": "Favorites",
    "menu.following": "Following",
    "menu.history": "Account history",
    "menu.withdraw": "Withdraw",
    "menu.tasks": "Tasks",
    "menu.messages": "Messages",
    "menu.notifications": "Notifications",
    "menu.badges": "Badges",
    "menu.security": "2FA security",
    "menu.logout": "Log out",
    "cta.login": "Log in",
    "cta.register": "Register",
    "auth.username.invalid": "Username must be 3-20 chars, lowercase letters/numbers and . _ - only.",
    "media.imageOnly": "Only images are supported.",
    "media.imageTooLarge": "Image exceeds 2MB.",
    "cta.joinSeller": "Become a seller",
    "cta.manageShop": "Manage shop",
    "cta.manageTasks": "Manage tasks",
    "currency.note": "Exchange rates update automatically.",
    "footer.about": "About polyflux.xyz",
    "footer.aboutDesc": "The #1 trusted marketplace for digital assets on polyflux.xyz. Buy accounts, emails, tools and more with instant delivery.",
    "footer.nav": "Navigation",
    "footer.products": "Products",
    "footer.services": "Services",
    "footer.tasksMarketplace": "Tasks marketplace",
    "footer.account": "My account",
    "footer.payments": "Payments & security",
    "footer.paymentDesc1": "20+ payment methods, processed automatically.",
    "footer.paymentDesc2": "Transparent order history.",
    "footer.paymentDesc3": "2FA & suspicious login alerts.",
    "footer.join": "Sell on PolyFlux",
    "footer.joinDesc": "Want to open a store on polyflux.xyz?",
    "footer.joinBtn": "Sell on PolyFlux",
    "filter.title": "Filter",
    "filter.descSubcategories": "Choose one or more subcategories",
    "filter.descCategories": "Choose one or more categories",
    "filter.searchLabel": "Search",
    "filter.searchPlaceholder.product": "Enter product name...",
    "filter.searchPlaceholder.service": "Enter service name...",
    "filter.apply": "Search",
    "sort.popular": "Popular",
    "sort.rating": "Rating",
    "sort.newest": "Newest",
    "empty.noData": "No data yet, will appear when the API is connected.",
    "empty.adjustFilters": "You can change filters or try again later.",
    "empty.adjustCategory": "You can change categories or try another search.",
    "landing.featured.emptyTitle": "No featured products yet",
    "landing.featured.emptyDesc": "No data yet, will appear when the API is connected.",
    "product.fallback.delivery": "Digital goods, delivered instantly after payment.",
    "product.fallback.safe": "Secure checkout, instant delivery.",
    "product.fallback.stockLeft": "{count} left",
    "product.fallback.outOfStock": "Out of stock",
    "product.action.view": "View details",
    "service.fallback.short": "Service processed on request after checkout.",
    "service.fallback.eta": "Flexible timing",
    "task.fallback.short": "Marketplace tasks for collaborators.",
    "task.status.open": "Open",
    "label.stock": "Stock",
    "label.sold": "Sold",
    "label.rating": "Rating",
    "label.seller": "Seller",
    "label.type": "Type",
    "product.category.email": "Email",
    "product.category.tool": "Software",
    "product.category.account": "Accounts",
    "product.category.other": "Other",
    "product.header.subtitle": "Sort by needs and quickly pick the right product.",
    "product.empty.noneInCategory": "No products in this category.",
    "product.subcategory.domainEmail": "Domain email",
    "product.subcategory.otherEmail": "Other email types",
    "product.subcategory.toolFacebook": "Facebook software",
    "product.subcategory.toolGoogle": "Google software",
    "product.subcategory.toolYouTube": "YouTube software",
    "product.subcategory.toolCrypto": "Crypto software",
    "product.subcategory.toolPTC": "PTC software",
    "product.subcategory.toolCaptcha": "Captcha software",
    "product.subcategory.toolOffer": "Offer software",
    "product.subcategory.toolPTU": "PTU software",
    "product.subcategory.toolOther": "Other software",
    "product.subcategory.accFacebook": "Facebook account",
    "product.subcategory.accBM": "Business Manager account",
    "product.subcategory.accZalo": "Zalo account",
    "product.subcategory.accTwitter": "Twitter account",
    "product.subcategory.accTelegram": "Telegram account",
    "product.subcategory.accInstagram": "Instagram account",
    "product.subcategory.accShopee": "Shopee account",
    "product.subcategory.accDiscord": "Discord account",
    "product.subcategory.accTikTok": "TikTok account",
    "product.subcategory.keyAntivirus": "Antivirus key",
    "product.subcategory.accCapCut": "CapCut account",
    "product.subcategory.keyWindows": "Windows key",
    "product.subcategory.accOther": "Other accounts",
    "product.subcategory.giftCard": "Gift card",
    "product.subcategory.vps": "VPS",
    "product.subcategory.other": "Other",
    "service.category.interaction": "Engagement services",
    "service.category.software": "Software services",
    "service.category.blockchain": "Blockchain",
    "service.category.other": "Other services",
    "service.header.subtitle": "Sort by needs and quickly pick the right service.",
    "service.defaultName": "Service",
    "service.filter.facebook": "Facebook service",
    "service.filter.tiktok": "TikTok service",
    "service.filter.google": "Google service",
    "service.filter.telegram": "Telegram service",
    "service.filter.shopee": "Shopee service",
    "service.filter.discord": "Discord service",
    "service.filter.twitter": "Twitter service",
    "service.filter.youtube": "YouTube service",
    "service.filter.zalo": "Zalo service",
    "service.filter.instagram": "Instagram service",
    "service.filter.otherInteraction": "Other engagement service",
    "service.filter.codingTool": "Development tools service",
    "service.filter.design": "Design service",
    "service.filter.video": "Video service",
    "service.filter.otherTool": "Other tools service",
    "service.type.facebook": "Facebook",
    "service.type.tiktok": "TikTok",
    "service.type.google": "Google",
    "service.type.telegram": "Telegram",
    "service.type.shopee": "Shopee",
    "service.type.discord": "Discord",
    "service.type.twitter": "Twitter",
    "service.type.youtube": "YouTube",
    "service.type.zalo": "Zalo",
    "service.type.instagram": "Instagram",
    "service.type.otherInteraction": "Other engagement",
    "service.type.codingTool": "Development",
    "service.type.design": "Design",
    "service.type.video": "Video",
    "service.type.otherTool": "Other tools",
    "seller.badge.verified": "Verified",
    "seller.badge.merchant": "Merchant tier {tier}",
    "seller.badge.admin": "Admin",
    "task.board.title": "Task board",
    "task.board.subtitle": "Users post requests; others can take tasks and contact directly.",
    "task.empty.title": "No tasks posted yet.",
    "task.empty.desc": "Create a new one to get support quickly.",
    "task.modal.title": "Confirm task acceptance",
    "task.modal.text": "Are you sure you want to accept this task?",
    "task.modal.cancel": "Cancel",
    "task.modal.confirm": "Confirm",
    "task.pagination.page": "Page {current} / {total}",
    "task.pagination.prev": "Previous",
    "task.pagination.next": "Next",
    "task.status.paid": "Paid",
    "task.status.unpaid": "Unpaid",
    "task.action.accept": "Accept task",
    "task.action.accepted": "Accepted",
    "task.action.complete": "I've completed it",
    "task.action.chat": "Message",
    "task.action.submitProof": "Submit proof",
    "task.label.joined": "Joined",
    "task.label.deposited": "Deposited",
    "task.label.quantity": "Quantity",
    "task.label.status": "Status",
    "task.label.expires": "Expires",
    "task.label.budget": "Budget",
    "task.label.proofImage": "Screenshot / proof",
    "task.label.proofLink": "Additional link (optional)",
    "task.label.note": "Additional note",
    "task.placeholder.proofLink": "https://...",
    "task.placeholder.note": "Briefly describe the proof you sent...",
    "task.note.mock": "Note: once the job owner approves, funds go to your wallet.",
    "task.toast.fullSlots": "No slots left.",
    "task.toast.accepted": "Task accepted successfully.",
    "task.toast.proofRequired": "Please attach proof or add a note.",
    "task.toast.proofSubmitted": "Proof submitted.",
    "task.desc.empty": "No detailed description yet.",
    "task.title.default": "Task",
  },
  ko: {
    "nav.products": "\uc81c\ud488",
    "nav.services": "\uc11c\ube44\uc2a4",
    "nav.tasks": "\uc791\uc5c5",
    "nav.topups": "\ucda9\uc804",
    "menu.overview": "\uacc4\uc815 \uac1c\uc694",
    "menu.profile": "\uac1c\uc778 \ud398\uc774\uc9c0",
    "menu.manageShop": "\ub9e4\uc7a5 \uad00\ub9ac",
    "menu.manageTasks": "\uc791\uc5c5 \uad00\ub9ac",
    "menu.orders": "\ub0b4 \uc8fc\ubb38",
    "menu.favorites": "\uc990\uaca8\ucc3e\uae30",
    "menu.history": "\uacc4\uc815 \ub0b4\uc5ed",
    "menu.withdraw": "\uc778\ucd9c",
    "menu.tasks": "\uc791\uc5c5",
    "menu.messages": "\uba54\uc2dc\uc9c0",
    "menu.notifications": "\uc54c\ub9bc",
    "menu.badges": "\ubc30\uc9c0",
    "menu.security": "2FA \ubcf4\uc548",
    "menu.logout": "\ub85c\uadf8\uc544\uc6c3",
    "cta.login": "\ub85c\uadf8\uc778",
    "cta.register": "\uac00\uc785",
    "auth.username.invalid": "\uC0AC\uC6A9\uC790 \uC774\uB984\uC740 \uC601\uBB38/\uC22B\uC790\uB9CC \uD5C8\uC6A9\uB418\uBA70 \uACF5\uBC31\uACFC \uC545\uC13C\uD2B8\uB294 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    "media.imageOnly": "\uC774\uBBF8\uC9C0\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4.",
    "media.imageTooLarge": "\uC774\uBBF8\uC9C0\uAC00 2MB\uB97C \uCD08\uACFC\uD569\uB2C8\uB2E4.",
    "cta.joinSeller": "\ud310\ub9e4\uc790\uac00 \ub418\uc138\uc694",
    "cta.manageShop": "\ub9e4\uc7a5 \uad00\ub9ac",
    "cta.manageTasks": "\uc791\uc5c5 \uad00\ub9ac",
    "currency.note": "\ud658\uc728\uc740 \uc790\ub3d9\uc73c\ub85c \uc5c5\ub370\uc774\ud2b8\ub429\ub2c8\ub2e4.",
    "footer.about": "\ubc14\ud750\ud0b4 \uc2a4\ud1a0\uc5b4 \uc18c\uac1c",
    "footer.aboutDesc": "polyflux.xyz\uc758 \ub514\uc9c0\ud138 \uc790\uc0b0\uc5d0 \ub300\ud55c \uc2e0\ub8b0\ud560 \uc218 \uc788\ub294 1\uc704 \ub9c8\ucf13\ud50c\ub808\uc774\uc2a4\uc785\ub2c8\ub2e4. \uc989\uc2dc \ubc30\uc1a1\uc73c\ub85c \uacc4\uc815, \uc774\uba54\uc77c, \ub3c4\uad6c \ub4f1\uc744 \uad6c\ub9e4\ud558\uc138\uc694.",
    "footer.nav": "\ud0d0\uc0c9 \uba54\ub274",
    "footer.products": "\uc81c\ud488",
    "footer.services": "\uc11c\ube44\uc2a4",
    "footer.tasksMarketplace": "\uc791\uc5c5 \ub9c8\ucf13\ud50c\ub808\uc774\uc2a4",
    "footer.account": "\ub0b4 \uacc4\uc815",
    "footer.payments": "\uacb0\uc81c \ubc0f \ubcf4\uc548",
    "footer.paymentDesc1": "20\uac1c \uc774\uc0c1\uc758 \uacb0\uc81c \ubc29\ubc95\uc774 \uc790\ub3d9\uc73c\ub85c \ucc98\ub9ac\ub429\ub2c8\ub2e4.",
    "footer.paymentDesc2": "\ud22c\uba85\ud55c \uc8fc\ubb38 \ub0b4\uc5ed.",
    "footer.paymentDesc3": "2FA \ubc0f \uc758\uc2ec\uc2a4\ub7ec\uc6b4 \ub85c\uadf8\uc778 \uc54c\ub9bc.",
    "footer.join": "PolyFlux\uc5d0\uc11c \ud310\ub9e4",
    "footer.joinDesc": "polyflux.xyz\uc5d0 \ub9e4\uc7a5\uc744 \uc5f4\uace0 \uc2f6\uc73c\uc2e0\uac00\uc694?",
    "footer.joinBtn": "PolyFlux\uc5d0\uc11c \ud310\ub9e4",
    "filter.title": "\ud544\ud130",
    "filter.descSubcategories": "\ud558\uc704 \uce74\ud14c\uace0\ub9ac\ub97c \ud558\ub098 \uc774\uc0c1 \uc120\ud0dd\ud558\uc138\uc694",
    "filter.descCategories": "\uce74\ud14c\uace0\ub9ac\ub97c \ud558\ub098 \uc774\uc0c1 \uc120\ud0dd\ud558\uc138\uc694",
    "filter.searchLabel": "\uac80\uc0c9",
    "filter.searchPlaceholder.product": "\uc0c1\ud488\uba85\uc744 \uc785\ub825\ud558\uc138\uc694...",
    "filter.searchPlaceholder.service": "\uc11c\ube44\uc2a4\uba85\uc744 \uc785\ub825\ud558\uc138\uc694...",
    "filter.apply": "\uac80\uc0c9",
    "sort.popular": "\uc778\uae30",
    "sort.rating": "\ud3c9\uc810",
    "sort.newest": "\ucd5c\uc2e0",
    "empty.noData": "\ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. API\uac00 \uc5f0\uacb0\ub418\uba74 \ud45c\uc2dc\ub429\ub2c8\ub2e4.",
    "empty.adjustFilters": "\ud544\ud130\ub97c \ubcc0\uacbd\ud558\uac70\ub098 \ub098\uc911\uc5d0 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694.",
    "empty.adjustCategory": "\uce74\ud14c\uace0\ub9ac\ub97c \ubc14\uafb8\uac70\ub098 \ub2e4\ub978 \uac80\uc0c9\uc5b4\ub97c \uc0ac\uc6a9\ud574 \ubcf4\uc138\uc694.",
    "landing.featured.emptyTitle": "\ucd94\ucc9c \uc0c1\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4",
    "landing.featured.emptyDesc": "\ub370\uc774\ud130\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. API\uac00 \uc5f0\uacb0\ub418\uba74 \ud45c\uc2dc\ub429\ub2c8\ub2e4.",
    "product.fallback.delivery": "\ub514\uc9c0\ud138 \uc0c1\ud488, \uacb0\uc81c \ud6c4 \uc989\uc2dc \uc804\ub2ec\ub429\ub2c8\ub2e4.",
    "product.fallback.safe": "\uc548\uc804\ud55c \uacb0\uc81c, \uc989\uc2dc \uc804\ub2ec.",
    "product.fallback.stockLeft": "\uc7ac\uace0 {count}\uac1c",
    "product.fallback.outOfStock": "\ud488\uc808",
    "product.action.view": "\uc790\uc138\ud788 \ubcf4\uae30",
    "service.fallback.short": "\uacb0\uc81c \ud6c4 \uc694\uccad\uc5d0 \ub530\ub77c \ucc98\ub9ac\ub429\ub2c8\ub2e4.",
    "service.fallback.eta": "\uc720\ub3d9\uc801\uc778 \uc2dc\uac04",
    "task.fallback.short": "\ud611\ub825\uc790\ub97c \uc704\ud55c \ub9c8\ucf13\ud50c\ub808\uc774\uc2a4 \uc791\uc5c5\uc785\ub2c8\ub2e4.",
    "task.status.open": "\ubaa8\uc9d1 \uc911",
    "label.stock": "\uc7ac\uace0",
    "label.sold": "\ud310\ub9e4\ub428",
    "label.rating": "\ud3c9\uc810",
    "label.seller": "\ud310\ub9e4\uc790",
    "label.type": "\uc720\ud615",
    "product.category.email": "\uc774\uba54\uc77c",
    "product.category.tool": "\uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.category.account": "\uacc4\uc815",
    "product.category.other": "\uae30\ud0c0",
    "product.header.subtitle": "\ud544\uc694\uc5d0 \ub9de\uac8c \uc815\ub82c\ud558\uace0 \uc801\ud569\ud55c \uc0c1\ud488\uc744 \ube60\ub974\uac8c \uc120\ud0dd\ud558\uc138\uc694.",
    "product.empty.noneInCategory": "\uc774 \uce74\ud14c\uace0\ub9ac\uc5d0 \uc0c1\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
    "product.subcategory.domainEmail": "\ub3c4\uba54\uc778 \uc774\uba54\uc77c",
    "product.subcategory.otherEmail": "\uae30\ud0c0 \uc774\uba54\uc77c",
    "product.subcategory.toolFacebook": "\ud398\uc774\uc2a4\ubd81 \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolGoogle": "\uad6c\uae00 \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolYouTube": "\uc720\ud29c\ube0c \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolCrypto": "\uc554\ud638\ud654\ud3d0 \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolPTC": "PTC \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolCaptcha": "\ucea1\ucc28 \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolOffer": "\uc624\ud37c \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolPTU": "PTU \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.toolOther": "\uae30\ud0c0 \uc18c\ud504\ud2b8\uc6e8\uc5b4",
    "product.subcategory.accFacebook": "\ud398\uc774\uc2a4\ubd81 \uacc4\uc815",
    "product.subcategory.accBM": "\ube44\uc988\ub2c8\uc2a4 \ub9e4\ub2c8\uc800 \uacc4\uc815",
    "product.subcategory.accZalo": "\uc798\ub85c \uacc4\uc815",
    "product.subcategory.accTwitter": "\ud2b8\uc704\ud130 \uacc4\uc815",
    "product.subcategory.accTelegram": "\ud154\ub808\uadf8\ub7a8 \uacc4\uc815",
    "product.subcategory.accInstagram": "\uc778\uc2a4\ud0c0\uadf8\ub7a8 \uacc4\uc815",
    "product.subcategory.accShopee": "\uc1fc\ud53c \uacc4\uc815",
    "product.subcategory.accDiscord": "\ub514\uc2a4\ucf54\ub4dc \uacc4\uc815",
    "product.subcategory.accTikTok": "\ud2f1\ud1a1 \uacc4\uc815",
    "product.subcategory.keyAntivirus": "\uc548\ud2f0\ubc14\uc774\ub7ec\uc2a4 \ud0a4",
    "product.subcategory.accCapCut": "\ucea1\ucee7 \uacc4\uc815",
    "product.subcategory.keyWindows": "\uc708\ub3c4\uc6b0 \ud0a4",
    "product.subcategory.accOther": "\uae30\ud0c0 \uacc4\uc815",
    "product.subcategory.giftCard": "\uae30\ud504\ud2b8 \uce74\ub4dc",
    "product.subcategory.vps": "VPS",
    "product.subcategory.other": "\uae30\ud0c0",
    "service.category.interaction": "\uc0c1\ud638\uc791\uc6a9 \uc11c\ube44\uc2a4",
    "service.category.software": "\uc18c\ud504\ud2b8\uc6e8\uc5b4 \uc11c\ube44\uc2a4",
    "service.category.blockchain": "\ube14\ub85d\uccb4\uc778",
    "service.category.other": "\uae30\ud0c0 \uc11c\ube44\uc2a4",
    "service.header.subtitle": "\ud544\uc694\uc5d0 \ub9de\uac8c \uc815\ub82c\ud558\uace0 \uc801\ud569\ud55c \uc11c\ube44\uc2a4\ub97c \ube60\ub974\uac8c \uc120\ud0dd\ud558\uc138\uc694.",
    "service.defaultName": "\uc11c\ube44\uc2a4",
    "service.filter.facebook": "Facebook \uc11c\ube44\uc2a4",
    "service.filter.tiktok": "TikTok \uc11c\ube44\uc2a4",
    "service.filter.google": "Google \uc11c\ube44\uc2a4",
    "service.filter.telegram": "Telegram \uc11c\ube44\uc2a4",
    "service.filter.shopee": "Shopee \uc11c\ube44\uc2a4",
    "service.filter.discord": "Discord \uc11c\ube44\uc2a4",
    "service.filter.twitter": "Twitter \uc11c\ube44\uc2a4",
    "service.filter.youtube": "YouTube \uc11c\ube44\uc2a4",
    "service.filter.zalo": "Zalo \uc11c\ube44\uc2a4",
    "service.filter.instagram": "Instagram \uc11c\ube44\uc2a4",
    "service.filter.otherInteraction": "\uae30\ud0c0 \uc0c1\ud638\uc791\uc6a9 \uc11c\ube44\uc2a4",
    "service.filter.codingTool": "\uac1c\ubc1c \ub3c4\uad6c \uc11c\ube44\uc2a4",
    "service.filter.design": "\ub514\uc790\uc778 \uc11c\ube44\uc2a4",
    "service.filter.video": "\ube44\ub514\uc624 \uc11c\ube44\uc2a4",
    "service.filter.otherTool": "\uae30\ud0c0 \ub3c4\uad6c \uc11c\ube44\uc2a4",
    "service.type.facebook": "Facebook",
    "service.type.tiktok": "TikTok",
    "service.type.google": "Google",
    "service.type.telegram": "Telegram",
    "service.type.shopee": "Shopee",
    "service.type.discord": "Discord",
    "service.type.twitter": "Twitter",
    "service.type.youtube": "YouTube",
    "service.type.zalo": "Zalo",
    "service.type.instagram": "Instagram",
    "service.type.otherInteraction": "\uae30\ud0c0 \uc0c1\ud638\uc791\uc6a9",
    "service.type.codingTool": "\uac1c\ubc1c",
    "service.type.design": "\ub514\uc790\uc778",
    "service.type.video": "\ube44\ub514\uc624",
    "service.type.otherTool": "\uae30\ud0c0 \ub3c4\uad6c",
    "seller.badge.verified": "\uc778\uc99d\ub428",
    "seller.badge.merchant": "\uc0c1\uc778 \ub4f1\uae09 {tier}",
    "seller.badge.admin": "\uad00\ub9ac\uc790",
    "task.board.title": "\uc791\uc5c5 \uac8c\uc2dc\ud310",
    "task.board.subtitle": "\uc0ac\uc6a9\uc790\uac00 \uc694\uccad\uc744 \uac8c\uc2dc\ud558\uba74 \ub2e4\ub978 \uc0ac\uc6a9\uc790\uac00 \uc791\uc5c5\uc744 \uc218\ub77d\ud558\uace0 \uc9c1\uc811 \uc5f0\ub77d\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
    "task.empty.title": "\uac8c\uc2dc\ub41c \uc791\uc5c5\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
    "task.empty.desc": "\uc0c8\ub85c \ub9cc\ub4e4\uc5b4 \ube60\ub978 \uc9c0\uc6d0\uc744 \ubc1b\uc73c\uc138\uc694.",
    "task.modal.title": "\uc791\uc5c5 \uc218\ub77d \ud655\uc778",
    "task.modal.text": "\uc774 \uc791\uc5c5\uc744 \uc218\ub77d\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?",
    "task.modal.cancel": "\ucde8\uc18c",
    "task.modal.confirm": "\ud655\uc778",
    "task.pagination.page": "\ud398\uc774\uc9c0 {current} / {total}",
    "task.pagination.prev": "\uc774\uc804",
    "task.pagination.next": "\ub2e4\uc74c",
    "task.status.paid": "\uacb0\uc81c \uc644\ub8cc",
    "task.status.unpaid": "\ubbf8\uacb0\uc81c",
    "task.action.accept": "\uc791\uc5c5 \uc218\ub77d",
    "task.action.accepted": "\uc218\ub77d\ub428",
    "task.action.complete": "\uc644\ub8cc\ud588\uc2b5\ub2c8\ub2e4",
    "task.action.chat": "\uba54\uc2dc\uc9c0",
    "task.action.submitProof": "\uc99d\ube59 \uc81c\ucd9c",
    "task.label.joined": "\uac00\uc785",
    "task.label.deposited": "\uc608\uce58\ub428",
    "task.label.quantity": "\uc218\ub7c9",
    "task.label.status": "\uc0c1\ud0dc",
    "task.label.expires": "\ub9cc\ub8cc",
    "task.label.budget": "\uc608\uc0b0",
    "task.label.proofImage": "\uc2a4\ud06c\ub9b0\uc0f7 / \uc99d\ube59",
    "task.label.proofLink": "\ucd94\uac00 \ub9c1\ud06c(\uc120\ud0dd)",
    "task.label.note": "\ucd94\uac00 \uba54\ubaa8",
    "task.placeholder.proofLink": "https://...",
    "task.placeholder.note": "\ucca8\ubd80\ud55c \uc99d\ube59\uc744 \uac04\ub2e8\ud788 \uc124\uba85\ud558\uc138\uc694...",
    "task.note.mock": "Note: \uc791\uc5c5\uc790\uac00 \uc2b9\uc778\ud558\uba74 \uae08\uc561\uc774 \uc9c0\uac11\uc73c\ub85c \ub4e4\uc5b4\uc635\ub2c8\ub2e4.",
    "task.toast.fullSlots": "\ub0a8\uc740 \uc218\ub7c9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
    "task.toast.accepted": "\uc791\uc5c5\uc744 \uc218\ub77d\ud588\uc2b5\ub2c8\ub2e4.",
    "task.toast.proofRequired": "\uc99d\ube59\uc744 \ucca8\ubd80\ud558\uac70\ub098 \uba54\ubaa8\ub97c \ucd94\uac00\ud558\uc138\uc694.",
    "task.toast.proofSubmitted": "\uc99d\ube59\uc774 \uc81c\ucd9c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
    "task.desc.empty": "\uc0c1\uc138 \uc124\uba85\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.",
    "task.title.default": "\uc791\uc5c5",
  },
  ja: {
    "nav.products": "\u88fd\u54c1",
    "nav.services": "\u30b5\u30fc\u30d3\u30b9",
    "nav.tasks": "\u30bf\u30b9\u30af",
    "nav.topups": "\u30ea\u30c1\u30e3\u30fc\u30b8",
    "menu.overview": "\u30a2\u30ab\u30a6\u30f3\u30c8\u306e\u6982\u8981",
    "menu.profile": "\u500b\u4eba\u30da\u30fc\u30b8",
    "menu.manageShop": "\u30b7\u30e7\u30c3\u30d7\u306e\u7ba1\u7406",
    "menu.manageTasks": "\u30bf\u30b9\u30af\u7ba1\u7406",
    "menu.orders": "\u6ce8\u6587",
    "menu.favorites": "\u304a\u6c17\u306b\u5165\u308a",
    "menu.history": "\u30a2\u30ab\u30a6\u30f3\u30c8\u5c65\u6b74",
    "menu.withdraw": "\u51fa\u91d1",
    "menu.tasks": "\u30bf\u30b9\u30af",
    "menu.messages": "\u30e1\u30c3\u30bb\u30fc\u30b8",
    "menu.notifications": "\u901a\u77e5",
    "menu.badges": "\u30d0\u30c3\u30b8",
    "menu.security": "2FA\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3",
    "menu.logout": "\u30ed\u30b0\u30a2\u30a6\u30c8",
    "cta.login": "\u30ed\u30b0\u30a4\u30f3",
    "cta.register": "\u767b\u9332\u3059\u308b",
    "auth.username.invalid": "\u30E6\u30FC\u30B6\u30FC\u540D\u306F\u82F1\u6570\u5B57\u306E\u307F\u3067\u3001\u30B9\u30DA\u30FC\u30B9\u3084\u30A2\u30AF\u30BB\u30F3\u30C8\u8A18\u53F7\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u3002",
    "media.imageOnly": "\u753B\u50CF\u306E\u307F\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059\u3002",
    "media.imageTooLarge": "\u753B\u50CF\u304C2MB\u3092\u8D85\u3048\u3066\u3044\u307E\u3059\u3002",
    "cta.joinSeller": "\u8ca9\u58f2\u8005\u306b\u306a\u308b",
    "cta.manageShop": "\u30b7\u30e7\u30c3\u30d7\u306e\u7ba1\u7406",
    "cta.manageTasks": "\u30bf\u30b9\u30af\u7ba1\u7406",
    "currency.note": "\u70ba\u66ff\u30ec\u30fc\u30c8\u306f\u81ea\u52d5\u7684\u306b\u66f4\u65b0\u3055\u308c\u307e\u3059\u3002",
    "footer.about": "PolyFlux\u30b9\u30c8\u30a2\u306b\u3064\u3044\u3066",
    "footer.aboutDesc": "polyflux.xyz \u306f\u3001\u30c7\u30b8\u30bf\u30eb\u8cc7\u7523\u306e\u30ca\u30f3\u30d0\u30fc\u30ef\u30f3\u306e\u4fe1\u983c\u3067\u304d\u308b\u30de\u30fc\u30b1\u30c3\u30c8\u30d7\u30ec\u30a4\u30b9\u3067\u3059\u3002\u30a2\u30ab\u30a6\u30f3\u30c8\u3001\u30e1\u30fc\u30eb\u3001\u30c4\u30fc\u30eb\u306a\u3069\u3092\u5373\u6642\u914d\u9001\u3067\u8cfc\u5165\u3067\u304d\u307e\u3059\u3002",
    "footer.nav": "\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3",
    "footer.products": "\u88fd\u54c1",
    "footer.services": "\u30b5\u30fc\u30d3\u30b9",
    "footer.tasksMarketplace": "\u30bf\u30b9\u30af\u30de\u30fc\u30b1\u30c3\u30c8\u30d7\u30ec\u30a4\u30b9",
    "footer.account": "\u79c1\u306e\u30a2\u30ab\u30a6\u30f3\u30c8",
    "footer.payments": "\u652f\u6255\u3044\u3068\u30bb\u30ad\u30e5\u30ea\u30c6\u30a3",
    "footer.paymentDesc1": "20 \u4ee5\u4e0a\u306e\u652f\u6255\u3044\u65b9\u6cd5\u304c\u3042\u308a\u3001\u81ea\u52d5\u7684\u306b\u51e6\u7406\u3055\u308c\u307e\u3059\u3002",
    "footer.paymentDesc2": "\u900f\u660e\u306a\u6ce8\u6587\u5c65\u6b74\u3002",
    "footer.paymentDesc3": "2FA \u304a\u3088\u3073\u4e0d\u5be9\u306a\u30ed\u30b0\u30a4\u30f3\u306e\u30a2\u30e9\u30fc\u30c8\u3002",
    "footer.join": "PolyFlux\u3067\u8ca9\u58f2\u3059\u308b",
    "footer.joinDesc": "polyflux.xyz \u306b\u30b9\u30c8\u30a2\u3092\u958b\u304d\u305f\u3044\u3067\u3059\u304b?",
    "footer.joinBtn": "PolyFlux\u3067\u8ca9\u58f2\u3059\u308b",
    "filter.title": "\u30d5\u30a3\u30eb\u30bf\u30fc",
    "filter.descSubcategories": "1\u3064\u4ee5\u4e0a\u306e\u30b5\u30d6\u30ab\u30c6\u30b4\u30ea\u3092\u9078\u629e",
    "filter.descCategories": "1\u3064\u4ee5\u4e0a\u306e\u30ab\u30c6\u30b4\u30ea\u3092\u9078\u629e",
    "filter.searchLabel": "\u691c\u7d22",
    "filter.searchPlaceholder.product": "\u5546\u54c1\u540d\u3092\u5165\u529b...",
    "filter.searchPlaceholder.service": "\u30b5\u30fc\u30d3\u30b9\u540d\u3092\u5165\u529b...",
    "filter.apply": "\u691c\u7d22",
    "sort.popular": "\u4eba\u6c17",
    "sort.rating": "\u8a55\u4fa1",
    "sort.newest": "\u6700\u65b0",
    "empty.noData": "\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002API\u63a5\u7d9a\u5f8c\u306b\u8868\u793a\u3055\u308c\u307e\u3059\u3002",
    "empty.adjustFilters": "\u30d5\u30a3\u30eb\u30bf\u30fc\u3092\u5909\u66f4\u3059\u308b\u304b\u3001\u5f8c\u3067\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
    "empty.adjustCategory": "\u30ab\u30c6\u30b4\u30ea\u3092\u5909\u66f4\u3059\u308b\u304b\u3001\u5225\u306e\u691c\u7d22\u3092\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    "landing.featured.emptyTitle": "\u6ce8\u76ee\u5546\u54c1\u304c\u3042\u308a\u307e\u305b\u3093",
    "landing.featured.emptyDesc": "\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093\u3002API\u63a5\u7d9a\u5f8c\u306b\u8868\u793a\u3055\u308c\u307e\u3059\u3002",
    "product.fallback.delivery": "\u30c7\u30b8\u30bf\u30eb\u5546\u54c1\u3001\u652f\u6255\u3044\u5f8c\u3059\u3050\u306b\u914d\u9054\u3002",
    "product.fallback.safe": "\u5b89\u5168\u306a\u6c7a\u6e08\u3001\u5373\u6642\u914d\u9054\u3002",
    "product.fallback.stockLeft": "\u6b8b\u308a{count}",
    "product.fallback.outOfStock": "\u5728\u5eab\u5207\u308c",
    "product.action.view": "\u8a73\u7d30\u3092\u898b\u308b",
    "service.fallback.short": "\u6c7a\u6e08\u5f8c\u306b\u30ea\u30af\u30a8\u30b9\u30c8\u306b\u5fdc\u3058\u3066\u51e6\u7406\u3057\u307e\u3059\u3002",
    "service.fallback.eta": "\u67d4\u8edf\u306a\u6642\u9593",
    "task.fallback.short": "\u5354\u529b\u8005\u5411\u3051\u306e\u30de\u30fc\u30b1\u30c3\u30c8\u30d7\u30ec\u30a4\u30b9\u306e\u30bf\u30b9\u30af\u3002",
    "task.status.open": "\u53d7\u4ed8\u4e2d",
    "label.stock": "\u5728\u5eab",
    "label.sold": "\u8ca9\u58f2\u6570",
    "label.rating": "\u8a55\u4fa1",
    "label.seller": "\u8ca9\u58f2\u8005",
    "label.type": "\u7a2e\u985e",
    "product.category.email": "\u30e1\u30fc\u30eb",
    "product.category.tool": "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2",
    "product.category.account": "\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.category.other": "\u305d\u306e\u4ed6",
    "product.header.subtitle": "\u30cb\u30fc\u30ba\u306b\u5408\u308f\u305b\u3066\u4e26\u3079\u66ff\u3048\u3001\u6700\u9069\u306a\u5546\u54c1\u3092\u3059\u3070\u3084\u304f\u9078\u629e\u3002",
    "product.empty.noneInCategory": "\u3053\u306e\u30ab\u30c6\u30b4\u30ea\u306b\u306f\u5546\u54c1\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
    "product.subcategory.domainEmail": "\u30c9\u30e1\u30a4\u30f3\u30e1\u30fc\u30eb",
    "product.subcategory.otherEmail": "\u305d\u306e\u4ed6\u306e\u30e1\u30fc\u30eb",
    "product.subcategory.toolFacebook": "Facebook\u30bd\u30d5\u30c8",
    "product.subcategory.toolGoogle": "Google\u30bd\u30d5\u30c8",
    "product.subcategory.toolYouTube": "YouTube\u30bd\u30d5\u30c8",
    "product.subcategory.toolCrypto": "\u6697\u53f7\u901a\u8ca8\u30bd\u30d5\u30c8",
    "product.subcategory.toolPTC": "PTC\u30bd\u30d5\u30c8",
    "product.subcategory.toolCaptcha": "Captcha\u30bd\u30d5\u30c8",
    "product.subcategory.toolOffer": "Offer\u30bd\u30d5\u30c8",
    "product.subcategory.toolPTU": "PTU\u30bd\u30d5\u30c8",
    "product.subcategory.toolOther": "\u305d\u306e\u4ed6\u306e\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2",
    "product.subcategory.accFacebook": "Facebook\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accBM": "Business Manager\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accZalo": "Zalo\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accTwitter": "Twitter\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accTelegram": "Telegram\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accInstagram": "Instagram\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accShopee": "Shopee\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accDiscord": "Discord\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.accTikTok": "TikTok\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.keyAntivirus": "\u30a2\u30f3\u30c1\u30a6\u30a4\u30eb\u30b9\u30ad\u30fc",
    "product.subcategory.accCapCut": "CapCut\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.keyWindows": "Windows\u30ad\u30fc",
    "product.subcategory.accOther": "\u305d\u306e\u4ed6\u306e\u30a2\u30ab\u30a6\u30f3\u30c8",
    "product.subcategory.giftCard": "\u30ae\u30d5\u30c8\u30ab\u30fc\u30c9",
    "product.subcategory.vps": "VPS",
    "product.subcategory.other": "\u305d\u306e\u4ed6",
    "service.category.interaction": "\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u30b5\u30fc\u30d3\u30b9",
    "service.category.software": "\u30bd\u30d5\u30c8\u30a6\u30a7\u30a2\u30b5\u30fc\u30d3\u30b9",
    "service.category.blockchain": "\u30d6\u30ed\u30c3\u30af\u30c1\u30a7\u30fc\u30f3",
    "service.category.other": "\u305d\u306e\u4ed6\u306e\u30b5\u30fc\u30d3\u30b9",
    "service.header.subtitle": "\u30cb\u30fc\u30ba\u306b\u5408\u308f\u305b\u3066\u4e26\u3079\u66ff\u3048\u3001\u6700\u9069\u306a\u30b5\u30fc\u30d3\u30b9\u3092\u3059\u3070\u3084\u304f\u9078\u629e\u3002",
    "service.defaultName": "\u30b5\u30fc\u30d3\u30b9",
    "service.filter.facebook": "Facebook\u30b5\u30fc\u30d3\u30b9",
    "service.filter.tiktok": "TikTok\u30b5\u30fc\u30d3\u30b9",
    "service.filter.google": "Google\u30b5\u30fc\u30d3\u30b9",
    "service.filter.telegram": "Telegram\u30b5\u30fc\u30d3\u30b9",
    "service.filter.shopee": "Shopee\u30b5\u30fc\u30d3\u30b9",
    "service.filter.discord": "Discord\u30b5\u30fc\u30d3\u30b9",
    "service.filter.twitter": "Twitter\u30b5\u30fc\u30d3\u30b9",
    "service.filter.youtube": "YouTube\u30b5\u30fc\u30d3\u30b9",
    "service.filter.zalo": "Zalo\u30b5\u30fc\u30d3\u30b9",
    "service.filter.instagram": "Instagram\u30b5\u30fc\u30d3\u30b9",
    "service.filter.otherInteraction": "\u305d\u306e\u4ed6\u306e\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u30b5\u30fc\u30d3\u30b9",
    "service.filter.codingTool": "\u958b\u767a\u30c4\u30fc\u30eb\u30b5\u30fc\u30d3\u30b9",
    "service.filter.design": "\u30c7\u30b6\u30a4\u30f3\u30b5\u30fc\u30d3\u30b9",
    "service.filter.video": "\u30d3\u30c7\u30aa\u30b5\u30fc\u30d3\u30b9",
    "service.filter.otherTool": "\u305d\u306e\u4ed6\u306e\u30c4\u30fc\u30eb\u30b5\u30fc\u30d3\u30b9",
    "service.type.facebook": "Facebook",
    "service.type.tiktok": "TikTok",
    "service.type.google": "Google",
    "service.type.telegram": "Telegram",
    "service.type.shopee": "Shopee",
    "service.type.discord": "Discord",
    "service.type.twitter": "Twitter",
    "service.type.youtube": "YouTube",
    "service.type.zalo": "Zalo",
    "service.type.instagram": "Instagram",
    "service.type.otherInteraction": "\u305d\u306e\u4ed6\u306e\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8",
    "service.type.codingTool": "\u958b\u767a",
    "service.type.design": "\u30c7\u30b6\u30a4\u30f3",
    "service.type.video": "\u30d3\u30c7\u30aa",
    "service.type.otherTool": "\u305d\u306e\u4ed6\u306e\u30c4\u30fc\u30eb",
    "seller.badge.verified": "\u8a8d\u8a3c\u6e08\u307f",
    "seller.badge.merchant": "\u30de\u30fc\u30c1\u30e3\u30f3\u30c8\u30e9\u30f3\u30af {tier}",
    "seller.badge.admin": "\u7ba1\u7406\u8005",
    "task.board.title": "\u30bf\u30b9\u30af\u63b2\u793a\u677f",
    "task.board.subtitle": "\u30e6\u30fc\u30b6\u30fc\u304c\u4f9d\u983c\u3092\u6295\u7a3f\u3057\u3001\u4ed6\u306e\u30e6\u30fc\u30b6\u30fc\u304c\u30bf\u30b9\u30af\u3092\u53d7\u3051\u3066\u76f4\u63a5\u9023\u7d61\u3067\u304d\u307e\u3059\u3002",
    "task.empty.title": "\u30bf\u30b9\u30af\u306e\u6295\u7a3f\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
    "task.empty.desc": "\u65b0\u898f\u4f5c\u6210\u3057\u3066\u3059\u3070\u3084\u304f\u30b5\u30dd\u30fc\u30c8\u3092\u53d7\u3051\u307e\u3057\u3087\u3046\u3002",
    "task.modal.title": "\u30bf\u30b9\u30af\u53d7\u3051\u53d6\u308a\u306e\u78ba\u8a8d",
    "task.modal.text": "\u3053\u306e\u30bf\u30b9\u30af\u3092\u53d7\u3051\u53d6\u308a\u307e\u3059\u304b\uff1f",
    "task.modal.cancel": "\u30ad\u30e3\u30f3\u30bb\u30eb",
    "task.modal.confirm": "\u78ba\u8a8d",
    "task.pagination.page": "\u30da\u30fc\u30b8 {current} / {total}",
    "task.pagination.prev": "\u524d\u3078",
    "task.pagination.next": "\u6b21\u3078",
    "task.status.paid": "\u652f\u6255\u3044\u6e08\u307f",
    "task.status.unpaid": "\u672a\u6255\u3044",
    "task.action.accept": "\u30bf\u30b9\u30af\u3092\u53d7\u3051\u308b",
    "task.action.accepted": "\u53d7\u3051\u53d6\u308a\u6e08\u307f",
    "task.action.complete": "\u5b8c\u4e86\u3057\u307e\u3057\u305f",
    "task.action.chat": "\u30e1\u30c3\u30bb\u30fc\u30b8",
    "task.action.submitProof": "\u8a3c\u62e0\u3092\u9001\u4fe1",
    "task.label.joined": "\u53c2\u52a0",
    "task.label.deposited": "\u5165\u91d1\u6e08\u307f",
    "task.label.quantity": "\u6570\u91cf",
    "task.label.status": "\u30b9\u30c6\u30fc\u30bf\u30b9",
    "task.label.expires": "\u671f\u9650",
    "task.label.budget": "\u4e88\u7b97",
    "task.label.proofImage": "\u30b9\u30af\u30ea\u30fc\u30f3\u30b7\u30e7\u30c3\u30c8 / \u8a3c\u62e0",
    "task.label.proofLink": "\u8ffd\u52a0\u30ea\u30f3\u30af\uff08\u4efb\u610f\uff09",
    "task.label.note": "\u8ffd\u52a0\u30e1\u30e2",
    "task.placeholder.proofLink": "https://...",
    "task.placeholder.note": "\u9001\u4ed8\u3057\u305f\u8a3c\u62e0\u3092\u7c21\u5358\u306b\u8aac\u660e\u3057\u3066\u304f\u3060\u3055\u3044...",
    "task.note.mock": "Note: \u30b8\u30e7\u30d6\u30aa\u30fc\u30ca\u30fc\u304c\u627f\u8a8d\u3059\u308b\u3068\u3001\u5831\u916c\u306f\u3042\u306a\u305f\u306e\u30a6\u30a9\u30ec\u30c3\u30c8\u306b\u5165\u308a\u307e\u3059\u3002",
    "task.toast.fullSlots": "\u53d7\u3051\u53d6\u308a\u67a0\u304c\u3042\u308a\u307e\u305b\u3093\u3002",
    "task.toast.accepted": "\u30bf\u30b9\u30af\u3092\u53d7\u3051\u53d6\u308a\u307e\u3057\u305f\u3002",
    "task.toast.proofRequired": "\u8a3c\u62e0\u3092\u6dfb\u4ed8\u3059\u308b\u304b\u30e1\u30e2\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    "task.toast.proofSubmitted": "\u8a3c\u62e0\u3092\u9001\u4fe1\u3057\u307e\u3057\u305f\u3002",
    "task.desc.empty": "\u8a73\u7d30\u306a\u8aac\u660e\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
    "task.title.default": "\u30bf\u30b9\u30af",
  },
  zh: {
    "nav.products": "\u4ea7\u54c1",
    "nav.services": "\u670d\u52a1",
    "nav.tasks": "\u4efb\u52a1",
    "nav.topups": "\u5145\u503c",
    "menu.overview": "\u8d26\u6237\u6982\u89c8",
    "menu.profile": "\u4e2a\u4eba\u9875\u9762",
    "menu.manageShop": "\u7ba1\u7406\u5e97\u94fa",
    "menu.manageTasks": "\u7ba1\u7406\u4efb\u52a1",
    "menu.orders": "\u8ba2\u5355",
    "menu.favorites": "\u6536\u85cf\u5939",
    "menu.history": "\u8d26\u6237\u5386\u53f2\u8bb0\u5f55",
    "menu.withdraw": "\u63d0\u6b3e",
    "menu.tasks": "\u4efb\u52a1",
    "menu.messages": "\u4fe1\u606f",
    "menu.notifications": "\u901a\u77e5",
    "menu.badges": "\u5fbd\u7ae0",
    "menu.security": "2FA \u5b89\u5168",
    "menu.logout": "\u9000\u51fa",
    "cta.login": "\u767b\u5f55",
    "cta.register": "\u6ce8\u518c",
    "auth.username.invalid": "\u7528\u6237\u540D\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57\uFF0C\u4E0D\u80FD\u6709\u7A7A\u683C\u6216\u91CD\u97F3\u7B26\u53F7\u3002",
    "media.imageOnly": "\u4EC5\u652F\u6301\u56FE\u7247\u3002",
    "media.imageTooLarge": "\u56FE\u7247\u8D85\u8FC7 2MB\u3002",
    "cta.joinSeller": "\u6210\u4e3a\u5356\u5bb6",
    "cta.manageShop": "\u7ba1\u7406\u5e97\u94fa",
    "cta.manageTasks": "\u7ba1\u7406\u4efb\u52a1",
    "currency.note": "\u6c47\u7387\u81ea\u52a8\u66f4\u65b0\u3002",
    "footer.about": "\u5173\u4e8e PolyFlux \u5546\u5e97",
    "footer.aboutDesc": "polyflux.xyz \u4e0a\u6392\u540d\u7b2c\u4e00\u7684\u503c\u5f97\u4fe1\u8d56\u7684\u6570\u5b57\u8d44\u4ea7\u5e02\u573a\u3002\u8d2d\u4e70\u5e10\u6237\u3001\u7535\u5b50\u90ae\u4ef6\u3001\u5de5\u5177\u7b49\uff0c\u5e76\u5373\u65f6\u4ea4\u4ed8\u3002",
    "footer.nav": "\u5bfc\u822a",
    "footer.products": "\u4ea7\u54c1",
    "footer.services": "\u670d\u52a1",
    "footer.tasksMarketplace": "\u4efb\u52a1\u5e02\u573a",
    "footer.account": "\u6211\u7684\u8d26\u6237",
    "footer.payments": "\u652f\u4ed8\u4e0e\u5b89\u5168",
    "footer.paymentDesc1": "20 \u591a\u79cd\u4ed8\u6b3e\u65b9\u5f0f\uff0c\u81ea\u52a8\u5904\u7406\u3002",
    "footer.paymentDesc2": "\u900f\u660e\u7684\u8ba2\u5355\u5386\u53f2\u8bb0\u5f55\u3002",
    "footer.paymentDesc3": "2FA \u548c\u53ef\u7591\u767b\u5f55\u8b66\u62a5\u3002",
    "footer.join": "\u5728 PolyFlux \u4e0a\u51fa\u552e",
    "footer.joinDesc": "\u60f3\u5728 polyflux.xyz \u4e0a\u5f00\u5e97\u5417\uff1f",
    "footer.joinBtn": "\u5728 PolyFlux \u4e0a\u51fa\u552e",
    "filter.title": "\u7b5b\u9009",
    "filter.descSubcategories": "\u9009\u62e9\u4e00\u4e2a\u6216\u591a\u4e2a\u5b50\u5206\u7c7b",
    "filter.descCategories": "\u9009\u62e9\u4e00\u4e2a\u6216\u591a\u4e2a\u5206\u7c7b",
    "filter.searchLabel": "\u641c\u7d22",
    "filter.searchPlaceholder.product": "\u8f93\u5165\u4ea7\u54c1\u540d\u79f0...",
    "filter.searchPlaceholder.service": "\u8f93\u5165\u670d\u52a1\u540d\u79f0...",
    "filter.apply": "\u641c\u7d22",
    "sort.popular": "\u70ed\u95e8",
    "sort.rating": "\u8bc4\u5206",
    "sort.newest": "\u6700\u65b0",
    "empty.noData": "\u6682\u65e0\u6570\u636e\uff0c\u8fde\u63a5 API \u540e\u663e\u793a\u3002",
    "empty.adjustFilters": "\u60a8\u53ef\u4ee5\u66f4\u6539\u7b5b\u9009\u6216\u7a0d\u540e\u518d\u8bd5\u3002",
    "empty.adjustCategory": "\u60a8\u53ef\u4ee5\u66f4\u6362\u5206\u7c7b\u6216\u5c1d\u8bd5\u5176\u4ed6\u641c\u7d22\u3002",
    "landing.featured.emptyTitle": "\u6682\u65e0\u7cbe\u9009\u5546\u54c1",
    "landing.featured.emptyDesc": "\u6682\u65e0\u6570\u636e\uff0c\u8fde\u63a5 API \u540e\u663e\u793a\u3002",
    "product.fallback.delivery": "\u6570\u5b57\u5546\u54c1\uff0c\u4ed8\u6b3e\u540e\u5373\u65f6\u4ea4\u4ed8\u3002",
    "product.fallback.safe": "\u5b89\u5168\u4ea4\u6613\uff0c\u6781\u901f\u4ea4\u4ed8\u3002",
    "product.fallback.stockLeft": "\u5269\u4f59{count}",
    "product.fallback.outOfStock": "\u7f3a\u8d27",
    "product.action.view": "\u67e5\u770b\u8be6\u60c5",
    "service.fallback.short": "\u7ed3\u8d26\u540e\u6309\u9700\u5904\u7406\u670d\u52a1\u3002",
    "service.fallback.eta": "\u65f6\u95f4\u7075\u6d3b",
    "task.fallback.short": "\u9762\u5411\u534f\u4f5c\u8005\u7684\u4efb\u52a1\u5e02\u573a\u3002",
    "task.status.open": "\u5f00\u653e\u4e2d",
    "label.stock": "\u5e93\u5b58",
    "label.sold": "\u5df2\u552e",
    "label.rating": "\u8bc4\u5206",
    "label.seller": "\u5356\u5bb6",
    "label.type": "\u7c7b\u578b",
    "product.category.email": "\u90ae\u7bb1",
    "product.category.tool": "\u8f6f\u4ef6",
    "product.category.account": "\u8d26\u53f7",
    "product.category.other": "\u5176\u4ed6",
    "product.header.subtitle": "\u6309\u9700\u6c42\u6392\u5e8f\uff0c\u5feb\u901f\u9009\u62e9\u5408\u9002\u7684\u4ea7\u54c1\u3002",
    "product.empty.noneInCategory": "\u6b64\u5206\u7c7b\u6682\u65e0\u4ea7\u54c1\u3002",
    "product.subcategory.domainEmail": "\u57df\u540d\u90ae\u7bb1",
    "product.subcategory.otherEmail": "\u5176\u4ed6\u90ae\u7bb1",
    "product.subcategory.toolFacebook": "Facebook \u8f6f\u4ef6",
    "product.subcategory.toolGoogle": "Google \u8f6f\u4ef6",
    "product.subcategory.toolYouTube": "YouTube \u8f6f\u4ef6",
    "product.subcategory.toolCrypto": "\u52a0\u5bc6\u8d27\u5e01\u8f6f\u4ef6",
    "product.subcategory.toolPTC": "PTC \u8f6f\u4ef6",
    "product.subcategory.toolCaptcha": "Captcha \u8f6f\u4ef6",
    "product.subcategory.toolOffer": "Offer \u8f6f\u4ef6",
    "product.subcategory.toolPTU": "PTU \u8f6f\u4ef6",
    "product.subcategory.toolOther": "\u5176\u4ed6\u8f6f\u4ef6",
    "product.subcategory.accFacebook": "Facebook \u8d26\u53f7",
    "product.subcategory.accBM": "Business Manager \u8d26\u53f7",
    "product.subcategory.accZalo": "Zalo \u8d26\u53f7",
    "product.subcategory.accTwitter": "Twitter \u8d26\u53f7",
    "product.subcategory.accTelegram": "Telegram \u8d26\u53f7",
    "product.subcategory.accInstagram": "Instagram \u8d26\u53f7",
    "product.subcategory.accShopee": "Shopee \u8d26\u53f7",
    "product.subcategory.accDiscord": "Discord \u8d26\u53f7",
    "product.subcategory.accTikTok": "TikTok \u8d26\u53f7",
    "product.subcategory.keyAntivirus": "\u6740\u6bd2\u8f6f\u4ef6\u5bc6\u94a5",
    "product.subcategory.accCapCut": "CapCut \u8d26\u53f7",
    "product.subcategory.keyWindows": "Windows \u5bc6\u94a5",
    "product.subcategory.accOther": "\u5176\u4ed6\u8d26\u53f7",
    "product.subcategory.giftCard": "\u793c\u54c1\u5361",
    "product.subcategory.vps": "VPS",
    "product.subcategory.other": "\u5176\u4ed6",
    "service.category.interaction": "\u4e92\u52a8\u670d\u52a1",
    "service.category.software": "\u8f6f\u4ef6\u670d\u52a1",
    "service.category.blockchain": "\u533a\u5757\u94fe",
    "service.category.other": "\u5176\u4ed6\u670d\u52a1",
    "service.header.subtitle": "\u6309\u9700\u6c42\u6392\u5e8f\uff0c\u5feb\u901f\u9009\u62e9\u5408\u9002\u7684\u670d\u52a1\u3002",
    "service.defaultName": "\u670d\u52a1",
    "service.filter.facebook": "Facebook \u670d\u52a1",
    "service.filter.tiktok": "TikTok \u670d\u52a1",
    "service.filter.google": "Google \u670d\u52a1",
    "service.filter.telegram": "Telegram \u670d\u52a1",
    "service.filter.shopee": "Shopee \u670d\u52a1",
    "service.filter.discord": "Discord \u670d\u52a1",
    "service.filter.twitter": "Twitter \u670d\u52a1",
    "service.filter.youtube": "YouTube \u670d\u52a1",
    "service.filter.zalo": "Zalo \u670d\u52a1",
    "service.filter.instagram": "Instagram \u670d\u52a1",
    "service.filter.otherInteraction": "\u5176\u4ed6\u4e92\u52a8\u670d\u52a1",
    "service.filter.codingTool": "\u5f00\u53d1\u5de5\u5177\u670d\u52a1",
    "service.filter.design": "\u8bbe\u8ba1\u670d\u52a1",
    "service.filter.video": "\u89c6\u9891\u670d\u52a1",
    "service.filter.otherTool": "\u5176\u4ed6\u5de5\u5177\u670d\u52a1",
    "service.type.facebook": "Facebook",
    "service.type.tiktok": "TikTok",
    "service.type.google": "Google",
    "service.type.telegram": "Telegram",
    "service.type.shopee": "Shopee",
    "service.type.discord": "Discord",
    "service.type.twitter": "Twitter",
    "service.type.youtube": "YouTube",
    "service.type.zalo": "Zalo",
    "service.type.instagram": "Instagram",
    "service.type.otherInteraction": "\u5176\u4ed6\u4e92\u52a8",
    "service.type.codingTool": "\u5f00\u53d1",
    "service.type.design": "\u8bbe\u8ba1",
    "service.type.video": "\u89c6\u9891",
    "service.type.otherTool": "\u5176\u4ed6\u5de5\u5177",
    "seller.badge.verified": "\u5df2\u8ba4\u8bc1",
    "seller.badge.merchant": "\u5546\u5bb6\u7b49\u7ea7 {tier}",
    "seller.badge.admin": "\u7ba1\u7406\u5458",
    "task.board.title": "\u4efb\u52a1\u770b\u677f",
    "task.board.subtitle": "\u7528\u6237\u53d1\u5e03\u9700\u6c42\uff0c\u5176\u4ed6\u4eba\u53ef\u63a5\u4efb\u52a1\u5e76\u76f4\u63a5\u8054\u7cfb\u3002",
    "task.empty.title": "\u6682\u65e0\u4efb\u52a1\u53d1\u5e03\u3002",
    "task.empty.desc": "\u521b\u5efa\u65b0\u4efb\u52a1\u4ee5\u5feb\u901f\u83b7\u5f97\u652f\u6301\u3002",
    "task.modal.title": "\u786e\u8ba4\u63a5\u4efb\u52a1",
    "task.modal.text": "\u786e\u5b9a\u63a5\u4e0b\u8fd9\u4e2a\u4efb\u52a1\u5417\uff1f",
    "task.modal.cancel": "\u53d6\u6d88",
    "task.modal.confirm": "\u786e\u8ba4",
    "task.pagination.page": "\u7b2c {current} / {total} \u9875",
    "task.pagination.prev": "\u4e0a\u4e00\u9875",
    "task.pagination.next": "\u4e0b\u4e00\u9875",
    "task.status.paid": "\u5df2\u652f\u4ed8",
    "task.status.unpaid": "\u672a\u652f\u4ed8",
    "task.action.accept": "\u63a5\u4efb\u52a1",
    "task.action.accepted": "\u5df2\u63a5",
    "task.action.complete": "\u6211\u5df2\u5b8c\u6210",
    "task.action.chat": "\u79c1\u4fe1",
    "task.action.submitProof": "\u63d0\u4ea4\u51ed\u8bc1",
    "task.label.joined": "\u52a0\u5165",
    "task.label.deposited": "\u5df2\u9884\u4ed8",
    "task.label.quantity": "\u6570\u91cf",
    "task.label.status": "\u72b6\u6001",
    "task.label.expires": "\u5230\u671f",
    "task.label.budget": "\u9884\u7b97",
    "task.label.proofImage": "\u622a\u56fe / \u51ed\u8bc1",
    "task.label.proofLink": "\u9644\u52a0\u94fe\u63a5\uff08\u53ef\u9009\uff09",
    "task.label.note": "\u8865\u5145\u8bf4\u660e",
    "task.placeholder.proofLink": "https://...",
    "task.placeholder.note": "\u7b80\u5355\u8bf4\u660e\u5df2\u63d0\u4ea4\u7684\u51ed\u8bc1...",
    "task.note.mock": "Note: \u4efb\u52a1\u53d1\u5e03\u8005\u5ba1\u6838\u540e\uff0c\u8d44\u91d1\u5c06\u8fdb\u5165\u4f60\u7684\u94b1\u5305\u3002",
    "task.toast.fullSlots": "\u540d\u989d\u5df2\u6ee1\u3002",
    "task.toast.accepted": "\u4efb\u52a1\u63a5\u53d6\u6210\u529f\u3002",
    "task.toast.proofRequired": "\u8bf7\u9644\u4e0a\u51ed\u8bc1\u6216\u8865\u5145\u8bf4\u660e\u3002",
    "task.toast.proofSubmitted": "\u51ed\u8bc1\u5df2\u63d0\u4ea4\u3002",
    "task.desc.empty": "\u6682\u65e0\u8be6\u7ec6\u63cf\u8ff0\u3002",
    "task.title.default": "\u4efb\u52a1",
  },
};

const BK_I18N_EXT = {
  vi: {
    "landing.hero.subtitle": "Ná»n táº£ng giao dá»‹ch uy tÃ­n vÃ  nhanh chÃ³ng.",
    "landing.hero.buy": "Mua hÃ ng ngay",
    "landing.hero.explore": "KhÃ¡m phÃ¡ thÃªm",
    "landing.pill.email": "Email",
    "landing.pill.account": "TÃ i khoáº£n",
    "landing.pill.software": "Pháº§n má»m",
    "landing.pill.interaction": "Dá»‹ch vá»¥ tÆ°Æ¡ng tÃ¡c",
    "landing.pill.tools": "CÃ´ng cá»¥",
    "landing.pill.other": "KhÃ¡c",
    "landing.faq.title": "CÃ¢u há»i thÆ°á»ng gáº·p",
    "landing.faq.subtitle": "TÃ¬m cÃ¢u tráº£ lá»i cho cÃ¡c tháº¯c máº¯c thÆ°á»ng gáº·p vá» polyflux.xyz",
    "landing.faq.q1": "LÃ m tháº¿ nÃ o Ä‘á»ƒ xem Ä‘Æ¡n hÃ ng cá»§a tÃ´i?",
    "landing.faq.a1": "CÃ¡c sáº£n pháº©m Ä‘Ã£ mua sáº½ hiá»ƒn thá»‹ trong lá»‹ch sá»­ mua hÃ ng cá»§a báº¡n.",
    "landing.faq.q2": "ÄÃ¢y cÃ³ pháº£i lá»«a Ä‘áº£o khÃ´ng?",
    "landing.faq.a2": "ChÃºng tÃ´i dÃ¹ng thanh toÃ¡n Ä‘Ã£ xÃ¡c minh, Ä‘Ã¡nh giÃ¡ cÃ´ng khai vÃ  chÃ­nh sÃ¡ch hoÃ n tiá»n Ä‘á»ƒ báº£o vá»‡ báº¡n.",
    "landing.faq.q3": "TÃ´i cÃ³ cÃ¢u há»i, liÃªn há»‡ tháº¿ nÃ o?",
    "landing.faq.a3": "Nháº¯n tin cho admin qua Telegram.",
    "landing.payments.title": "20+ phÆ°Æ¡ng thá»©c thanh toÃ¡n",
    "landing.payments.subtitle": "ChÃºng tÃ´i há»— trá»£ nhiá»u phÆ°Æ¡ng thá»©c thanh toÃ¡n Ä‘á»ƒ thanh toÃ¡n nhanh vÃ  an toÃ n.",
    "landing.trusted.title": "SÃ n giao dá»‹ch Ä‘Ã¡ng tin cáº­y nháº¥t.",
    "landing.trusted.subtitle": "Xem lÃ½ do khÃ¡ch hÃ ng chá»n chÃºng tÃ´i",
    "landing.stats.orders": "Tá»•ng Ä‘Æ¡n hÃ ng",
    "landing.stats.vouches": "ÄÃ¡nh giÃ¡ Ä‘Ã£ xÃ¡c minh",
    "landing.stats.instantValue": "Tá»©c thÃ¬",
    "landing.stats.deliveryLabel": "Giao hÃ ng cho má»i sáº£n pháº©m",
    "landing.products.emptyTitle": "KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m",
    "landing.products.emptyDesc": "HÃ£y thá»­ Ä‘iá»u chá»‰nh tÃ¬m kiáº¿m hoáº·c bá»™ lá»c danh má»¥c.",
    "landing.products.instant": "Giao ngay vÃ  thanh toÃ¡n an toÃ n.",
    "landing.products.add": "ThÃªm",
    "landing.product.email": "Email {index}",
    "landing.product.account": "TÃ i khoáº£n {tier}",
    "landing.product.software": "Pháº§n má»m {tier}",
    "landing.product.interaction": "GÃ³i tÆ°Æ¡ng tÃ¡c {index}",
    "landing.product.other": "Máº·t hÃ ng khÃ¡c {index}",
    "landing.tier.basic": "CÆ¡ báº£n",
    "landing.tier.pro": "Pro",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "Lite",
    "landing.tier.plus": "Plus",
    "support.label": "Há»— trá»£",
    "support.close": "ÄÃ³ng",
    "support.header.title": "Há»— trá»£ PolyFlux",
    "support.header.status": "Äang trá»±c tuyáº¿n",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "Chat vá»›i Admin",
    "support.faq.title": "FAQ - CÃ‚U Há»ŽI THÆ¯á»œNG Gáº¶P",
    "support.faq.buyer.title": "I. NGÆ¯á»œI MUA",
    "support.faq.buyer.q1": "LÃ m tháº¿ nÃ o Ä‘á»ƒ mua sáº£n pháº©m?",
    "support.faq.buyer.a1.1": "NgÆ°á»i mua cÃ³ thá»ƒ thanh toÃ¡n báº±ng Crypto hoáº·c chuyá»ƒn khoáº£n ngÃ¢n hÃ ng.",
    "support.faq.buyer.a1.2": "Vá»›i Crypto: náº¡p vÃ o vÃ­ cÃ¡ nhÃ¢n Ä‘Æ°á»£c chá»‰ Ä‘á»‹nh; sau khi giao dá»‹ch on-chain Ä‘Æ°á»£c xÃ¡c nháº­n, sá»‘ dÆ° sáº½ tá»± Ä‘á»™ng cáº­p nháº­t.",
    "support.faq.buyer.a1.3": "Vá»›i NgÃ¢n hÃ ng: chuyá»ƒn khoáº£n theo thÃ´ng tin Ä‘Æ°á»£c cung cáº¥p; há»‡ thá»‘ng sáº½ Ä‘á»‘i soÃ¡t vÃ  cáº­p nháº­t sá»‘ dÆ° sau khi xÃ¡c nháº­n thanh toÃ¡n.",
    "support.faq.buyer.q2": "Email/tÃ i khoáº£n khÃ´ng trÃ¹ng láº·p lÃ  gÃ¬?",
    "support.faq.buyer.a2": "Há»‡ thá»‘ng Ä‘áº£m báº£o sáº£n pháº©m chÆ°a tá»«ng Ä‘Æ°á»£c bÃ¡n trÆ°á»›c Ä‘Ã³, sá»­ dá»¥ng kiá»ƒm tra trÃ¹ng láº·p vÃ  huy hiá»‡u Zero Duplicate.",
    "support.faq.buyer.q3": "LÃ m tháº¿ nÃ o Ä‘á»ƒ náº¡p tiá»n?",
    "support.faq.buyer.a3.1": "Crypto: Chá»n Náº¡p tiá»n -> chá»n loáº¡i tiá»n Ä‘iá»‡n tá»­ -> gá»­i Ä‘áº¿n vÃ­ cÃ¡ nhÃ¢n cá»§a báº¡n. Há»— trá»£ USDT, USDC, BTC, ETH, BNB, TRX, v.v.",
    "support.faq.buyer.a3.2": "NgÃ¢n hÃ ng: Chá»n Náº¡p tiá»n -> Chuyá»ƒn khoáº£n ngÃ¢n hÃ ng -> chuyá»ƒn Ä‘Ãºng ná»™i dung/mÃ£ giao dá»‹ch Ä‘á»ƒ há»‡ thá»‘ng tá»± Ä‘á»™ng xÃ¡c nháº­n.",
    "support.faq.buyer.q4": "TÃ´i cÃ³ thá»ƒ yÃªu cáº§u hoÃ n tiá»n khÃ´ng?",
    "support.faq.buyer.a4": "CÃ³. Má»—i Ä‘Æ¡n hÃ ng Ä‘Æ°á»£c báº£o vá»‡ bá»Ÿi thá»i gian escrow 3 ngÃ y Ä‘á»ƒ khiáº¿u náº¡i hoáº·c má»Ÿ tranh cháº¥p.",
    "support.faq.buyer.q5": "Tiá»n náº¡p cá»§a tÃ´i chÆ°a Ä‘áº¿n?",
    "support.faq.buyer.a5.1": "Crypto: cÃ³ thá»ƒ do sai chain, sai token, hoáº·c blockchain Ä‘ang táº¯c ngháº½n. Náº¿u váº«n chÆ°a cáº­p nháº­t sau vÃ i phÃºt, vui lÃ²ng gá»­i TXID Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£.",
    "support.faq.buyer.a5.2": "NgÃ¢n hÃ ng: cÃ³ thá»ƒ do chuyá»ƒn ngoÃ i giá», sai ná»™i dung hoáº·c Ä‘ang chá» Ä‘á»‘i soÃ¡t. LiÃªn há»‡ há»— trá»£ kÃ¨m áº£nh giao dá»‹ch.",
    "support.faq.buyer.q6": "Náº¿u tÃ´i gá»­i sai thÃ¬ sao?",
    "support.faq.buyer.a6.1": "Crypto: giao dá»‹ch blockchain khÃ´ng thá»ƒ Ä‘áº£o ngÆ°á»£c; gá»­i sai chain hoáº·c sai Ä‘á»‹a chá»‰ thÆ°á»ng dáº«n Ä‘áº¿n máº¥t vÄ©nh viá»…n.",
    "support.faq.buyer.a6.2": "NgÃ¢n hÃ ng: há»‡ thá»‘ng chá»‰ há»— trá»£ kiá»ƒm tra Ä‘á»‘i soÃ¡t; khÃ´ng Ä‘áº£m báº£o hoÃ n tiá»n náº¿u chuyá»ƒn sai thÃ´ng tin.",
    "support.faq.buyer.q7": "TÃ´i cÃ³ cáº§n ngÆ°á»i trung gian khÃ´ng?",
    "support.faq.buyer.a7": "KhÃ´ng. Há»‡ thá»‘ng hoáº¡t Ä‘á»™ng nhÆ° escrow tÃ­ch há»£p, tá»± Ä‘á»™ng giá»¯ tiá»n trong 3 ngÃ y trÆ°á»›c khi giáº£i ngÃ¢n cho ngÆ°á»i bÃ¡n.",
    "support.faq.seller.title": "II. NGÆ¯á»œI BÃN (SELLER)",
    "support.faq.seller.q1": "LÃ m tháº¿ nÃ o Ä‘á»ƒ Ä‘Äƒng kÃ½ lÃ m ngÆ°á»i bÃ¡n?",
    "support.faq.seller.a1": "ÄÄƒng nháº­p -> ÄÄƒng kÃ½ lÃ m Seller -> Ä‘iá»n thÃ´ng tin cáº§n thiáº¿t -> chá» phÃª duyá»‡t.",
    "support.faq.seller.q2": "LÃ m tháº¿ nÃ o Ä‘á»ƒ táº¡o cá»­a hÃ ng?",
    "support.faq.seller.a2": "VÃ o Quáº£n lÃ½ cá»­a hÃ ng -> Táº¡o má»›i -> táº£i lÃªn mÃ´ táº£ sáº£n pháº©m, hÃ¬nh áº£nh vÃ  tá»‡p.",
    "support.faq.seller.q3": "LÃ m tháº¿ nÃ o Ä‘á»ƒ tá»‘i Æ°u cá»­a hÃ ng?",
    "support.faq.seller.a3": "Sá»­ dá»¥ng hÃ¬nh áº£nh cháº¥t lÆ°á»£ng cao, tiÃªu Ä‘á» rÃµ rÃ ng, mÃ´ táº£ chi tiáº¿t, sáº£n pháº©m á»•n Ä‘á»‹nh vÃ  há»— trá»£ nhanh. Xáº¿p háº¡ng Ä‘Æ°á»£c cáº­p nháº­t hÃ ng tuáº§n.",
    "support.faq.seller.q4": "LÃ m tháº¿ nÃ o Ä‘á»ƒ lÃªn top listing?",
    "support.faq.seller.a4": "Phá»¥ thuá»™c vÃ o doanh sá»‘, Ä‘Ã¡nh giÃ¡ khÃ¡ch hÃ ng, Ä‘á»™ tin cáº­y vÃ  tá»· lá»‡ tranh cháº¥p.",
    "support.faq.seller.q5": "Thu nháº­p Ä‘Æ°á»£c xá»­ lÃ½ nhÆ° tháº¿ nÃ o?",
    "support.faq.seller.a5.1": "Sau khi Ä‘Æ¡n hÃ ng hoÃ n táº¥t, tiá»n sáº½ á»Ÿ tráº¡ng thÃ¡i Pending trong 3 ngÃ y (escrow). Háº¿t thá»i gian nÃ y, ngÆ°á»i bÃ¡n cÃ³ thá»ƒ rÃºt tiá»n qua:",
    "support.faq.seller.a5.list1": "Crypto: USDT, BTC, ETH, BNB, TRX, v.v.",
    "support.faq.seller.a5.list2": "Chuyá»ƒn khoáº£n ngÃ¢n hÃ ng (theo thÃ´ng tin Ä‘Ã£ xÃ¡c minh).",
    "support.faq.seller.q6": "Hoa há»“ng Ä‘Æ°á»£c tÃ­nh nhÆ° tháº¿ nÃ o?",
    "support.faq.seller.a6": "Ná»n táº£ng Ã¡p dá»¥ng phÃ­ giao dá»‹ch 5% trÃªn má»—i Ä‘Æ¡n hÃ ng thÃ nh cÃ´ng. NgÆ°á»i bÃ¡n cÃ³ thá»ƒ báº­t cháº¿ Ä‘á»™ Reseller Ä‘á»ƒ tÄƒng doanh sá»‘.",
    "support.faq.seller.q7": "LÃ m tháº¿ nÃ o Ä‘á»ƒ rÃºt tiá»n?",
    "support.faq.seller.a7": "Chá»n RÃºt tiá»n -> chá»n Crypto hoáº·c NgÃ¢n hÃ ng -> nháº­p thÃ´ng tin -> xÃ¡c nháº­n.",
    "support.faq.seller.q8": "NghÄ©a vá»¥ thuáº¿ cá»§a ngÆ°á»i bÃ¡n Ä‘Æ°á»£c xá»­ lÃ½ ra sao?",
    "support.faq.seller.a8.1": "Ná»n táº£ng chá»‰ Ä‘Ã³ng vai trÃ² trung gian cung cáº¥p háº¡ táº§ng giao dá»‹ch.",
    "support.faq.seller.a8.2": "NgÆ°á»i bÃ¡n tá»± chá»‹u trÃ¡ch nhiá»‡m kÃª khai vÃ  thá»±c hiá»‡n nghÄ©a vá»¥ thuáº¿ phÃ¡t sinh tá»« thu nháº­p cá»§a mÃ¬nh theo quy Ä‘á»‹nh phÃ¡p luáº­t Viá»‡t Nam.",
    "support.faq.seller.a8.3": "Ná»n táº£ng khÃ´ng kháº¥u trá»«, khÃ´ng Ä‘áº¡i diá»‡n vÃ  khÃ´ng thay máº·t ngÆ°á»i bÃ¡n thá»±c hiá»‡n nghÄ©a vá»¥ thuáº¿.",
    "support.faq.seller.q9": "CÃ¡c máº·t hÃ ng bá»‹ cáº¥m?",
    "support.faq.seller.a9": "TÃ i khoáº£n bá»‹ hack, dá»¯ liá»‡u báº¥t há»£p phÃ¡p, tÃ i khoáº£n ngÃ¢n hÃ ng, cÃ´ng cá»¥ gÃ¢y háº¡i, hoáº·c báº¥t ká»³ ná»™i dung nÃ o vi pháº¡m phÃ¡p luáº­t Viá»‡t Nam hay Ä‘iá»u khoáº£n cá»§a bÃªn thá»© ba.",
    "support.faq.seller.q10": "Giao dá»‹ch cá»§a ngÆ°á»i dÃ¹ng cÃ³ liÃªn quan Ä‘áº¿n admin khÃ´ng?",
    "support.faq.seller.a10.1": "CÃ¡c máº·t hÃ ng ngÆ°á»i dÃ¹ng Ä‘Äƒng bÃ¡n hoáº·c Ä‘Äƒng nhiá»‡m vá»¥ lÃ  giao dá»‹ch giá»¯a ngÆ°á»i dÃ¹ng vá»›i nhau, khÃ´ng liÃªn quan Ä‘áº¿n admin.",
    "support.faq.seller.a10.2": "Admin khÃ´ng mua bÃ¡n hÃ ng hÃ³a pháº¡m phÃ¡p. Náº¿u cÃ³ giao dá»‹ch trÃ¡i phÃ©p hoáº·c cá»‘ tÃ¬nh vi pháº¡m, admin cÃ³ quyá»n xÃ³a ná»™i dung vÃ  Ä‘Ã³ng bÄƒng sá»‘ dÆ°. Viá»‡c tham gia bÃ¡n hÃ ng Ä‘á»“ng nghÄ©a báº¡n Ä‘Ã£ Ä‘á»c vÃ  cháº¥p nháº­n Ä‘iá»u khoáº£n.",
    "support.faq.seller.q11": "TÃ­ch há»£p API?",
    "support.faq.seller.a11": "CÃ³. NgÆ°á»i bÃ¡n cÃ³ thá»ƒ tÃ­ch há»£p API Ä‘á»ƒ tá»± Ä‘á»™ng giao hÃ ng vÃ  Ä‘á»“ng bá»™ kho.",
    "support.faq.seller.q12": "LÃ m tháº¿ nÃ o Ä‘á»ƒ xá»­ lÃ½ báº£o hÃ nh?",
    "support.faq.seller.a12": "VÃ o ÄÆ¡n hÃ ng Ä‘Ã£ bÃ¡n -> Báº£o hÃ nh -> nháº­p sá»‘ lÆ°á»£ng -> há»‡ thá»‘ng tá»± Ä‘á»™ng gá»­i mÃ£ thay tháº¿ cho khÃ¡ch hÃ ng.",
    "support.faq.reseller.title": "III. RESELLER",
    "support.faq.reseller.q1": "LÃ m tháº¿ nÃ o Ä‘á»ƒ trá»Ÿ thÃ nh reseller?",
    "support.faq.reseller.a1": "Báº­t cháº¿ Ä‘á»™ Reseller trong cÃ i Ä‘áº·t tÃ i khoáº£n.",
    "support.faq.reseller.q2": "LÃ m tháº¿ nÃ o Ä‘á»ƒ bÃ¡n vá»›i tÆ° cÃ¡ch reseller?",
    "support.faq.reseller.a2": "Chá»n sáº£n pháº©m Ä‘á»§ Ä‘iá»u kiá»‡n -> láº¥y link giá»›i thiá»‡u -> chia sáº» -> há»‡ thá»‘ng tá»± Ä‘á»™ng ghi nháº­n hoa há»“ng.",
    "support.faq.reseller.q3": "RÃºt hoa há»“ng?",
    "support.faq.reseller.a3": "Hoa há»“ng Ä‘Æ°á»£c giá»¯ 3 ngÃ y (escrow) trÆ°á»›c khi rÃºt qua Crypto hoáº·c NgÃ¢n hÃ ng.",
    "support.faq.reseller.q4": "ThÆ°á»Ÿng hÃ ng thÃ¡ng?",
    "support.faq.reseller.a4": "CÃ³. Ná»n táº£ng Ã¡p dá»¥ng chÆ°Æ¡ng trÃ¬nh thÆ°á»Ÿng dá»±a trÃªn hiá»‡u suáº¥t hÃ ng thÃ¡ng.",
    "support.faq.compliance.title": "IV. TUÃ‚N THá»¦ PHÃP LUáº¬T VIá»†T NAM - AML & FRAUD",
    "support.faq.compliance.q1": "Chá»‘ng rá»­a tiá»n (AML)",
    "support.faq.compliance.a1.lead": "NghiÃªm cáº¥m:",
    "support.faq.compliance.a1.list1": "LÆ°u thÃ´ng tÃ i sáº£n báº¥t há»£p phÃ¡p",
    "support.faq.compliance.a1.list2": "Che giáº¥u nguá»“n gá»‘c quá»¹",
    "support.faq.compliance.a1.list3": "Giao dá»‹ch báº¥t thÆ°á»ng cÃ³ dáº¥u hiá»‡u rá»­a tiá»n",
    "support.faq.compliance.a1.note": "Ná»n táº£ng cÃ³ quyá»n giá»¯ tiá»n, khÃ³a tÃ i khoáº£n, yÃªu cáº§u xÃ¡c minh danh tÃ­nh vÃ  há»£p tÃ¡c vá»›i cÆ¡ quan chá»©c nÄƒng khi cáº§n thiáº¿t.",
    "support.faq.compliance.q2": "PhÃ²ng chá»‘ng gian láº­n (Fraud)",
    "support.faq.compliance.a2.lead": "NghiÃªm cáº¥m:",
    "support.faq.compliance.a2.list1": "ÄÆ¡n hÃ ng giáº£",
    "support.faq.compliance.a2.list2": "Láº¡m dá»¥ng tranh cháº¥p",
    "support.faq.compliance.a2.list3": "Äa tÃ i khoáº£n",
    "support.faq.compliance.a2.list4": "Bot, hack, khai thÃ¡c lá»—i há»‡ thá»‘ng",
    "support.faq.compliance.q3": "TuÃ¢n thá»§ phÃ¡p luáº­t Viá»‡t Nam",
    "support.faq.compliance.a3": "NgÆ°á»i dÃ¹ng khÃ´ng Ä‘Æ°á»£c mua bÃ¡n cÃ¡c máº·t hÃ ng báº¥t há»£p phÃ¡p, xÃ¢m pháº¡m quyá»n riÃªng tÆ° hoáº·c dá»¯ liá»‡u cÃ¡ nhÃ¢n trÃ¡i phÃ©p.",
    "profile.overview.pageTitle": "Tá»•ng quan tÃ i khoáº£n | polyflux.xyz",
    "profile.overview.title": "Tá»•ng quan tÃ i khoáº£n",
    "profile.overview.subtitle": "Theo dÃµi sá»‘ dÆ°, Ä‘Æ¡n hÃ ng, báº£o máº­t trong má»™t nÆ¡i.",
    "profile.overview.quickInfoTitle": "ThÃ´ng tin nhanh",
    "profile.overview.quickInfoDesc": "sá»‘ dÆ°, tá»•ng Ä‘Æ¡n, cáº¥p Ä‘á»™ tÃ i khoáº£n...",
    "profile.overview.table.labelItem": "Háº¡ng má»¥c",
    "profile.overview.table.labelValue": "GiÃ¡ trá»‹",
    "profile.overview.table.labelStatus": "Tráº¡ng thÃ¡i",
    "profile.overview.table.balanceLabel": "Sá»‘ dÆ° kháº£ dá»¥ng",
    "profile.overview.table.balanceStatus": "ChÆ°a náº¡p",
    "profile.overview.table.ordersLabel": "Tá»•ng Ä‘Æ¡n hÃ ng",
    "profile.overview.table.ordersStatus": "HoÃ n thÃ nh",
    "profile.overview.quickLinks.title": "Äiá»u hÆ°á»›ng nhanh",
    "profile.overview.quickLinks.profile": "Trang cÃ¡ nhÃ¢n",
    "profile.overview.quickLinks.orders": "ÄÆ¡n hÃ ng",
    "profile.overview.quickLinks.topups": "Náº¡p tiá»n",
    "profile.overview.quickLinks.logins": "Nháº­t kÃ½ Ä‘Äƒng nháº­p",
    "profile.overview.quickLinks.security": "Báº£o máº­t & 2FA",
    "profile.public.pageTitle": "Trang c\u00e1 nh\u00e2n | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "Tham gia",
    "profile.public.badgeLabel": "Danh hi\u1ec7u",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "Sao ch\u00e9p li\u00ean k\u1ebft",
    "profile.public.copySuccess": "\u0110\u00e3 sao ch\u00e9p li\u00ean k\u1ebft.",
    "profile.public.copyFail": "Kh\u00f4ng th\u1ec3 sao ch\u00e9p li\u00ean k\u1ebft.",
    "profile.public.follow": "Theo d\u00f5i",
    "profile.public.following": "\u0110ang theo d\u00f5i",
    "profile.public.followersLabel": "Ng\u01b0\u1eddi theo d\u00f5i",
    "profile.public.followingLabel": "\u0110ang theo d\u00f5i",
    "profile.public.stats.purchased": "\u0110\u00e3 mua",
    "profile.public.stats.sold": "\u0110\u00e3 b\u00e1n",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "Xem gian h\u00e0ng",
    "profile.public.featured.title": "Tin \u0111\u00e1ng ch\u00fa \u00fd",
    "profile.public.featured.manage": "Ch\u1ec9nh s\u1eeda ph\u1ea7n \u0110\u00e1ng ch\u00fa \u00fd",
    "profile.public.featured.note": "Tin \u0111\u00e1ng ch\u00fa \u00fd t\u1ef1 \u0111\u1ed9ng xo\u00e1 sau 30 ng\u00e0y.",
    "profile.public.featured.emptyTitle": "Ng\u01b0\u1eddi d\u00f9ng n\u00e0y ch\u01b0a \u0111\u0103ng m\u1ee5c \u0111\u00e1ng ch\u00fa \u00fd.",
    "profile.public.featured.emptyDesc": "Tin m\u1edbi s\u1ebd t\u1ef1 \u0111\u1ed9ng \u1ea9n sau 30 ng\u00e0y.",
    "profile.public.story.defaultTitle": "Tin #{index}",
    "profile.public.story.type.video": "Video",
    "profile.public.story.type.image": "\u1ea2nh",
    "profile.public.story.titleFallback": "Tin \u0111\u00e1ng ch\u00fa \u00fd",
    "profile.public.story.alt": "Tin \u0111\u0103ng",
    "profile.public.manage.title": "Qu\u1ea3n l\u00fd trang c\u00e1 nh\u00e2n",
    "profile.public.manage.titlePlaceholder": "Ti\u00eau \u0111\u1ec1 tin",
    "profile.public.manage.upload": "T\u1ea3i l\u00ean",
    "profile.public.manage.remove": "G\u1ee1 b\u1ecf",
    "profile.public.manage.help": "\u1ea2nh s\u1ebd t\u1ef1 c\u1eaft 9:16, t\u1ed1i \u0111a 2MB. Video t\u1ed1i \u0111a 60 gi\u00e2y v\u00e0 ch\u1ec9 admin \u0111\u01b0\u1ee3c \u0111\u0103ng.",
    "profile.public.manage.close": "\u0110\u00f3ng",
    "profile.public.manage.save": "L\u01b0u thay \u0111\u1ed5i",
    "profile.public.manage.slotLabel": "\u00d4 {index}",
    "profile.public.manage.limit.pro": "T\u1ed1i \u0111a 4 tin, h\u1ed7 tr\u1ee3 video.",
    "profile.public.manage.limit.basic": "Ch\u01b0a \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n, ch\u1ec9 \u0111\u0103ng \u0111\u01b0\u1ee3c 1 \u1ea3nh.",
    "profile.public.toast.saveFail": "Kh\u00f4ng th\u1ec3 l\u01b0u tin \u0111\u00e1ng ch\u00fa \u00fd.",
    "profile.public.toast.loginRequired": "Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 theo d\u00f5i.",
    "profile.public.toast.imageOrVideoOnly": "Ch\u1ec9 h\u1ed7 tr\u1ee3 \u1ea3nh ho\u1eb7c video.",
    "profile.public.toast.notEligible": "B\u1ea1n ch\u01b0a \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n \u0111\u0103ng video ho\u1eb7c nhi\u1ec1u tin.",
    "profile.public.toast.uploadFail": "T\u1ea3i l\u00ean th\u1ea5t b\u1ea1i.",
    "profile.public.toast.imageTooLarge": "\u1ea2nh v\u01b0\u1ee3t qu\u00e1 2MB.",
    "profile.public.toast.imageRatio": "\u1ea2nh c\u1ea7n \u0111\u00fang t\u1ec9 l\u1ec7 9:16.",
    "profile.public.toast.imageReadFail": "Kh\u00f4ng th\u1ec3 \u0111\u1ecdc \u1ea3nh.",
    "profile.public.toast.videoNotEligible": "Video ch\u1ec9 d\u00e0nh cho t\u00e0i kho\u1ea3n \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n.",
    "profile.public.toast.videoTooLarge": "Video v\u01b0\u1ee3t qu\u00e1 25MB.",
    "profile.public.toast.videoRatio": "Video c\u1ea7n \u0111\u00fang t\u1ec9 l\u1ec7 9:16.",
    "profile.public.toast.videoDuration": "Video v\u01b0\u1ee3t qu\u00e1 60 gi\u00e2y.",
    "profile.public.toast.videoReadFail": "Kh\u00f4ng th\u1ec3 \u0111\u1ecdc video.",
    "profile.public.toast.coverReadFail": "Kh\u00f4ng th\u1ec3 \u0111\u1ecdc \u1ea3nh b\u00eca.",
    "product.detail.pageTitle": "Chi tiáº¿t sáº£n pháº©m | polyflux.xyz",
    "breadcrumb.home": "Trang chá»§",
    "breadcrumb.detail": "Chi tiáº¿t",
    "product.detail.share": "Chia sáº»",
    "product.detail.share.copied": "ÄÃ£ sao chÃ©p",
    "product.detail.share.failed": "KhÃ´ng thá»ƒ sao chÃ©p",
    "product.detail.favorite": "YÃªu thÃ­ch",
    "product.detail.favorite.active": "ÄÃ£ yÃªu thÃ­ch",
    "product.detail.otherTitle": "Máº·t hÃ ng khÃ¡c tá»« gian hÃ ng",
    "product.detail.other.empty": "ChÆ°a cÃ³ máº·t hÃ ng khÃ¡c.",
    "product.detail.order": "Äáº·t hÃ ng",
    "product.detail.preorder": "Äáº·t trÆ°á»›c",
    "product.detail.message": "Nháº¯n tin",
    "product.detail.tab.shop": "MÃ´ táº£ gian hÃ ng",
    "product.detail.tab.reviews": "ÄÃ¡nh giÃ¡",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "XÃ¡c nháº­n Ä‘áº·t hÃ ng",
    "product.detail.modal.quantity": "Sá»‘ lÆ°á»£ng",
    "product.detail.modal.subtotal": "Táº¡m tÃ­nh",
    "product.detail.modal.cancel": "Há»§y",
    "product.detail.modal.confirm": "XÃ¡c nháº­n Ä‘áº·t hÃ ng",
    "product.detail.modal.processing": "Äang xá»­ lÃ½...",
    "product.detail.modal.max": "Tá»‘i Ä‘a {max}",
    "product.detail.toast.success": "Äáº·t hÃ ng thÃ nh cÃ´ng. Kiá»ƒm tra trong Ä‘Æ¡n hÃ ng cá»§a báº¡n.",
    "product.detail.toast.viewOrders": "Xem Ä‘Æ¡n hÃ ng",
    "product.detail.toast.loginRequired": "Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ Ä‘áº·t hÃ ng.",
    "product.detail.toast.orderFailed": "Äáº·t hÃ ng tháº¥t báº¡i.",
    "product.detail.notFound": "KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m",
    "product.detail.description.pending": "MÃ´ táº£ Ä‘ang cáº­p nháº­t.",
    "product.detail.rating.positive": "TÃ­ch cá»±c",
    "product.detail.rating.neutral": "BÃ¬nh thÆ°á»ng",
    "product.detail.rating.negative": "Cáº§n cáº£i thiá»‡n",
    "product.detail.rating.none": "ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡",
    "product.detail.shopIdLabel": "Gian hÃ ng ID",
    "product.detail.shop.polyflux.title": "PolyFlux Official",
    "product.detail.shop.polyflux.bullet1": "Giao nhanh, kiá»ƒm tra trÆ°á»›c khi bÃ n giao.",
    "product.detail.shop.polyflux.bullet2": "HoÃ n tiá»n náº¿u lá»—i khÃ´ng kháº¯c phá»¥c Ä‘Æ°á»£c.",
    "product.detail.shop.polyflux.bullet3": "Há»— trá»£ 24/7 qua Telegram.",
    "product.detail.shop.partner.title": "Äá»‘i tÃ¡c Marketplace #1",
    "product.detail.shop.partner.bullet1": "Kho á»•n Ä‘á»‹nh, giao nhanh trong vÃ i phÃºt.",
    "product.detail.shop.partner.bullet2": "Cam káº¿t giÃ¡ tá»‘t cho Ä‘Æ¡n hÃ ng sá»‘ lÆ°á»£ng lá»›n.",
    "product.detail.shop.partner.bullet3": "Há»— trá»£ báº£o hÃ nh theo chÃ­nh sÃ¡ch niÃªm yáº¿t.",
    "product.detail.shop.fallbackTitle": "Gian hÃ ng uy tÃ­n",
    "product.detail.shop.fallbackBullet1": "Kiá»ƒm tra sáº£n pháº©m ngay sau khi nháº­n.",
    "product.detail.shop.fallbackBullet2": "Há»— trá»£ khi cÃ³ váº¥n Ä‘á» phÃ¡t sinh.",
    "product.detail.review.1.text": "Giao hÃ ng nhanh, tÃ i khoáº£n hoáº¡t Ä‘á»™ng tá»‘t.",
    "product.detail.review.1.time": "2 giá» trÆ°á»›c",
    "product.detail.review.2.text": "Shop há»— trá»£ nhanh, cÃ³ báº£o hÃ nh rÃµ rÃ ng.",
    "product.detail.review.2.time": "1 ngÃ y trÆ°á»›c",
    "product.detail.review.3.text": "Sáº£n pháº©m Ä‘Ãºng mÃ´ táº£, sáº½ mua láº¡i.",
    "product.detail.review.3.time": "3 ngÃ y trÆ°á»›c",
    "product.detail.api.title": "API giao hÃ ng",
    "product.detail.api.bullet1": "Há»— trá»£ tá»± Ä‘á»™ng giao mÃ£ sau thanh toÃ¡n.",
    "product.detail.api.bullet2": "TÆ°Æ¡ng thÃ­ch REST/JSON.",
    "product.detail.api.bullet3": "LiÃªn há»‡ Admin Ä‘á»ƒ nháº­n key.",
    "service.detail.pageTitle": "Chi tiáº¿t dá»‹ch vá»¥ | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Äang táº£i dá»‹ch vá»¥...",
    "service.detail.hero.loadingDesc": "MÃ´ táº£ dá»‹ch vá»¥ sáº½ xuáº¥t hiá»‡n á»Ÿ Ä‘Ã¢y.",
    "service.detail.info.title": "ThÃ´ng tin gÃ³i",
    "service.detail.info.desc": "Äá»c tá»« /data/mock-services.json. Sau khi ná»‘i API, backend tráº£ thÃªm trÆ°á»ng mÃ´ táº£ chi tiáº¿t.",
    "service.detail.form.title": "Form yÃªu cáº§u sau checkout",
    "service.detail.form.desc": "Sau khi thanh toÃ¡n thÃ nh cÃ´ng, khÃ¡ch Ä‘iá»n form nÃ y Ä‘á»ƒ báº¡n xá»­ lÃ½ dá»‹ch vá»¥ chÃ­nh xÃ¡c theo yÃªu cáº§u.",
    "service.detail.form.emailLabel": "Email nháº­n káº¿t quáº£",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "Link cáº§n xá»­ lÃ½",
    "service.detail.form.linkPlaceholder": "VD: link bÃ i viáº¿t, profile, video...",
    "service.detail.form.noteLabel": "Ná»™i dung chi tiáº¿t",
    "service.detail.form.notePlaceholder": "MÃ´ táº£ rÃµ yÃªu cáº§u, sá»‘ lÆ°á»£ng, tá»‘c Ä‘á»™ mong muá»‘n...",
    "service.detail.form.save": "LÆ°u yÃªu cáº§u",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "Form chÆ°a gá»­i Ä‘i Ä‘Ã¢u cáº£. Khi ná»‘i API, chá»‰ cáº§n POST dá»¯ liá»‡u nÃ y vÃ o backend.",
    "service.detail.notFound": "KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥",
    "service.detail.noData": "ChÆ°a cÃ³ dá»¯ liá»‡u, sáº½ hiá»‡n khi ná»‘i API hoáº·c khi thÃªm JSON.",
    "service.detail.fallback.summary": "MÃ´ táº£ chi tiáº¿t dá»‹ch vá»¥ sáº½ hiá»ƒn thá»‹ á»Ÿ Ä‘Ã¢y.",
    "service.detail.fallback.description": "MÃ´ táº£ chi tiáº¿t dá»‹ch vá»¥ sáº½ Ä‘Æ°á»£c tráº£ vá» bá»Ÿi API backend vÃ  hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "task.detail.pageTitle": "Chi tiáº¿t nhiá»‡m vá»¥ | polyflux.xyz",
    "task.detail.hero.loadingTitle": "Äang táº£i nhiá»‡m vá»¥...",
    "task.detail.hero.loadingDesc": "MÃ´ táº£ nhiá»‡m vá»¥ sáº½ xuáº¥t hiá»‡n á»Ÿ Ä‘Ã¢y.",
    "task.detail.info.title": "ThÃ´ng tin nhiá»‡m vá»¥",
    "task.detail.info.desc": "Dá»¯ liá»‡u Ä‘Æ°á»£c láº¥y tá»« /data/mock-tasks.json. Khi káº¿t ná»‘i API, thÃ´ng tin sáº½ Ä‘Æ°á»£c láº¥y tá»« backend.",
    "task.detail.report.title": "Ná»™p bÃ¡o cÃ¡o",
    "task.detail.report.desc": "Ná»™p báº±ng chá»©ng hoÃ n thÃ nh nhiá»‡m vá»¥.",
    "task.detail.report.contactLabel": "Email / Username",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "Link báº±ng chá»©ng",
    "task.detail.report.proofPlaceholder": "VD: link bÃ i viáº¿t, video",
    "task.detail.report.noteLabel": "Ghi chÃº thÃªm",
    "task.detail.report.notePlaceholder": "MÃ´ táº£ nhanh vá» cÃ´ng viá»‡c Ä‘Ã£ lÃ m...",
    "task.detail.report.submit": "Gá»­i bÃ¡o cÃ¡o",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "Khi káº¿t ná»‘i API, há»‡ thá»‘ng sáº½ nháº­n bÃ¡o cÃ¡o vÃ  duyá»‡t tá»± Ä‘á»™ng.",
    "task.detail.notFound": "KhÃ´ng tÃ¬m tháº¥y nhiá»‡m vá»¥",
    "task.detail.noData": "ChÆ°a cÃ³ dá»¯ liá»‡u, vui lÃ²ng thá»­ láº¡i sau.",
    "task.detail.titleFallback": "Nhiá»‡m vá»¥",
    "task.detail.fallback.summary": "MÃ´ táº£ chi tiáº¿t nhiá»‡m vá»¥ sáº½ hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "task.detail.fallback.description": "MÃ´ táº£ chi tiáº¿t nhiá»‡m vá»¥ sáº½ Ä‘Æ°á»£c cáº­p nháº­t khi cÃ³ API.",
    "maintenance.title": "MÃ¡y chá»§ báº£o trÃ¬",
    "maintenance.desc": "Báº£o trÃ¬ há»‡ thá»‘ng, xin lá»—i vÃ¬ sá»± báº¥t tiá»‡n nÃ y, báº£o trÃ¬ sáº½ khÃ´ng kÃ©o dÃ i quÃ¡ 1 giá», xin hÃ£y yÃªn tÃ¢m.",
    "cart.pageTitle": "Giá» hÃ ng | polyflux.xyz",
    "cart.items.title": "Sáº£n pháº©m trong giá»",
    "cart.empty.title": "Giá» hÃ ng hiá»‡n Ä‘ang trá»‘ng.",
    "cart.empty.desc": "Sau khi ná»‘i API, cÃ¡c sáº£n pháº©m báº¡n chá»n sáº½ hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "cart.summary.title": "TÃ³m táº¯t Ä‘Æ¡n hÃ ng",
    "cart.summary.desc": "Tá»•ng tiá»n, phÃ­, mÃ£ giáº£m giÃ¡.",
    "cart.summary.couponLabel": "MÃ£ giáº£m giÃ¡",
    "cart.summary.couponPlaceholder": "Nháº­p mÃ£",
    "cart.summary.apply": "Ãp dá»¥ng",
    "cart.summary.checkout": "Tiáº¿p tá»¥c thanh toÃ¡n",
    "checkout.pageTitle": "Thanh toÃ¡n | polyflux.xyz",
    "checkout.buyer.title": "ThÃ´ng tin ngÆ°á»i mua",
    "checkout.buyer.emailLabel": "Email nháº­n Ä‘Æ¡n",
    "checkout.buyer.platformLabel": "ID / Username (náº¿u cáº§n)",
    "checkout.buyer.platformPlaceholder": "TÃ¹y sáº£n pháº©m/dá»‹ch vá»¥",
    "checkout.note.title": "Ghi chÃº thÃªm",
    "checkout.note.label": "Ghi chÃº Ä‘Æ¡n hÃ ng",
    "checkout.note.placeholder": "VÃ­ dá»¥: giao file .txt, gá»­i qua mail...",
    "checkout.summary.title": "TÃ³m táº¯t Ä‘Æ¡n hÃ ng",
    "checkout.summary.desc": "tá»•ng tiá»n & phÆ°Æ¡ng thá»©c thanh toÃ¡n.",
    "checkout.summary.emptyTitle": "ChÆ°a cÃ³ dá»¯ liá»‡u giá» hÃ ng.",
    "checkout.summary.emptyDesc": "Sau khi ná»‘i API, danh sÃ¡ch item vÃ  total sáº½ hiá»ƒn thá»‹ á»Ÿ Ä‘Ã¢y.",
    "checkout.summary.success": "Thanh toÃ¡n thÃ nh cÃ´ng",
    "checkout.summary.failed": "MÃ´ phá»ng tháº¥t báº¡i",
    "checkout.success.pageTitle": "Thanh toÃ¡n thÃ nh cÃ´ng | polyflux.xyz",
    "checkout.success.title": "Thanh toÃ¡n thÃ nh cÃ´ng",
    "checkout.success.desc": "ÄÆ¡n hÃ ng cá»§a báº¡n Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n. Khi káº¿t ná»‘i API, trang nÃ y sáº½ hiá»ƒn thá»‹ chi tiáº¿t Ä‘Æ¡n vÃ  nÃºt táº£i tÃ i nguyÃªn.",
    "checkout.success.orders": "Xem Ä‘Æ¡n hÃ ng cá»§a tÃ´i",
    "checkout.success.continue": "Tiáº¿p tá»¥c mua hÃ ng",
    "checkout.failed.pageTitle": "Thanh toÃ¡n tháº¥t báº¡i | polyflux.xyz",
    "checkout.failed.title": "Thanh toÃ¡n tháº¥t báº¡i",
    "checkout.failed.desc": "CÃ³ thá»ƒ báº¡n Ä‘Ã£ há»§y phiÃªn thanh toÃ¡n hoáº·c cá»•ng thanh toÃ¡n bÃ¡o lá»—i. Khi ná»‘i API, trang nÃ y sáº½ hiá»ƒn thá»‹ mÃ£ lá»—i chi tiáº¿t.",
    "checkout.failed.retry": "Thá»­ thanh toÃ¡n láº¡i",
    "checkout.failed.backProducts": "Quay láº¡i sáº£n pháº©m",
    "profile.orders.pageTitle": "ÄÆ¡n hÃ ng | polyflux.xyz",
    "profile.orders.title": "ÄÆ¡n hÃ ng cá»§a tÃ´i",
    "profile.orders.subtitle": "Theo dÃµi tráº¡ng thÃ¡i cÃ¡c Ä‘Æ¡n hÃ ng vÃ  lá»‹ch sá»­ giao dá»‹ch.",
    "profile.orders.history.title": "Lá»‹ch sá»­ Ä‘Æ¡n hÃ ng",
    "profile.orders.table.orderId": "MÃ£ Ä‘Æ¡n",
    "profile.orders.table.product": "Sáº£n pháº©m",
    "profile.orders.table.total": "Tá»•ng tiá»n",
    "profile.orders.table.status": "Tráº¡ng thÃ¡i",
    "profile.orders.status.completed": "HoÃ n thÃ nh",
    "profile.orders.status.processing": "Äang xá»­ lÃ½",
    "profile.orders.status.cancelled": "ÄÃ£ há»§y",
    "profile.orders.sample.email": "Email 1",
    "profile.orders.sample.vip": "TÃ i khoáº£n VIP",
    "profile.orders.sample.interaction": "TÆ°Æ¡ng tÃ¡c gÃ³i 3",
    "profile.history.pageTitle": "Lá»‹ch sá»­ tÃ i khoáº£n | polyflux.xyz",
    "profile.history.title": "Lá»‹ch sá»­ tÃ i khoáº£n",
    "profile.history.subtitle": "Tá»•ng há»£p giao dá»‹ch náº¡p, rÃºt vÃ  mua hÃ ng gáº§n Ä‘Ã¢y.",
    "profile.history.sectionTitle": "Hoáº¡t Ä‘á»™ng gáº§n Ä‘Ã¢y",
    "profile.history.table.date": "Thá»i gian",
    "profile.history.table.type": "Loáº¡i",
    "profile.history.table.amount": "Sá»‘ tiá»n",
    "profile.history.table.status": "Tráº¡ng thÃ¡i",
    "profile.history.type.topup": "Náº¡p tiá»n",
    "profile.history.type.withdraw": "RÃºt tiá»n",
    "profile.history.type.order": "ÄÆ¡n hÃ ng",
    "profile.history.status.success": "ThÃ nh cÃ´ng",
    "profile.history.status.processing": "Äang xá»­ lÃ½",
    "profile.history.status.completed": "HoÃ n thÃ nh",
    "profile.tasks.pageTitle": "Nhiá»‡m vá»¥ Ä‘ang nháº­n | polyflux.xyz",
    "profile.tasks.title": "Nhiá»‡m vá»¥ Ä‘ang nháº­n",
    "profile.tasks.subtitle": "Theo dÃµi cÃ¡c nhiá»‡m vá»¥ báº¡n Ä‘Ã£ nháº­n vÃ  tiáº¿n Ä‘á»™ duyá»‡t.",
    "profile.tasks.sectionTitle": "Danh sÃ¡ch nhiá»‡m vá»¥ Ä‘ang nháº­n",
    "profile.tasks.table.task": "Nhiá»‡m vá»¥",
    "profile.tasks.table.receivedAt": "NgÃ y nháº­n",
    "profile.tasks.table.deadline": "Háº¿t háº¡n",
    "profile.tasks.table.reward": "ThÆ°á»Ÿng",
    "profile.tasks.table.status": "Tráº¡ng thÃ¡i",
    "profile.tasks.emptyTitle": "ChÆ°a cÃ³ nhiá»‡m vá»¥ nÃ o Ä‘ang nháº­n.",
    "profile.tasks.emptyDesc": "Khi báº¡n nháº­n nhiá»‡m vá»¥ má»›i, há»‡ thá»‘ng sáº½ hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "profile.topups.pageTitle": "Náº¡p tiá»n | polyflux.xyz",
    "profile.topups.title": "Náº¡p tiá»n vÃ o tÃ i khoáº£n",
    "profile.topups.subtitle": "Nháº­p sá»‘ tiá»n muá»‘n náº¡p, tá»‘i thiá»ƒu 10.000Ä‘, tá»‘i Ä‘a 499.000.000Ä‘. QR sáº½ táº¡o tá»± Ä‘á»™ng cho má»—i láº§n náº¡p.",
    "profile.topups.guard.title": "YÃªu cáº§u Ä‘Äƒng nháº­p:",
    "profile.topups.guard.desc": "Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ náº¡p tiá»n vÃ o vÃ­.",
    "profile.topups.bank.title": "Náº¡p báº±ng NgÃ¢n hÃ ng (QR)",
    "profile.topups.bank.desc": "QuÃ©t QR báº±ng app ngÃ¢n hÃ ng. Sau khi chuyá»ƒn, há»‡ thá»‘ng tá»± Ä‘á»™ng cá»™ng tiá»n vÃ o vÃ­.",
    "profile.topups.bank.qrPlaceholder": "QR sáº½ hiá»ƒn thá»‹ sau khi táº¡o.",
    "profile.topups.bank.codeLabel": "TÃªn chá»§ tÃ i khoáº£n",
    "profile.topups.bank.amountLabel": "Sá»‘ tiá»n",
    "profile.topups.bank.amountInputLabel": "Sá»‘ tiá»n muá»‘n náº¡p (VND)",
    "profile.topups.bank.amountPlaceholder": "VD: 100000",
    "profile.topups.bank.amountHint": "Tá»‘i thiá»ƒu 10.000Ä‘, tá»‘i Ä‘a 499.000.000Ä‘.",
    "profile.topups.bank.generate": "Táº¡o QR",
    "profile.topups.bank.toast.invalidAmount": "Vui lÃ²ng nháº­p sá»‘ tiá»n há»£p lá»‡.",
    "profile.topups.bank.toast.range": "Sá»‘ tiá»n pháº£i tá»« {min} Ä‘áº¿n {max} Ä‘.",
    "profile.topups.bank.toast.created": "QR Ä‘Ã£ táº¡o. QuÃ©t Ä‘á»ƒ náº¡p tiá»n.",
    "profile.topups.bank.toast.failed": "KhÃ´ng thá»ƒ táº¡o QR lÃºc nÃ y.",
    "profile.topups.crypto.notice": "Náº¡p báº±ng crypto Ä‘ang lá»—i táº¡m thá»i, khÃ´ng sá»­ dá»¥ng Ä‘Æ°á»£c. HÃ£y dÃ¹ng NgÃ¢n hÃ ng.",
    "profile.topups.crypto.title": "Náº¡p báº±ng Crypto (USDT TRC20)",
    "profile.topups.crypto.desc": "Náº¡p báº±ng USDT máº¡ng TRC20. Khi on-chain xÃ¡c nháº­n thÃ nh cÃ´ng, há»‡ thá»‘ng sáº½ cá»™ng tiá»n.",
    "profile.topups.crypto.addressLabel": "Äá»‹a chá»‰ vÃ­ TRC20",
    "profile.topups.crypto.amountLabel": "Sá»‘ lÆ°á»£ng USDT",
    "profile.topups.crypto.amountPlaceholder": "VD: 10",
    "profile.topups.crypto.confirm": "TÃ´i Ä‘Ã£ chuyá»ƒn",
    "profile.topups.withdraw.title": "RÃºt tiá»n",
    "profile.topups.withdraw.desc": "Nháº­p sá»‘ tiá»n muá»‘n rÃºt theo sá»‘ dÆ° hiá»‡n cÃ³. Tá»‘i thiá»ƒu 50.000Ä‘, tá»‘i Ä‘a 499.000.000Ä‘.",
    "profile.topups.withdraw.balanceLabel": "Sá»‘ dÆ° kháº£ dá»¥ng:",
    "profile.topups.withdraw.amountLabel": "Sá»‘ tiá»n muá»‘n rÃºt (VND)",
    "profile.topups.withdraw.amountPlaceholder": "VD: 500000",
    "profile.topups.withdraw.amountHint": "RÃºt tá»‘i thiá»ƒu 50.000Ä‘, tá»‘i Ä‘a 499.000.000Ä‘.",
    "profile.topups.withdraw.bankLabel": "NgÃ¢n hÃ ng",
    "profile.topups.withdraw.bankPlaceholder": "VD: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "Sá»‘ tÃ i khoáº£n",
    "profile.topups.withdraw.accountPlaceholder": "Nháº­p sá»‘ tÃ i khoáº£n",
    "profile.topups.withdraw.nameLabel": "TÃªn chá»§ tÃ i khoáº£n",
    "profile.topups.withdraw.namePlaceholder": "Há» vÃ  tÃªn chá»§ tÃ i khoáº£n",
    "profile.topups.withdraw.submit": "Gá»­i yÃªu cáº§u rÃºt",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "YÃªu cáº§u sáº½ Ä‘Æ°á»£c admin duyá»‡t trÆ°á»›c khi chuyá»ƒn khoáº£n.",
    "profile.topups.history.topup.title": "Lá»‹ch sá»­ náº¡p tiá»n gáº§n Ä‘Ã¢y",
    "profile.topups.history.withdraw.title": "Lá»‹ch sá»­ rÃºt tiá»n",
    "profile.topups.history.table.date": "Thá»i gian",
    "profile.topups.history.table.amount": "Sá»‘ tiá»n",
    "profile.topups.history.table.bank": "NgÃ¢n hÃ ng",
    "profile.topups.history.table.status": "Tráº¡ng thÃ¡i",
    "profile.topups.status.pending": "Äang duyá»‡t",
    "profile.topups.status.completed": "ÄÃ£ xá»­ lÃ½",
    "profile.topups.status.rejected": "Tá»« chá»‘i",
    "profile.security.pageTitle": "Báº£o máº­t & 2FA | polyflux.xyz",
    "profile.security.title": "Báº£o máº­t & 2FA",
    "profile.security.subtitle": "TÄƒng cÆ°á»ng báº£o máº­t tÃ i khoáº£n vÃ  kiá»ƒm soÃ¡t truy cáº­p.",
    "profile.security.password.title": "Cáº­p nháº­t máº­t kháº©u",
    "profile.security.password.desc": "Thay Ä‘á»•i máº­t kháº©u Ä‘á»‹nh ká»³ Ä‘á»ƒ báº£o vá»‡ tÃ i khoáº£n tá»‘t hÆ¡n.",
    "profile.security.password.currentLabel": "Máº­t kháº©u hiá»‡n táº¡i",
    "profile.security.password.currentPlaceholder": "Nháº­p máº­t kháº©u hiá»‡n táº¡i",
    "profile.security.password.newLabel": "Máº­t kháº©u má»›i",
    "profile.security.password.newPlaceholder": "Tá»‘i thiá»ƒu 8 kÃ½ tá»±",
    "profile.security.password.confirmLabel": "XÃ¡c nháº­n máº­t kháº©u má»›i",
    "profile.security.password.confirmPlaceholder": "Nháº­p láº¡i máº­t kháº©u má»›i",
    "profile.security.password.submit": "Cáº­p nháº­t máº­t kháº©u",
    "profile.security.2fa.title": "XÃ¡c thá»±c hai lá»›p (2FA)",
    "profile.security.2fa.desc": "Báº­t 2FA Ä‘á»ƒ yÃªu cáº§u mÃ£ xÃ¡c thá»±c khi Ä‘Äƒng nháº­p.",
    "profile.security.2fa.recoveryLabel": "MÃ£ khÃ´i phá»¥c",
    "profile.security.2fa.deviceLabel": "Thiáº¿t bá»‹ tin cáº­y",
    "profile.security.2fa.deviceNone": "ChÆ°a cÃ³ thiáº¿t bá»‹ nÃ o Ä‘Æ°á»£c thÃªm.",
    "profile.security.2fa.enable": "Báº­t 2FA",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "Káº¿t ná»‘i API Ä‘á»ƒ lÆ°u cáº¥u hÃ¬nh 2FA vÃ  danh sÃ¡ch thiáº¿t bá»‹.",
    "profile.favorites.pageTitle": "YÃªu thÃ­ch | polyflux.xyz",
    "profile.favorites.title": "YÃªu thÃ­ch",
    "profile.favorites.subtitle": "Danh sÃ¡ch sáº£n pháº©m, dá»‹ch vá»¥ báº¡n Ä‘Ã£ lÆ°u.",
    "profile.favorites.listTitle": "Danh sÃ¡ch yÃªu thÃ­ch",
    "profile.favorites.emptyTitle": "ChÆ°a cÃ³ dá»¯ liá»‡u.",
    "profile.favorites.emptyDesc": "HÃ£y lÆ°u sáº£n pháº©m Ä‘á»ƒ xem láº¡i sau.",
    "profile.notifications.pageTitle": "ThÃ´ng bÃ¡o | polyflux.xyz",
    "profile.notifications.title": "ThÃ´ng bÃ¡o",
    "profile.notifications.subtitle": "Cáº­p nháº­t Ä‘Æ¡n hÃ ng vÃ  há»‡ thá»‘ng sáº½ hiá»ƒn thá»‹ á»Ÿ Ä‘Ã¢y.",
    "profile.notifications.listTitle": "ThÃ´ng bÃ¡o má»›i",
    "profile.notifications.emptyTitle": "ChÆ°a cÃ³ thÃ´ng bÃ¡o.",
    "profile.notifications.emptyDesc": "HÃ£y quay láº¡i sau.",
    "profile.badges.pageTitle": "Danh hiá»‡u | polyflux.xyz",
    "profile.badges.title": "Danh hiá»‡u",
    "profile.badges.subtitle": "Theo dÃµi cáº¥p Ä‘á»™ vÃ  thÃ nh tÃ­ch cá»§a báº¡n.",
    "profile.badges.listTitle": "Danh hiá»‡u Ä‘áº¡t Ä‘Æ°á»£c",
    "profile.badges.emptyTitle": "ChÆ°a cÃ³ danh hiá»‡u.",
    "profile.badges.emptyDesc": "HoÃ n thÃ nh nhiá»‡m vá»¥ Ä‘á»ƒ má»Ÿ khÃ³a.",
    "profile.messages.pageTitle": "Tin nháº¯n | polyflux.xyz",
    "profile.messages.inboxTitle": "Há»™p thÆ°",
    "profile.messages.inboxCount": "1 cuá»™c trÃ² chuyá»‡n",
    "profile.messages.searchPlaceholder": "TÃ¬m kiáº¿m...",
    "profile.messages.thread.name": "Báº¡ch Kim",
    "profile.messages.thread.note": "Há»— trá»£ chÃ­nh thá»©c",
    "profile.messages.thread.empty": "KhÃ´ng cÃ³ cuá»™c trÃ² chuyá»‡n khÃ¡c.",
    "profile.messages.back": "Quay láº¡i",
    "profile.messages.user.sub": "Há»— trá»£ Admin",
    "profile.messages.role.admin": "Admin",
    "profile.messages.day.today": "HÃ´m nay",
    "profile.messages.message.1": "Xin chÃ o, báº¡n cáº§n há»— trá»£ gÃ¬?",
    "profile.messages.message.2": "Cho mÃ¬nh há»i thÃ´ng tin Ä‘Æ¡n hÃ ng #.",
    "profile.messages.message.3": "MÃ¬nh Ä‘ang kiá»ƒm tra, báº¡n chá» mÃ¬nh 1 chÃºt nhÃ©.",
    "profile.messages.message.4": "Cáº£m Æ¡n báº¡n.",
    "profile.messages.emojiLabel": "Biá»ƒu cáº£m",
    "profile.messages.attachLabel": "ÄÃ­nh kÃ¨m",
    "profile.messages.inputPlaceholder": "Nháº­p tin nháº¯n...",
    "profile.messages.send": "Gá»­i",
    "product.data.gmail-random.name": "Gmail random name",
    "product.data.gmail-random.short": "Full quyá»n truy cáº­p Gmail random, báº£o hÃ nh 7 ngÃ y.",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "TÃ i khoáº£n Gmail EDU dÃ¹ng Ä‘á»ƒ kÃ­ch hoáº¡t nhiá»u Æ°u Ä‘Ã£i.",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "TÃ i khoáº£n US Ä‘Ã£ KYC, dÃ¹ng cho nhiá»u dá»‹ch vá»¥.",
    "product.data.tool-checker.name": "Tool checker tÃ i nguyÃªn",
    "product.data.tool-checker.short": "Tool local kiá»ƒm tra live/dead tÃ i nguyÃªn nhanh.",
    "service.data.fb-boost.name": "Dá»‹ch vá»¥ tÄƒng tÆ°Æ¡ng tÃ¡c Facebook",
    "service.data.fb-boost.short": "TÄƒng like, comment, share tá»± nhiÃªn, báº£o hÃ nh 7 ngÃ y.",
    "service.data.tiktok-view.name": "TÄƒng view TikTok",
    "service.data.tiktok-view.short": "GÃ³i view TikTok cho video má»›i, phÃ¹ há»£p test ná»™i dung.",
    "task.data.review-product.title": "Viáº¿t review sáº£n pháº©m trÃªn diá»…n Ä‘Ã n",
    "task.data.review-product.short": "Viáº¿t review chi tiáº¿t vÃ  tráº£i nghiá»‡m mua hÃ ng táº¡i polyflux.xyz.",
    "task.data.tiktok-video.title": "LÃ m video TikTok giá»›i thiá»‡u shop",
    "task.data.tiktok-video.short": "Quay video ngáº¯n review dá»‹ch vá»¥, Ä‘Ã­nh kÃ¨m hashtag theo yÃªu cáº§u.",
  },
  en: {
    "landing.hero.subtitle": "A reputable and fast trading platform.",
    "landing.hero.buy": "Buy now",
    "landing.hero.explore": "Explore more",
    "landing.pill.email": "Email",
    "landing.pill.account": "Accounts",
    "landing.pill.software": "Software",
    "landing.pill.interaction": "Engagement services",
    "landing.pill.tools": "Tools",
    "landing.pill.other": "Other",
    "landing.faq.title": "Frequently Asked Questions",
    "landing.faq.subtitle": "Find answers to common questions about polyflux.xyz",
    "landing.faq.q1": "How can I view my order?",
    "landing.faq.a1": "Your purchased products will be listed in your purchase history.",
    "landing.faq.q2": "Is this a scam?",
    "landing.faq.a2": "We use verified payments, visible reviews, and a refund policy to keep you safe.",
    "landing.faq.q3": "I have a question, how do I contact you?",
    "landing.faq.a3": "Message the admin via Telegram.",
    "landing.payments.title": "20+ Payment Options",
    "landing.payments.subtitle": "We accept a variety of payment methods to keep checkout fast and secure.",
    "landing.trusted.title": "The most trusted market.",
    "landing.trusted.subtitle": "See why our customers choose us",
    "landing.stats.orders": "Total Orders",
    "landing.stats.vouches": "Verified Vouches",
    "landing.stats.instantValue": "Instant",
    "landing.stats.deliveryLabel": "Delivery For Everything",
    "landing.products.emptyTitle": "No products found",
    "landing.products.emptyDesc": "Try adjusting your search or category filter.",
    "landing.products.instant": "Instant delivery and secure checkout.",
    "landing.products.add": "Add",
    "landing.product.email": "Email {index}",
    "landing.product.account": "Account {tier}",
    "landing.product.software": "Software {tier}",
    "landing.product.interaction": "Interaction Package {index}",
    "landing.product.other": "Other Item {index}",
    "landing.tier.basic": "Basic",
    "landing.tier.pro": "Pro",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "Lite",
    "landing.tier.plus": "Plus",
    "support.label": "Support",
    "support.close": "Close",
    "support.header.title": "PolyFlux Support",
    "support.header.status": "Online",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "Chat with Admin",
    "support.faq.title": "FAQ - Frequently Asked Questions",
    "support.faq.buyer.title": "I. Buyer",
    "support.faq.buyer.q1": "How do I buy a product?",
    "support.faq.buyer.a1.1": "Buyers can pay via crypto or bank transfer.",
    "support.faq.buyer.a1.2": "Crypto: deposit to the designated personal wallet; once the on-chain transaction is confirmed, the balance updates automatically.",
    "support.faq.buyer.a1.3": "Bank: transfer according to the provided details; the system reconciles and updates the balance after payment is confirmed.",
    "support.faq.buyer.q2": "What does non-duplicate email/account mean?",
    "support.faq.buyer.a2": "The system ensures items have not been sold before, using duplicate checks and a Zero Duplicate badge.",
    "support.faq.buyer.q3": "How do I top up?",
    "support.faq.buyer.a3.1": "Crypto: choose Top up -> select the coin -> send to your personal wallet. Supports USDT, USDC, BTC, ETH, BNB, TRX, etc.",
    "support.faq.buyer.a3.2": "Bank: choose Top up -> bank transfer -> send with the correct transfer note/code for automatic confirmation.",
    "support.faq.buyer.q4": "Can I request a refund?",
    "support.faq.buyer.a4": "Yes. Each order is protected by a 3-day escrow period for complaints or disputes.",
    "support.faq.buyer.q5": "My top-up hasn't arrived?",
    "support.faq.buyer.a5.1": "Crypto: could be wrong chain/token or network congestion. If it still hasn't updated after a few minutes, send the TXID for support.",
    "support.faq.buyer.a5.2": "Bank: could be after-hours transfer, wrong note, or pending reconciliation. Contact support with a transfer screenshot.",
    "support.faq.buyer.q6": "What if I send to the wrong address?",
    "support.faq.buyer.a6.1": "Crypto: blockchain transactions are irreversible; wrong chain/address usually means permanent loss.",
    "support.faq.buyer.a6.2": "Bank: the system only helps with reconciliation; refunds aren't guaranteed for incorrect transfers.",
    "support.faq.buyer.q7": "Do I need a middleman?",
    "support.faq.buyer.a7": "No. The system works as integrated escrow, holding funds for 3 days before releasing to the seller.",
    "support.faq.seller.title": "II. Seller",
    "support.faq.seller.q1": "How do I register as a seller?",
    "support.faq.seller.a1": "Log in -> register as Seller -> fill required info -> wait for approval.",
    "support.faq.seller.q2": "How do I create a shop?",
    "support.faq.seller.a2": "Go to Shop Management -> create a new shop -> upload product descriptions, images, and files.",
    "support.faq.seller.q3": "How do I optimize my shop?",
    "support.faq.seller.a3": "Use high-quality images, clear titles, detailed descriptions, stable products, and fast support. Rankings update weekly.",
    "support.faq.seller.q4": "How do I get to the top listing?",
    "support.faq.seller.a4": "It depends on sales, customer ratings, trust score, and dispute rate.",
    "support.faq.seller.q5": "How is income processed?",
    "support.faq.seller.a5.1": "After an order is completed, funds stay Pending for 3 days (escrow). After that, the seller can withdraw via:",
    "support.faq.seller.a5.list1": "Crypto: USDT, BTC, ETH, BNB, TRX, etc.",
    "support.faq.seller.a5.list2": "Bank transfer (to verified account details).",
    "support.faq.seller.q6": "How are commissions calculated?",
    "support.faq.seller.a6": "The platform charges a 5% transaction fee per successful order. Sellers can enable Reseller mode to boost sales.",
    "support.faq.seller.q7": "How do I withdraw?",
    "support.faq.seller.a7": "Choose Withdraw -> select Crypto or Bank -> enter info -> confirm.",
    "support.faq.seller.q8": "How are sellers' tax obligations handled?",
    "support.faq.seller.a8.1": "The platform only acts as an intermediary providing transaction infrastructure.",
    "support.faq.seller.a8.2": "Sellers are responsible for declaring and paying taxes arising from their income under Vietnamese law.",
    "support.faq.seller.a8.3": "The platform does not withhold, represent, or fulfill tax obligations on the seller's behalf.",
    "support.faq.seller.q9": "Which items are prohibited?",
    "support.faq.seller.a9": "Hacked accounts, illegal data, bank accounts, harmful tools, or any content that violates Vietnamese law or third-party terms.",
    "support.faq.seller.q10": "Are user transactions related to the admin?",
    "support.faq.seller.a10.1": "Items users list for sale or task postings are transactions between users and are not related to the admin.",
    "support.faq.seller.a10.2": "The admin does not trade illegal goods. If illegal trading or intentional violations occur, the admin may delete listings and freeze balances. By selling on this platform, you are deemed to have read and accepted the terms.",
    "support.faq.seller.q11": "API integration?",
    "support.faq.seller.a11": "Yes. Sellers can integrate the API to automate delivery and sync inventory.",
    "support.faq.seller.q12": "How do I handle warranty requests?",
    "support.faq.seller.a12": "Go to Sold Orders -> Warranty -> enter quantity -> the system sends replacement codes automatically.",
    "support.faq.reseller.title": "III. Reseller",
    "support.faq.reseller.q1": "How do I become a reseller?",
    "support.faq.reseller.a1": "Enable Reseller mode in account settings.",
    "support.faq.reseller.q2": "How do I sell as a reseller?",
    "support.faq.reseller.a2": "Choose eligible products -> get a referral link -> share -> the system records commissions automatically.",
    "support.faq.reseller.q3": "Withdraw commissions?",
    "support.faq.reseller.a3": "Commissions are held for 3 days (escrow) before withdrawal via crypto or bank.",
    "support.faq.reseller.q4": "Monthly bonuses?",
    "support.faq.reseller.a4": "Yes. The platform runs monthly performance-based bonus programs.",
    "support.faq.compliance.title": "IV. Compliance with Vietnam law - AML & Fraud",
    "support.faq.compliance.q1": "Anti-money laundering (AML)",
    "support.faq.compliance.a1.lead": "Strictly prohibited:",
    "support.faq.compliance.a1.list1": "Circulating illegal assets",
    "support.faq.compliance.a1.list2": "Concealing the source of funds",
    "support.faq.compliance.a1.list3": "Suspicious transactions indicating money laundering",
    "support.faq.compliance.a1.note": "The platform may hold funds, lock accounts, request identity verification, and cooperate with authorities when necessary.",
    "support.faq.compliance.q2": "Fraud prevention",
    "support.faq.compliance.a2.lead": "Strictly prohibited:",
    "support.faq.compliance.a2.list1": "Fake orders",
    "support.faq.compliance.a2.list2": "Dispute abuse",
    "support.faq.compliance.a2.list3": "Multiple accounts",
    "support.faq.compliance.a2.list4": "Bots, hacks, or exploiting system vulnerabilities",
    "support.faq.compliance.q3": "Compliance with Vietnamese law",
    "support.faq.compliance.a3": "Users must not trade illegal goods or violate privacy or personal data.",
    "profile.overview.pageTitle": "Account overview | polyflux.xyz",
    "profile.overview.title": "Account overview",
    "profile.overview.subtitle": "Track balances, orders, and security in one place.",
    "profile.overview.quickInfoTitle": "Quick info",
    "profile.overview.quickInfoDesc": "balance, total orders, account tier...",
    "profile.overview.table.labelItem": "Item",
    "profile.overview.table.labelValue": "Value",
    "profile.overview.table.labelStatus": "Status",
    "profile.overview.table.balanceLabel": "Available balance",
    "profile.overview.table.balanceStatus": "Not funded",
    "profile.overview.table.ordersLabel": "Total orders",
    "profile.overview.table.ordersStatus": "Completed",
    "profile.overview.quickLinks.title": "Quick navigation",
    "profile.overview.quickLinks.profile": "Profile",
    "profile.overview.quickLinks.orders": "Orders",
    "profile.overview.quickLinks.topups": "Top up",
    "profile.overview.quickLinks.logins": "Login history",
    "profile.overview.quickLinks.security": "Security & 2FA",
    "profile.public.pageTitle": "Profile | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "Joined",
    "profile.public.badgeLabel": "Badge",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "Copy profile link",
    "profile.public.copySuccess": "Profile link copied.",
    "profile.public.copyFail": "Unable to copy profile link.",
    "profile.public.follow": "Follow",
    "profile.public.following": "Following",
    "profile.public.followersLabel": "Followers",
    "profile.public.followingLabel": "Following",
    "profile.public.stats.purchased": "Purchased",
    "profile.public.stats.sold": "Sold",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "View shop",
    "profile.public.featured.title": "Featured posts",
    "profile.public.featured.manage": "Edit featured posts",
    "profile.public.featured.note": "Featured posts are auto-removed after 30 days.",
    "profile.public.featured.emptyTitle": "This user hasn't posted any featured items yet.",
    "profile.public.featured.emptyDesc": "New posts will auto-hide after 30 days.",
    "profile.public.story.defaultTitle": "Post #{index}",
    "profile.public.story.type.video": "Video",
    "profile.public.story.type.image": "Image",
    "profile.public.story.titleFallback": "Featured post",
    "profile.public.story.alt": "Story",
    "profile.public.manage.title": "Manage profile",
    "profile.public.manage.titlePlaceholder": "Post title",
    "profile.public.manage.upload": "Upload",
    "profile.public.manage.remove": "Remove",
    "profile.public.manage.help": "Images are cropped to 9:16, max 2MB. Video is 60s max and admin-only.",
    "profile.public.manage.close": "Close",
    "profile.public.manage.save": "Save changes",
    "profile.public.manage.slotLabel": "Slot {index}",
    "profile.public.manage.limit.pro": "Up to 4 posts, video supported.",
    "profile.public.manage.limit.basic": "Not eligible yet, only 1 photo.",
    "profile.public.toast.saveFail": "Unable to save featured posts.",
    "profile.public.toast.loginRequired": "Please log in to follow.",
    "profile.public.toast.imageOrVideoOnly": "Only images or videos are supported.",
    "profile.public.toast.notEligible": "You are not eligible to upload video or multiple posts.",
    "profile.public.toast.uploadFail": "Upload failed.",
    "profile.public.toast.imageTooLarge": "Image exceeds 2MB.",
    "profile.public.toast.imageRatio": "Image must be 9:16.",
    "profile.public.toast.imageReadFail": "Cannot read image.",
    "profile.public.toast.videoNotEligible": "Video is only available for eligible accounts.",
    "profile.public.toast.videoTooLarge": "Video exceeds 25MB.",
    "profile.public.toast.videoRatio": "Video must be 9:16.",
    "profile.public.toast.videoDuration": "Video exceeds 60 seconds.",
    "profile.public.toast.videoReadFail": "Cannot read video.",
    "profile.public.toast.coverReadFail": "Cannot read cover image.",
    "product.detail.pageTitle": "Product detail | polyflux.xyz",
    "breadcrumb.home": "Home",
    "breadcrumb.detail": "Detail",
    "product.detail.share": "Share",
    "product.detail.share.copied": "Copied",
    "product.detail.share.failed": "Copy failed",
    "product.detail.favorite": "Favorite",
    "product.detail.favorite.active": "Favorited",
    "product.detail.otherTitle": "Other items from this shop",
    "product.detail.other.empty": "No other items yet.",
    "product.detail.order": "Place order",
    "product.detail.preorder": "Preorder",
    "product.detail.message": "Message",
    "product.detail.tab.shop": "Shop description",
    "product.detail.tab.reviews": "Reviews",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "Confirm order",
    "product.detail.modal.quantity": "Quantity",
    "product.detail.modal.subtotal": "Subtotal",
    "product.detail.modal.cancel": "Cancel",
    "product.detail.modal.confirm": "Confirm order",
    "product.detail.modal.processing": "Processing...",
    "product.detail.modal.max": "Max {max}",
    "product.detail.toast.success": "Order placed successfully. Check your orders.",
    "product.detail.toast.viewOrders": "View orders",
    "product.detail.toast.loginRequired": "Please log in to place an order.",
    "product.detail.toast.orderFailed": "Order failed.",
    "product.detail.notFound": "Product not found",
    "product.detail.description.pending": "Description is updating.",
    "product.detail.rating.positive": "Positive",
    "product.detail.rating.neutral": "Neutral",
    "product.detail.rating.negative": "Needs improvement",
    "product.detail.rating.none": "No rating yet",
    "product.detail.shopIdLabel": "Shop ID",
    "product.detail.shop.polyflux.title": "PolyFlux Official",
    "product.detail.shop.polyflux.bullet1": "Fast delivery and pre-check before handoff.",
    "product.detail.shop.polyflux.bullet2": "Refunds if issues cannot be resolved.",
    "product.detail.shop.polyflux.bullet3": "24/7 support via Telegram.",
    "product.detail.shop.partner.title": "Partner Marketplace #1",
    "product.detail.shop.partner.bullet1": "Stable inventory, fast delivery within minutes.",
    "product.detail.shop.partner.bullet2": "Best pricing for bulk orders.",
    "product.detail.shop.partner.bullet3": "Warranty support per published policy.",
    "product.detail.shop.fallbackTitle": "Trusted shop",
    "product.detail.shop.fallbackBullet1": "Check the item right after delivery.",
    "product.detail.shop.fallbackBullet2": "Support is available if issues arise.",
    "product.detail.review.1.text": "Fast delivery, account works great.",
    "product.detail.review.1.time": "2 hours ago",
    "product.detail.review.2.text": "Quick support and clear warranty.",
    "product.detail.review.2.time": "1 day ago",
    "product.detail.review.3.text": "Item matches description, will buy again.",
    "product.detail.review.3.time": "3 days ago",
    "product.detail.api.title": "Delivery API",
    "product.detail.api.bullet1": "Auto-deliver codes after payment.",
    "product.detail.api.bullet2": "REST/JSON compatible.",
    "product.detail.api.bullet3": "Contact Admin to receive a key.",
    "service.detail.pageTitle": "Service detail | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Loading service...",
    "service.detail.hero.loadingDesc": "Service description will appear here.",
    "service.detail.info.title": "Package details",
    "service.detail.info.desc": "Read from /data/mock-services.json. When the API is connected, the backend returns a detailed description.",
    "service.detail.form.title": "Request form after checkout",
    "service.detail.form.desc": "After successful payment, the customer fills out this form so you can deliver the service accurately.",
    "service.detail.form.emailLabel": "Result email",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "Target link",
    "service.detail.form.linkPlaceholder": "e.g. post link, profile, video...",
    "service.detail.form.noteLabel": "Detailed request",
    "service.detail.form.notePlaceholder": "Describe requirements, quantity, desired speed...",
    "service.detail.form.save": "Save request",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "This form doesn't submit anywhere. When the API is connected, POST this data to the backend.",
    "service.detail.notFound": "Service not found",
    "service.detail.noData": "No data yet, will appear when the API is connected or when JSON is added.",
    "service.detail.fallback.summary": "Detailed service information will appear here.",
    "service.detail.fallback.description": "Detailed service info will be returned by the backend API and displayed here.",
    "task.detail.pageTitle": "Task detail | polyflux.xyz",
    "task.detail.hero.loadingTitle": "Loading task...",
    "task.detail.hero.loadingDesc": "Task description will appear here.",
    "task.detail.info.title": "Task information",
    "task.detail.info.desc": "Data is loaded from /data/mock-tasks.json. When the API is connected, details are fetched from the backend.",
    "task.detail.report.title": "Submit report",
    "task.detail.report.desc": "Submit proof of task completion.",
    "task.detail.report.contactLabel": "Email / Username",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "Proof link",
    "task.detail.report.proofPlaceholder": "e.g. post link, video",
    "task.detail.report.noteLabel": "Additional note",
    "task.detail.report.notePlaceholder": "Quick summary of the work done...",
    "task.detail.report.submit": "Submit report",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "When the API is connected, the system will receive and auto-review the report.",
    "task.detail.notFound": "Task not found",
    "task.detail.noData": "No data yet, please try again later.",
    "task.detail.titleFallback": "Task",
    "task.detail.fallback.summary": "Detailed task description will appear here.",
    "task.detail.fallback.description": "Detailed task info will be updated when the API is available.",
    "maintenance.title": "Server maintenance",
    "maintenance.desc": "System maintenance in progress. Sorry for the inconvenience; it should not take more than 1 hour.",
    "cart.pageTitle": "Cart | polyflux.xyz",
    "cart.items.title": "Items in cart",
    "cart.empty.title": "Your cart is currently empty.",
    "cart.empty.desc": "Once the API is connected, selected items will appear here.",
    "cart.summary.title": "Order summary",
    "cart.summary.desc": "Totals, fees, and discount codes.",
    "cart.summary.couponLabel": "Discount code",
    "cart.summary.couponPlaceholder": "Enter code",
    "cart.summary.apply": "Apply",
    "cart.summary.checkout": "Proceed to checkout",
    "checkout.pageTitle": "Checkout | polyflux.xyz",
    "checkout.buyer.title": "Buyer information",
    "checkout.buyer.emailLabel": "Order email",
    "checkout.buyer.platformLabel": "ID / Username (optional)",
    "checkout.buyer.platformPlaceholder": "Depends on product/service",
    "checkout.note.title": "Additional notes",
    "checkout.note.label": "Order note",
    "checkout.note.placeholder": "Example: deliver a .txt file, send via email...",
    "checkout.summary.title": "Order summary",
    "checkout.summary.desc": "totals & payment methods.",
    "checkout.summary.emptyTitle": "No cart data yet.",
    "checkout.summary.emptyDesc": "Once the API is connected, items and totals will appear here.",
    "checkout.summary.success": "Payment success",
    "checkout.summary.failed": "Simulate failure",
    "checkout.success.pageTitle": "Payment successful | polyflux.xyz",
    "checkout.success.title": "Payment successful",
    "checkout.success.desc": "Your order has been recorded. Once the API is connected, this page will show order details and a download button.",
    "checkout.success.orders": "View my orders",
    "checkout.success.continue": "Continue shopping",
    "checkout.failed.pageTitle": "Payment failed | polyflux.xyz",
    "checkout.failed.title": "Payment failed",
    "checkout.failed.desc": "You may have canceled the payment or the gateway returned an error. Once the API is connected, this page will show detailed error codes.",
    "checkout.failed.retry": "Try again",
    "checkout.failed.backProducts": "Back to products",
    "profile.orders.pageTitle": "Orders | polyflux.xyz",
    "profile.orders.title": "My orders",
    "profile.orders.subtitle": "Track order status and transaction history.",
    "profile.orders.history.title": "Order history",
    "profile.orders.table.orderId": "Order ID",
    "profile.orders.table.product": "Product",
    "profile.orders.table.total": "Total",
    "profile.orders.table.status": "Status",
    "profile.orders.status.completed": "Completed",
    "profile.orders.status.processing": "Processing",
    "profile.orders.status.cancelled": "Canceled",
    "profile.orders.sample.email": "Email 1",
    "profile.orders.sample.vip": "VIP account",
    "profile.orders.sample.interaction": "Engagement Pack 3",
    "profile.history.pageTitle": "Account history | polyflux.xyz",
    "profile.history.title": "Account history",
    "profile.history.subtitle": "Summary of recent top ups, withdrawals, and purchases.",
    "profile.history.sectionTitle": "Recent activity",
    "profile.history.table.date": "Date",
    "profile.history.table.type": "Type",
    "profile.history.table.amount": "Amount",
    "profile.history.table.status": "Status",
    "profile.history.type.topup": "Top up",
    "profile.history.type.withdraw": "Withdraw",
    "profile.history.type.order": "Order",
    "profile.history.status.success": "Success",
    "profile.history.status.processing": "Processing",
    "profile.history.status.completed": "Completed",
    "profile.tasks.pageTitle": "Active tasks | polyflux.xyz",
    "profile.tasks.title": "Active tasks",
    "profile.tasks.subtitle": "Track the tasks you've accepted and approval progress.",
    "profile.tasks.sectionTitle": "Active task list",
    "profile.tasks.table.task": "Task",
    "profile.tasks.table.receivedAt": "Received on",
    "profile.tasks.table.deadline": "Deadline",
    "profile.tasks.table.reward": "Reward",
    "profile.tasks.table.status": "Status",
    "profile.tasks.emptyTitle": "No active tasks yet.",
    "profile.tasks.emptyDesc": "When you accept a new task, it will appear here.",
    "profile.topups.pageTitle": "Top up | polyflux.xyz",
    "profile.topups.title": "Top up your account",
    "profile.topups.subtitle": "Enter the amount to top up: minimum 10,000Ä‘ and maximum 499,000,000Ä‘. A QR code will be generated for each top-up.",
    "profile.topups.guard.title": "Login required:",
    "profile.topups.guard.desc": "You need to log in to top up your wallet.",
    "profile.topups.bank.title": "Bank top up (QR)",
    "profile.topups.bank.desc": "Scan the QR code in your banking app. After transferring, funds will be credited automatically.",
    "profile.topups.bank.qrPlaceholder": "QR will appear after creation.",
    "profile.topups.bank.codeLabel": "Account name",
    "profile.topups.bank.amountLabel": "Amount",
    "profile.topups.bank.amountInputLabel": "Top-up amount (VND)",
    "profile.topups.bank.amountPlaceholder": "e.g. 100000",
    "profile.topups.bank.amountHint": "Minimum 10,000Ä‘, maximum 499,000,000Ä‘.",
    "profile.topups.bank.generate": "Generate QR",
    "profile.topups.bank.toast.invalidAmount": "Please enter a valid amount.",
    "profile.topups.bank.toast.range": "Amount must be between {min} and {max} Ä‘.",
    "profile.topups.bank.toast.created": "QR created. Scan to top up.",
    "profile.topups.bank.toast.failed": "Unable to create QR right now.",
    "profile.topups.crypto.notice": "Crypto top-ups are temporarily unavailable. Please use bank transfer.",
    "profile.topups.crypto.title": "Crypto top up (USDT TRC20)",
    "profile.topups.crypto.desc": "Top up via USDT TRC20. Once the on-chain transaction is confirmed, your balance will be credited.",
    "profile.topups.crypto.addressLabel": "TRC20 wallet address",
    "profile.topups.crypto.amountLabel": "USDT amount",
    "profile.topups.crypto.amountPlaceholder": "e.g. 10",
    "profile.topups.crypto.confirm": "I've sent it",
    "profile.topups.withdraw.title": "Withdraw funds",
    "profile.topups.withdraw.desc": "Enter the amount to withdraw based on your current balance. Minimum 50,000Ä‘, maximum 499,000,000Ä‘.",
    "profile.topups.withdraw.balanceLabel": "Available balance:",
    "profile.topups.withdraw.amountLabel": "Withdrawal amount (VND)",
    "profile.topups.withdraw.amountPlaceholder": "e.g. 500000",
    "profile.topups.withdraw.amountHint": "Minimum 50,000Ä‘, maximum 499,000,000Ä‘.",
    "profile.topups.withdraw.bankLabel": "Bank",
    "profile.topups.withdraw.bankPlaceholder": "e.g. Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "Account number",
    "profile.topups.withdraw.accountPlaceholder": "Enter account number",
    "profile.topups.withdraw.nameLabel": "Account holder name",
    "profile.topups.withdraw.namePlaceholder": "Full name of account holder",
    "profile.topups.withdraw.submit": "Submit withdrawal",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "Requests will be reviewed by the admin before transfer.",
    "profile.topups.history.topup.title": "Recent top-ups",
    "profile.topups.history.withdraw.title": "Withdrawal history",
    "profile.topups.history.table.date": "Date",
    "profile.topups.history.table.amount": "Amount",
    "profile.topups.history.table.bank": "Bank",
    "profile.topups.history.table.status": "Status",
    "profile.topups.status.pending": "Pending review",
    "profile.topups.status.completed": "Processed",
    "profile.topups.status.rejected": "Rejected",
    "profile.security.pageTitle": "Security & 2FA | polyflux.xyz",
    "profile.security.title": "Security & 2FA",
    "profile.security.subtitle": "Strengthen account security and access control.",
    "profile.security.password.title": "Update password",
    "profile.security.password.desc": "Change your password regularly to keep the account secure.",
    "profile.security.password.currentLabel": "Current password",
    "profile.security.password.currentPlaceholder": "Enter current password",
    "profile.security.password.newLabel": "New password",
    "profile.security.password.newPlaceholder": "At least 8 characters",
    "profile.security.password.confirmLabel": "Confirm new password",
    "profile.security.password.confirmPlaceholder": "Re-enter new password",
    "profile.security.password.submit": "Update password",
    "profile.security.2fa.title": "Two-factor authentication (2FA)",
    "profile.security.2fa.desc": "Enable 2FA to require verification codes on login.",
    "profile.security.2fa.recoveryLabel": "Recovery code",
    "profile.security.2fa.deviceLabel": "Trusted devices",
    "profile.security.2fa.deviceNone": "No trusted devices added yet.",
    "profile.security.2fa.enable": "Enable 2FA",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "Connect the API to save 2FA settings and device lists.",
    "profile.favorites.pageTitle": "Favorites | polyflux.xyz",
    "profile.favorites.title": "Favorites",
    "profile.favorites.subtitle": "Saved products and services you've bookmarked.",
    "profile.favorites.listTitle": "Favorite list",
    "profile.favorites.emptyTitle": "No data yet.",
    "profile.favorites.emptyDesc": "Save items to view them later.",
    "profile.notifications.pageTitle": "Notifications | polyflux.xyz",
    "profile.notifications.title": "Notifications",
    "profile.notifications.subtitle": "Order and system updates will show up here.",
    "profile.notifications.listTitle": "New notifications",
    "profile.notifications.emptyTitle": "No notifications yet.",
    "profile.notifications.emptyDesc": "Check back later.",
    "profile.badges.pageTitle": "Badges | polyflux.xyz",
    "profile.badges.title": "Badges",
    "profile.badges.subtitle": "Track your level and achievements.",
    "profile.badges.listTitle": "Earned badges",
    "profile.badges.emptyTitle": "No badges yet.",
    "profile.badges.emptyDesc": "Complete tasks to unlock.",
    "profile.messages.pageTitle": "Messages | polyflux.xyz",
    "profile.messages.inboxTitle": "Inbox",
    "profile.messages.inboxCount": "1 conversation",
    "profile.messages.searchPlaceholder": "Search...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "Official support",
    "profile.messages.thread.empty": "No other conversations.",
    "profile.messages.back": "Back",
    "profile.messages.user.sub": "Admin support",
    "profile.messages.role.admin": "Admin",
    "profile.messages.day.today": "Today",
    "profile.messages.message.1": "Hi, how can we help you?",
    "profile.messages.message.2": "I'd like to ask about order #.",
    "profile.messages.message.3": "I'm checking now, please wait a moment.",
    "profile.messages.message.4": "Thanks.",
    "profile.messages.emojiLabel": "Emoji",
    "profile.messages.attachLabel": "Attachment",
    "profile.messages.inputPlaceholder": "Type a message...",
    "profile.messages.send": "Send",
    "product.data.gmail-random.name": "Gmail random name",
    "product.data.gmail-random.short": "Full access Gmail random, 7-day warranty.",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "Gmail EDU account for activating multiple perks.",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "US account with KYC, usable for many services.",
    "product.data.tool-checker.name": "Resource checker tool",
    "product.data.tool-checker.short": "Local tool to quickly check live/dead resources.",
    "service.data.fb-boost.name": "Facebook engagement boost",
    "service.data.fb-boost.short": "Increase likes, comments, and shares naturally, 7-day warranty.",
    "service.data.tiktok-view.name": "TikTok view boost",
    "service.data.tiktok-view.short": "TikTok view package for new videos, ideal for content testing.",
    "task.data.review-product.title": "Write a product review on forums",
    "task.data.review-product.short": "Write a detailed review and purchase experience on polyflux.xyz.",
    "task.data.tiktok-video.title": "Create a TikTok video introducing the shop",
    "task.data.tiktok-video.short": "Record a short video reviewing the service with required hashtags.",
  },
  ko: {
    "landing.hero.subtitle": "ë¯¿ì„ ìˆ˜ ìžˆê³  ë¹ ë¥¸ ê±°ëž˜ í”Œëž«í¼ìž…ë‹ˆë‹¤.",
    "landing.hero.buy": "ì§€ê¸ˆ êµ¬ë§¤",
    "landing.hero.explore": "ë” ì•Œì•„ë³´ê¸°",
    "landing.pill.email": "ì´ë©”ì¼",
    "landing.pill.account": "ê³„ì •",
    "landing.pill.software": "ì†Œí”„íŠ¸ì›¨ì–´",
    "landing.pill.interaction": "ì¸í„°ëž™ì…˜ ì„œë¹„ìŠ¤",
    "landing.pill.tools": "ë„êµ¬",
    "landing.pill.other": "ê¸°íƒ€",
    "landing.faq.title": "ìžì£¼ ë¬»ëŠ” ì§ˆë¬¸",
    "landing.faq.subtitle": "polyflux.xyz ê´€ë ¨ ìžì£¼ ë¬»ëŠ” ì§ˆë¬¸ì„ í™•ì¸í•˜ì„¸ìš”",
    "landing.faq.q1": "ë‚´ ì£¼ë¬¸ì„ ì–´ë–»ê²Œ í™•ì¸í•˜ë‚˜ìš”?",
    "landing.faq.a1": "êµ¬ë§¤í•œ ìƒí’ˆì€ êµ¬ë§¤ ë‚´ì—­ì—ì„œ í™•ì¸í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "landing.faq.q2": "ì‚¬ê¸°ì¸ê°€ìš”?",
    "landing.faq.a2": "ê²€ì¦ëœ ê²°ì œ, ê³µê°œ ë¦¬ë·°, í™˜ë¶ˆ ì •ì±…ìœ¼ë¡œ ì•ˆì „ì„ ë³´ìž¥í•©ë‹ˆë‹¤.",
    "landing.faq.q3": "ë¬¸ì˜ê°€ ìžˆëŠ”ë° ì–´ë–»ê²Œ ì—°ë½í•˜ë‚˜ìš”?",
    "landing.faq.a3": "Telegramìœ¼ë¡œ ê´€ë¦¬ìžì—ê²Œ ë¬¸ì˜í•˜ì„¸ìš”.",
    "landing.payments.title": "20ê°œ ì´ìƒì˜ ê²°ì œ ì˜µì…˜",
    "landing.payments.subtitle": "ë¹ ë¥´ê³  ì•ˆì „í•œ ê²°ì œë¥¼ ìœ„í•´ ë‹¤ì–‘í•œ ê²°ì œ ìˆ˜ë‹¨ì„ ì§€ì›í•©ë‹ˆë‹¤.",
    "landing.trusted.title": "ê°€ìž¥ ì‹ ë¢°ë°›ëŠ” ë§ˆì¼“.",
    "landing.trusted.subtitle": "ê³ ê°ì´ ìš°ë¦¬ë¥¼ ì„ íƒí•˜ëŠ” ì´ìœ ë¥¼ í™•ì¸í•˜ì„¸ìš”",
    "landing.stats.orders": "ì´ ì£¼ë¬¸",
    "landing.stats.vouches": "ê²€ì¦ëœ ë¦¬ë·°",
    "landing.stats.instantValue": "ì¦‰ì‹œ",
    "landing.stats.deliveryLabel": "ëª¨ë“  ìƒí’ˆ ì¦‰ì‹œ ì „ë‹¬",
    "landing.products.emptyTitle": "ìƒí’ˆì´ ì—†ìŠµë‹ˆë‹¤",
    "landing.products.emptyDesc": "ê²€ìƒ‰ì–´ë‚˜ ì¹´í…Œê³ ë¦¬ í•„í„°ë¥¼ ì¡°ì •í•´ ë³´ì„¸ìš”.",
    "landing.products.instant": "ì¦‰ì‹œ ì „ë‹¬ ë° ì•ˆì „í•œ ê²°ì œ.",
    "landing.products.add": "ì¶”ê°€",
    "landing.product.email": "ì´ë©”ì¼ {index}",
    "landing.product.account": "ê³„ì • {tier}",
    "landing.product.software": "ì†Œí”„íŠ¸ì›¨ì–´ {tier}",
    "landing.product.interaction": "ì¸í„°ëž™ì…˜ íŒ¨í‚¤ì§€ {index}",
    "landing.product.other": "ê¸°íƒ€ ìƒí’ˆ {index}",
    "landing.tier.basic": "ê¸°ë³¸",
    "landing.tier.pro": "í”„ë¡œ",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "ë¼ì´íŠ¸",
    "landing.tier.plus": "í”ŒëŸ¬ìŠ¤",
    "support.label": "ì§€ì›",
    "support.close": "ë‹«ê¸°",
    "support.header.title": "PolyFlux ì§€ì›",
    "support.header.status": "ì˜¨ë¼ì¸",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "ê´€ë¦¬ìžì™€ ì±„íŒ…",
    "support.faq.title": "FAQ - ìžì£¼ ë¬»ëŠ” ì§ˆë¬¸",
    "support.faq.buyer.title": "I. êµ¬ë§¤ìž",
    "support.faq.buyer.q1": "ì œí’ˆì„ ì–´ë–»ê²Œ êµ¬ë§¤í•˜ë‚˜ìš”?",
    "support.faq.buyer.a1.1": "êµ¬ë§¤ìžëŠ” ì•”í˜¸í™”í ë˜ëŠ” ì€í–‰ ì´ì²´ë¡œ ê²°ì œí•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.buyer.a1.2": "ì•”í˜¸í™”í: ì§€ì •ëœ ê°œì¸ ì§€ê°‘ìœ¼ë¡œ ìž…ê¸ˆí•˜ë©°, ì˜¨ì²´ì¸ ê±°ëž˜ê°€ í™•ì¸ë˜ë©´ ìž”ì•¡ì´ ìžë™ìœ¼ë¡œ ì—…ë°ì´íŠ¸ë©ë‹ˆë‹¤.",
    "support.faq.buyer.a1.3": "ì€í–‰: ì œê³µëœ ì •ë³´ë¡œ ì´ì²´í•˜ë©´, ê²°ì œê°€ í™•ì¸ëœ ë’¤ ì‹œìŠ¤í…œì´ ëŒ€ì¡°í•˜ì—¬ ìž”ì•¡ì„ ì—…ë°ì´íŠ¸í•©ë‹ˆë‹¤.",
    "support.faq.buyer.q2": "ì´ë©”ì¼/ê³„ì • ì¤‘ë³µ ì—†ìŒì€ ë¬´ì—‡ì¸ê°€ìš”?",
    "support.faq.buyer.a2": "ì‹œìŠ¤í…œì€ ì¤‘ë³µ ê²€ì‚¬ë¥¼ í†µí•´ ì´ì „ì— íŒë§¤ë˜ì§€ ì•Šì€ ìƒí’ˆë§Œ ì œê³µí•˜ë©° Zero Duplicate ë°°ì§€ë¥¼ í‘œì‹œí•©ë‹ˆë‹¤.",
    "support.faq.buyer.q3": "ì–´ë–»ê²Œ ì¶©ì „í•˜ë‚˜ìš”?",
    "support.faq.buyer.a3.1": "ì•”í˜¸í™”í: ì¶©ì „ ì„ íƒ -> ì½”ì¸ ì„ íƒ -> ê°œì¸ ì§€ê°‘ìœ¼ë¡œ ì „ì†¡. USDT, USDC, BTC, ETH, BNB, TRX ë“± ì§€ì›.",
    "support.faq.buyer.a3.2": "ì€í–‰: ì¶©ì „ ì„ íƒ -> ì€í–‰ ì´ì²´ -> ì˜¬ë°”ë¥¸ ë©”ëª¨/ê±°ëž˜ ì½”ë“œë¥¼ ìž…ë ¥í•˜ë©´ ì‹œìŠ¤í…œì´ ìžë™ í™•ì¸í•©ë‹ˆë‹¤.",
    "support.faq.buyer.q4": "í™˜ë¶ˆ ìš”ì²­ì´ ê°€ëŠ¥í•œê°€ìš”?",
    "support.faq.buyer.a4": "ê°€ëŠ¥í•©ë‹ˆë‹¤. ëª¨ë“  ì£¼ë¬¸ì€ 3ì¼ ì—ìŠ¤í¬ë¡œ ê¸°ê°„ ë™ì•ˆ ë³´í˜¸ë˜ì–´ ì´ì˜ ì œê¸°ë‚˜ ë¶„ìŸì„ ì§„í–‰í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.buyer.q5": "ì¶©ì „ì´ ì•„ì§ ë„ì°©í•˜ì§€ ì•Šì•˜ë‚˜ìš”?",
    "support.faq.buyer.a5.1": "ì•”í˜¸í™”í: ì²´ì¸/í† í° ì˜¤ë¥˜ ë˜ëŠ” ë„¤íŠ¸ì›Œí¬ í˜¼ìž¡ì¼ ìˆ˜ ìžˆìŠµë‹ˆë‹¤. ëª‡ ë¶„ í›„ì—ë„ ì—…ë°ì´íŠ¸ë˜ì§€ ì•Šìœ¼ë©´ TXIDë¥¼ ë³´ë‚´ì£¼ì„¸ìš”.",
    "support.faq.buyer.a5.2": "ì€í–‰: ì˜ì—…ì‹œê°„ ì™¸ ì´ì²´, ë©”ëª¨ ì˜¤ë¥˜, ë˜ëŠ” ëŒ€ì¡° ëŒ€ê¸°ì¼ ìˆ˜ ìžˆìŠµë‹ˆë‹¤. ì´ì²´ ì¦ë¹™ì„ ì²¨ë¶€í•´ ë¬¸ì˜í•˜ì„¸ìš”.",
    "support.faq.buyer.q6": "ìž˜ëª» ë³´ë‚´ë©´ ì–´ë–»ê²Œ ë˜ë‚˜ìš”?",
    "support.faq.buyer.a6.1": "ì•”í˜¸í™”í: ë¸”ë¡ì²´ì¸ ê±°ëž˜ëŠ” ë˜ëŒë¦´ ìˆ˜ ì—†ìœ¼ë©°, ìž˜ëª»ëœ ì²´ì¸/ì£¼ì†Œë¡œ ë³´ë‚´ë©´ ì˜êµ¬ ì†ì‹¤ë  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.buyer.a6.2": "ì€í–‰: ì‹œìŠ¤í…œì€ ëŒ€ì¡° í™•ì¸ë§Œ ì§€ì›í•˜ë©°, ìž˜ëª»ëœ ì´ì²´ì— ëŒ€í•œ í™˜ë¶ˆì€ ë³´ìž¥ë˜ì§€ ì•ŠìŠµë‹ˆë‹¤.",
    "support.faq.buyer.q7": "ì¤‘ê°œì¸ì´ í•„ìš”í•œê°€ìš”?",
    "support.faq.buyer.a7": "ì•„ë‹ˆìš”. ì‹œìŠ¤í…œì€ ë‚´ìž¥ ì—ìŠ¤í¬ë¡œë¡œ ë™ìž‘í•˜ë©° 3ì¼ ë™ì•ˆ ë³´ê´€ í›„ íŒë§¤ìžì—ê²Œ ì§€ê¸‰í•©ë‹ˆë‹¤.",
    "support.faq.seller.title": "II. íŒë§¤ìž",
    "support.faq.seller.q1": "íŒë§¤ìž ë“±ë¡ì€ ì–´ë–»ê²Œ í•˜ë‚˜ìš”?",
    "support.faq.seller.a1": "ë¡œê·¸ì¸ -> íŒë§¤ìž ë“±ë¡ -> ì •ë³´ ìž…ë ¥ -> ìŠ¹ì¸ ëŒ€ê¸°.",
    "support.faq.seller.q2": "ìƒì ì„ ì–´ë–»ê²Œ ë§Œë“¤ë‚˜ìš”?",
    "support.faq.seller.a2": "ìƒì  ê´€ë¦¬ -> ìƒˆë¡œ ë§Œë“¤ê¸° -> ìƒí’ˆ ì„¤ëª…/ì´ë¯¸ì§€/íŒŒì¼ ì—…ë¡œë“œ.",
    "support.faq.seller.q3": "ìƒì ì„ ì–´ë–»ê²Œ ìµœì í™”í•˜ë‚˜ìš”?",
    "support.faq.seller.a3": "ê³ í’ˆì§ˆ ì´ë¯¸ì§€, ëª…í™•í•œ ì œëª©, ìƒì„¸ ì„¤ëª…, ì•ˆì •ì ì¸ ìƒí’ˆ, ë¹ ë¥¸ ì§€ì›ì„ ì œê³µí•˜ì„¸ìš”. ìˆœìœ„ëŠ” ë§¤ì£¼ ì—…ë°ì´íŠ¸ë©ë‹ˆë‹¤.",
    "support.faq.seller.q4": "ìƒìœ„ ë…¸ì¶œì€ ì–´ë–»ê²Œ í•˜ë‚˜ìš”?",
    "support.faq.seller.a4": "ë§¤ì¶œ, ê³ ê° í‰ê°€, ì‹ ë¢°ë„, ë¶„ìŸë¥ ì— ë”°ë¼ ê²°ì •ë©ë‹ˆë‹¤.",
    "support.faq.seller.q5": "ìˆ˜ìµì€ ì–´ë–»ê²Œ ì²˜ë¦¬ë˜ë‚˜ìš”?",
    "support.faq.seller.a5.1": "ì£¼ë¬¸ ì™„ë£Œ í›„ ìžê¸ˆì€ 3ì¼ê°„ Pending(ì—ìŠ¤í¬ë¡œ) ìƒíƒœë¡œ ìœ ì§€ë©ë‹ˆë‹¤. ì´í›„ íŒë§¤ìžëŠ” ë‹¤ìŒìœ¼ë¡œ ì¶œê¸ˆí•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤:",
    "support.faq.seller.a5.list1": "ì•”í˜¸í™”í: USDT, BTC, ETH, BNB, TRX ë“±.",
    "support.faq.seller.a5.list2": "ì€í–‰ ì´ì²´(í™•ì¸ëœ ê³„ì¢Œ ì •ë³´ ê¸°ì¤€).",
    "support.faq.seller.q6": "ìˆ˜ìˆ˜ë£ŒëŠ” ì–´ë–»ê²Œ ê³„ì‚°ë˜ë‚˜ìš”?",
    "support.faq.seller.a6": "í”Œëž«í¼ì€ ì„±ê³µ ì£¼ë¬¸ë‹¹ 5% ê±°ëž˜ ìˆ˜ìˆ˜ë£Œë¥¼ ë¶€ê³¼í•©ë‹ˆë‹¤. íŒë§¤ìžëŠ” ë¦¬ì…€ëŸ¬ ëª¨ë“œë¥¼ ì¼œì„œ ë§¤ì¶œì„ ëŠ˜ë¦´ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.seller.q7": "ì¶œê¸ˆì€ ì–´ë–»ê²Œ í•˜ë‚˜ìš”?",
    "support.faq.seller.a7": "ì¶œê¸ˆ ì„ íƒ -> ì•”í˜¸í™”í ë˜ëŠ” ì€í–‰ ì„ íƒ -> ì •ë³´ ìž…ë ¥ -> í™•ì¸.",
    "support.faq.seller.q8": "íŒë§¤ìžì˜ ì„¸ê¸ˆ ì˜ë¬´ëŠ” ì–´ë–»ê²Œ ì²˜ë¦¬ë˜ë‚˜ìš”?",
    "support.faq.seller.a8.1": "í”Œëž«í¼ì€ ê±°ëž˜ ì¸í”„ë¼ë¥¼ ì œê³µí•˜ëŠ” ì¤‘ê°œ ì—­í• ë§Œ í•©ë‹ˆë‹¤.",
    "support.faq.seller.a8.2": "íŒë§¤ìžëŠ” ë² íŠ¸ë‚¨ ë²•ë¥ ì— ë”°ë¼ ìžì‹ ì˜ ì†Œë“ì— ëŒ€í•œ ì„¸ê¸ˆì„ ì‹ ê³ Â·ë‚©ë¶€í•  ì±…ìž„ì´ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.seller.a8.3": "í”Œëž«í¼ì€ ì„¸ê¸ˆì„ ì›ì²œì§•ìˆ˜í•˜ê±°ë‚˜ íŒë§¤ìžë¥¼ ëŒ€í‘œí•˜ê±°ë‚˜ ëŒ€ì‹  ë‚©ë¶€í•˜ì§€ ì•ŠìŠµë‹ˆë‹¤.",
    "support.faq.seller.q9": "ê¸ˆì§€ í’ˆëª©ì€ ë¬´ì—‡ì¸ê°€ìš”?",
    "support.faq.seller.a9": "í•´í‚¹ëœ ê³„ì •, ë¶ˆë²• ë°ì´í„°, ì€í–‰ ê³„ì •, ì•…ì„± ë„êµ¬, ë˜ëŠ” ë² íŠ¸ë‚¨ ë²•ë¥ ì´ë‚˜ ì œ3ìž ì•½ê´€ì„ ìœ„ë°˜í•˜ëŠ” ëª¨ë“  ì½˜í…ì¸ .",
    "support.faq.seller.q10": "ì‚¬ìš©ìž ê±°ëž˜ê°€ ê´€ë¦¬ìžì™€ ê´€ë ¨ì´ ìžˆë‚˜ìš”?",
    "support.faq.seller.a10.1": "ì‚¬ìš©ìžê°€ íŒë§¤ ë“±ë¡í•˜ê±°ë‚˜ ìž‘ì—…ì„ ì˜¬ë¦° í•­ëª©ì€ ì‚¬ìš©ìž ê°„ ê±°ëž˜ì´ë©° ê´€ë¦¬ìžì™€ëŠ” ê´€ë ¨ì´ ì—†ìŠµë‹ˆë‹¤.",
    "support.faq.seller.a10.2": "ê´€ë¦¬ìžëŠ” ë¶ˆë²• ë¬¼í’ˆì„ ê±°ëž˜í•˜ì§€ ì•ŠìŠµë‹ˆë‹¤. ë¶ˆë²• ê±°ëž˜ ë˜ëŠ” ê³ ì˜ì  ìœ„ë°˜ì´ ë°œìƒí•˜ë©´ ê´€ë¦¬ìžì—ê²ŒëŠ” ê²Œì‹œë¬¼ ì‚­ì œ ë° ìž”ì•¡ ë™ê²° ê¶Œí•œì´ ìžˆìŠµë‹ˆë‹¤. ì´ í”Œëž«í¼ì—ì„œ íŒë§¤ì— ì°¸ì—¬í•˜ëŠ” ê²ƒì€ ì•½ê´€ì„ ì½ê³  ë™ì˜í•œ ê²ƒìœ¼ë¡œ ê°„ì£¼ë©ë‹ˆë‹¤.",
    "support.faq.seller.q11": "API ì—°ë™?",
    "support.faq.seller.a11": "ê°€ëŠ¥í•©ë‹ˆë‹¤. íŒë§¤ìžëŠ” APIë¥¼ ì—°ë™í•´ ìžë™ ë°°ì†¡ ë° ìž¬ê³  ë™ê¸°í™”ë¥¼ í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.seller.q12": "ë³´ì¦ ì²˜ë¦¬ëŠ” ì–´ë–»ê²Œ í•˜ë‚˜ìš”?",
    "support.faq.seller.a12": "íŒë§¤ëœ ì£¼ë¬¸ -> ë³´ì¦ -> ìˆ˜ëŸ‰ ìž…ë ¥ -> ì‹œìŠ¤í…œì´ ê³ ê°ì—ê²Œ ëŒ€ì²´ ì½”ë“œë¥¼ ìžë™ ë°œì†¡í•©ë‹ˆë‹¤.",
    "support.faq.reseller.title": "III. ë¦¬ì…€ëŸ¬",
    "support.faq.reseller.q1": "ë¦¬ì…€ëŸ¬ê°€ ë˜ë ¤ë©´?",
    "support.faq.reseller.a1": "ê³„ì • ì„¤ì •ì—ì„œ ë¦¬ì…€ëŸ¬ ëª¨ë“œë¥¼ ì¼œì„¸ìš”.",
    "support.faq.reseller.q2": "ë¦¬ì…€ëŸ¬ë¡œ íŒë§¤í•˜ëŠ” ë°©ë²•ì€?",
    "support.faq.reseller.a2": "ì¡°ê±´ì„ ì¶©ì¡±í•˜ëŠ” ìƒí’ˆ ì„ íƒ -> ì¶”ì²œ ë§í¬ ë°œê¸‰ -> ê³µìœ  -> ì‹œìŠ¤í…œì´ ìˆ˜ìˆ˜ë£Œë¥¼ ìžë™ ê¸°ë¡í•©ë‹ˆë‹¤.",
    "support.faq.reseller.q3": "ìˆ˜ìˆ˜ë£Œ ì¶œê¸ˆ?",
    "support.faq.reseller.a3": "ìˆ˜ìˆ˜ë£ŒëŠ” 3ì¼(ì—ìŠ¤í¬ë¡œ) ë³´ê´€ í›„ ì•”í˜¸í™”í ë˜ëŠ” ì€í–‰ìœ¼ë¡œ ì¶œê¸ˆë©ë‹ˆë‹¤.",
    "support.faq.reseller.q4": "ì›”ê°„ ë³´ë„ˆìŠ¤?",
    "support.faq.reseller.a4": "ìžˆìŠµë‹ˆë‹¤. í”Œëž«í¼ì€ ì›”ê°„ ì„±ê³¼ ê¸°ë°˜ ë³´ë„ˆìŠ¤ í”„ë¡œê·¸ëž¨ì„ ìš´ì˜í•©ë‹ˆë‹¤.",
    "support.faq.compliance.title": "IV. ë² íŠ¸ë‚¨ ë²•ë¥  ì¤€ìˆ˜ - AML & ì‚¬ê¸°",
    "support.faq.compliance.q1": "ìžê¸ˆì„¸íƒ ë°©ì§€(AML)",
    "support.faq.compliance.a1.lead": "ì—„ê²©ížˆ ê¸ˆì§€:",
    "support.faq.compliance.a1.list1": "ë¶ˆë²• ìžì‚° ìœ í†µ",
    "support.faq.compliance.a1.list2": "ìžê¸ˆ ì¶œì²˜ ì€ë‹‰",
    "support.faq.compliance.a1.list3": "ìžê¸ˆì„¸íƒ ì˜ì‹¬ ê±°ëž˜",
    "support.faq.compliance.a1.note": "í”Œëž«í¼ì€ í•„ìš” ì‹œ ìžê¸ˆ ë³´ë¥˜, ê³„ì • ìž ê¸ˆ, ì‹ ì› í™•ì¸ ìš”ì²­ ë° ë‹¹êµ­ í˜‘ì¡°ë¥¼ í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "support.faq.compliance.q2": "ì‚¬ê¸° ë°©ì§€",
    "support.faq.compliance.a2.lead": "ì—„ê²©ížˆ ê¸ˆì§€:",
    "support.faq.compliance.a2.list1": "ê°€ì§œ ì£¼ë¬¸",
    "support.faq.compliance.a2.list2": "ë¶„ìŸ ì•…ìš©",
    "support.faq.compliance.a2.list3": "ë‹¤ì¤‘ ê³„ì •",
    "support.faq.compliance.a2.list4": "ë´‡, í•´í‚¹, ì‹œìŠ¤í…œ ì·¨ì•½ì  ì•…ìš©",
    "support.faq.compliance.q3": "ë² íŠ¸ë‚¨ ë²•ë¥  ì¤€ìˆ˜",
    "support.faq.compliance.a3": "ì‚¬ìš©ìžëŠ” ë¶ˆë²• ìƒí’ˆì„ ê±°ëž˜í•˜ê±°ë‚˜ ê°œì¸ì •ë³´/í”„ë¼ì´ë²„ì‹œë¥¼ ì¹¨í•´í•´ì„œëŠ” ì•ˆ ë©ë‹ˆë‹¤.",
    "profile.overview.pageTitle": "ê³„ì • ê°œìš” | polyflux.xyz",
    "profile.overview.title": "ê³„ì • ê°œìš”",
    "profile.overview.subtitle": "ìž”ì•¡, ì£¼ë¬¸, ë³´ì•ˆì„ í•œ ê³³ì—ì„œ í™•ì¸í•˜ì„¸ìš”.",
    "profile.overview.quickInfoTitle": "ë¹ ë¥¸ ì •ë³´",
    "profile.overview.quickInfoDesc": "ìž”ì•¡, ì´ ì£¼ë¬¸, ê³„ì • ë“±ê¸‰...",
    "profile.overview.table.labelItem": "í•­ëª©",
    "profile.overview.table.labelValue": "ê°’",
    "profile.overview.table.labelStatus": "ìƒíƒœ",
    "profile.overview.table.balanceLabel": "ì‚¬ìš© ê°€ëŠ¥ ìž”ì•¡",
    "profile.overview.table.balanceStatus": "ë¯¸ì¶©ì „",
    "profile.overview.table.ordersLabel": "ì´ ì£¼ë¬¸",
    "profile.overview.table.ordersStatus": "ì™„ë£Œ",
    "profile.overview.quickLinks.title": "ë¹ ë¥¸ íƒìƒ‰",
    "profile.overview.quickLinks.profile": "í”„ë¡œí•„",
    "profile.overview.quickLinks.orders": "ì£¼ë¬¸",
    "profile.overview.quickLinks.topups": "ì¶©ì „",
    "profile.overview.quickLinks.logins": "ë¡œê·¸ì¸ ê¸°ë¡",
    "profile.overview.quickLinks.security": "ë³´ì•ˆ & 2FA",
    "profile.public.pageTitle": "í”„ë¡œí•„ | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "ê°€ìž…",
    "profile.public.badgeLabel": "ì¹­í˜¸",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "??? ?? ??",
    "profile.public.copySuccess": "??? ??? ??????.",
    "profile.public.copyFail": "??? ??? ??? ? ????.",
    "profile.public.follow": "íŒ”ë¡œìš°",
    "profile.public.following": "íŒ”ë¡œìž‰",
    "profile.public.followersLabel": "íŒ”ë¡œì›Œ",
    "profile.public.followingLabel": "íŒ”ë¡œìž‰",
    "profile.public.stats.purchased": "êµ¬ë§¤",
    "profile.public.stats.sold": "íŒë§¤",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "ìƒì  ë³´ê¸°",
    "profile.public.featured.title": "ì£¼ìš” ê²Œì‹œë¬¼",
    "profile.public.featured.manage": "ì£¼ìš” ê²Œì‹œë¬¼ íŽ¸ì§‘",
    "profile.public.featured.note": "ì£¼ìš” ê²Œì‹œë¬¼ì€ 30ì¼ í›„ ìžë™ ì‚­ì œë©ë‹ˆë‹¤.",
    "profile.public.featured.emptyTitle": "ì´ ì‚¬ìš©ìžëŠ” ì•„ì§ ì£¼ìš” ê²Œì‹œë¬¼ì„ ì˜¬ë¦¬ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.",
    "profile.public.featured.emptyDesc": "ìƒˆ ê²Œì‹œë¬¼ì€ 30ì¼ í›„ ìžë™ìœ¼ë¡œ ìˆ¨ê²¨ì§‘ë‹ˆë‹¤.",
    "profile.public.story.defaultTitle": "ê²Œì‹œë¬¼ #{index}",
    "profile.public.story.type.video": "ë¹„ë””ì˜¤",
    "profile.public.story.type.image": "ì´ë¯¸ì§€",
    "profile.public.story.titleFallback": "ì£¼ìš” ê²Œì‹œë¬¼",
    "profile.public.story.alt": "ìŠ¤í† ë¦¬",
    "profile.public.manage.title": "í”„ë¡œí•„ ê´€ë¦¬",
    "profile.public.manage.titlePlaceholder": "ê²Œì‹œë¬¼ ì œëª©",
    "profile.public.manage.upload": "ì—…ë¡œë“œ",
    "profile.public.manage.remove": "ì‚­ì œ",
    "profile.public.manage.help": "???? 9:16?? ??? ?? 2MB???. ??? ?? 60??? ???? ???? ? ????.",
    "profile.public.manage.close": "ë‹«ê¸°",
    "profile.public.manage.save": "ë³€ê²½ ì €ìž¥",
    "profile.public.manage.slotLabel": "ìŠ¬ë¡¯ {index}",
    "profile.public.manage.limit.pro": "ìµœëŒ€ 4ê°œ ê²Œì‹œë¬¼, ë¹„ë””ì˜¤ ì§€ì›.",
    "profile.public.manage.limit.basic": "ì¡°ê±´ ë¯¸ì¶©ì¡±, ì‚¬ì§„ 1ê°œë§Œ ê°€ëŠ¥.",
    "profile.public.toast.saveFail": "ì£¼ìš” ê²Œì‹œë¬¼ì„ ì €ìž¥í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "profile.public.toast.loginRequired": "íŒ”ë¡œìš°í•˜ë ¤ë©´ ë¡œê·¸ì¸í•˜ì„¸ìš”.",
    "profile.public.toast.imageOrVideoOnly": "ì´ë¯¸ì§€ ë˜ëŠ” ë¹„ë””ì˜¤ë§Œ ì§€ì›í•©ë‹ˆë‹¤.",
    "profile.public.toast.notEligible": "ë¹„ë””ì˜¤ ë˜ëŠ” ì—¬ëŸ¬ ê²Œì‹œë¬¼ì„ ì—…ë¡œë“œí•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "profile.public.toast.uploadFail": "ì—…ë¡œë“œ ì‹¤íŒ¨.",
    "profile.public.toast.imageTooLarge": "???? 2MB? ?????.",
    "profile.public.toast.imageRatio": "ì´ë¯¸ì§€ëŠ” 9:16 ë¹„ìœ¨ì´ì–´ì•¼ í•©ë‹ˆë‹¤.",
    "profile.public.toast.imageReadFail": "ì´ë¯¸ì§€ë¥¼ ì½ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "profile.public.toast.videoNotEligible": "ë¹„ë””ì˜¤ëŠ” ì¡°ê±´ì„ ì¶©ì¡±í•œ ê³„ì •ì—ì„œë§Œ ê°€ëŠ¥í•©ë‹ˆë‹¤.",
    "profile.public.toast.videoTooLarge": "ë¹„ë””ì˜¤ê°€ 25MBë¥¼ ì´ˆê³¼í•©ë‹ˆë‹¤.",
    "profile.public.toast.videoRatio": "ë¹„ë””ì˜¤ëŠ” 9:16 ë¹„ìœ¨ì´ì–´ì•¼ í•©ë‹ˆë‹¤.",
    "profile.public.toast.videoDuration": "ë¹„ë””ì˜¤ê°€ 60ì´ˆë¥¼ ì´ˆê³¼í•©ë‹ˆë‹¤.",
    "profile.public.toast.videoReadFail": "ë¹„ë””ì˜¤ë¥¼ ì½ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "profile.public.toast.coverReadFail": "ì»¤ë²„ ì´ë¯¸ì§€ë¥¼ ì½ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "product.detail.pageTitle": "ìƒí’ˆ ìƒì„¸ | polyflux.xyz",
    "breadcrumb.home": "í™ˆ",
    "breadcrumb.detail": "ìƒì„¸",
    "product.detail.share": "ê³µìœ ",
    "product.detail.share.copied": "ë³µì‚¬ë¨",
    "product.detail.share.failed": "ë³µì‚¬ ì‹¤íŒ¨",
    "product.detail.favorite": "ì°œ",
    "product.detail.favorite.active": "ì°œë¨",
    "product.detail.otherTitle": "ì´ ìƒì ì˜ ë‹¤ë¥¸ ìƒí’ˆ",
    "product.detail.other.empty": "ë‹¤ë¥¸ ìƒí’ˆì´ ì—†ìŠµë‹ˆë‹¤.",
    "product.detail.order": "ì£¼ë¬¸í•˜ê¸°",
    "product.detail.preorder": "ì˜ˆì•½ ì£¼ë¬¸",
    "product.detail.message": "ë©”ì‹œì§€",
    "product.detail.tab.shop": "ìƒì  ì„¤ëª…",
    "product.detail.tab.reviews": "ë¦¬ë·°",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "ì£¼ë¬¸ í™•ì¸",
    "product.detail.modal.quantity": "ìˆ˜ëŸ‰",
    "product.detail.modal.subtotal": "ì†Œê³„",
    "product.detail.modal.cancel": "ì·¨ì†Œ",
    "product.detail.modal.confirm": "ì£¼ë¬¸ í™•ì¸",
    "product.detail.modal.processing": "ì²˜ë¦¬ ì¤‘...",
    "product.detail.modal.max": "ìµœëŒ€ {max}",
    "product.detail.toast.success": "ì£¼ë¬¸ì´ ì™„ë£Œë˜ì—ˆìŠµë‹ˆë‹¤. ë‚´ ì£¼ë¬¸ì—ì„œ í™•ì¸í•˜ì„¸ìš”.",
    "product.detail.toast.viewOrders": "ì£¼ë¬¸ ë³´ê¸°",
    "product.detail.toast.loginRequired": "ì£¼ë¬¸í•˜ë ¤ë©´ ë¡œê·¸ì¸í•˜ì„¸ìš”.",
    "product.detail.toast.orderFailed": "ì£¼ë¬¸ ì‹¤íŒ¨.",
    "product.detail.notFound": "ìƒí’ˆì„ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤",
    "product.detail.description.pending": "ì„¤ëª…ì´ ì—…ë°ì´íŠ¸ ì¤‘ìž…ë‹ˆë‹¤.",
    "product.detail.rating.positive": "ê¸ì •ì ",
    "product.detail.rating.neutral": "ë³´í†µ",
    "product.detail.rating.negative": "ê°œì„  í•„ìš”",
    "product.detail.rating.none": "í‰ê°€ ì—†ìŒ",
    "product.detail.shopIdLabel": "ìƒì  ID",
    "product.detail.shop.polyflux.title": "PolyFlux ê³µì‹",
    "product.detail.shop.polyflux.bullet1": "ë¹ ë¥¸ ë°°ì†¡, ì „ë‹¬ ì „ ì‚¬ì „ í™•ì¸.",
    "product.detail.shop.polyflux.bullet2": "í•´ê²° ë¶ˆê°€ ì‹œ í™˜ë¶ˆ.",
    "product.detail.shop.polyflux.bullet3": "Telegram 24/7 ì§€ì›.",
    "product.detail.shop.partner.title": "íŒŒíŠ¸ë„ˆ ë§ˆì¼“í”Œë ˆì´ìŠ¤ #1",
    "product.detail.shop.partner.bullet1": "ì•ˆì •ì ì¸ ìž¬ê³ , ëª‡ ë¶„ ë‚´ ë¹ ë¥¸ ë°°ì†¡.",
    "product.detail.shop.partner.bullet2": "ëŒ€ëŸ‰ ì£¼ë¬¸ì— ìµœì ê°€ ì œê³µ.",
    "product.detail.shop.partner.bullet3": "ê³µì§€ëœ ì •ì±…ì— ë”°ë¥¸ ë³´ì¦ ì§€ì›.",
    "product.detail.shop.fallbackTitle": "ì‹ ë¢°í•  ìˆ˜ ìžˆëŠ” ìƒì ",
    "product.detail.shop.fallbackBullet1": "ìˆ˜ë ¹ ì¦‰ì‹œ ìƒí’ˆ í™•ì¸.",
    "product.detail.shop.fallbackBullet2": "ë¬¸ì œ ë°œìƒ ì‹œ ì§€ì›.",
    "product.detail.review.1.text": "ë°°ì†¡ì´ ë¹ ë¥´ê³  ê³„ì •ì´ ìž˜ ìž‘ë™í•©ë‹ˆë‹¤.",
    "product.detail.review.1.time": "2ì‹œê°„ ì „",
    "product.detail.review.2.text": "ì§€ì›ì´ ë¹ ë¥´ê³  ë³´ì¦ì´ ëª…í™•í•©ë‹ˆë‹¤.",
    "product.detail.review.2.time": "1ì¼ ì „",
    "product.detail.review.3.text": "ì„¤ëª… ê·¸ëŒ€ë¡œë¼ ë‹¤ì‹œ êµ¬ë§¤í• ê²Œìš”.",
    "product.detail.review.3.time": "3ì¼ ì „",
    "product.detail.api.title": "ë°°ì†¡ API",
    "product.detail.api.bullet1": "ê²°ì œ í›„ ìžë™ìœ¼ë¡œ ì½”ë“œ ì „ë‹¬.",
    "product.detail.api.bullet2": "REST/JSON í˜¸í™˜.",
    "product.detail.api.bullet3": "í‚¤ ë°œê¸‰ì€ ê´€ë¦¬ìžì—ê²Œ ë¬¸ì˜.",
    "service.detail.pageTitle": "ì„œë¹„ìŠ¤ ìƒì„¸ | polyflux.xyz",
    "service.detail.hero.loadingTitle": "ì„œë¹„ìŠ¤ ë¡œë”© ì¤‘...",
    "service.detail.hero.loadingDesc": "ì„œë¹„ìŠ¤ ì„¤ëª…ì´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "service.detail.info.title": "íŒ¨í‚¤ì§€ ì •ë³´",
    "service.detail.info.desc": "/data/mock-services.jsonì—ì„œ ì½ì–´ì˜µë‹ˆë‹¤. API ì—°ê²° ì‹œ ìƒì„¸ ì„¤ëª…ì´ ì œê³µë©ë‹ˆë‹¤.",
    "service.detail.form.title": "ê²°ì œ í›„ ìš”ì²­ í¼",
    "service.detail.form.desc": "ê²°ì œ ì™„ë£Œ í›„ ê³ ê°ì´ ì´ í¼ì„ ìž‘ì„±í•˜ë©´ ì •í™•í•œ ì„œë¹„ìŠ¤ ì²˜ë¦¬ê°€ ê°€ëŠ¥í•©ë‹ˆë‹¤.",
    "service.detail.form.emailLabel": "ê²°ê³¼ ìˆ˜ì‹  ì´ë©”ì¼",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "ëŒ€ìƒ ë§í¬",
    "service.detail.form.linkPlaceholder": "ì˜ˆ: ê²Œì‹œë¬¼/í”„ë¡œí•„/ì˜ìƒ ë§í¬...",
    "service.detail.form.noteLabel": "ìƒì„¸ ìš”ì²­",
    "service.detail.form.notePlaceholder": "ìš”êµ¬ì‚¬í•­, ìˆ˜ëŸ‰, ì›í•˜ëŠ” ì†ë„ ë“±ì„ ì„¤ëª…...",
    "service.detail.form.save": "ìš”ì²­ ì €ìž¥",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "ì´ í¼ì€ ì–´ë””ì—ë„ ì „ì†¡ë˜ì§€ ì•ŠìŠµë‹ˆë‹¤. API ì—°ê²° í›„ ì´ ë°ì´í„°ë¥¼ ë°±ì—”ë“œë¡œ POSTí•˜ì„¸ìš”.",
    "service.detail.notFound": "ì„œë¹„ìŠ¤ë¥¼ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤",
    "service.detail.noData": "ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤. API ì—°ê²° ë˜ëŠ” JSON ì¶”ê°€ ì‹œ í‘œì‹œë©ë‹ˆë‹¤.",
    "service.detail.fallback.summary": "ì„œë¹„ìŠ¤ ìƒì„¸ ë‚´ìš©ì´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "service.detail.fallback.description": "ì„œë¹„ìŠ¤ ìƒì„¸ ì •ë³´ëŠ” ë°±ì—”ë“œ APIì—ì„œ ë°˜í™˜ë˜ì–´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "task.detail.pageTitle": "ìž‘ì—… ìƒì„¸ | polyflux.xyz",
    "task.detail.hero.loadingTitle": "ìž‘ì—… ë¡œë”© ì¤‘...",
    "task.detail.hero.loadingDesc": "ìž‘ì—… ì„¤ëª…ì´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "task.detail.info.title": "ìž‘ì—… ì •ë³´",
    "task.detail.info.desc": "ë°ì´í„°ëŠ” /data/mock-tasks.jsonì—ì„œ ë¡œë“œë©ë‹ˆë‹¤. API ì—°ê²° ì‹œ ë°±ì—”ë“œì—ì„œ ê°€ì ¸ì˜µë‹ˆë‹¤.",
    "task.detail.report.title": "ë³´ê³  ì œì¶œ",
    "task.detail.report.desc": "ìž‘ì—… ì™„ë£Œ ì¦ë¹™ì„ ì œì¶œí•˜ì„¸ìš”.",
    "task.detail.report.contactLabel": "ì´ë©”ì¼ / ì‚¬ìš©ìžëª…",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "ì¦ë¹™ ë§í¬",
    "task.detail.report.proofPlaceholder": "ì˜ˆ: ê²Œì‹œë¬¼ ë§í¬, ì˜ìƒ",
    "task.detail.report.noteLabel": "ì¶”ê°€ ë©”ëª¨",
    "task.detail.report.notePlaceholder": "ì™„ë£Œí•œ ìž‘ì—…ì„ ê°„ë‹¨ížˆ ì„¤ëª…...",
    "task.detail.report.submit": "ë³´ê³  ì œì¶œ",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "API ì—°ê²° í›„ ì‹œìŠ¤í…œì´ ë³´ê³ ì„œë¥¼ ìˆ˜ì‹ í•˜ê³  ìžë™ ê²€í† í•©ë‹ˆë‹¤.",
    "task.detail.notFound": "ìž‘ì—…ì„ ì°¾ì„ ìˆ˜ ì—†ìŠµë‹ˆë‹¤",
    "task.detail.noData": "ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤. ìž ì‹œ í›„ ë‹¤ì‹œ ì‹œë„í•˜ì„¸ìš”.",
    "task.detail.titleFallback": "ìž‘ì—…",
    "task.detail.fallback.summary": "ìž‘ì—… ìƒì„¸ ì„¤ëª…ì´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "task.detail.fallback.description": "APIê°€ ì¤€ë¹„ë˜ë©´ ìž‘ì—… ìƒì„¸ ì •ë³´ê°€ ì—…ë°ì´íŠ¸ë©ë‹ˆë‹¤.",
    "maintenance.title": "ì„œë²„ ì ê²€",
    "maintenance.desc": "ì‹œìŠ¤í…œ ì ê²€ ì¤‘ìž…ë‹ˆë‹¤. ë¶ˆíŽ¸ì„ ë“œë ¤ ì£„ì†¡í•©ë‹ˆë‹¤. ì ê²€ì€ 1ì‹œê°„ì„ ë„˜ê¸°ì§€ ì•Šì„ ì˜ˆì •ìž…ë‹ˆë‹¤.",
    "cart.pageTitle": "ìž¥ë°”êµ¬ë‹ˆ | polyflux.xyz",
    "cart.items.title": "ìž¥ë°”êµ¬ë‹ˆ ìƒí’ˆ",
    "cart.empty.title": "ìž¥ë°”êµ¬ë‹ˆê°€ ë¹„ì–´ ìžˆìŠµë‹ˆë‹¤.",
    "cart.empty.desc": "APIê°€ ì—°ê²°ë˜ë©´ ì„ íƒí•œ ìƒí’ˆì´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "cart.summary.title": "ì£¼ë¬¸ ìš”ì•½",
    "cart.summary.desc": "ì´ì•¡, ìˆ˜ìˆ˜ë£Œ, í• ì¸ ì½”ë“œ.",
    "cart.summary.couponLabel": "í• ì¸ ì½”ë“œ",
    "cart.summary.couponPlaceholder": "ì½”ë“œ ìž…ë ¥",
    "cart.summary.apply": "ì ìš©",
    "cart.summary.checkout": "ê²°ì œ ì§„í–‰",
    "checkout.pageTitle": "ê²°ì œ | polyflux.xyz",
    "checkout.buyer.title": "êµ¬ë§¤ìž ì •ë³´",
    "checkout.buyer.emailLabel": "ì£¼ë¬¸ ì´ë©”ì¼",
    "checkout.buyer.platformLabel": "ID / ì‚¬ìš©ìžëª…(ì„ íƒ)",
    "checkout.buyer.platformPlaceholder": "ìƒí’ˆ/ì„œë¹„ìŠ¤ì— ë”°ë¼ ë‹¤ë¦„",
    "checkout.note.title": "ì¶”ê°€ ë©”ëª¨",
    "checkout.note.label": "ì£¼ë¬¸ ë©”ëª¨",
    "checkout.note.placeholder": "ì˜ˆ: .txt íŒŒì¼ ì „ë‹¬, ì´ë©”ì¼ë¡œ ì „ì†¡...",
    "checkout.summary.title": "ì£¼ë¬¸ ìš”ì•½",
    "checkout.summary.desc": "ì´ì•¡ ë° ê²°ì œ ìˆ˜ë‹¨.",
    "checkout.summary.emptyTitle": "ìž¥ë°”êµ¬ë‹ˆ ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤.",
    "checkout.summary.emptyDesc": "API ì—°ê²° í›„ í•­ëª©ê³¼ í•©ê³„ê°€ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "checkout.summary.success": "ê²°ì œ ì„±ê³µ",
    "checkout.summary.failed": "ì‹¤íŒ¨ ì‹œë®¬ë ˆì´ì…˜",
    "checkout.success.pageTitle": "ê²°ì œ ì„±ê³µ | polyflux.xyz",
    "checkout.success.title": "ê²°ì œ ì„±ê³µ",
    "checkout.success.desc": "ì£¼ë¬¸ì´ ê¸°ë¡ë˜ì—ˆìŠµë‹ˆë‹¤. API ì—°ê²° í›„ ì£¼ë¬¸ ìƒì„¸ì™€ ë‹¤ìš´ë¡œë“œ ë²„íŠ¼ì´ í‘œì‹œë©ë‹ˆë‹¤.",
    "checkout.success.orders": "ë‚´ ì£¼ë¬¸ ë³´ê¸°",
    "checkout.success.continue": "ê³„ì† ì‡¼í•‘í•˜ê¸°",
    "checkout.failed.pageTitle": "ê²°ì œ ì‹¤íŒ¨ | polyflux.xyz",
    "checkout.failed.title": "ê²°ì œ ì‹¤íŒ¨",
    "checkout.failed.desc": "ê²°ì œë¥¼ ì·¨ì†Œí–ˆê±°ë‚˜ ê²°ì œ ê²Œì´íŠ¸ì›¨ì´ ì˜¤ë¥˜ì¼ ìˆ˜ ìžˆìŠµë‹ˆë‹¤. API ì—°ê²° í›„ ìƒì„¸ ì˜¤ë¥˜ ì½”ë“œê°€ í‘œì‹œë©ë‹ˆë‹¤.",
    "checkout.failed.retry": "ë‹¤ì‹œ ê²°ì œí•˜ê¸°",
    "checkout.failed.backProducts": "ìƒí’ˆìœ¼ë¡œ ëŒì•„ê°€ê¸°",
    "profile.orders.pageTitle": "ì£¼ë¬¸ | polyflux.xyz",
    "profile.orders.title": "ë‚´ ì£¼ë¬¸",
    "profile.orders.subtitle": "ì£¼ë¬¸ ìƒíƒœì™€ ê±°ëž˜ ë‚´ì—­ì„ í™•ì¸í•˜ì„¸ìš”.",
    "profile.orders.history.title": "ì£¼ë¬¸ ë‚´ì—­",
    "profile.orders.table.orderId": "ì£¼ë¬¸ ë²ˆí˜¸",
    "profile.orders.table.product": "ìƒí’ˆ",
    "profile.orders.table.total": "ì´ì•¡",
    "profile.orders.table.status": "ìƒíƒœ",
    "profile.orders.status.completed": "ì™„ë£Œ",
    "profile.orders.status.processing": "ì²˜ë¦¬ ì¤‘",
    "profile.orders.status.cancelled": "ì·¨ì†Œë¨",
    "profile.orders.sample.email": "ì´ë©”ì¼ 1",
    "profile.orders.sample.vip": "VIP ê³„ì •",
    "profile.orders.sample.interaction": "ì¸í„°ëž™ì…˜ íŒ¨í‚¤ì§€ 3",
    "profile.history.pageTitle": "ê³„ì • ë‚´ì—­ | polyflux.xyz",
    "profile.history.title": "ê³„ì • ë‚´ì—­",
    "profile.history.subtitle": "ìµœê·¼ ì¶©ì „, ì¸ì¶œ ë° êµ¬ë§¤ ë‚´ì—­ì„ í™•ì¸í•˜ì„¸ìš”.",
    "profile.history.sectionTitle": "ìµœê·¼ í™œë™",
    "profile.history.table.date": "ë‚ ì§œ",
    "profile.history.table.type": "ìœ í˜•",
    "profile.history.table.amount": "ê¸ˆì•¡",
    "profile.history.table.status": "ìƒíƒœ",
    "profile.history.type.topup": "ì¶©ì „",
    "profile.history.type.withdraw": "ì¸ì¶œ",
    "profile.history.type.order": "ì£¼ë¬¸",
    "profile.history.status.success": "ì„±ê³µ",
    "profile.history.status.processing": "ì²˜ë¦¬ ì¤‘",
    "profile.history.status.completed": "ì™„ë£Œ",
    "profile.tasks.pageTitle": "ìˆ˜ë½í•œ ìž‘ì—… | polyflux.xyz",
    "profile.tasks.title": "ìˆ˜ë½í•œ ìž‘ì—…",
    "profile.tasks.subtitle": "ìˆ˜ë½í•œ ìž‘ì—…ì„ í™•ì¸í•˜ì„¸ìš”.",
    "profile.tasks.sectionTitle": "ìˆ˜ë½í•œ ìž‘ì—… ëª©ë¡",
    "profile.tasks.table.task": "ìž‘ì—…",
    "profile.tasks.table.receivedAt": "ìˆ˜ë½ì¼",
    "profile.tasks.table.deadline": "ë§ˆê°ì¼",
    "profile.tasks.table.reward": "ë³´ìƒ",
    "profile.tasks.table.status": "ìƒíƒœ",
    "profile.tasks.emptyTitle": "ìˆ˜ë½í•œ ìž‘ì—…ì´ ì—†ìŠµë‹ˆë‹¤.",
    "profile.tasks.emptyDesc": "ìƒˆ ìž‘ì—…ì„ ìˆ˜ë½í•˜ë©´ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "profile.topups.pageTitle": "ì¶©ì „ | polyflux.xyz",
    "profile.topups.title": "ê³„ì • ì¶©ì „",
    "profile.topups.subtitle": "ì¶©ì „ ê¸ˆì•¡ì„ ìž…ë ¥í•˜ì„¸ìš”: ìµœì†Œ 10,000Ä‘, ìµœëŒ€ 499,000,000Ä‘. ê° ì¶©ì „ì— ëŒ€í•´ QRì´ ìƒì„±ë©ë‹ˆë‹¤.",
    "profile.topups.guard.title": "ë¡œê·¸ì¸ í•„ìš”:",
    "profile.topups.guard.desc": "ì§€ê°‘ì— ì¶©ì „í•˜ë ¤ë©´ ë¡œê·¸ì¸í•´ì•¼ í•©ë‹ˆë‹¤.",
    "profile.topups.bank.title": "ì€í–‰ ì¶©ì „ (QR)",
    "profile.topups.bank.desc": "ì€í–‰ ì•±ìœ¼ë¡œ QRì„ ìŠ¤ìº”í•˜ì„¸ìš”. ì´ì²´ í›„ ìžë™ìœ¼ë¡œ ìž”ì•¡ì´ ì¶©ì „ë©ë‹ˆë‹¤.",
    "profile.topups.bank.qrPlaceholder": "QRì€ ìƒì„± í›„ í‘œì‹œë©ë‹ˆë‹¤.",
    "profile.topups.bank.codeLabel": "ì˜ˆê¸ˆì£¼ëª…",
    "profile.topups.bank.amountLabel": "ê¸ˆì•¡",
    "profile.topups.bank.amountInputLabel": "ì¶©ì „ ê¸ˆì•¡ (VND)",
    "profile.topups.bank.amountPlaceholder": "ì˜ˆ: 100000",
    "profile.topups.bank.amountHint": "ìµœì†Œ 10,000Ä‘, ìµœëŒ€ 499,000,000Ä‘.",
    "profile.topups.bank.generate": "QR ìƒì„±",
    "profile.topups.bank.toast.invalidAmount": "ìœ íš¨í•œ ê¸ˆì•¡ì„ ìž…ë ¥í•˜ì„¸ìš”.",
    "profile.topups.bank.toast.range": "ê¸ˆì•¡ì€ {min} ~ {max} Ä‘ ì‚¬ì´ì—¬ì•¼ í•©ë‹ˆë‹¤.",
    "profile.topups.bank.toast.created": "QRì´ ìƒì„±ë˜ì—ˆìŠµë‹ˆë‹¤. ìŠ¤ìº”í•˜ì—¬ ì¶©ì „í•˜ì„¸ìš”.",
    "profile.topups.bank.toast.failed": "ì§€ê¸ˆì€ QRì„ ìƒì„±í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
    "profile.topups.crypto.notice": "ì•”í˜¸í™”í ì¶©ì „ì€ ì¼ì‹œì ìœ¼ë¡œ ì‚¬ìš©í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤. ì€í–‰ì„ ì´ìš©í•˜ì„¸ìš”.",
    "profile.topups.crypto.title": "ì•”í˜¸í™”í ì¶©ì „ (USDT TRC20)",
    "profile.topups.crypto.desc": "USDT TRC20ìœ¼ë¡œ ì¶©ì „í•©ë‹ˆë‹¤. ì˜¨ì²´ì¸ í™•ì¸ í›„ ìž”ì•¡ì´ ì¶”ê°€ë©ë‹ˆë‹¤.",
    "profile.topups.crypto.addressLabel": "TRC20 ì§€ê°‘ ì£¼ì†Œ",
    "profile.topups.crypto.amountLabel": "USDT ìˆ˜ëŸ‰",
    "profile.topups.crypto.amountPlaceholder": "ì˜ˆ: 10",
    "profile.topups.crypto.confirm": "ì´ì²´ ì™„ë£Œ",
    "profile.topups.withdraw.title": "ì¶œê¸ˆ",
    "profile.topups.withdraw.desc": "í˜„ìž¬ ìž”ì•¡ì— ë”°ë¼ ì¶œê¸ˆ ê¸ˆì•¡ì„ ìž…ë ¥í•˜ì„¸ìš”. ìµœì†Œ 50,000Ä‘, ìµœëŒ€ 499,000,000Ä‘.",
    "profile.topups.withdraw.balanceLabel": "ì‚¬ìš© ê°€ëŠ¥ ìž”ì•¡:",
    "profile.topups.withdraw.amountLabel": "ì¶œê¸ˆ ê¸ˆì•¡ (VND)",
    "profile.topups.withdraw.amountPlaceholder": "ì˜ˆ: 500000",
    "profile.topups.withdraw.amountHint": "ìµœì†Œ 50,000Ä‘, ìµœëŒ€ 499,000,000Ä‘.",
    "profile.topups.withdraw.bankLabel": "ì€í–‰",
    "profile.topups.withdraw.bankPlaceholder": "ì˜ˆ: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "ê³„ì¢Œ ë²ˆí˜¸",
    "profile.topups.withdraw.accountPlaceholder": "ê³„ì¢Œ ë²ˆí˜¸ ìž…ë ¥",
    "profile.topups.withdraw.nameLabel": "ì˜ˆê¸ˆì£¼ëª…",
    "profile.topups.withdraw.namePlaceholder": "ì˜ˆê¸ˆì£¼ ì„±ëª…",
    "profile.topups.withdraw.submit": "ì¶œê¸ˆ ìš”ì²­ ì œì¶œ",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "ìš”ì²­ì€ ì´ì²´ ì „ì— ê´€ë¦¬ìž ìŠ¹ì¸ì„ ê±°ì¹©ë‹ˆë‹¤.",
    "profile.topups.history.topup.title": "ìµœê·¼ ì¶©ì „ ë‚´ì—­",
    "profile.topups.history.withdraw.title": "ì¶œê¸ˆ ë‚´ì—­",
    "profile.topups.history.table.date": "ì¼ì‹œ",
    "profile.topups.history.table.amount": "ê¸ˆì•¡",
    "profile.topups.history.table.bank": "ì€í–‰",
    "profile.topups.history.table.status": "ìƒíƒœ",
    "profile.topups.status.pending": "ê²€í†  ì¤‘",
    "profile.topups.status.completed": "ì²˜ë¦¬ ì™„ë£Œ",
    "profile.topups.status.rejected": "ê±°ì ˆ",
    "profile.security.pageTitle": "ë³´ì•ˆ & 2FA | polyflux.xyz",
    "profile.security.title": "ë³´ì•ˆ & 2FA",
    "profile.security.subtitle": "ê³„ì • ë³´ì•ˆì„ ê°•í™”í•˜ê³  ì ‘ê·¼ì„ ì œì–´í•˜ì„¸ìš”.",
    "profile.security.password.title": "ë¹„ë°€ë²ˆí˜¸ ë³€ê²½",
    "profile.security.password.desc": "ì •ê¸°ì ìœ¼ë¡œ ë¹„ë°€ë²ˆí˜¸ë¥¼ ë³€ê²½í•˜ì—¬ ê³„ì •ì„ ë” ì•ˆì „í•˜ê²Œ ë³´í˜¸í•˜ì„¸ìš”.",
    "profile.security.password.currentLabel": "í˜„ìž¬ ë¹„ë°€ë²ˆí˜¸",
    "profile.security.password.currentPlaceholder": "í˜„ìž¬ ë¹„ë°€ë²ˆí˜¸ ìž…ë ¥",
    "profile.security.password.newLabel": "ìƒˆ ë¹„ë°€ë²ˆí˜¸",
    "profile.security.password.newPlaceholder": "ìµœì†Œ 8ìž",
    "profile.security.password.confirmLabel": "ìƒˆ ë¹„ë°€ë²ˆí˜¸ í™•ì¸",
    "profile.security.password.confirmPlaceholder": "ìƒˆ ë¹„ë°€ë²ˆí˜¸ ë‹¤ì‹œ ìž…ë ¥",
    "profile.security.password.submit": "ë¹„ë°€ë²ˆí˜¸ ë³€ê²½",
    "profile.security.2fa.title": "2ë‹¨ê³„ ì¸ì¦ (2FA)",
    "profile.security.2fa.desc": "ë¡œê·¸ì¸ ì‹œ ì¸ì¦ ì½”ë“œë¥¼ ìš”êµ¬í•˜ë„ë¡ 2FAë¥¼ í™œì„±í™”í•˜ì„¸ìš”.",
    "profile.security.2fa.recoveryLabel": "ë³µêµ¬ ì½”ë“œ",
    "profile.security.2fa.deviceLabel": "ì‹ ë¢° ê¸°ê¸°",
    "profile.security.2fa.deviceNone": "ì¶”ê°€ëœ ê¸°ê¸°ê°€ ì—†ìŠµë‹ˆë‹¤.",
    "profile.security.2fa.enable": "2FA í™œì„±í™”",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "API ì—°ê²° í›„ 2FA ì„¤ì •ê³¼ ê¸°ê¸° ëª©ë¡ì„ ì €ìž¥í•©ë‹ˆë‹¤.",
    "profile.favorites.pageTitle": "ì¦ê²¨ì°¾ê¸° | polyflux.xyz",
    "profile.favorites.title": "ì¦ê²¨ì°¾ê¸°",
    "profile.favorites.subtitle": "ì €ìž¥í•œ ìƒí’ˆê³¼ ì„œë¹„ìŠ¤ë¥¼ í™•ì¸í•˜ì„¸ìš”.",
    "profile.favorites.listTitle": "ì¦ê²¨ì°¾ê¸° ëª©ë¡",
    "profile.favorites.emptyTitle": "ë°ì´í„°ê°€ ì—†ìŠµë‹ˆë‹¤.",
    "profile.favorites.emptyDesc": "ìƒí’ˆì„ ì €ìž¥í•˜ë©´ ë‚˜ì¤‘ì— ë‹¤ì‹œ ë³¼ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
    "profile.notifications.pageTitle": "ì•Œë¦¼ | polyflux.xyz",
    "profile.notifications.title": "ì•Œë¦¼",
    "profile.notifications.subtitle": "ì£¼ë¬¸ ë° ì‹œìŠ¤í…œ ì—…ë°ì´íŠ¸ê°€ ì—¬ê¸°ì— í‘œì‹œë©ë‹ˆë‹¤.",
    "profile.notifications.listTitle": "ìƒˆ ì•Œë¦¼",
    "profile.notifications.emptyTitle": "ì•Œë¦¼ì´ ì—†ìŠµë‹ˆë‹¤.",
    "profile.notifications.emptyDesc": "ë‚˜ì¤‘ì— ë‹¤ì‹œ í™•ì¸í•˜ì„¸ìš”.",
    "profile.badges.pageTitle": "ë°°ì§€ | polyflux.xyz",
    "profile.badges.title": "ë°°ì§€",
    "profile.badges.subtitle": "ë ˆë²¨ê³¼ ì„±ê³¼ë¥¼ í™•ì¸í•˜ì„¸ìš”.",
    "profile.badges.listTitle": "íšë“í•œ ë°°ì§€",
    "profile.badges.emptyTitle": "ì•„ì§ ë°°ì§€ê°€ ì—†ìŠµë‹ˆë‹¤.",
    "profile.badges.emptyDesc": "ìž‘ì—…ì„ ì™„ë£Œí•´ ìž ê¸ˆ í•´ì œí•˜ì„¸ìš”.",
    "profile.messages.pageTitle": "ë©”ì‹œì§€ | polyflux.xyz",
    "profile.messages.inboxTitle": "ë°›ì€íŽ¸ì§€í•¨",
    "profile.messages.inboxCount": "ëŒ€í™” 1ê°œ",
    "profile.messages.searchPlaceholder": "ê²€ìƒ‰...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "ê³µì‹ ì§€ì›",
    "profile.messages.thread.empty": "ë‹¤ë¥¸ ëŒ€í™”ê°€ ì—†ìŠµë‹ˆë‹¤.",
    "profile.messages.back": "ë’¤ë¡œ",
    "profile.messages.user.sub": "ê´€ë¦¬ìž ì§€ì›",
    "profile.messages.role.admin": "ê´€ë¦¬ìž",
    "profile.messages.day.today": "ì˜¤ëŠ˜",
    "profile.messages.message.1": "ì•ˆë…•í•˜ì„¸ìš”, ë¬´ì—‡ì„ ë„ì™€ë“œë¦´ê¹Œìš”?",
    "profile.messages.message.2": "ì£¼ë¬¸ # ì •ë³´ë¥¼ ë¬¸ì˜í•˜ê³  ì‹¶ìŠµë‹ˆë‹¤.",
    "profile.messages.message.3": "í™•ì¸ ì¤‘ìž…ë‹ˆë‹¤. ìž ì‹œë§Œ ê¸°ë‹¤ë ¤ ì£¼ì„¸ìš”.",
    "profile.messages.message.4": "ê°ì‚¬í•©ë‹ˆë‹¤.",
    "profile.messages.emojiLabel": "ì´ëª¨ì§€",
    "profile.messages.attachLabel": "ì²¨ë¶€",
    "profile.messages.inputPlaceholder": "ë©”ì‹œì§€ ìž…ë ¥...",
    "profile.messages.send": "ë³´ë‚´ê¸°",
    "product.data.gmail-random.name": "Gmail ëžœë¤ ì´ë¦„",
    "product.data.gmail-random.short": "Gmail ëžœë¤ ì „ì²´ ê¶Œí•œ, 7ì¼ ë³´ì¦.",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "ì—¬ëŸ¬ í˜œíƒì„ í™œì„±í™”í•˜ëŠ” Gmail EDU ê³„ì •.",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "KYC ì™„ë£Œëœ ë¯¸êµ­ ê³„ì •, ë‹¤ì–‘í•œ ì„œë¹„ìŠ¤ì— ì‚¬ìš©.",
    "product.data.tool-checker.name": "ë¦¬ì†ŒìŠ¤ ì²´ì»¤ ë„êµ¬",
    "product.data.tool-checker.short": "ë¼ì´ë¸Œ/ë°ë“œ ë¦¬ì†ŒìŠ¤ë¥¼ ë¹ ë¥´ê²Œ í™•ì¸í•˜ëŠ” ë¡œì»¬ ë„êµ¬.",
    "service.data.fb-boost.name": "Facebook ì°¸ì—¬ ì¦ëŒ€ ì„œë¹„ìŠ¤",
    "service.data.fb-boost.short": "ìžì—°ìŠ¤ëŸ¬ìš´ ì¢‹ì•„ìš”/ëŒ“ê¸€/ê³µìœ  ì¦ê°€, 7ì¼ ë³´ì¦.",
    "service.data.tiktok-view.name": "TikTok ì¡°íšŒìˆ˜ ì¦ê°€",
    "service.data.tiktok-view.short": "ìƒˆ ì˜ìƒìš© TikTok ì¡°íšŒìˆ˜ íŒ¨í‚¤ì§€, ì½˜í…ì¸  í…ŒìŠ¤íŠ¸ì— ì í•©.",
    "task.data.review-product.title": "í¬ëŸ¼ì— ìƒí’ˆ ë¦¬ë·° ìž‘ì„±",
    "task.data.review-product.short": "polyflux.xyz êµ¬ë§¤ ê²½í—˜ê³¼ ìƒì„¸ ë¦¬ë·° ìž‘ì„±.",
    "task.data.tiktok-video.title": "ìƒµ ì†Œê°œ TikTok ì˜ìƒ ì œìž‘",
    "task.data.tiktok-video.short": "ì„œë¹„ìŠ¤ ë¦¬ë·° ì§§ì€ ì˜ìƒ ì´¬ì˜, ìš”êµ¬ í•´ì‹œíƒœê·¸ í¬í•¨.",
  },
  ja: {
    "landing.hero.subtitle": "ä¿¡é ¼ã§ãã‚‹é«˜é€Ÿãªå–å¼•ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã§ã™ã€‚",
    "landing.hero.buy": "ä»Šã™ãè³¼å…¥",
    "landing.hero.explore": "ã‚‚ã£ã¨è¦‹ã‚‹",
    "landing.pill.email": "ãƒ¡ãƒ¼ãƒ«",
    "landing.pill.account": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆ",
    "landing.pill.software": "ã‚½ãƒ•ãƒˆã‚¦ã‚§ã‚¢",
    "landing.pill.interaction": "ã‚¨ãƒ³ã‚²ãƒ¼ã‚¸ãƒ¡ãƒ³ãƒˆã‚µãƒ¼ãƒ“ã‚¹",
    "landing.pill.tools": "ãƒ„ãƒ¼ãƒ«",
    "landing.pill.other": "ãã®ä»–",
    "landing.faq.title": "ã‚ˆãã‚ã‚‹è³ªå•",
    "landing.faq.subtitle": "polyflux.xyz ã«é–¢ã™ã‚‹ã‚ˆãã‚ã‚‹è³ªå•ã®å›žç­”ã‚’ç¢ºèªã§ãã¾ã™",
    "landing.faq.q1": "æ³¨æ–‡ã‚’ç¢ºèªã™ã‚‹ã«ã¯ï¼Ÿ",
    "landing.faq.a1": "è³¼å…¥ã—ãŸå•†å“ã¯è³¼å…¥å±¥æ­´ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "landing.faq.q2": "è©æ¬ºã§ã™ã‹ï¼Ÿ",
    "landing.faq.a2": "èªè¨¼æ¸ˆã¿æ±ºæ¸ˆã€å…¬é–‹ãƒ¬ãƒ“ãƒ¥ãƒ¼ã€è¿”é‡‘ãƒãƒªã‚·ãƒ¼ã§å®‰å…¨ã‚’å®ˆã‚Šã¾ã™ã€‚",
    "landing.faq.q3": "è³ªå•ãŒã‚ã‚Šã¾ã™ã€‚ã©ã†ã‚„ã£ã¦é€£çµ¡ã™ã‚Œã°ã„ã„ã§ã™ã‹ï¼Ÿ",
    "landing.faq.a3": "Telegramã§ç®¡ç†è€…ã«é€£çµ¡ã—ã¦ãã ã•ã„ã€‚",
    "landing.payments.title": "20ç¨®é¡žä»¥ä¸Šã®æ”¯æ‰•ã„æ–¹æ³•",
    "landing.payments.subtitle": "ã‚¹ãƒ”ãƒ¼ãƒ‡ã‚£ãƒ¼ã§å®‰å…¨ãªæ±ºæ¸ˆã®ãŸã‚ã€å¤šæ§˜ãªæ”¯æ‰•ã„æ–¹æ³•ã«å¯¾å¿œã—ã¦ã„ã¾ã™ã€‚",
    "landing.trusted.title": "æœ€ã‚‚ä¿¡é ¼ã•ã‚Œã‚‹ãƒžãƒ¼ã‚±ãƒƒãƒˆã€‚",
    "landing.trusted.subtitle": "ãŠå®¢æ§˜ãŒé¸ã¶ç†ç”±ã‚’ã”è¦§ãã ã•ã„",
    "landing.stats.orders": "ç·æ³¨æ–‡æ•°",
    "landing.stats.vouches": "æ¤œè¨¼æ¸ˆã¿ãƒ¬ãƒ“ãƒ¥ãƒ¼",
    "landing.stats.instantValue": "å³æ™‚",
    "landing.stats.deliveryLabel": "ã™ã¹ã¦å³æ™‚é…é”",
    "landing.products.emptyTitle": "å•†å“ãŒè¦‹ã¤ã‹ã‚Šã¾ã›ã‚“",
    "landing.products.emptyDesc": "æ¤œç´¢ã‚„ã‚«ãƒ†ã‚´ãƒªã®ãƒ•ã‚£ãƒ«ã‚¿ãƒ¼ã‚’èª¿æ•´ã—ã¦ã¿ã¦ãã ã•ã„ã€‚",
    "landing.products.instant": "å³æ™‚é…é€ã¨å®‰å…¨ãªæ±ºæ¸ˆã€‚",
    "landing.products.add": "è¿½åŠ ",
    "landing.product.email": "ãƒ¡ãƒ¼ãƒ« {index}",
    "landing.product.account": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆ {tier}",
    "landing.product.software": "ã‚½ãƒ•ãƒˆã‚¦ã‚§ã‚¢ {tier}",
    "landing.product.interaction": "ã‚¤ãƒ³ã‚¿ãƒ©ã‚¯ã‚·ãƒ§ãƒ³ãƒ‘ãƒƒã‚±ãƒ¼ã‚¸ {index}",
    "landing.product.other": "ãã®ä»–ã‚¢ã‚¤ãƒ†ãƒ  {index}",
    "landing.tier.basic": "ãƒ™ãƒ¼ã‚·ãƒƒã‚¯",
    "landing.tier.pro": "ãƒ—ãƒ­",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "ãƒ©ã‚¤ãƒˆ",
    "landing.tier.plus": "ãƒ—ãƒ©ã‚¹",
    "support.label": "ã‚µãƒãƒ¼ãƒˆ",
    "support.close": "é–‰ã˜ã‚‹",
    "support.header.title": "PolyFlux ã‚µãƒãƒ¼ãƒˆ",
    "support.header.status": "ã‚ªãƒ³ãƒ©ã‚¤ãƒ³",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "ç®¡ç†è€…ã¨ãƒãƒ£ãƒƒãƒˆ",
    "support.faq.title": "FAQ - ã‚ˆãã‚ã‚‹è³ªå•",
    "support.faq.buyer.title": "I. è³¼å…¥è€…",
    "support.faq.buyer.q1": "å•†å“ã¯ã©ã†è³¼å…¥ã—ã¾ã™ã‹ï¼Ÿ",
    "support.faq.buyer.a1.1": "è³¼å…¥è€…ã¯æš—å·è³‡ç”£ã¾ãŸã¯éŠ€è¡ŒæŒ¯è¾¼ã§æ”¯æ‰•ãˆã¾ã™ã€‚",
    "support.faq.buyer.a1.2": "æš—å·è³‡ç”£: æŒ‡å®šã•ã‚ŒãŸå€‹äººã‚¦ã‚©ãƒ¬ãƒƒãƒˆã«å…¥é‡‘ã—ã€ã‚ªãƒ³ãƒã‚§ãƒ¼ãƒ³å–å¼•ã®ç¢ºèªå¾Œã«æ®‹é«˜ãŒè‡ªå‹•æ›´æ–°ã•ã‚Œã¾ã™ã€‚",
    "support.faq.buyer.a1.3": "éŠ€è¡Œ: æä¾›ã•ã‚ŒãŸæƒ…å ±ã«å¾“ã£ã¦æŒ¯è¾¼ã—ã€æ±ºæ¸ˆç¢ºèªå¾Œã«ã‚·ã‚¹ãƒ†ãƒ ãŒç…§åˆã—ã¦æ®‹é«˜ã‚’æ›´æ–°ã—ã¾ã™ã€‚",
    "support.faq.buyer.q2": "ãƒ¡ãƒ¼ãƒ«/ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã®é‡è¤‡ãªã—ã¨ã¯ï¼Ÿ",
    "support.faq.buyer.a2": "é‡è¤‡ãƒã‚§ãƒƒã‚¯ã¨Zero Duplicateãƒãƒƒã‚¸ã«ã‚ˆã‚Šã€ä»¥å‰ã«è²©å£²ã•ã‚Œã¦ã„ãªã„å•†å“ã§ã‚ã‚‹ã“ã¨ã‚’ä¿è¨¼ã—ã¾ã™ã€‚",
    "support.faq.buyer.q3": "ãƒãƒ£ãƒ¼ã‚¸ã™ã‚‹ã«ã¯ï¼Ÿ",
    "support.faq.buyer.a3.1": "æš—å·è³‡ç”£: ãƒãƒ£ãƒ¼ã‚¸ã‚’é¸æŠž -> ã‚³ã‚¤ãƒ³ã‚’é¸æŠž -> å€‹äººã‚¦ã‚©ãƒ¬ãƒƒãƒˆã¸é€é‡‘ã€‚USDTã€USDCã€BTCã€ETHã€BNBã€TRXãªã©ã«å¯¾å¿œã€‚",
    "support.faq.buyer.a3.2": "éŠ€è¡Œ: ãƒãƒ£ãƒ¼ã‚¸ -> éŠ€è¡ŒæŒ¯è¾¼ -> æ­£ã—ã„å…¥é‡‘å†…å®¹/å–å¼•ã‚³ãƒ¼ãƒ‰ã§é€é‡‘ã™ã‚‹ã¨è‡ªå‹•ç¢ºèªã•ã‚Œã¾ã™ã€‚",
    "support.faq.buyer.q4": "è¿”é‡‘ã‚’ä¾é ¼ã§ãã¾ã™ã‹ï¼Ÿ",
    "support.faq.buyer.a4": "ã¯ã„ã€‚å„æ³¨æ–‡ã«ã¯3æ—¥é–“ã®ã‚¨ã‚¹ã‚¯ãƒ­ãƒ¼æœŸé–“ãŒã‚ã‚Šã€å•é¡ŒãŒã‚ã‚Œã°ç•°è­°ç”³ç«‹ã¦ã‚„ç´›äº‰ã‚’é–‹å§‹ã§ãã¾ã™ã€‚",
    "support.faq.buyer.q5": "å…¥é‡‘ãŒã¾ã å±Šãã¾ã›ã‚“",
    "support.faq.buyer.a5.1": "æš—å·è³‡ç”£: ãƒã‚§ãƒ¼ãƒ³/ãƒˆãƒ¼ã‚¯ãƒ³ã®èª¤ã‚Šã‚„ãƒãƒƒãƒˆãƒ¯ãƒ¼ã‚¯æ··é›‘ã®å¯èƒ½æ€§ãŒã‚ã‚Šã¾ã™ã€‚æ•°åˆ†çµŒã£ã¦ã‚‚æ›´æ–°ã•ã‚Œãªã„å ´åˆã¯TXIDã‚’é€ã£ã¦ãã ã•ã„ã€‚",
    "support.faq.buyer.a5.2": "éŠ€è¡Œ: å–¶æ¥­æ™‚é–“å¤–ã®é€é‡‘ã€è¨˜è¼‰å†…å®¹ã®èª¤ã‚Šã€ç…§åˆå¾…ã¡ã®å¯èƒ½æ€§ãŒã‚ã‚Šã¾ã™ã€‚å–å¼•è¨¼æ˜Žã®ç”»åƒã‚’æ·»ãˆã¦ã‚µãƒãƒ¼ãƒˆã«é€£çµ¡ã—ã¦ãã ã•ã„ã€‚",
    "support.faq.buyer.q6": "èª¤é€é‡‘ã—ãŸå ´åˆã¯ï¼Ÿ",
    "support.faq.buyer.a6.1": "æš—å·è³‡ç”£: ãƒ–ãƒ­ãƒƒã‚¯ãƒã‚§ãƒ¼ãƒ³å–å¼•ã¯å–ã‚Šæ¶ˆã›ãšã€èª¤ã£ãŸãƒã‚§ãƒ¼ãƒ³/ã‚¢ãƒ‰ãƒ¬ã‚¹ã¸ã®é€é‡‘ã¯æ°¸ä¹…ã«å¤±ã‚ã‚Œã‚‹å¯èƒ½æ€§ãŒã‚ã‚Šã¾ã™ã€‚",
    "support.faq.buyer.a6.2": "éŠ€è¡Œ: ã‚·ã‚¹ãƒ†ãƒ ã¯ç…§åˆç¢ºèªã®ã¿ã‚’æ”¯æ´ã—ã€èª¤ã£ãŸé€é‡‘ã®è¿”é‡‘ã¯ä¿è¨¼ã•ã‚Œã¾ã›ã‚“ã€‚",
    "support.faq.buyer.q7": "ä»²ä»‹ã¯å¿…è¦ã§ã™ã‹ï¼Ÿ",
    "support.faq.buyer.a7": "ã„ã„ãˆã€‚ã‚·ã‚¹ãƒ†ãƒ ã¯çµ±åˆã‚¨ã‚¹ã‚¯ãƒ­ãƒ¼ã¨ã—ã¦å‹•ä½œã—ã€3æ—¥é–“ä¿ç•™ã—ãŸå¾Œã«è²©å£²è€…ã¸æ”¯æ‰•ã„ã¾ã™ã€‚",
    "support.faq.seller.title": "II. è²©å£²è€…",
    "support.faq.seller.q1": "è²©å£²è€…ç™»éŒ²ã¯ã©ã†è¡Œã„ã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a1": "ãƒ­ã‚°ã‚¤ãƒ³ -> Sellerç™»éŒ² -> å¿…è¦æƒ…å ±å…¥åŠ› -> æ‰¿èªå¾…ã¡ã€‚",
    "support.faq.seller.q2": "ã‚·ãƒ§ãƒƒãƒ—ã‚’ä½œæˆã™ã‚‹ã«ã¯ï¼Ÿ",
    "support.faq.seller.a2": "ã‚·ãƒ§ãƒƒãƒ—ç®¡ç† -> æ–°è¦ä½œæˆ -> å•†å“èª¬æ˜Žã€ç”»åƒã€ãƒ•ã‚¡ã‚¤ãƒ«ã‚’ã‚¢ãƒƒãƒ—ãƒ­ãƒ¼ãƒ‰ã€‚",
    "support.faq.seller.q3": "ã‚·ãƒ§ãƒƒãƒ—æœ€é©åŒ–ã®æ–¹æ³•ã¯ï¼Ÿ",
    "support.faq.seller.a3": "é«˜å“è³ªã®ç”»åƒã€æ˜Žç¢ºãªã‚¿ã‚¤ãƒˆãƒ«ã€è©³ç´°ãªèª¬æ˜Žã€å®‰å®šã—ãŸå•†å“ã€è¿…é€Ÿãªã‚µãƒãƒ¼ãƒˆã‚’æä¾›ã—ã¦ãã ã•ã„ã€‚ãƒ©ãƒ³ã‚­ãƒ³ã‚°ã¯æ¯Žé€±æ›´æ–°ã•ã‚Œã¾ã™ã€‚",
    "support.faq.seller.q4": "ä¸Šä½è¡¨ç¤ºã«ã¯ï¼Ÿ",
    "support.faq.seller.a4": "å£²ä¸Šã€é¡§å®¢è©•ä¾¡ã€ä¿¡é ¼åº¦ã€ç´›äº‰çŽ‡ã«ã‚ˆã‚Šæ±ºã¾ã‚Šã¾ã™ã€‚",
    "support.faq.seller.q5": "åŽç›Šã¯ã©ã†å‡¦ç†ã•ã‚Œã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a5.1": "æ³¨æ–‡å®Œäº†å¾Œã€è³‡é‡‘ã¯3æ—¥é–“ï¼ˆã‚¨ã‚¹ã‚¯ãƒ­ãƒ¼ï¼‰ä¿ç•™ã•ã‚Œã¾ã™ã€‚ãã®å¾Œã€è²©å£²è€…ã¯ä»¥ä¸‹ã§å‡ºé‡‘ã§ãã¾ã™ï¼š",
    "support.faq.seller.a5.list1": "æš—å·è³‡ç”£: USDT, BTC, ETH, BNB, TRX ãªã©ã€‚",
    "support.faq.seller.a5.list2": "éŠ€è¡ŒæŒ¯è¾¼ï¼ˆç¢ºèªæ¸ˆã¿ã®å£åº§æƒ…å ±ï¼‰ã€‚",
    "support.faq.seller.q6": "æ‰‹æ•°æ–™ã¯ã©ã†è¨ˆç®—ã•ã‚Œã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a6": "ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã¯æˆåŠŸã—ãŸæ³¨æ–‡ã”ã¨ã«5%ã®å–å¼•æ‰‹æ•°æ–™ã‚’é©ç”¨ã—ã¾ã™ã€‚è²©å£²è€…ã¯ãƒªã‚»ãƒ©ãƒ¼ãƒ¢ãƒ¼ãƒ‰ã‚’æœ‰åŠ¹ã«ã—ã¦å£²ä¸Šã‚’ä¼¸ã°ã›ã¾ã™ã€‚",
    "support.faq.seller.q7": "å‡ºé‡‘æ–¹æ³•ã¯ï¼Ÿ",
    "support.faq.seller.a7": "å‡ºé‡‘ã‚’é¸æŠž -> æš—å·è³‡ç”£ã¾ãŸã¯éŠ€è¡Œã‚’é¸æŠž -> æƒ…å ±å…¥åŠ› -> ç¢ºèªã€‚",
    "support.faq.seller.q8": "è²©å£²è€…ã®ç¨Žå‹™ç¾©å‹™ã¯ã©ã†æ‰±ã‚ã‚Œã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a8.1": "ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã¯å–å¼•ã‚¤ãƒ³ãƒ•ãƒ©ã‚’æä¾›ã™ã‚‹ä»²ä»‹å½¹ã«éŽãŽã¾ã›ã‚“ã€‚",
    "support.faq.seller.a8.2": "è²©å£²è€…ã¯ãƒ™ãƒˆãƒŠãƒ æ³•ã«åŸºã¥ãã€è‡ªèº«ã®åŽå…¥ã«é–¢ã™ã‚‹ç¨Žå‹™ç”³å‘Šã¨ç´ç¨Žã‚’è¡Œã†è²¬ä»»ãŒã‚ã‚Šã¾ã™ã€‚",
    "support.faq.seller.a8.3": "ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã¯æºæ³‰å¾´åŽã‚„ä»£ç†ç”³å‘Šã€ä»£è¡Œç´ä»˜ã‚’è¡Œã„ã¾ã›ã‚“ã€‚",
    "support.faq.seller.q9": "ç¦æ­¢ã•ã‚Œã¦ã„ã‚‹å•†å“ã¯ï¼Ÿ",
    "support.faq.seller.a9": "ãƒãƒƒã‚­ãƒ³ã‚°ã•ã‚ŒãŸã‚¢ã‚«ã‚¦ãƒ³ãƒˆã€ä¸æ­£ãƒ‡ãƒ¼ã‚¿ã€éŠ€è¡Œå£åº§ã€æ‚ªç”¨ãƒ„ãƒ¼ãƒ«ã€ã¾ãŸã¯ãƒ™ãƒˆãƒŠãƒ æ³•ã‚„ç¬¬ä¸‰è€…ã®è¦ç´„ã«é•åã™ã‚‹ã‚³ãƒ³ãƒ†ãƒ³ãƒ„ã€‚",
    "support.faq.seller.q10": "ãƒ¦ãƒ¼ã‚¶ãƒ¼å–å¼•ã¯ç®¡ç†è€…ã¨é–¢ä¿‚ãŒã‚ã‚Šã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a10.1": "ãƒ¦ãƒ¼ã‚¶ãƒ¼ãŒå‡ºå“ã¾ãŸã¯ã‚¿ã‚¹ã‚¯ã‚’æŽ²è¼‰ã™ã‚‹å•†å“ã¯ãƒ¦ãƒ¼ã‚¶ãƒ¼é–“ã®å–å¼•ã§ã‚ã‚Šã€ç®¡ç†è€…ã¨ã¯ç„¡é–¢ä¿‚ã§ã™ã€‚",
    "support.faq.seller.a10.2": "ç®¡ç†è€…ã¯é•æ³•å•†å“ã®å£²è²·ã‚’è¡Œã„ã¾ã›ã‚“ã€‚é•æ³•å–å¼•ã‚„æ•…æ„ã®é•åãŒã‚ã£ãŸå ´åˆã€ç®¡ç†è€…ã¯æŽ²è¼‰ã®å‰Šé™¤ã‚„æ®‹é«˜ã®å‡çµã‚’è¡Œã†æ¨©é™ãŒã‚ã‚Šã¾ã™ã€‚æœ¬ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã§è²©å£²ã«å‚åŠ ã™ã‚‹ã“ã¨ã¯ã€è¦ç´„ã‚’èª­ã¿åŒæ„ã—ãŸã‚‚ã®ã¨ã¿ãªã•ã‚Œã¾ã™ã€‚",
    "support.faq.seller.q11": "APIé€£æºï¼Ÿ",
    "support.faq.seller.a11": "ã¯ã„ã€‚è²©å£²è€…ã¯APIã‚’é€£æºã—ã¦è‡ªå‹•é…é€ã‚„åœ¨åº«åŒæœŸãŒã§ãã¾ã™ã€‚",
    "support.faq.seller.q12": "ä¿è¨¼å¯¾å¿œã¯ã©ã†è¡Œã„ã¾ã™ã‹ï¼Ÿ",
    "support.faq.seller.a12": "è²©å£²æ¸ˆã¿æ³¨æ–‡ -> ä¿è¨¼ -> æ•°é‡å…¥åŠ› -> ã‚·ã‚¹ãƒ†ãƒ ãŒä»£æ›¿ã‚³ãƒ¼ãƒ‰ã‚’è‡ªå‹•é€ä¿¡ã—ã¾ã™ã€‚",
    "support.faq.reseller.title": "III. ãƒªã‚»ãƒ©ãƒ¼",
    "support.faq.reseller.q1": "ãƒªã‚»ãƒ©ãƒ¼ã«ãªã‚‹ã«ã¯ï¼Ÿ",
    "support.faq.reseller.a1": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆè¨­å®šã§ãƒªã‚»ãƒ©ãƒ¼ãƒ¢ãƒ¼ãƒ‰ã‚’æœ‰åŠ¹ã«ã—ã¦ãã ã•ã„ã€‚",
    "support.faq.reseller.q2": "ãƒªã‚»ãƒ©ãƒ¼ã¨ã—ã¦è²©å£²ã™ã‚‹ã«ã¯ï¼Ÿ",
    "support.faq.reseller.a2": "å¯¾è±¡å•†å“ã‚’é¸æŠž -> ç´¹ä»‹ãƒªãƒ³ã‚¯ã‚’å–å¾— -> å…±æœ‰ -> ã‚·ã‚¹ãƒ†ãƒ ãŒæ‰‹æ•°æ–™ã‚’è‡ªå‹•è¨˜éŒ²ã—ã¾ã™ã€‚",
    "support.faq.reseller.q3": "æ‰‹æ•°æ–™ã®å‡ºé‡‘ã¯ï¼Ÿ",
    "support.faq.reseller.a3": "æ‰‹æ•°æ–™ã¯3æ—¥é–“ï¼ˆã‚¨ã‚¹ã‚¯ãƒ­ãƒ¼ï¼‰ä¿ç•™ã•ã‚ŒãŸå¾Œã€æš—å·è³‡ç”£ã¾ãŸã¯éŠ€è¡Œã§å‡ºé‡‘ã§ãã¾ã™ã€‚",
    "support.faq.reseller.q4": "æœˆé–“ãƒœãƒ¼ãƒŠã‚¹ï¼Ÿ",
    "support.faq.reseller.a4": "ã¯ã„ã€‚ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã¯æœˆé–“å®Ÿç¸¾ã«åŸºã¥ããƒœãƒ¼ãƒŠã‚¹åˆ¶åº¦ã‚’å®Ÿæ–½ã—ã¦ã„ã¾ã™ã€‚",
    "support.faq.compliance.title": "IV. ãƒ™ãƒˆãƒŠãƒ æ³•ä»¤éµå®ˆ - AMLãƒ»ä¸æ­£",
    "support.faq.compliance.q1": "ãƒžãƒãƒ¼ãƒ­ãƒ³ãƒ€ãƒªãƒ³ã‚°å¯¾ç­–ï¼ˆAMLï¼‰",
    "support.faq.compliance.a1.lead": "åŽ³ç¦:",
    "support.faq.compliance.a1.list1": "é•æ³•è³‡ç”£ã®æµé€š",
    "support.faq.compliance.a1.list2": "è³‡é‡‘æºã®éš è”½",
    "support.faq.compliance.a1.list3": "ãƒžãƒãƒ¼ãƒ­ãƒ³ãƒ€ãƒªãƒ³ã‚°ã®ç–‘ã„ãŒã‚ã‚‹å–å¼•",
    "support.faq.compliance.a1.note": "ãƒ—ãƒ©ãƒƒãƒˆãƒ•ã‚©ãƒ¼ãƒ ã¯å¿…è¦ã«å¿œã˜ã¦è³‡é‡‘ã®ä¿ç•™ã€ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã®å‡çµã€æœ¬äººç¢ºèªã®è¦æ±‚ã€é–¢ä¿‚å½“å±€ã¨ã®å”åŠ›ã‚’è¡Œã†ã“ã¨ãŒã‚ã‚Šã¾ã™ã€‚",
    "support.faq.compliance.q2": "ä¸æ­£é˜²æ­¢",
    "support.faq.compliance.a2.lead": "åŽ³ç¦:",
    "support.faq.compliance.a2.list1": "å½ã®æ³¨æ–‡",
    "support.faq.compliance.a2.list2": "ç´›äº‰ã®ä¹±ç”¨",
    "support.faq.compliance.a2.list3": "è¤‡æ•°ã‚¢ã‚«ã‚¦ãƒ³ãƒˆ",
    "support.faq.compliance.a2.list4": "ãƒœãƒƒãƒˆã€ãƒãƒƒã‚¯ã€ã‚·ã‚¹ãƒ†ãƒ è„†å¼±æ€§ã®æ‚ªç”¨",
    "support.faq.compliance.q3": "ãƒ™ãƒˆãƒŠãƒ æ³•ä»¤éµå®ˆ",
    "support.faq.compliance.a3": "ãƒ¦ãƒ¼ã‚¶ãƒ¼ã¯é•æ³•å•†å“ã®å£²è²·ã‚„ãƒ—ãƒ©ã‚¤ãƒã‚·ãƒ¼ãƒ»å€‹äººãƒ‡ãƒ¼ã‚¿ã®ä¾µå®³ã‚’ã—ã¦ã¯ãªã‚Šã¾ã›ã‚“ã€‚",
    "profile.overview.pageTitle": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆæ¦‚è¦ | polyflux.xyz",
    "profile.overview.title": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆæ¦‚è¦",
    "profile.overview.subtitle": "æ®‹é«˜ã€æ³¨æ–‡ã€ã‚»ã‚­ãƒ¥ãƒªãƒ†ã‚£ã‚’ä¸€ã‹æ‰€ã§ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.overview.quickInfoTitle": "ã‚¯ã‚¤ãƒƒã‚¯æƒ…å ±",
    "profile.overview.quickInfoDesc": "æ®‹é«˜ã€ç·æ³¨æ–‡æ•°ã€ã‚¢ã‚«ã‚¦ãƒ³ãƒˆç­‰ç´š...",
    "profile.overview.table.labelItem": "é …ç›®",
    "profile.overview.table.labelValue": "å€¤",
    "profile.overview.table.labelStatus": "çŠ¶æ…‹",
    "profile.overview.table.balanceLabel": "åˆ©ç”¨å¯èƒ½æ®‹é«˜",
    "profile.overview.table.balanceStatus": "æœªå…¥é‡‘",
    "profile.overview.table.ordersLabel": "åˆè¨ˆæ³¨æ–‡",
    "profile.overview.table.ordersStatus": "å®Œäº†",
    "profile.overview.quickLinks.title": "ã‚¯ã‚¤ãƒƒã‚¯ãƒŠãƒ“",
    "profile.overview.quickLinks.profile": "ãƒ—ãƒ­ãƒ•ã‚£ãƒ¼ãƒ«",
    "profile.overview.quickLinks.orders": "æ³¨æ–‡",
    "profile.overview.quickLinks.topups": "ãƒãƒ£ãƒ¼ã‚¸",
    "profile.overview.quickLinks.logins": "ãƒ­ã‚°ã‚¤ãƒ³å±¥æ­´",
    "profile.overview.quickLinks.security": "ã‚»ã‚­ãƒ¥ãƒªãƒ†ã‚£ & 2FA",
    "profile.public.pageTitle": "ãƒ—ãƒ­ãƒ•ã‚£ãƒ¼ãƒ« | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "å‚åŠ ",
    "profile.public.badgeLabel": "ç§°å·",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "?????????????",
    "profile.public.copySuccess": "??????????????????",
    "profile.public.copyFail": "???????????????????",
    "profile.public.follow": "ãƒ•ã‚©ãƒ­ãƒ¼",
    "profile.public.following": "ãƒ•ã‚©ãƒ­ãƒ¼ä¸­",
    "profile.public.followersLabel": "ãƒ•ã‚©ãƒ­ãƒ¯ãƒ¼",
    "profile.public.followingLabel": "ãƒ•ã‚©ãƒ­ãƒ¼ä¸­",
    "profile.public.stats.purchased": "è³¼å…¥æ¸ˆã¿",
    "profile.public.stats.sold": "è²©å£²æ¸ˆã¿",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "ã‚·ãƒ§ãƒƒãƒ—ã‚’è¦‹ã‚‹",
    "profile.public.featured.title": "æ³¨ç›®æŠ•ç¨¿",
    "profile.public.featured.manage": "æ³¨ç›®æŠ•ç¨¿ã‚’ç·¨é›†",
    "profile.public.featured.note": "æ³¨ç›®æŠ•ç¨¿ã¯30æ—¥å¾Œã«è‡ªå‹•å‰Šé™¤ã•ã‚Œã¾ã™ã€‚",
    "profile.public.featured.emptyTitle": "ã“ã®ãƒ¦ãƒ¼ã‚¶ãƒ¼ã¯ã¾ã æ³¨ç›®æŠ•ç¨¿ã‚’ã—ã¦ã„ã¾ã›ã‚“ã€‚",
    "profile.public.featured.emptyDesc": "æ–°ã—ã„æŠ•ç¨¿ã¯30æ—¥å¾Œã«è‡ªå‹•ã§éžè¡¨ç¤ºã«ãªã‚Šã¾ã™ã€‚",
    "profile.public.story.defaultTitle": "æŠ•ç¨¿ #{index}",
    "profile.public.story.type.video": "å‹•ç”»",
    "profile.public.story.type.image": "ç”»åƒ",
    "profile.public.story.titleFallback": "æ³¨ç›®æŠ•ç¨¿",
    "profile.public.story.alt": "ã‚¹ãƒˆãƒ¼ãƒªãƒ¼",
    "profile.public.manage.title": "ãƒ—ãƒ­ãƒ•ã‚£ãƒ¼ãƒ«ç®¡ç†",
    "profile.public.manage.titlePlaceholder": "æŠ•ç¨¿ã‚¿ã‚¤ãƒˆãƒ«",
    "profile.public.manage.upload": "ã‚¢ãƒƒãƒ—ãƒ­ãƒ¼ãƒ‰",
    "profile.public.manage.remove": "å‰Šé™¤",
    "profile.public.manage.help": "???9:16???????????2MB????????60??????????????????",
    "profile.public.manage.close": "é–‰ã˜ã‚‹",
    "profile.public.manage.save": "å¤‰æ›´ã‚’ä¿å­˜",
    "profile.public.manage.slotLabel": "ã‚¹ãƒ­ãƒƒãƒˆ {index}",
    "profile.public.manage.limit.pro": "æœ€å¤§4ä»¶ã€å‹•ç”»å¯¾å¿œã€‚",
    "profile.public.manage.limit.basic": "æ¡ä»¶æœªé”ã®ãŸã‚ã€å†™çœŸ1æžšã®ã¿ã€‚",
    "profile.public.toast.saveFail": "æ³¨ç›®æŠ•ç¨¿ã‚’ä¿å­˜ã§ãã¾ã›ã‚“ã€‚",
    "profile.public.toast.loginRequired": "ãƒ•ã‚©ãƒ­ãƒ¼ã™ã‚‹ã«ã¯ãƒ­ã‚°ã‚¤ãƒ³ã—ã¦ãã ã•ã„ã€‚",
    "profile.public.toast.imageOrVideoOnly": "ç”»åƒã¾ãŸã¯å‹•ç”»ã®ã¿å¯¾å¿œã—ã¦ã„ã¾ã™ã€‚",
    "profile.public.toast.notEligible": "å‹•ç”»ã‚„è¤‡æ•°æŠ•ç¨¿ã‚’ã‚¢ãƒƒãƒ—ãƒ­ãƒ¼ãƒ‰ã§ãã¾ã›ã‚“ã€‚",
    "profile.public.toast.uploadFail": "ã‚¢ãƒƒãƒ—ãƒ­ãƒ¼ãƒ‰ã«å¤±æ•—ã—ã¾ã—ãŸã€‚",
    "profile.public.toast.imageTooLarge": "???2MB????????",
    "profile.public.toast.imageRatio": "ç”»åƒã¯9:16æ¯”çŽ‡ãŒå¿…è¦ã§ã™ã€‚",
    "profile.public.toast.imageReadFail": "ç”»åƒã‚’èª­ã¿å–ã‚Œã¾ã›ã‚“ã€‚",
    "profile.public.toast.videoNotEligible": "å‹•ç”»ã¯æ¡ä»¶ã‚’æº€ãŸã—ãŸã‚¢ã‚«ã‚¦ãƒ³ãƒˆã®ã¿åˆ©ç”¨ã§ãã¾ã™ã€‚",
    "profile.public.toast.videoTooLarge": "å‹•ç”»ãŒ25MBã‚’è¶…ãˆã¦ã„ã¾ã™ã€‚",
    "profile.public.toast.videoRatio": "å‹•ç”»ã¯9:16æ¯”çŽ‡ãŒå¿…è¦ã§ã™ã€‚",
    "profile.public.toast.videoDuration": "å‹•ç”»ãŒ60ç§’ã‚’è¶…ãˆã¦ã„ã¾ã™ã€‚",
    "profile.public.toast.videoReadFail": "å‹•ç”»ã‚’èª­ã¿å–ã‚Œã¾ã›ã‚“ã€‚",
    "profile.public.toast.coverReadFail": "ã‚«ãƒãƒ¼ç”»åƒã‚’èª­ã¿å–ã‚Œã¾ã›ã‚“ã€‚",
    "product.detail.pageTitle": "å•†å“è©³ç´° | polyflux.xyz",
    "breadcrumb.home": "ãƒ›ãƒ¼ãƒ ",
    "breadcrumb.detail": "è©³ç´°",
    "product.detail.share": "å…±æœ‰",
    "product.detail.share.copied": "ã‚³ãƒ”ãƒ¼ã—ã¾ã—ãŸ",
    "product.detail.share.failed": "ã‚³ãƒ”ãƒ¼ã§ãã¾ã›ã‚“ã§ã—ãŸ",
    "product.detail.favorite": "ãŠæ°—ã«å…¥ã‚Š",
    "product.detail.favorite.active": "ãŠæ°—ã«å…¥ã‚Šæ¸ˆã¿",
    "product.detail.otherTitle": "åŒã˜ã‚·ãƒ§ãƒƒãƒ—ã®ä»–ã®å•†å“",
    "product.detail.other.empty": "ä»–ã®å•†å“ã¯ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "product.detail.order": "æ³¨æ–‡ã™ã‚‹",
    "product.detail.preorder": "äºˆç´„æ³¨æ–‡",
    "product.detail.message": "ãƒ¡ãƒƒã‚»ãƒ¼ã‚¸",
    "product.detail.tab.shop": "ã‚·ãƒ§ãƒƒãƒ—èª¬æ˜Ž",
    "product.detail.tab.reviews": "ãƒ¬ãƒ“ãƒ¥ãƒ¼",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "æ³¨æ–‡ç¢ºèª",
    "product.detail.modal.quantity": "æ•°é‡",
    "product.detail.modal.subtotal": "å°è¨ˆ",
    "product.detail.modal.cancel": "ã‚­ãƒ£ãƒ³ã‚»ãƒ«",
    "product.detail.modal.confirm": "æ³¨æ–‡ç¢ºå®š",
    "product.detail.modal.processing": "å‡¦ç†ä¸­...",
    "product.detail.modal.max": "æœ€å¤§ {max}",
    "product.detail.toast.success": "æ³¨æ–‡ãŒå®Œäº†ã—ã¾ã—ãŸã€‚æ³¨æ–‡å±¥æ­´ã§ç¢ºèªã—ã¦ãã ã•ã„ã€‚",
    "product.detail.toast.viewOrders": "æ³¨æ–‡ã‚’è¦‹ã‚‹",
    "product.detail.toast.loginRequired": "æ³¨æ–‡ã™ã‚‹ã«ã¯ãƒ­ã‚°ã‚¤ãƒ³ã—ã¦ãã ã•ã„ã€‚",
    "product.detail.toast.orderFailed": "æ³¨æ–‡ã«å¤±æ•—ã—ã¾ã—ãŸã€‚",
    "product.detail.notFound": "å•†å“ãŒè¦‹ã¤ã‹ã‚Šã¾ã›ã‚“",
    "product.detail.description.pending": "èª¬æ˜Žã‚’æ›´æ–°ä¸­ã§ã™ã€‚",
    "product.detail.rating.positive": "è‰¯ã„",
    "product.detail.rating.neutral": "æ™®é€š",
    "product.detail.rating.negative": "æ”¹å–„ãŒå¿…è¦",
    "product.detail.rating.none": "è©•ä¾¡ãªã—",
    "product.detail.shopIdLabel": "ã‚·ãƒ§ãƒƒãƒ—ID",
    "product.detail.shop.polyflux.title": "PolyFluxå…¬å¼",
    "product.detail.shop.polyflux.bullet1": "è¿…é€Ÿé…é€ã€å¼•ãæ¸¡ã—å‰ã«ç¢ºèªã€‚",
    "product.detail.shop.polyflux.bullet2": "è§£æ±ºã§ããªã„å ´åˆã¯è¿”é‡‘ã€‚",
    "product.detail.shop.polyflux.bullet3": "Telegramã§24/7ã‚µãƒãƒ¼ãƒˆã€‚",
    "product.detail.shop.partner.title": "ãƒ‘ãƒ¼ãƒˆãƒŠãƒ¼ãƒžãƒ¼ã‚±ãƒƒãƒˆ #1",
    "product.detail.shop.partner.bullet1": "å®‰å®šã—ãŸåœ¨åº«ã€æ•°åˆ†ã§é…é€ã€‚",
    "product.detail.shop.partner.bullet2": "å¤§é‡æ³¨æ–‡ã«æœ€é©ä¾¡æ ¼ã€‚",
    "product.detail.shop.partner.bullet3": "æŽ²è¼‰ãƒãƒªã‚·ãƒ¼ã«æ²¿ã£ãŸä¿è¨¼å¯¾å¿œã€‚",
    "product.detail.shop.fallbackTitle": "ä¿¡é ¼ã§ãã‚‹ã‚·ãƒ§ãƒƒãƒ—",
    "product.detail.shop.fallbackBullet1": "å—å–å¾Œã™ãã«å•†å“ã‚’ç¢ºèªã€‚",
    "product.detail.shop.fallbackBullet2": "å•é¡ŒãŒã‚ã‚Œã°ã‚µãƒãƒ¼ãƒˆã€‚",
    "product.detail.review.1.text": "é…é€ãŒæ—©ãã€ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã‚‚å•é¡Œãªã—ã€‚",
    "product.detail.review.1.time": "2æ™‚é–“å‰",
    "product.detail.review.2.text": "ã‚µãƒãƒ¼ãƒˆãŒæ—©ãã€ä¿è¨¼ã‚‚æ˜Žç¢ºã€‚",
    "product.detail.review.2.time": "1æ—¥å‰",
    "product.detail.review.3.text": "èª¬æ˜Žé€šã‚Šã§ã€ã¾ãŸè³¼å…¥ã—ã¾ã™ã€‚",
    "product.detail.review.3.time": "3æ—¥å‰",
    "product.detail.api.title": "é…é€API",
    "product.detail.api.bullet1": "æ±ºæ¸ˆå¾Œã«ã‚³ãƒ¼ãƒ‰ã‚’è‡ªå‹•é€ä¿¡ã€‚",
    "product.detail.api.bullet2": "REST/JSONå¯¾å¿œã€‚",
    "product.detail.api.bullet3": "ã‚­ãƒ¼å–å¾—ã¯ç®¡ç†è€…ã¸é€£çµ¡ã€‚",
    "service.detail.pageTitle": "ã‚µãƒ¼ãƒ“ã‚¹è©³ç´° | polyflux.xyz",
    "service.detail.hero.loadingTitle": "ã‚µãƒ¼ãƒ“ã‚¹ã‚’èª­ã¿è¾¼ã¿ä¸­...",
    "service.detail.hero.loadingDesc": "ã‚µãƒ¼ãƒ“ã‚¹èª¬æ˜ŽãŒã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "service.detail.info.title": "ãƒ‘ãƒƒã‚±ãƒ¼ã‚¸æƒ…å ±",
    "service.detail.info.desc": "/data/mock-services.json ã‹ã‚‰èª­ã¿è¾¼ã¿ã€‚APIæŽ¥ç¶šå¾Œã€è©³ç´°èª¬æ˜ŽãŒè¿”ã•ã‚Œã¾ã™ã€‚",
    "service.detail.form.title": "æ±ºæ¸ˆå¾Œã®ãƒªã‚¯ã‚¨ã‚¹ãƒˆãƒ•ã‚©ãƒ¼ãƒ ",
    "service.detail.form.desc": "æ±ºæ¸ˆå¾Œã€é¡§å®¢ãŒã“ã®ãƒ•ã‚©ãƒ¼ãƒ ã‚’å…¥åŠ›ã™ã‚‹ã¨æ­£ç¢ºã«å¯¾å¿œã§ãã¾ã™ã€‚",
    "service.detail.form.emailLabel": "çµæžœå—å–ãƒ¡ãƒ¼ãƒ«",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "å¯¾è±¡ãƒªãƒ³ã‚¯",
    "service.detail.form.linkPlaceholder": "ä¾‹: æŠ•ç¨¿/ãƒ—ãƒ­ãƒ•ã‚£ãƒ¼ãƒ«/å‹•ç”»ãƒªãƒ³ã‚¯...",
    "service.detail.form.noteLabel": "è©³ç´°ãƒªã‚¯ã‚¨ã‚¹ãƒˆ",
    "service.detail.form.notePlaceholder": "è¦ä»¶ã€æ•°é‡ã€å¸Œæœ›é€Ÿåº¦ãªã©ã‚’è¨˜è¼‰...",
    "service.detail.form.save": "ãƒªã‚¯ã‚¨ã‚¹ãƒˆä¿å­˜",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "ã“ã®ãƒ•ã‚©ãƒ¼ãƒ ã¯é€ä¿¡ã•ã‚Œã¾ã›ã‚“ã€‚APIæŽ¥ç¶šå¾Œã«ãƒãƒƒã‚¯ã‚¨ãƒ³ãƒ‰ã¸POSTã—ã¦ãã ã•ã„ã€‚",
    "service.detail.notFound": "ã‚µãƒ¼ãƒ“ã‚¹ãŒè¦‹ã¤ã‹ã‚Šã¾ã›ã‚“",
    "service.detail.noData": "ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“ã€‚APIæŽ¥ç¶šã¾ãŸã¯JSONè¿½åŠ å¾Œã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "service.detail.fallback.summary": "ã‚µãƒ¼ãƒ“ã‚¹ã®è©³ç´°ã¯ã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "service.detail.fallback.description": "è©³ç´°æƒ…å ±ã¯ãƒãƒƒã‚¯ã‚¨ãƒ³ãƒ‰APIã‹ã‚‰è¿”ã•ã‚Œã€ã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "task.detail.pageTitle": "ã‚¿ã‚¹ã‚¯è©³ç´° | polyflux.xyz",
    "task.detail.hero.loadingTitle": "ã‚¿ã‚¹ã‚¯èª­ã¿è¾¼ã¿ä¸­...",
    "task.detail.hero.loadingDesc": "ã‚¿ã‚¹ã‚¯èª¬æ˜ŽãŒã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "task.detail.info.title": "ã‚¿ã‚¹ã‚¯æƒ…å ±",
    "task.detail.info.desc": "/data/mock-tasks.json ã‹ã‚‰èª­ã¿è¾¼ã¿ã€‚APIæŽ¥ç¶šå¾Œã«ãƒãƒƒã‚¯ã‚¨ãƒ³ãƒ‰ã‹ã‚‰å–å¾—ã—ã¾ã™ã€‚",
    "task.detail.report.title": "å ±å‘Šã‚’æå‡º",
    "task.detail.report.desc": "ã‚¿ã‚¹ã‚¯å®Œäº†ã®è¨¼æ‹ ã‚’æå‡ºã€‚",
    "task.detail.report.contactLabel": "ãƒ¡ãƒ¼ãƒ« / ãƒ¦ãƒ¼ã‚¶ãƒ¼å",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "è¨¼æ‹ ãƒªãƒ³ã‚¯",
    "task.detail.report.proofPlaceholder": "ä¾‹: æŠ•ç¨¿ãƒªãƒ³ã‚¯ã€å‹•ç”»",
    "task.detail.report.noteLabel": "è¿½åŠ ãƒ¡ãƒ¢",
    "task.detail.report.notePlaceholder": "å®Ÿæ–½ã—ãŸå†…å®¹ã‚’ç°¡æ½”ã«...",
    "task.detail.report.submit": "å ±å‘Šã‚’é€ä¿¡",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "APIæŽ¥ç¶šå¾Œã€ã‚·ã‚¹ãƒ†ãƒ ãŒå ±å‘Šã‚’å—ã‘å–ã‚Šè‡ªå‹•å¯©æŸ»ã—ã¾ã™ã€‚",
    "task.detail.notFound": "ã‚¿ã‚¹ã‚¯ãŒè¦‹ã¤ã‹ã‚Šã¾ã›ã‚“",
    "task.detail.noData": "ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“ã€‚å¾Œã§å†è©¦è¡Œã—ã¦ãã ã•ã„ã€‚",
    "task.detail.titleFallback": "ã‚¿ã‚¹ã‚¯",
    "task.detail.fallback.summary": "ã‚¿ã‚¹ã‚¯ã®è©³ç´°ã¯ã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "task.detail.fallback.description": "APIåˆ©ç”¨å¯èƒ½å¾Œã«ã‚¿ã‚¹ã‚¯è©³ç´°ãŒæ›´æ–°ã•ã‚Œã¾ã™ã€‚",
    "maintenance.title": "ã‚µãƒ¼ãƒãƒ¼ãƒ¡ãƒ³ãƒ†ãƒŠãƒ³ã‚¹",
    "maintenance.desc": "ã‚·ã‚¹ãƒ†ãƒ ãƒ¡ãƒ³ãƒ†ãƒŠãƒ³ã‚¹ä¸­ã§ã™ã€‚ã”ä¸ä¾¿ã‚’ãŠã‹ã‘ã—ã¦ç”³ã—è¨³ã‚ã‚Šã¾ã›ã‚“ã€‚1æ™‚é–“ä»¥å†…ã«çµ‚äº†ã™ã‚‹äºˆå®šã§ã™ã€‚",
    "cart.pageTitle": "ã‚«ãƒ¼ãƒˆ | polyflux.xyz",
    "cart.items.title": "ã‚«ãƒ¼ãƒˆå†…ã®å•†å“",
    "cart.empty.title": "ã‚«ãƒ¼ãƒˆã¯ç©ºã§ã™ã€‚",
    "cart.empty.desc": "APIæŽ¥ç¶šå¾Œã€é¸æŠžã—ãŸå•†å“ãŒã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "cart.summary.title": "æ³¨æ–‡ã‚µãƒžãƒªãƒ¼",
    "cart.summary.desc": "åˆè¨ˆã€æ‰‹æ•°æ–™ã€å‰²å¼•ã‚³ãƒ¼ãƒ‰ã€‚",
    "cart.summary.couponLabel": "å‰²å¼•ã‚³ãƒ¼ãƒ‰",
    "cart.summary.couponPlaceholder": "ã‚³ãƒ¼ãƒ‰ã‚’å…¥åŠ›",
    "cart.summary.apply": "é©ç”¨",
    "cart.summary.checkout": "æ±ºæ¸ˆã«é€²ã‚€",
    "checkout.pageTitle": "æ±ºæ¸ˆ | polyflux.xyz",
    "checkout.buyer.title": "è³¼å…¥è€…æƒ…å ±",
    "checkout.buyer.emailLabel": "å—å–ãƒ¡ãƒ¼ãƒ«",
    "checkout.buyer.platformLabel": "ID / ãƒ¦ãƒ¼ã‚¶ãƒ¼åï¼ˆä»»æ„ï¼‰",
    "checkout.buyer.platformPlaceholder": "å•†å“/ã‚µãƒ¼ãƒ“ã‚¹ã«ã‚ˆã£ã¦ç•°ãªã‚Šã¾ã™",
    "checkout.note.title": "è¿½åŠ ãƒ¡ãƒ¢",
    "checkout.note.label": "æ³¨æ–‡ãƒ¡ãƒ¢",
    "checkout.note.placeholder": "ä¾‹ï¼š.txtãƒ•ã‚¡ã‚¤ãƒ«ã‚’ç´å“ã€ãƒ¡ãƒ¼ãƒ«ã§é€ä¿¡...",
    "checkout.summary.title": "æ³¨æ–‡ã‚µãƒžãƒªãƒ¼",
    "checkout.summary.desc": "åˆè¨ˆ & æ”¯æ‰•ã„æ–¹æ³•ã€‚",
    "checkout.summary.emptyTitle": "ã‚«ãƒ¼ãƒˆãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“ã€‚",
    "checkout.summary.emptyDesc": "APIæŽ¥ç¶šå¾Œã€ã‚¢ã‚¤ãƒ†ãƒ ã¨åˆè¨ˆãŒè¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "checkout.summary.success": "æ±ºæ¸ˆæˆåŠŸ",
    "checkout.summary.failed": "å¤±æ•—ã‚’ã‚·ãƒŸãƒ¥ãƒ¬ãƒ¼ã‚·ãƒ§ãƒ³",
    "checkout.success.pageTitle": "æ±ºæ¸ˆæˆåŠŸ | polyflux.xyz",
    "checkout.success.title": "æ±ºæ¸ˆæˆåŠŸ",
    "checkout.success.desc": "æ³¨æ–‡ãŒè¨˜éŒ²ã•ã‚Œã¾ã—ãŸã€‚APIæŽ¥ç¶šå¾Œã€è©³ç´°ã¨ãƒ€ã‚¦ãƒ³ãƒ­ãƒ¼ãƒ‰ãƒœã‚¿ãƒ³ãŒè¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "checkout.success.orders": "è‡ªåˆ†ã®æ³¨æ–‡ã‚’è¦‹ã‚‹",
    "checkout.success.continue": "è²·ã„ç‰©ã‚’ç¶šã‘ã‚‹",
    "checkout.failed.pageTitle": "æ±ºæ¸ˆå¤±æ•— | polyflux.xyz",
    "checkout.failed.title": "æ±ºæ¸ˆå¤±æ•—",
    "checkout.failed.desc": "æ±ºæ¸ˆã‚’ã‚­ãƒ£ãƒ³ã‚»ãƒ«ã—ãŸã‹ã€ã‚²ãƒ¼ãƒˆã‚¦ã‚§ã‚¤ãŒã‚¨ãƒ©ãƒ¼ã‚’è¿”ã—ãŸå¯èƒ½æ€§ãŒã‚ã‚Šã¾ã™ã€‚APIæŽ¥ç¶šå¾Œã€è©³ç´°ãªã‚¨ãƒ©ãƒ¼ã‚³ãƒ¼ãƒ‰ãŒè¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "checkout.failed.retry": "å†è©¦è¡Œã™ã‚‹",
    "checkout.failed.backProducts": "å•†å“ã«æˆ»ã‚‹",
    "profile.orders.pageTitle": "æ³¨æ–‡ | polyflux.xyz",
    "profile.orders.title": "ç§ã®æ³¨æ–‡",
    "profile.orders.subtitle": "æ³¨æ–‡ã®çŠ¶æ…‹ã¨å–å¼•å±¥æ­´ã‚’ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.orders.history.title": "æ³¨æ–‡å±¥æ­´",
    "profile.orders.table.orderId": "æ³¨æ–‡ç•ªå·",
    "profile.orders.table.product": "å•†å“",
    "profile.orders.table.total": "åˆè¨ˆ",
    "profile.orders.table.status": "çŠ¶æ…‹",
    "profile.orders.status.completed": "å®Œäº†",
    "profile.orders.status.processing": "å‡¦ç†ä¸­",
    "profile.orders.status.cancelled": "ã‚­ãƒ£ãƒ³ã‚»ãƒ«æ¸ˆã¿",
    "profile.orders.sample.email": "ãƒ¡ãƒ¼ãƒ« 1",
    "profile.orders.sample.vip": "VIPã‚¢ã‚«ã‚¦ãƒ³ãƒˆ",
    "profile.orders.sample.interaction": "ã‚¤ãƒ³ã‚¿ãƒ©ã‚¯ã‚·ãƒ§ãƒ³ãƒ‘ãƒƒã‚¯ 3",
    "profile.history.pageTitle": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆå±¥æ­´ | polyflux.xyz",
    "profile.history.title": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆå±¥æ­´",
    "profile.history.subtitle": "æœ€è¿‘ã®å–å¼•å±¥æ­´ã‚’ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.history.sectionTitle": "æœ€è¿‘ã®ã‚¢ã‚¯ãƒ†ã‚£ãƒ“ãƒ†ã‚£",
    "profile.history.table.date": "æ—¥ä»˜",
    "profile.history.table.type": "ç¨®é¡ž",
    "profile.history.table.amount": "é‡‘é¡",
    "profile.history.table.status": "çŠ¶æ…‹",
    "profile.history.type.topup": "ãƒãƒ£ãƒ¼ã‚¸",
    "profile.history.type.withdraw": "å‡ºé‡‘",
    "profile.history.type.order": "æ³¨æ–‡",
    "profile.history.status.success": "æˆåŠŸ",
    "profile.history.status.processing": "å‡¦ç†ä¸­",
    "profile.history.status.completed": "å®Œäº†",
    "profile.tasks.pageTitle": "å—ã‘ãŸã‚¿ã‚¹ã‚¯ | polyflux.xyz",
    "profile.tasks.title": "å—ã‘ãŸã‚¿ã‚¹ã‚¯",
    "profile.tasks.subtitle": "å—ã‘ãŸã‚¿ã‚¹ã‚¯ã‚’ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.tasks.sectionTitle": "å—ã‘ãŸã‚¿ã‚¹ã‚¯ä¸€è¦§",
    "profile.tasks.table.task": "ã‚¿ã‚¹ã‚¯",
    "profile.tasks.table.receivedAt": "å—å–æ—¥",
    "profile.tasks.table.deadline": "æœŸé™",
    "profile.tasks.table.reward": "å ±é…¬",
    "profile.tasks.table.status": "çŠ¶æ…‹",
    "profile.tasks.emptyTitle": "å—ã‘ãŸã‚¿ã‚¹ã‚¯ã¯ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.tasks.emptyDesc": "æ–°ã—ã„ã‚¿ã‚¹ã‚¯ã‚’å—ã‘ã‚‹ã¨ã€ã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "profile.topups.pageTitle": "ãƒãƒ£ãƒ¼ã‚¸ | polyflux.xyz",
    "profile.topups.title": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã«ãƒãƒ£ãƒ¼ã‚¸",
    "profile.topups.subtitle": "ãƒãƒ£ãƒ¼ã‚¸é‡‘é¡ã‚’å…¥åŠ›ã—ã¦ãã ã•ã„ã€‚æœ€å°10,000Ä‘ã€æœ€å¤§499,000,000Ä‘ã€‚å„ãƒãƒ£ãƒ¼ã‚¸ã§QRãŒç”Ÿæˆã•ã‚Œã¾ã™ã€‚",
    "profile.topups.guard.title": "ãƒ­ã‚°ã‚¤ãƒ³ãŒå¿…è¦:",
    "profile.topups.guard.desc": "ã‚¦ã‚©ãƒ¬ãƒƒãƒˆã«ãƒãƒ£ãƒ¼ã‚¸ã™ã‚‹ã«ã¯ãƒ­ã‚°ã‚¤ãƒ³ãŒå¿…è¦ã§ã™ã€‚",
    "profile.topups.bank.title": "éŠ€è¡Œãƒãƒ£ãƒ¼ã‚¸ï¼ˆQRï¼‰",
    "profile.topups.bank.desc": "éŠ€è¡Œã‚¢ãƒ—ãƒªã§QRã‚’ã‚¹ã‚­ãƒ£ãƒ³ã—ã¦ãã ã•ã„ã€‚é€é‡‘å¾Œã€è‡ªå‹•çš„ã«åæ˜ ã•ã‚Œã¾ã™ã€‚",
    "profile.topups.bank.qrPlaceholder": "ç”Ÿæˆå¾Œã«QRãŒè¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "profile.topups.bank.codeLabel": "å£åº§åç¾©",
    "profile.topups.bank.amountLabel": "é‡‘é¡",
    "profile.topups.bank.amountInputLabel": "ãƒãƒ£ãƒ¼ã‚¸é‡‘é¡ (VND)",
    "profile.topups.bank.amountPlaceholder": "ä¾‹: 100000",
    "profile.topups.bank.amountHint": "æœ€å°10,000Ä‘ã€æœ€å¤§499,000,000Ä‘ã€‚",
    "profile.topups.bank.generate": "QRç”Ÿæˆ",
    "profile.topups.bank.toast.invalidAmount": "æœ‰åŠ¹ãªé‡‘é¡ã‚’å…¥åŠ›ã—ã¦ãã ã•ã„ã€‚",
    "profile.topups.bank.toast.range": "é‡‘é¡ã¯ {min} ã€œ {max} Ä‘ ã®é–“ã§ã™ã€‚",
    "profile.topups.bank.toast.created": "QRã‚’ä½œæˆã—ã¾ã—ãŸã€‚ã‚¹ã‚­ãƒ£ãƒ³ã—ã¦ãƒãƒ£ãƒ¼ã‚¸ã—ã¦ãã ã•ã„ã€‚",
    "profile.topups.bank.toast.failed": "ç¾åœ¨QRã‚’ç”Ÿæˆã§ãã¾ã›ã‚“ã€‚",
    "profile.topups.crypto.notice": "æš—å·è³‡ç”£ã®ãƒãƒ£ãƒ¼ã‚¸ã¯ä¸€æ™‚çš„ã«åˆ©ç”¨ã§ãã¾ã›ã‚“ã€‚éŠ€è¡Œã‚’ã”åˆ©ç”¨ãã ã•ã„ã€‚",
    "profile.topups.crypto.title": "æš—å·è³‡ç”£ãƒãƒ£ãƒ¼ã‚¸ (USDT TRC20)",
    "profile.topups.crypto.desc": "USDT TRC20ã§ãƒãƒ£ãƒ¼ã‚¸ã—ã¾ã™ã€‚ã‚ªãƒ³ãƒã‚§ãƒ¼ãƒ³ç¢ºèªå¾Œã«åæ˜ ã•ã‚Œã¾ã™ã€‚",
    "profile.topups.crypto.addressLabel": "TRC20ã‚¦ã‚©ãƒ¬ãƒƒãƒˆã‚¢ãƒ‰ãƒ¬ã‚¹",
    "profile.topups.crypto.amountLabel": "USDTæ•°é‡",
    "profile.topups.crypto.amountPlaceholder": "ä¾‹: 10",
    "profile.topups.crypto.confirm": "é€é‡‘ã—ã¾ã—ãŸ",
    "profile.topups.withdraw.title": "å‡ºé‡‘",
    "profile.topups.withdraw.desc": "ç¾åœ¨ã®æ®‹é«˜ã«å¿œã˜ã¦å‡ºé‡‘é¡ã‚’å…¥åŠ›ã—ã¦ãã ã•ã„ã€‚æœ€å°50,000Ä‘ã€æœ€å¤§499,000,000Ä‘ã€‚",
    "profile.topups.withdraw.balanceLabel": "åˆ©ç”¨å¯èƒ½æ®‹é«˜:",
    "profile.topups.withdraw.amountLabel": "å‡ºé‡‘é¡ (VND)",
    "profile.topups.withdraw.amountPlaceholder": "ä¾‹: 500000",
    "profile.topups.withdraw.amountHint": "æœ€å°50,000Ä‘ã€æœ€å¤§499,000,000Ä‘ã€‚",
    "profile.topups.withdraw.bankLabel": "éŠ€è¡Œ",
    "profile.topups.withdraw.bankPlaceholder": "ä¾‹: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "å£åº§ç•ªå·",
    "profile.topups.withdraw.accountPlaceholder": "å£åº§ç•ªå·ã‚’å…¥åŠ›",
    "profile.topups.withdraw.nameLabel": "å£åº§åç¾©",
    "profile.topups.withdraw.namePlaceholder": "å£åº§åç¾©äººã®æ°å",
    "profile.topups.withdraw.submit": "å‡ºé‡‘ç”³è«‹",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "é€é‡‘å‰ã«ç®¡ç†è€…ãŒç”³è«‹ã‚’æ‰¿èªã—ã¾ã™ã€‚",
    "profile.topups.history.topup.title": "æœ€è¿‘ã®ãƒãƒ£ãƒ¼ã‚¸å±¥æ­´",
    "profile.topups.history.withdraw.title": "å‡ºé‡‘å±¥æ­´",
    "profile.topups.history.table.date": "æ—¥æ™‚",
    "profile.topups.history.table.amount": "é‡‘é¡",
    "profile.topups.history.table.bank": "éŠ€è¡Œ",
    "profile.topups.history.table.status": "çŠ¶æ…‹",
    "profile.topups.status.pending": "å¯©æŸ»ä¸­",
    "profile.topups.status.completed": "å‡¦ç†æ¸ˆã¿",
    "profile.topups.status.rejected": "æ‹’å¦",
    "profile.security.pageTitle": "ã‚»ã‚­ãƒ¥ãƒªãƒ†ã‚£ & 2FA | polyflux.xyz",
    "profile.security.title": "ã‚»ã‚­ãƒ¥ãƒªãƒ†ã‚£ & 2FA",
    "profile.security.subtitle": "ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã®å®‰å…¨æ€§ã‚’é«˜ã‚ã€ã‚¢ã‚¯ã‚»ã‚¹ã‚’ç®¡ç†ã—ã¾ã™ã€‚",
    "profile.security.password.title": "ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰æ›´æ–°",
    "profile.security.password.desc": "å®šæœŸçš„ã«ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ã‚’å¤‰æ›´ã—ã¦å®‰å…¨æ€§ã‚’é«˜ã‚ã¾ã—ã‚‡ã†ã€‚",
    "profile.security.password.currentLabel": "ç¾åœ¨ã®ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰",
    "profile.security.password.currentPlaceholder": "ç¾åœ¨ã®ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ã‚’å…¥åŠ›",
    "profile.security.password.newLabel": "æ–°ã—ã„ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰",
    "profile.security.password.newPlaceholder": "æœ€ä½Ž8æ–‡å­—",
    "profile.security.password.confirmLabel": "æ–°ã—ã„ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ã‚’ç¢ºèª",
    "profile.security.password.confirmPlaceholder": "æ–°ã—ã„ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰ã‚’å†å…¥åŠ›",
    "profile.security.password.submit": "ãƒ‘ã‚¹ãƒ¯ãƒ¼ãƒ‰æ›´æ–°",
    "profile.security.2fa.title": "äºŒè¦ç´ èªè¨¼ (2FA)",
    "profile.security.2fa.desc": "ãƒ­ã‚°ã‚¤ãƒ³æ™‚ã«èªè¨¼ã‚³ãƒ¼ãƒ‰ã‚’è¦æ±‚ã™ã‚‹ãŸã‚2FAã‚’æœ‰åŠ¹ã«ã—ã¾ã™ã€‚",
    "profile.security.2fa.recoveryLabel": "å¾©æ—§ã‚³ãƒ¼ãƒ‰",
    "profile.security.2fa.deviceLabel": "ä¿¡é ¼æ¸ˆã¿ãƒ‡ãƒã‚¤ã‚¹",
    "profile.security.2fa.deviceNone": "è¿½åŠ ã•ã‚ŒãŸãƒ‡ãƒã‚¤ã‚¹ã¯ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.security.2fa.enable": "2FAã‚’æœ‰åŠ¹åŒ–",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "APIæŽ¥ç¶šã§2FAè¨­å®šã¨ãƒ‡ãƒã‚¤ã‚¹ä¸€è¦§ã‚’ä¿å­˜ã—ã¾ã™ã€‚",
    "profile.favorites.pageTitle": "ãŠæ°—ã«å…¥ã‚Š | polyflux.xyz",
    "profile.favorites.title": "ãŠæ°—ã«å…¥ã‚Š",
    "profile.favorites.subtitle": "ä¿å­˜ã—ãŸå•†å“ãƒ»ã‚µãƒ¼ãƒ“ã‚¹ã‚’ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.favorites.listTitle": "ãŠæ°—ã«å…¥ã‚Šä¸€è¦§",
    "profile.favorites.emptyTitle": "ãƒ‡ãƒ¼ã‚¿ãŒã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.favorites.emptyDesc": "å•†å“ã‚’ä¿å­˜ã™ã‚‹ã¨å¾Œã§ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.notifications.pageTitle": "é€šçŸ¥ | polyflux.xyz",
    "profile.notifications.title": "é€šçŸ¥",
    "profile.notifications.subtitle": "æ³¨æ–‡ã‚„ã‚·ã‚¹ãƒ†ãƒ ã®æ›´æ–°ãŒã“ã“ã«è¡¨ç¤ºã•ã‚Œã¾ã™ã€‚",
    "profile.notifications.listTitle": "æ–°ã—ã„é€šçŸ¥",
    "profile.notifications.emptyTitle": "é€šçŸ¥ã¯ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.notifications.emptyDesc": "å¾Œã§ã‚‚ã†ä¸€åº¦ã”ç¢ºèªãã ã•ã„ã€‚",
    "profile.badges.pageTitle": "ãƒãƒƒã‚¸ | polyflux.xyz",
    "profile.badges.title": "ãƒãƒƒã‚¸",
    "profile.badges.subtitle": "ãƒ¬ãƒ™ãƒ«ã¨å®Ÿç¸¾ã‚’ç¢ºèªã§ãã¾ã™ã€‚",
    "profile.badges.listTitle": "ç²å¾—ã—ãŸãƒãƒƒã‚¸",
    "profile.badges.emptyTitle": "ãƒãƒƒã‚¸ã¯ã¾ã ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.badges.emptyDesc": "ã‚¿ã‚¹ã‚¯ã‚’å®Œäº†ã—ã¦è§£é™¤ã—ã¦ãã ã•ã„ã€‚",
    "profile.messages.pageTitle": "ãƒ¡ãƒƒã‚»ãƒ¼ã‚¸ | polyflux.xyz",
    "profile.messages.inboxTitle": "å—ä¿¡ç®±",
    "profile.messages.inboxCount": "ä¼šè©± 1 ä»¶",
    "profile.messages.searchPlaceholder": "æ¤œç´¢...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "å…¬å¼ã‚µãƒãƒ¼ãƒˆ",
    "profile.messages.thread.empty": "ä»–ã®ä¼šè©±ã¯ã‚ã‚Šã¾ã›ã‚“ã€‚",
    "profile.messages.back": "æˆ»ã‚‹",
    "profile.messages.user.sub": "ç®¡ç†è€…ã‚µãƒãƒ¼ãƒˆ",
    "profile.messages.role.admin": "ç®¡ç†è€…",
    "profile.messages.day.today": "ä»Šæ—¥",
    "profile.messages.message.1": "ã“ã‚“ã«ã¡ã¯ã€ã©ã®ã‚ˆã†ã«ãŠæ‰‹ä¼ã„ã§ãã¾ã™ã‹ï¼Ÿ",
    "profile.messages.message.2": "æ³¨æ–‡ # ã«ã¤ã„ã¦å•ã„åˆã‚ã›ãŸã„ã§ã™ã€‚",
    "profile.messages.message.3": "ç¢ºèªä¸­ã§ã™ã€‚å°‘ã€…ãŠå¾…ã¡ãã ã•ã„ã€‚",
    "profile.messages.message.4": "ã‚ã‚ŠãŒã¨ã†ã”ã–ã„ã¾ã™ã€‚",
    "profile.messages.emojiLabel": "çµµæ–‡å­—",
    "profile.messages.attachLabel": "æ·»ä»˜",
    "profile.messages.inputPlaceholder": "ãƒ¡ãƒƒã‚»ãƒ¼ã‚¸ã‚’å…¥åŠ›...",
    "profile.messages.send": "é€ä¿¡",
    "product.data.gmail-random.name": "Gmail ãƒ©ãƒ³ãƒ€ãƒ å",
    "product.data.gmail-random.short": "Gmailãƒ©ãƒ³ãƒ€ãƒ ã®ãƒ•ãƒ«ã‚¢ã‚¯ã‚»ã‚¹ã€7æ—¥ä¿è¨¼ã€‚",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "è¤‡æ•°ã®ç‰¹å…¸ã‚’æœ‰åŠ¹åŒ–ã§ãã‚‹ Gmail EDU ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã€‚",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "KYC æ¸ˆã¿ã®ç±³å›½ã‚¢ã‚«ã‚¦ãƒ³ãƒˆã€å„ç¨®ã‚µãƒ¼ãƒ“ã‚¹ã«åˆ©ç”¨å¯èƒ½ã€‚",
    "product.data.tool-checker.name": "ãƒªã‚½ãƒ¼ã‚¹ãƒã‚§ãƒƒã‚«ãƒ¼å·¥å…·",
    "product.data.tool-checker.short": "ãƒªã‚½ãƒ¼ã‚¹ã®ç”Ÿå­˜/æ­»æ´»ã‚’ç´ æ—©ãç¢ºèªã™ã‚‹ãƒ­ãƒ¼ã‚«ãƒ«ãƒ„ãƒ¼ãƒ«ã€‚",
    "service.data.fb-boost.name": "Facebook ã‚¨ãƒ³ã‚²ãƒ¼ã‚¸ãƒ¡ãƒ³ãƒˆå¢—åŠ ",
    "service.data.fb-boost.short": "è‡ªç„¶ãªã€Œã„ã„ã­ãƒ»ã‚³ãƒ¡ãƒ³ãƒˆãƒ»ã‚·ã‚§ã‚¢ã€ã‚’å¢—åŠ ã€7æ—¥ä¿è¨¼ã€‚",
    "service.data.tiktok-view.name": "TikTok å†ç”Ÿæ•°å¢—åŠ ",
    "service.data.tiktok-view.short": "æ–°ã—ã„å‹•ç”»å‘ã‘ã®TikTokå†ç”Ÿãƒ‘ãƒƒã‚±ãƒ¼ã‚¸ã€ã‚³ãƒ³ãƒ†ãƒ³ãƒ„ãƒ†ã‚¹ãƒˆã«æœ€é©ã€‚",
    "task.data.review-product.title": "ãƒ•ã‚©ãƒ¼ãƒ©ãƒ ã«å•†å“ãƒ¬ãƒ“ãƒ¥ãƒ¼æŠ•ç¨¿",
    "task.data.review-product.short": "polyflux.xyz ã®è³¼å…¥ä½“é¨“ã¨è©³ç´°ãƒ¬ãƒ“ãƒ¥ãƒ¼ã‚’æŠ•ç¨¿ã€‚",
    "task.data.tiktok-video.title": "ã‚·ãƒ§ãƒƒãƒ—ç´¹ä»‹TikTokå‹•ç”»ä½œæˆ",
    "task.data.tiktok-video.short": "ã‚µãƒ¼ãƒ“ã‚¹ãƒ¬ãƒ“ãƒ¥ãƒ¼ã®çŸ­ã„å‹•ç”»ã‚’æ’®å½±ã—ã€æŒ‡å®šãƒãƒƒã‚·ãƒ¥ã‚¿ã‚°ã‚’ä»˜ã‘ã¦ãã ã•ã„ã€‚",
  },
  zh: {
    "landing.hero.subtitle": "å¯ä¿¡ä¸”å¿«é€Ÿçš„äº¤æ˜“å¹³å°ã€‚",
    "landing.hero.buy": "ç«‹å³è´­ä¹°",
    "landing.hero.explore": "æŸ¥çœ‹æ›´å¤š",
    "landing.pill.email": "é‚®ç®±",
    "landing.pill.account": "è´¦å·",
    "landing.pill.software": "è½¯ä»¶",
    "landing.pill.interaction": "äº’åŠ¨æœåŠ¡",
    "landing.pill.tools": "å·¥å…·",
    "landing.pill.other": "å…¶ä»–",
    "landing.faq.title": "å¸¸è§é—®é¢˜",
    "landing.faq.subtitle": "æŸ¥æ‰¾å…³äºŽ polyflux.xyz çš„å¸¸è§é—®é¢˜è§£ç­”",
    "landing.faq.q1": "å¦‚ä½•æŸ¥çœ‹æˆ‘çš„è®¢å•ï¼Ÿ",
    "landing.faq.a1": "å·²è´­ä¹°çš„å•†å“ä¼šæ˜¾ç¤ºåœ¨è´­ä¹°è®°å½•ä¸­ã€‚",
    "landing.faq.q2": "è¿™æ˜¯éª—å±€å—ï¼Ÿ",
    "landing.faq.a2": "æˆ‘ä»¬é‡‡ç”¨å·²éªŒè¯çš„æ”¯ä»˜ã€å…¬å¼€è¯„ä»·å’Œé€€æ¬¾æ”¿ç­–æ¥ä¿éšœå®‰å…¨ã€‚",
    "landing.faq.q3": "æœ‰é—®é¢˜è¦å’¨è¯¢ï¼Œå¦‚ä½•è”ç³»ä½ ä»¬ï¼Ÿ",
    "landing.faq.a3": "é€šè¿‡ Telegram è”ç³»ç®¡ç†å‘˜ã€‚",
    "landing.payments.title": "20+ ç§æ”¯ä»˜æ–¹å¼",
    "landing.payments.subtitle": "æˆ‘ä»¬æ”¯æŒå¤šç§æ”¯ä»˜æ–¹å¼ï¼Œç¡®ä¿ç»“è´¦å¿«é€Ÿå®‰å…¨ã€‚",
    "landing.trusted.title": "æœ€å€¼å¾—ä¿¡èµ–çš„å¸‚åœºã€‚",
    "landing.trusted.subtitle": "çœ‹çœ‹å®¢æˆ·é€‰æ‹©æˆ‘ä»¬çš„åŽŸå› ",
    "landing.stats.orders": "è®¢å•æ€»æ•°",
    "landing.stats.vouches": "å·²éªŒè¯è¯„ä»·",
    "landing.stats.instantValue": "å³æ—¶",
    "landing.stats.deliveryLabel": "å…¨å“ç±»å³æ—¶äº¤ä»˜",
    "landing.products.emptyTitle": "æœªæ‰¾åˆ°å•†å“",
    "landing.products.emptyDesc": "è¯·å°è¯•è°ƒæ•´æœç´¢æˆ–åˆ†ç±»ç­›é€‰ã€‚",
    "landing.products.instant": "å³æ—¶äº¤ä»˜ï¼Œå®‰å…¨ç»“è´¦ã€‚",
    "landing.products.add": "æ·»åŠ ",
    "landing.product.email": "é‚®ç®± {index}",
    "landing.product.account": "è´¦å· {tier}",
    "landing.product.software": "è½¯ä»¶ {tier}",
    "landing.product.interaction": "äº’åŠ¨å¥—é¤ {index}",
    "landing.product.other": "å…¶ä»–å•†å“ {index}",
    "landing.tier.basic": "åŸºç¡€",
    "landing.tier.pro": "ä¸“ä¸š",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "è½»é‡",
    "landing.tier.plus": "Plus",
    "support.label": "æ”¯æŒ",
    "support.close": "å…³é—­",
    "support.header.title": "PolyFlux æ”¯æŒ",
    "support.header.status": "åœ¨çº¿",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "ä¸Žç®¡ç†å‘˜èŠå¤©",
    "support.faq.title": "FAQ - å¸¸è§é—®é¢˜",
    "support.faq.buyer.title": "I. ä¹°å®¶",
    "support.faq.buyer.q1": "å¦‚ä½•è´­ä¹°å•†å“ï¼Ÿ",
    "support.faq.buyer.a1.1": "ä¹°å®¶å¯ä»¥ä½¿ç”¨åŠ å¯†è´§å¸æˆ–é“¶è¡Œè½¬è´¦ä»˜æ¬¾ã€‚",
    "support.faq.buyer.a1.2": "åŠ å¯†è´§å¸ï¼šå……å€¼åˆ°æŒ‡å®šçš„ä¸ªäººé’±åŒ…ï¼Œé“¾ä¸Šäº¤æ˜“ç¡®è®¤åŽä½™é¢å°†è‡ªåŠ¨æ›´æ–°ã€‚",
    "support.faq.buyer.a1.3": "é“¶è¡Œï¼šæŒ‰æä¾›çš„ä¿¡æ¯è½¬è´¦ï¼Œä»˜æ¬¾ç¡®è®¤åŽç³»ç»Ÿä¼šå¯¹è´¦å¹¶æ›´æ–°ä½™é¢ã€‚",
    "support.faq.buyer.q2": "é‚®ç®±/è´¦å·ä¸é‡å¤æ˜¯ä»€ä¹ˆæ„æ€ï¼Ÿ",
    "support.faq.buyer.a2": "ç³»ç»Ÿé€šè¿‡é‡å¤æ£€æµ‹å’Œ Zero Duplicate å¾½ç« ï¼Œç¡®ä¿å•†å“ä»Žæœªå”®å‡ºè¿‡ã€‚",
    "support.faq.buyer.q3": "å¦‚ä½•å……å€¼ï¼Ÿ",
    "support.faq.buyer.a3.1": "åŠ å¯†è´§å¸ï¼šé€‰æ‹©å……å€¼ -> é€‰æ‹©å¸ç§ -> è½¬å…¥ä¸ªäººé’±åŒ…ã€‚æ”¯æŒ USDTã€USDCã€BTCã€ETHã€BNBã€TRX ç­‰ã€‚",
    "support.faq.buyer.a3.2": "é“¶è¡Œï¼šé€‰æ‹©å……å€¼ -> é“¶è¡Œè½¬è´¦ -> æŒ‰æ­£ç¡®çš„å¤‡æ³¨/äº¤æ˜“ç è½¬è´¦ä»¥ä¾¿ç³»ç»Ÿè‡ªåŠ¨ç¡®è®¤ã€‚",
    "support.faq.buyer.q4": "å¯ä»¥ç”³è¯·é€€æ¬¾å—ï¼Ÿ",
    "support.faq.buyer.a4": "å¯ä»¥ã€‚æ¯ç¬”è®¢å•éƒ½æœ‰ 3 å¤©çš„æ‰˜ç®¡æœŸï¼Œå¯ç”¨äºŽæŠ•è¯‰æˆ–å‘èµ·äº‰è®®ã€‚",
    "support.faq.buyer.q5": "å……å€¼æœªåˆ°è´¦ï¼Ÿ",
    "support.faq.buyer.a5.1": "åŠ å¯†è´§å¸ï¼šå¯èƒ½æ˜¯é“¾/ä»£å¸é”™è¯¯æˆ–åŒºå—é“¾æ‹¥å µã€‚è‹¥å‡ åˆ†é’ŸåŽä»æœªæ›´æ–°ï¼Œè¯·æä¾› TXID ä»¥ä¾¿æ”¯æŒã€‚",
    "support.faq.buyer.a5.2": "é“¶è¡Œï¼šå¯èƒ½æ˜¯éžå·¥ä½œæ—¶é—´è½¬è´¦ã€å¤‡æ³¨é”™è¯¯æˆ–å¾…å¯¹è´¦ã€‚è¯·è”ç³»æ”¯æŒå¹¶é™„ä¸Šè½¬è´¦æˆªå›¾ã€‚",
    "support.faq.buyer.q6": "å¦‚æžœè½¬é”™äº†æ€Žä¹ˆåŠžï¼Ÿ",
    "support.faq.buyer.a6.1": "åŠ å¯†è´§å¸ï¼šåŒºå—é“¾äº¤æ˜“ä¸å¯æ’¤é”€ï¼Œè½¬é”™é“¾æˆ–åœ°å€é€šå¸¸ä¼šé€ æˆæ°¸ä¹…æŸå¤±ã€‚",
    "support.faq.buyer.a6.2": "é“¶è¡Œï¼šç³»ç»Ÿä»…ååŠ©å¯¹è´¦ï¼Œè½¬è´¦ä¿¡æ¯é”™è¯¯ä¸ä¿è¯é€€æ¬¾ã€‚",
    "support.faq.buyer.q7": "éœ€è¦ä¸­é—´äººå—ï¼Ÿ",
    "support.faq.buyer.a7": "ä¸éœ€è¦ã€‚ç³»ç»Ÿä¸ºå†…ç½®æ‰˜ç®¡ï¼Œèµ„é‡‘ä¿ç•™ 3 å¤©åŽå†æ”¾æ¬¾ç»™å–å®¶ã€‚",
    "support.faq.seller.title": "II. å–å®¶",
    "support.faq.seller.q1": "å¦‚ä½•æ³¨å†Œæˆä¸ºå–å®¶ï¼Ÿ",
    "support.faq.seller.a1": "ç™»å½• -> ç”³è¯·æˆä¸ºå–å®¶ -> å¡«å†™ä¿¡æ¯ -> ç­‰å¾…å®¡æ ¸ã€‚",
    "support.faq.seller.q2": "å¦‚ä½•åˆ›å»ºåº—é“ºï¼Ÿ",
    "support.faq.seller.a2": "è¿›å…¥åº—é“ºç®¡ç† -> æ–°å»º -> ä¸Šä¼ å•†å“æè¿°ã€å›¾ç‰‡å’Œæ–‡ä»¶ã€‚",
    "support.faq.seller.q3": "å¦‚ä½•ä¼˜åŒ–åº—é“ºï¼Ÿ",
    "support.faq.seller.a3": "ä½¿ç”¨é«˜è´¨é‡å›¾ç‰‡ã€æ¸…æ™°æ ‡é¢˜ã€è¯¦ç»†æè¿°ã€ç¨³å®šçš„äº§å“å’Œå¿«é€Ÿæ”¯æŒã€‚æŽ’åæ¯å‘¨æ›´æ–°ã€‚",
    "support.faq.seller.q4": "å¦‚ä½•è¿›å…¥æŽ¨è/ç½®é¡¶ï¼Ÿ",
    "support.faq.seller.a4": "å–å†³äºŽé”€é‡ã€å®¢æˆ·è¯„ä»·ã€ä¿¡èª‰åº¦å’Œçº çº·çŽ‡ã€‚",
    "support.faq.seller.q5": "æ”¶å…¥å¦‚ä½•å¤„ç†ï¼Ÿ",
    "support.faq.seller.a5.1": "è®¢å•å®ŒæˆåŽï¼Œèµ„é‡‘å°†å¤„äºŽ Pending çŠ¶æ€ 3 å¤©ï¼ˆæ‰˜ç®¡ï¼‰ã€‚ä¹‹åŽå–å®¶å¯é€šè¿‡ä»¥ä¸‹æ–¹å¼æçŽ°ï¼š",
    "support.faq.seller.a5.list1": "åŠ å¯†è´§å¸ï¼šUSDTã€BTCã€ETHã€BNBã€TRX ç­‰ã€‚",
    "support.faq.seller.a5.list2": "é“¶è¡Œè½¬è´¦ï¼ˆæŒ‰å·²éªŒè¯çš„è´¦æˆ·ä¿¡æ¯ï¼‰ã€‚",
    "support.faq.seller.q6": "ä½£é‡‘å¦‚ä½•è®¡ç®—ï¼Ÿ",
    "support.faq.seller.a6": "å¹³å°å¯¹æ¯ç¬”æˆåŠŸè®¢å•æ”¶å– 5% äº¤æ˜“è´¹ã€‚å–å®¶å¯å¼€å¯ Reseller æ¨¡å¼ä»¥æå‡é”€é‡ã€‚",
    "support.faq.seller.q7": "å¦‚ä½•æçŽ°å—ï¼Ÿ",
    "support.faq.seller.a7": "é€‰æ‹©æçŽ° -> é€‰æ‹©åŠ å¯†è´§å¸æˆ–é“¶è¡Œ -> å¡«å†™ä¿¡æ¯ -> ç¡®è®¤ã€‚",
    "support.faq.seller.q8": "å–å®¶çš„ç¨ŽåŠ¡ä¹‰åŠ¡å¦‚ä½•å¤„ç†ï¼Ÿ",
    "support.faq.seller.a8.1": "å¹³å°ä»…ä½œä¸ºæä¾›äº¤æ˜“åŸºç¡€è®¾æ–½çš„ä¸­ä»‹ã€‚",
    "support.faq.seller.a8.2": "å–å®¶éœ€æ ¹æ®è¶Šå—æ³•å¾‹è‡ªè¡Œç”³æŠ¥å¹¶å±¥è¡Œå› æ”¶å…¥äº§ç”Ÿçš„ç¨ŽåŠ¡ä¹‰åŠ¡ã€‚",
    "support.faq.seller.a8.3": "å¹³å°ä¸ä»£æ‰£ã€ä¸ä»£è¡¨æˆ–ä»£æ›¿å–å®¶å±¥è¡Œç¨ŽåŠ¡ä¹‰åŠ¡ã€‚",
    "support.faq.seller.q9": "ç¦æ­¢å•†å“æœ‰å“ªäº›ï¼Ÿ",
    "support.faq.seller.a9": "è¢«é»‘è´¦å·ã€éžæ³•æ•°æ®ã€é“¶è¡Œè´¦æˆ·ã€æ¶æ„å·¥å…·æˆ–ä»»ä½•è¿åè¶Šå—æ³•å¾‹æˆ–ç¬¬ä¸‰æ–¹æ¡æ¬¾çš„å†…å®¹ã€‚",
    "support.faq.seller.q10": "ç”¨æˆ·äº¤æ˜“ä¸Žç®¡ç†å‘˜æœ‰å…³å—ï¼Ÿ",
    "support.faq.seller.a10.1": "ç”¨æˆ·å‘å¸ƒçš„å•†å“æˆ–ä»»åŠ¡å‘å¸ƒå±žäºŽç”¨æˆ·ä¹‹é—´çš„äº¤æ˜“ï¼Œä¸Žç®¡ç†å‘˜æ— å…³ã€‚",
    "support.faq.seller.a10.2": "ç®¡ç†å‘˜ä¸å‚ä¸Žéžæ³•ç‰©å“äº¤æ˜“ã€‚å¦‚å‘ç”Ÿè¿è§„æˆ–æ•…æ„è¿æ³•äº¤æ˜“ï¼Œç®¡ç†å‘˜æœ‰æƒåˆ é™¤å†…å®¹å¹¶å†»ç»“ä½™é¢ã€‚å‚ä¸Žåœ¨æœ¬å¹³å°é”€å”®å³è§†ä¸ºå·²é˜…è¯»å¹¶åŒæ„æ¡æ¬¾ã€‚",
    "support.faq.seller.q11": "API é›†æˆï¼Ÿ",
    "support.faq.seller.a11": "å¯ä»¥ã€‚å–å®¶å¯é›†æˆ API ä»¥è‡ªåŠ¨å‘è´§å¹¶åŒæ­¥åº“å­˜ã€‚",
    "support.faq.seller.q12": "å¦‚ä½•å¤„ç†ä¿ä¿®ï¼Ÿ",
    "support.faq.seller.a12": "è¿›å…¥å·²å”®è®¢å• -> ä¿ä¿® -> è¾“å…¥æ•°é‡ -> ç³»ç»Ÿè‡ªåŠ¨å‘å®¢æˆ·å‘é€æ›¿æ¢ç ã€‚",
    "support.faq.reseller.title": "III. è½¬å”®å•†",
    "support.faq.reseller.q1": "å¦‚ä½•æˆä¸ºè½¬å”®å•†ï¼Ÿ",
    "support.faq.reseller.a1": "åœ¨è´¦å·è®¾ç½®ä¸­å¼€å¯ Reseller æ¨¡å¼ã€‚",
    "support.faq.reseller.q2": "å¦‚ä½•ä»¥è½¬å”®å•†èº«ä»½é”€å”®ï¼Ÿ",
    "support.faq.reseller.a2": "é€‰æ‹©ç¬¦åˆæ¡ä»¶çš„å•†å“ -> èŽ·å–æŽ¨å¹¿é“¾æŽ¥ -> åˆ†äº« -> ç³»ç»Ÿè‡ªåŠ¨è®°å½•ä½£é‡‘ã€‚",
    "support.faq.reseller.q3": "ä½£é‡‘æçŽ°å—ï¼Ÿ",
    "support.faq.reseller.a3": "ä½£é‡‘å°†æ‰˜ç®¡ 3 å¤©ï¼Œä¹‹åŽå¯é€šè¿‡åŠ å¯†è´§å¸æˆ–é“¶è¡ŒæçŽ°ã€‚",
    "support.faq.reseller.q4": "æ¯æœˆå¥–åŠ±ï¼Ÿ",
    "support.faq.reseller.a4": "æœ‰ã€‚å¹³å°æä¾›åŸºäºŽæœˆåº¦è¡¨çŽ°çš„å¥–åŠ±è®¡åˆ’ã€‚",
    "support.faq.compliance.title": "IV. éµå®ˆè¶Šå—æ³•å¾‹ - AML ä¸Žæ¬ºè¯ˆ",
    "support.faq.compliance.q1": "åæ´—é’±ï¼ˆAMLï¼‰",
    "support.faq.compliance.a1.lead": "ä¸¥æ ¼ç¦æ­¢ï¼š",
    "support.faq.compliance.a1.list1": "æµé€šéžæ³•èµ„äº§",
    "support.faq.compliance.a1.list2": "éšçž’èµ„é‡‘æ¥æº",
    "support.faq.compliance.a1.list3": "ç–‘ä¼¼æ´—é’±çš„å¼‚å¸¸äº¤æ˜“",
    "support.faq.compliance.a1.note": "å¹³å°æœ‰æƒåœ¨å¿…è¦æ—¶å†»ç»“èµ„é‡‘ã€é”å®šè´¦å·ã€è¦æ±‚èº«ä»½éªŒè¯å¹¶é…åˆæœ‰å…³éƒ¨é—¨ã€‚",
    "support.faq.compliance.q2": "æ¬ºè¯ˆé˜²èŒƒ",
    "support.faq.compliance.a2.lead": "ä¸¥æ ¼ç¦æ­¢ï¼š",
    "support.faq.compliance.a2.list1": "è™šå‡è®¢å•",
    "support.faq.compliance.a2.list2": "æ»¥ç”¨äº‰è®®",
    "support.faq.compliance.a2.list3": "å¤šè´¦å·",
    "support.faq.compliance.a2.list4": "æœºå™¨äººã€é»‘å®¢æˆ–åˆ©ç”¨ç³»ç»Ÿæ¼æ´ž",
    "support.faq.compliance.q3": "éµå®ˆè¶Šå—æ³•å¾‹",
    "support.faq.compliance.a3": "ç”¨æˆ·ä¸å¾—ä¹°å–éžæ³•ç‰©å“æˆ–ä¾µçŠ¯éšç§ä¸Žä¸ªäººæ•°æ®ã€‚",
    "profile.overview.pageTitle": "è´¦æˆ·æ¦‚è§ˆ | polyflux.xyz",
    "profile.overview.title": "è´¦æˆ·æ¦‚è§ˆ",
    "profile.overview.subtitle": "åœ¨ä¸€å¤„æŸ¥çœ‹ä½™é¢ã€è®¢å•ä¸Žå®‰å…¨ã€‚",
    "profile.overview.quickInfoTitle": "å¿«é€Ÿä¿¡æ¯",
    "profile.overview.quickInfoDesc": "ä½™é¢ã€æ€»è®¢å•ã€è´¦å·ç­‰çº§...",
    "profile.overview.table.labelItem": "é¡¹ç›®",
    "profile.overview.table.labelValue": "æ•°å€¼",
    "profile.overview.table.labelStatus": "çŠ¶æ€",
    "profile.overview.table.balanceLabel": "å¯ç”¨ä½™é¢",
    "profile.overview.table.balanceStatus": "æœªå……å€¼",
    "profile.overview.table.ordersLabel": "è®¢å•æ€»æ•°",
    "profile.overview.table.ordersStatus": "å®Œæˆ",
    "profile.overview.quickLinks.title": "å¿«é€Ÿå¯¼èˆª",
    "profile.overview.quickLinks.profile": "ä¸ªäººä¸»é¡µ",
    "profile.overview.quickLinks.orders": "è®¢å•",
    "profile.overview.quickLinks.topups": "å……å€¼",
    "profile.overview.quickLinks.logins": "ç™»å½•è®°å½•",
    "profile.overview.quickLinks.security": "å®‰å…¨ & 2FA",
    "profile.public.pageTitle": "ä¸ªäººä¸»é¡µ | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "åŠ å…¥",
    "profile.public.badgeLabel": "å¾½ç« ",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "????????",
    "profile.public.copySuccess": "??????????",
    "profile.public.copyFail": "???????????",
    "profile.public.follow": "å…³æ³¨",
    "profile.public.following": "å·²å…³æ³¨",
    "profile.public.followersLabel": "ç²‰ä¸",
    "profile.public.followingLabel": "å…³æ³¨ä¸­",
    "profile.public.stats.purchased": "å·²è´­ä¹°",
    "profile.public.stats.sold": "å·²å”®å‡º",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "æŸ¥çœ‹åº—é“º",
    "profile.public.featured.title": "ç²¾é€‰å†…å®¹",
    "profile.public.featured.manage": "ç¼–è¾‘ç²¾é€‰å†…å®¹",
    "profile.public.featured.note": "ç²¾é€‰å†…å®¹ä¼šåœ¨ 30 å¤©åŽè‡ªåŠ¨åˆ é™¤ã€‚",
    "profile.public.featured.emptyTitle": "è¯¥ç”¨æˆ·æš‚æ— ç²¾é€‰å†…å®¹ã€‚",
    "profile.public.featured.emptyDesc": "æ–°å†…å®¹å°†åœ¨ 30 å¤©åŽè‡ªåŠ¨éšè—ã€‚",
    "profile.public.story.defaultTitle": "åŠ¨æ€ #{index}",
    "profile.public.story.type.video": "è§†é¢‘",
    "profile.public.story.type.image": "å›¾ç‰‡",
    "profile.public.story.titleFallback": "ç²¾é€‰å†…å®¹",
    "profile.public.story.alt": "åŠ¨æ€",
    "profile.public.manage.title": "ç®¡ç†ä¸ªäººä¸»é¡µ",
    "profile.public.manage.titlePlaceholder": "æ ‡é¢˜",
    "profile.public.manage.upload": "ä¸Šä¼ ",
    "profile.public.manage.remove": "ç§»é™¤",
    "profile.public.manage.help": "?????? 9:16??? 2MB????? 60 ???????????",
    "profile.public.manage.close": "å…³é—­",
    "profile.public.manage.save": "ä¿å­˜æ›´æ”¹",
    "profile.public.manage.slotLabel": "ä½ç½® {index}",
    "profile.public.manage.limit.pro": "æœ€å¤š 4 æ¡ï¼Œæ”¯æŒè§†é¢‘ã€‚",
    "profile.public.manage.limit.basic": "æœªæ»¡è¶³æ¡ä»¶ï¼Œä»…å¯å‘å¸ƒ 1 å¼ å›¾ç‰‡ã€‚",
    "profile.public.toast.saveFail": "æ— æ³•ä¿å­˜ç²¾é€‰å†…å®¹ã€‚",
    "profile.public.toast.loginRequired": "è¯·ç™»å½•åŽå…³æ³¨ã€‚",
    "profile.public.toast.imageOrVideoOnly": "ä»…æ”¯æŒå›¾ç‰‡æˆ–è§†é¢‘ã€‚",
    "profile.public.toast.notEligible": "æš‚ä¸æ”¯æŒä¸Šä¼ è§†é¢‘æˆ–å¤šæ¡å†…å®¹ã€‚",
    "profile.public.toast.uploadFail": "ä¸Šä¼ å¤±è´¥ã€‚",
    "profile.public.toast.imageTooLarge": "???? 2MB?",
    "profile.public.toast.imageRatio": "å›¾ç‰‡æ¯”ä¾‹å¿…é¡»ä¸º 9:16ã€‚",
    "profile.public.toast.imageReadFail": "æ— æ³•è¯»å–å›¾ç‰‡ã€‚",
    "profile.public.toast.videoNotEligible": "è§†é¢‘ä»…é™ç¬¦åˆæ¡ä»¶çš„è´¦å·ã€‚",
    "profile.public.toast.videoTooLarge": "è§†é¢‘è¶…è¿‡ 25MBã€‚",
    "profile.public.toast.videoRatio": "è§†é¢‘æ¯”ä¾‹å¿…é¡»ä¸º 9:16ã€‚",
    "profile.public.toast.videoDuration": "è§†é¢‘è¶…è¿‡ 60 ç§’ã€‚",
    "profile.public.toast.videoReadFail": "æ— æ³•è¯»å–è§†é¢‘ã€‚",
    "profile.public.toast.coverReadFail": "æ— æ³•è¯»å–å°é¢å›¾ç‰‡ã€‚",
    "product.detail.pageTitle": "å•†å“è¯¦æƒ… | polyflux.xyz",
    "breadcrumb.home": "é¦–é¡µ",
    "breadcrumb.detail": "è¯¦æƒ…",
    "product.detail.share": "åˆ†äº«",
    "product.detail.share.copied": "å·²å¤åˆ¶",
    "product.detail.share.failed": "å¤åˆ¶å¤±è´¥",
    "product.detail.favorite": "æ”¶è—",
    "product.detail.favorite.active": "å·²æ”¶è—",
    "product.detail.otherTitle": "è¯¥åº—é“ºçš„å…¶ä»–å•†å“",
    "product.detail.other.empty": "æš‚æ— å…¶ä»–å•†å“ã€‚",
    "product.detail.order": "ä¸‹å•",
    "product.detail.preorder": "é¢„è®¢",
    "product.detail.message": "ç§ä¿¡",
    "product.detail.tab.shop": "åº—é“ºæè¿°",
    "product.detail.tab.reviews": "è¯„ä»·",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "ç¡®è®¤ä¸‹å•",
    "product.detail.modal.quantity": "æ•°é‡",
    "product.detail.modal.subtotal": "å°è®¡",
    "product.detail.modal.cancel": "å–æ¶ˆ",
    "product.detail.modal.confirm": "ç¡®è®¤ä¸‹å•",
    "product.detail.modal.processing": "å¤„ç†ä¸­...",
    "product.detail.modal.max": "æœ€å¤š {max}",
    "product.detail.toast.success": "ä¸‹å•æˆåŠŸï¼Œè¯·åœ¨è®¢å•ä¸­æŸ¥çœ‹ã€‚",
    "product.detail.toast.viewOrders": "æŸ¥çœ‹è®¢å•",
    "product.detail.toast.loginRequired": "è¯·ç™»å½•åŽä¸‹å•ã€‚",
    "product.detail.toast.orderFailed": "ä¸‹å•å¤±è´¥ã€‚",
    "product.detail.notFound": "æœªæ‰¾åˆ°å•†å“",
    "product.detail.description.pending": "æè¿°æ›´æ–°ä¸­ã€‚",
    "product.detail.rating.positive": "å¥½è¯„",
    "product.detail.rating.neutral": "ä¸€èˆ¬",
    "product.detail.rating.negative": "æœ‰å¾…æ”¹è¿›",
    "product.detail.rating.none": "æš‚æ— è¯„ä»·",
    "product.detail.shopIdLabel": "åº—é“º ID",
    "product.detail.shop.polyflux.title": "PolyFlux å®˜æ–¹",
    "product.detail.shop.polyflux.bullet1": "å¿«é€Ÿäº¤ä»˜ï¼Œäº¤ä»˜å‰æ£€æŸ¥ã€‚",
    "product.detail.shop.polyflux.bullet2": "é—®é¢˜æ— æ³•è§£å†³å¯é€€æ¬¾ã€‚",
    "product.detail.shop.polyflux.bullet3": "Telegram 24/7 æ”¯æŒã€‚",
    "product.detail.shop.partner.title": "åˆä½œå•†åº— #1",
    "product.detail.shop.partner.bullet1": "åº“å­˜ç¨³å®šï¼Œå‡ åˆ†é’Ÿå†…äº¤ä»˜ã€‚",
    "product.detail.shop.partner.bullet2": "å¤§é¢è®¢å•äº«å—æ›´ä¼˜ä»·æ ¼ã€‚",
    "product.detail.shop.partner.bullet3": "æŒ‰ä¸Šæž¶æ”¿ç­–æä¾›ä¿ä¿®æ”¯æŒã€‚",
    "product.detail.shop.fallbackTitle": "å¯ä¿¡åº—é“º",
    "product.detail.shop.fallbackBullet1": "æ”¶è´§åŽç«‹å³æ£€æŸ¥å•†å“ã€‚",
    "product.detail.shop.fallbackBullet2": "å‡ºçŽ°é—®é¢˜å¯èŽ·å¾—æ”¯æŒã€‚",
    "product.detail.review.1.text": "å‘è´§å¾ˆå¿«ï¼Œè´¦å·æ­£å¸¸ã€‚",
    "product.detail.review.1.time": "2 å°æ—¶å‰",
    "product.detail.review.2.text": "æ”¯æŒå¾ˆå¿«ï¼Œä¿ä¿®æ˜Žç¡®ã€‚",
    "product.detail.review.2.time": "1 å¤©å‰",
    "product.detail.review.3.text": "ä¸Žæè¿°ä¸€è‡´ï¼Œä¼šå†æ¬¡è´­ä¹°ã€‚",
    "product.detail.review.3.time": "3 å¤©å‰",
    "product.detail.api.title": "äº¤ä»˜ API",
    "product.detail.api.bullet1": "ä»˜æ¬¾åŽè‡ªåŠ¨å‘è´§ä»£ç ã€‚",
    "product.detail.api.bullet2": "å…¼å®¹ REST/JSONã€‚",
    "product.detail.api.bullet3": "è”ç³»ç®¡ç†å‘˜èŽ·å–å¯†é’¥ã€‚",
    "service.detail.pageTitle": "æœåŠ¡è¯¦æƒ… | polyflux.xyz",
    "service.detail.hero.loadingTitle": "æœåŠ¡åŠ è½½ä¸­...",
    "service.detail.hero.loadingDesc": "æœåŠ¡æè¿°å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "service.detail.info.title": "å¥—é¤ä¿¡æ¯",
    "service.detail.info.desc": "ä»Ž /data/mock-services.json è¯»å–ã€‚è¿žæŽ¥ API åŽä¼šè¿”å›žè¯¦ç»†æè¿°ã€‚",
    "service.detail.form.title": "ä»˜æ¬¾åŽçš„éœ€æ±‚è¡¨å•",
    "service.detail.form.desc": "æ”¯ä»˜æˆåŠŸåŽï¼Œç”¨æˆ·å¡«å†™æ­¤è¡¨å•ä»¥ä¾¿å‡†ç¡®å¤„ç†æœåŠ¡ã€‚",
    "service.detail.form.emailLabel": "ç»“æžœé‚®ç®±",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "ç›®æ ‡é“¾æŽ¥",
    "service.detail.form.linkPlaceholder": "ä¾‹å¦‚ï¼šå¸–å­/ä¸»é¡µ/è§†é¢‘é“¾æŽ¥...",
    "service.detail.form.noteLabel": "è¯¦ç»†éœ€æ±‚",
    "service.detail.form.notePlaceholder": "æè¿°éœ€æ±‚ã€æ•°é‡ã€æœŸæœ›é€Ÿåº¦...",
    "service.detail.form.save": "ä¿å­˜éœ€æ±‚",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "æ­¤è¡¨å•ä¸ä¼šæäº¤ã€‚è¿žæŽ¥ API åŽå°†æ•°æ® POST è‡³åŽç«¯ã€‚",
    "service.detail.notFound": "æœªæ‰¾åˆ°æœåŠ¡",
    "service.detail.noData": "æš‚æ— æ•°æ®ï¼Œè¿žæŽ¥ API æˆ–æ·»åŠ  JSON åŽæ˜¾ç¤ºã€‚",
    "service.detail.fallback.summary": "æœåŠ¡è¯¦æƒ…å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "service.detail.fallback.description": "æœåŠ¡è¯¦ç»†ä¿¡æ¯å°†ç”±åŽç«¯ API è¿”å›žå¹¶æ˜¾ç¤ºåœ¨æ­¤å¤„ã€‚",
    "task.detail.pageTitle": "ä»»åŠ¡è¯¦æƒ… | polyflux.xyz",
    "task.detail.hero.loadingTitle": "ä»»åŠ¡åŠ è½½ä¸­...",
    "task.detail.hero.loadingDesc": "ä»»åŠ¡æè¿°å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "task.detail.info.title": "ä»»åŠ¡ä¿¡æ¯",
    "task.detail.info.desc": "æ•°æ®æ¥è‡ª /data/mock-tasks.jsonã€‚è¿žæŽ¥ API åŽå°†ä»ŽåŽç«¯èŽ·å–ã€‚",
    "task.detail.report.title": "æäº¤æŠ¥å‘Š",
    "task.detail.report.desc": "æäº¤ä»»åŠ¡å®Œæˆè¯æ˜Žã€‚",
    "task.detail.report.contactLabel": "é‚®ç®± / ç”¨æˆ·å",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "è¯æ˜Žé“¾æŽ¥",
    "task.detail.report.proofPlaceholder": "ä¾‹å¦‚ï¼šå¸–å­é“¾æŽ¥ã€è§†é¢‘",
    "task.detail.report.noteLabel": "è¡¥å……è¯´æ˜Ž",
    "task.detail.report.notePlaceholder": "ç®€è¦è¯´æ˜Žå·²å®Œæˆçš„å·¥ä½œ...",
    "task.detail.report.submit": "æäº¤æŠ¥å‘Š",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "è¿žæŽ¥ API åŽç³»ç»Ÿå°†æŽ¥æ”¶æŠ¥å‘Šå¹¶è‡ªåŠ¨å®¡æ ¸ã€‚",
    "task.detail.notFound": "æœªæ‰¾åˆ°ä»»åŠ¡",
    "task.detail.noData": "æš‚æ— æ•°æ®ï¼Œè¯·ç¨åŽå†è¯•ã€‚",
    "task.detail.titleFallback": "ä»»åŠ¡",
    "task.detail.fallback.summary": "ä»»åŠ¡è¯¦æƒ…å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "task.detail.fallback.description": "API å¯ç”¨åŽå°†æ›´æ–°ä»»åŠ¡è¯¦ç»†ä¿¡æ¯ã€‚",
    "maintenance.title": "æœåŠ¡å™¨ç»´æŠ¤",
    "maintenance.desc": "ç³»ç»Ÿç»´æŠ¤ä¸­ï¼Œç»™æ‚¨å¸¦æ¥ä¸ä¾¿æ•¬è¯·è°…è§£ï¼Œé¢„è®¡ä¸ä¼šè¶…è¿‡ 1 å°æ—¶ã€‚",
    "cart.pageTitle": "è´­ç‰©è½¦ | polyflux.xyz",
    "cart.items.title": "è´­ç‰©è½¦å•†å“",
    "cart.empty.title": "è´­ç‰©è½¦ä¸ºç©ºã€‚",
    "cart.empty.desc": "è¿žæŽ¥ API åŽï¼Œä½ é€‰æ‹©çš„å•†å“å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "cart.summary.title": "è®¢å•æ‘˜è¦",
    "cart.summary.desc": "æ€»é¢ã€è´¹ç”¨ã€ä¼˜æƒ ç ã€‚",
    "cart.summary.couponLabel": "ä¼˜æƒ ç ",
    "cart.summary.couponPlaceholder": "è¾“å…¥ä¼˜æƒ ç ",
    "cart.summary.apply": "åº”ç”¨",
    "cart.summary.checkout": "ç»§ç»­ç»“ç®—",
    "checkout.pageTitle": "ç»“ç®— | polyflux.xyz",
    "checkout.buyer.title": "ä¹°å®¶ä¿¡æ¯",
    "checkout.buyer.emailLabel": "è®¢å•é‚®ç®±",
    "checkout.buyer.platformLabel": "ID / ç”¨æˆ·åï¼ˆå¯é€‰ï¼‰",
    "checkout.buyer.platformPlaceholder": "è§†äº§å“/æœåŠ¡è€Œå®š",
    "checkout.note.title": "é™„åŠ è¯´æ˜Ž",
    "checkout.note.label": "è®¢å•å¤‡æ³¨",
    "checkout.note.placeholder": "ä¾‹å¦‚ï¼šäº¤ä»˜ .txt æ–‡ä»¶ï¼Œé€šè¿‡é‚®ä»¶å‘é€...",
    "checkout.summary.title": "è®¢å•æ‘˜è¦",
    "checkout.summary.desc": "æ€»é¢ä¸Žæ”¯ä»˜æ–¹å¼ã€‚",
    "checkout.summary.emptyTitle": "æš‚æ— è´­ç‰©è½¦æ•°æ®ã€‚",
    "checkout.summary.emptyDesc": "è¿žæŽ¥ API åŽï¼Œå•†å“åˆ—è¡¨å’Œæ€»é¢ä¼šæ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "checkout.summary.success": "æ”¯ä»˜æˆåŠŸ",
    "checkout.summary.failed": "æ¨¡æ‹Ÿå¤±è´¥",
    "checkout.success.pageTitle": "æ”¯ä»˜æˆåŠŸ | polyflux.xyz",
    "checkout.success.title": "æ”¯ä»˜æˆåŠŸ",
    "checkout.success.desc": "ä½ çš„è®¢å•å·²è®°å½•ã€‚è¿žæŽ¥ API åŽå°†æ˜¾ç¤ºè®¢å•è¯¦æƒ…å’Œä¸‹è½½æŒ‰é’®ã€‚",
    "checkout.success.orders": "æŸ¥çœ‹æˆ‘çš„è®¢å•",
    "checkout.success.continue": "ç»§ç»­è´­ç‰©",
    "checkout.failed.pageTitle": "æ”¯ä»˜å¤±è´¥ | polyflux.xyz",
    "checkout.failed.title": "æ”¯ä»˜å¤±è´¥",
    "checkout.failed.desc": "ä½ å¯èƒ½å–æ¶ˆäº†æ”¯ä»˜æˆ–æ”¯ä»˜ç½‘å…³è¿”å›žé”™è¯¯ã€‚è¿žæŽ¥ API åŽå°†æ˜¾ç¤ºè¯¦ç»†é”™è¯¯ç ã€‚",
    "checkout.failed.retry": "é‡æ–°æ”¯ä»˜",
    "checkout.failed.backProducts": "è¿”å›žå•†å“",
    "profile.orders.pageTitle": "è®¢å• | polyflux.xyz",
    "profile.orders.title": "æˆ‘çš„è®¢å•",
    "profile.orders.subtitle": "è·Ÿè¸ªè®¢å•çŠ¶æ€å’Œäº¤æ˜“è®°å½•ã€‚",
    "profile.orders.history.title": "è®¢å•åŽ†å²",
    "profile.orders.table.orderId": "è®¢å•å·",
    "profile.orders.table.product": "å•†å“",
    "profile.orders.table.total": "æ€»é¢",
    "profile.orders.table.status": "çŠ¶æ€",
    "profile.orders.status.completed": "å·²å®Œæˆ",
    "profile.orders.status.processing": "å¤„ç†ä¸­",
    "profile.orders.status.cancelled": "å·²å–æ¶ˆ",
    "profile.orders.sample.email": "é‚®ç®± 1",
    "profile.orders.sample.vip": "VIP è´¦å·",
    "profile.orders.sample.interaction": "äº’åŠ¨å¥—é¤ 3",
    "profile.history.pageTitle": "è´¦æˆ·è®°å½• | polyflux.xyz",
    "profile.history.title": "è´¦æˆ·è®°å½•",
    "profile.history.subtitle": "æ±‡æ€»è¿‘æœŸå……å€¼ã€æçŽ°å’Œè´­ä¹°è®°å½•ã€‚",
    "profile.history.sectionTitle": "è¿‘æœŸæ´»åŠ¨",
    "profile.history.table.date": "æ—¶é—´",
    "profile.history.table.type": "ç±»åž‹",
    "profile.history.table.amount": "é‡‘é¢",
    "profile.history.table.status": "çŠ¶æ€",
    "profile.history.type.topup": "å……å€¼",
    "profile.history.type.withdraw": "æçŽ°",
    "profile.history.type.order": "è®¢å•",
    "profile.history.status.success": "æˆåŠŸ",
    "profile.history.status.processing": "å¤„ç†ä¸­",
    "profile.history.status.completed": "å·²å®Œæˆ",
    "profile.tasks.pageTitle": "å·²æŽ¥ä»»åŠ¡ | polyflux.xyz",
    "profile.tasks.title": "å·²æŽ¥ä»»åŠ¡",
    "profile.tasks.subtitle": "è·Ÿè¸ªä½ å·²æŽ¥çš„ä»»åŠ¡å’Œå®¡æ ¸è¿›åº¦ã€‚",
    "profile.tasks.sectionTitle": "å·²æŽ¥ä»»åŠ¡åˆ—è¡¨",
    "profile.tasks.table.task": "ä»»åŠ¡",
    "profile.tasks.table.receivedAt": "æŽ¥å–æ—¥æœŸ",
    "profile.tasks.table.deadline": "åˆ°æœŸ",
    "profile.tasks.table.reward": "å¥–åŠ±",
    "profile.tasks.table.status": "çŠ¶æ€",
    "profile.tasks.emptyTitle": "æš‚æ— å·²æŽ¥ä»»åŠ¡ã€‚",
    "profile.tasks.emptyDesc": "å½“ä½ æŽ¥å–æ–°ä»»åŠ¡æ—¶ï¼Œä¼šæ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "profile.topups.pageTitle": "å……å€¼ | polyflux.xyz",
    "profile.topups.title": "è´¦æˆ·å……å€¼",
    "profile.topups.subtitle": "è¯·è¾“å…¥å……å€¼é‡‘é¢ï¼šæœ€ä½Ž 10,000Ä‘ï¼Œæœ€é«˜ 499,000,000Ä‘ã€‚æ¯æ¬¡å……å€¼éƒ½ä¼šç”Ÿæˆ QRã€‚",
    "profile.topups.guard.title": "éœ€è¦ç™»å½•ï¼š",
    "profile.topups.guard.desc": "éœ€è¦ç™»å½•æ‰èƒ½ä¸ºé’±åŒ…å……å€¼ã€‚",
    "profile.topups.bank.title": "é“¶è¡Œå……å€¼ï¼ˆQRï¼‰",
    "profile.topups.bank.desc": "ç”¨é“¶è¡Œ App æ‰«æ QRã€‚è½¬è´¦åŽç³»ç»Ÿä¼šè‡ªåŠ¨å…¥è´¦ã€‚",
    "profile.topups.bank.qrPlaceholder": "åˆ›å»ºåŽå°†æ˜¾ç¤º QRã€‚",
    "profile.topups.bank.codeLabel": "å¼€æˆ·å",
    "profile.topups.bank.amountLabel": "é‡‘é¢",
    "profile.topups.bank.amountInputLabel": "å……å€¼é‡‘é¢ (VND)",
    "profile.topups.bank.amountPlaceholder": "ä¾‹å¦‚ï¼š100000",
    "profile.topups.bank.amountHint": "æœ€ä½Ž 10,000Ä‘ï¼Œæœ€é«˜ 499,000,000Ä‘ã€‚",
    "profile.topups.bank.generate": "ç”Ÿæˆ QR",
    "profile.topups.bank.toast.invalidAmount": "è¯·è¾“å…¥æœ‰æ•ˆé‡‘é¢ã€‚",
    "profile.topups.bank.toast.range": "é‡‘é¢å¿…é¡»åœ¨ {min} åˆ° {max} Ä‘ ä¹‹é—´ã€‚",
    "profile.topups.bank.toast.created": "å·²ç”Ÿæˆ QRã€‚æ‰«æå³å¯å……å€¼ã€‚",
    "profile.topups.bank.toast.failed": "æš‚æ—¶æ— æ³•ç”Ÿæˆ QRã€‚",
    "profile.topups.crypto.notice": "åŠ å¯†è´§å¸å……å€¼æš‚ä¸å¯ç”¨ï¼Œè¯·ä½¿ç”¨é“¶è¡Œè½¬è´¦ã€‚",
    "profile.topups.crypto.title": "åŠ å¯†è´§å¸å……å€¼ï¼ˆUSDT TRC20ï¼‰",
    "profile.topups.crypto.desc": "é€šè¿‡ USDT TRC20 å……å€¼ã€‚é“¾ä¸Šç¡®è®¤åŽç³»ç»Ÿå°†å…¥è´¦ã€‚",
    "profile.topups.crypto.addressLabel": "TRC20 é’±åŒ…åœ°å€",
    "profile.topups.crypto.amountLabel": "USDT æ•°é‡",
    "profile.topups.crypto.amountPlaceholder": "ä¾‹å¦‚ï¼š10",
    "profile.topups.crypto.confirm": "æˆ‘å·²è½¬è´¦",
    "profile.topups.withdraw.title": "æçŽ°",
    "profile.topups.withdraw.desc": "æ ¹æ®å½“å‰ä½™é¢è¾“å…¥æçŽ°é‡‘é¢ã€‚æœ€ä½Ž 50,000Ä‘ï¼Œæœ€é«˜ 499,000,000Ä‘ã€‚",
    "profile.topups.withdraw.balanceLabel": "å¯ç”¨ä½™é¢ï¼š",
    "profile.topups.withdraw.amountLabel": "æçŽ°é‡‘é¢ (VND)",
    "profile.topups.withdraw.amountPlaceholder": "ä¾‹å¦‚ï¼š500000",
    "profile.topups.withdraw.amountHint": "æœ€ä½Ž 50,000Ä‘ï¼Œæœ€é«˜ 499,000,000Ä‘ã€‚",
    "profile.topups.withdraw.bankLabel": "é“¶è¡Œ",
    "profile.topups.withdraw.bankPlaceholder": "ä¾‹å¦‚ï¼šVietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "è´¦å·",
    "profile.topups.withdraw.accountPlaceholder": "è¾“å…¥è´¦å·",
    "profile.topups.withdraw.nameLabel": "å¼€æˆ·å",
    "profile.topups.withdraw.namePlaceholder": "å¼€æˆ·äººå§“å",
    "profile.topups.withdraw.submit": "æäº¤æçŽ°ç”³è¯·",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "è½¬è´¦å‰éœ€ç®¡ç†å‘˜å®¡æ ¸ã€‚",
    "profile.topups.history.topup.title": "æœ€è¿‘å……å€¼è®°å½•",
    "profile.topups.history.withdraw.title": "æçŽ°è®°å½•",
    "profile.topups.history.table.date": "æ—¶é—´",
    "profile.topups.history.table.amount": "é‡‘é¢",
    "profile.topups.history.table.bank": "é“¶è¡Œ",
    "profile.topups.history.table.status": "çŠ¶æ€",
    "profile.topups.status.pending": "å®¡æ ¸ä¸­",
    "profile.topups.status.completed": "å·²å¤„ç†",
    "profile.topups.status.rejected": "å·²æ‹’ç»",
    "profile.security.pageTitle": "å®‰å…¨ & 2FA | polyflux.xyz",
    "profile.security.title": "å®‰å…¨ & 2FA",
    "profile.security.subtitle": "åŠ å¼ºè´¦æˆ·å®‰å…¨å¹¶æŽ§åˆ¶è®¿é—®ã€‚",
    "profile.security.password.title": "æ›´æ–°å¯†ç ",
    "profile.security.password.desc": "å®šæœŸä¿®æ”¹å¯†ç ä»¥æ›´å¥½ä¿æŠ¤è´¦æˆ·ã€‚",
    "profile.security.password.currentLabel": "å½“å‰å¯†ç ",
    "profile.security.password.currentPlaceholder": "è¾“å…¥å½“å‰å¯†ç ",
    "profile.security.password.newLabel": "æ–°å¯†ç ",
    "profile.security.password.newPlaceholder": "è‡³å°‘ 8 ä¸ªå­—ç¬¦",
    "profile.security.password.confirmLabel": "ç¡®è®¤æ–°å¯†ç ",
    "profile.security.password.confirmPlaceholder": "å†æ¬¡è¾“å…¥æ–°å¯†ç ",
    "profile.security.password.submit": "æ›´æ–°å¯†ç ",
    "profile.security.2fa.title": "åŒé‡éªŒè¯ (2FA)",
    "profile.security.2fa.desc": "å¯ç”¨ 2FA ä»¥åœ¨ç™»å½•æ—¶è¦æ±‚éªŒè¯ç ã€‚",
    "profile.security.2fa.recoveryLabel": "æ¢å¤ç ",
    "profile.security.2fa.deviceLabel": "å¯ä¿¡è®¾å¤‡",
    "profile.security.2fa.deviceNone": "æš‚æ— å·²æ·»åŠ è®¾å¤‡ã€‚",
    "profile.security.2fa.enable": "å¯ç”¨ 2FA",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "è¿žæŽ¥ API ä»¥ä¿å­˜ 2FA è®¾ç½®å’Œè®¾å¤‡åˆ—è¡¨ã€‚",
    "profile.favorites.pageTitle": "æ”¶è— | polyflux.xyz",
    "profile.favorites.title": "æ”¶è—",
    "profile.favorites.subtitle": "æŸ¥çœ‹ä½ å·²æ”¶è—çš„å•†å“ä¸ŽæœåŠ¡ã€‚",
    "profile.favorites.listTitle": "æ”¶è—åˆ—è¡¨",
    "profile.favorites.emptyTitle": "æš‚æ— æ•°æ®ã€‚",
    "profile.favorites.emptyDesc": "æ”¶è—å•†å“åŽå¯ç¨åŽæŸ¥çœ‹ã€‚",
    "profile.notifications.pageTitle": "é€šçŸ¥ | polyflux.xyz",
    "profile.notifications.title": "é€šçŸ¥",
    "profile.notifications.subtitle": "è®¢å•å’Œç³»ç»Ÿæ›´æ–°ä¼šæ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
    "profile.notifications.listTitle": "æ–°é€šçŸ¥",
    "profile.notifications.emptyTitle": "æš‚æ— é€šçŸ¥ã€‚",
    "profile.notifications.emptyDesc": "è¯·ç¨åŽå†æŸ¥çœ‹ã€‚",
    "profile.badges.pageTitle": "å¾½ç«  | polyflux.xyz",
    "profile.badges.title": "å¾½ç« ",
    "profile.badges.subtitle": "æŸ¥çœ‹ä½ çš„ç­‰çº§ä¸Žæˆå°±ã€‚",
    "profile.badges.listTitle": "å·²èŽ·å¾—å¾½ç« ",
    "profile.badges.emptyTitle": "æš‚æ— å¾½ç« ã€‚",
    "profile.badges.emptyDesc": "å®Œæˆä»»åŠ¡å³å¯è§£é”ã€‚",
    "profile.messages.pageTitle": "æ¶ˆæ¯ | polyflux.xyz",
    "profile.messages.inboxTitle": "æ”¶ä»¶ç®±",
    "profile.messages.inboxCount": "1 ä¸ªä¼šè¯",
    "profile.messages.searchPlaceholder": "æœç´¢...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "å®˜æ–¹æ”¯æŒ",
    "profile.messages.thread.empty": "æ²¡æœ‰å…¶ä»–ä¼šè¯ã€‚",
    "profile.messages.back": "è¿”å›ž",
    "profile.messages.user.sub": "ç®¡ç†å‘˜æ”¯æŒ",
    "profile.messages.role.admin": "ç®¡ç†å‘˜",
    "profile.messages.day.today": "ä»Šå¤©",
    "profile.messages.message.1": "ä½ å¥½ï¼Œéœ€è¦ä»€ä¹ˆå¸®åŠ©ï¼Ÿ",
    "profile.messages.message.2": "æˆ‘æƒ³å’¨è¯¢è®¢å• # çš„ä¿¡æ¯ã€‚",
    "profile.messages.message.3": "æ­£åœ¨æŸ¥çœ‹ï¼Œè¯·ç¨ç­‰ã€‚",
    "profile.messages.message.4": "è°¢è°¢ã€‚",
    "profile.messages.emojiLabel": "è¡¨æƒ…",
    "profile.messages.attachLabel": "é™„ä»¶",
    "profile.messages.inputPlaceholder": "è¾“å…¥æ¶ˆæ¯...",
    "profile.messages.send": "å‘é€",
    "product.data.gmail-random.name": "Gmail éšæœºå",
    "product.data.gmail-random.short": "Gmail éšæœºå…¨æƒé™ï¼Œ7 å¤©ä¿ä¿®ã€‚",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "ç”¨äºŽæ¿€æ´»å¤šç§ç¦åˆ©çš„ Gmail EDU è´¦å·ã€‚",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "å·²å®Œæˆ KYC çš„ç¾Žå›½è´¦å·ï¼Œå¯ç”¨äºŽå¤šç§æœåŠ¡ã€‚",
    "product.data.tool-checker.name": "èµ„æºæ£€æµ‹å·¥å…·",
    "product.data.tool-checker.short": "ç”¨äºŽå¿«é€Ÿæ£€æµ‹èµ„æºå­˜æ´»/å¤±æ•ˆçš„æœ¬åœ°å·¥å…·ã€‚",
    "service.data.fb-boost.name": "Facebook äº’åŠ¨æå‡æœåŠ¡",
    "service.data.fb-boost.short": "è‡ªç„¶æå‡ç‚¹èµžã€è¯„è®ºã€åˆ†äº«ï¼Œ7 å¤©ä¿ä¿®ã€‚",
    "service.data.tiktok-view.name": "TikTok æ’­æ”¾é‡æå‡",
    "service.data.tiktok-view.short": "é€‚ç”¨äºŽæ–°è§†é¢‘çš„ TikTok æ’­æ”¾é‡å¥—é¤ï¼Œé€‚åˆå†…å®¹æµ‹è¯•ã€‚",
    "task.data.review-product.title": "åœ¨è®ºå›æ’°å†™äº§å“è¯„ä»·",
    "task.data.review-product.short": "æ’°å†™ polyflux.xyz çš„è¯¦ç»†è´­ä¹°ä½“éªŒä¸Žè¯„ä»·ã€‚",
    "task.data.tiktok-video.title": "åˆ¶ä½œä»‹ç»åº—é“ºçš„ TikTok è§†é¢‘",
    "task.data.tiktok-video.short": "æ‹æ‘„æœåŠ¡è¯„æµ‹çŸ­è§†é¢‘ï¼Œå¹¶æŒ‰è¦æ±‚æ·»åŠ è¯é¢˜æ ‡ç­¾ã€‚",
  },
};

Object.keys(BK_I18N_EXT).forEach((lang) => {
  BK_I18N[lang] = Object.assign(BK_I18N[lang] || {}, BK_I18N_EXT[lang]);
});

const BK_I18N_SAFE = {
  vi: {
    "empty.noData": "ChÆ°a cÃ³ dá»¯ liá»‡u",
    "landing.featured.emptyDesc": "ChÆ°a cÃ³ dá»¯ liá»‡u",
    "cart.empty.desc": "ChÆ°a cÃ³ sáº£n pháº©m trong giá».",
    "cart.summary.desc": "Tá»•ng tiá»n, phÃ­ vÃ  mÃ£ giáº£m giÃ¡.",
    "cart.summary.couponPlaceholder": "Nháº­p mÃ£ giáº£m giÃ¡",
    "cart.summary.apply": "Ãp dá»¥ng",
    "checkout.summary.desc": "TÃ³m táº¯t thanh toÃ¡n.",
    "checkout.summary.emptyDesc": "ChÆ°a cÃ³ sáº£n pháº©m trong Ä‘Æ¡n.",
    "checkout.summary.success": "Thanh toÃ¡n thÃ nh cÃ´ng",
    "checkout.summary.failed": "Thanh toÃ¡n khÃ´ng thÃ nh cÃ´ng",
    "checkout.success.desc": "ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n. Chi tiáº¿t sáº½ hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "checkout.failed.desc": "CÃ³ thá»ƒ báº¡n Ä‘Ã£ há»§y hoáº·c thanh toÃ¡n gáº·p lá»—i. Vui lÃ²ng thá»­ láº¡i.",
    "checkout.buyer.platformPlaceholder": "TÃ¹y theo loáº¡i sáº£n pháº©m/háº¡ng má»¥c",
    "profile.overview.quickInfoDesc": "ThÃ´ng tin nhanh vá» sá»‘ dÆ°, Ä‘Æ¡n hÃ ng vÃ  cáº¥p Ä‘á»™ tÃ i khoáº£n.",
    "profile.security.password.submit": "Cáº­p nháº­t máº­t kháº©u",
    "profile.security.2fa.enable": "Báº­t 2FA",
    "profile.security.2fa.mockTitle": "LÆ°u Ã½",
    "profile.security.2fa.mockDesc": "Thiáº¿t láº­p sáº½ Ä‘Æ°á»£c lÆ°u vÃ  Ã¡p dá»¥ng sau khi xÃ¡c nháº­n.",
    "profile.topups.bank.desc": "QuÃ©t QR báº±ng á»©ng dá»¥ng ngÃ¢n hÃ ng Ä‘á»ƒ náº¡p tiá»n.",
    "profile.topups.bank.generate": "Táº¡o QR",
    "profile.topups.bank.toast.created": "QR Ä‘Ã£ táº¡o. QuÃ©t Ä‘á»ƒ náº¡p tiá»n.",
    "profile.topups.bank.toast.failed": "KhÃ´ng thá»ƒ táº¡o QR lÃºc nÃ y.",
    "profile.topups.crypto.confirm": "TÃ´i Ä‘Ã£ chuyá»ƒn",
    "profile.topups.withdraw.submit": "Gá»­i yÃªu cáº§u rÃºt",
    "profile.topups.withdraw.mockTitle": "LÆ°u Ã½",
    "task.action.submitProof": "Gá»­i báº±ng chá»©ng",
    "task.note.mock": "Sau khi Ä‘Æ°á»£c duyá»‡t, tiá»n sáº½ vá» vÃ­ cá»§a báº¡n.",
    "task.toast.proofSubmitted": "ÄÃ£ gá»­i báº±ng chá»©ng.",
    "task.detail.info.desc": "ThÃ´ng tin nhiá»‡m vá»¥ sáº½ hiá»ƒn thá»‹ khi cÃ³ dá»¯ liá»‡u.",
    "task.detail.report.desc": "Ná»™p báº±ng chá»©ng hoÃ n thÃ nh nhiá»‡m vá»¥.",
    "task.detail.report.submit": "Gá»­i bÃ¡o cÃ¡o",
    "task.detail.report.mockTitle": "LÆ°u Ã½",
    "task.detail.report.mockDesc": "BÃ¡o cÃ¡o sáº½ Ä‘Æ°á»£c ghi nháº­n vÃ  cáº­p nháº­t tráº¡ng thÃ¡i.",
    "task.detail.fallback.description": "ThÃ´ng tin chi tiáº¿t sáº½ Ä‘Æ°á»£c cáº­p nháº­t khi cÃ³ dá»¯ liá»‡u.",
    "support.faq.seller.q11": "Tá»± Ä‘á»™ng giao hÃ ng?",
    "support.faq.seller.a11": "CÃ³. Gian hÃ ng cÃ³ thá»ƒ báº­t giao hÃ ng tá»± Ä‘á»™ng vÃ  Ä‘á»“ng bá»™ tá»“n kho.",
    "product.detail.tab.api": "Tá»± Ä‘á»™ng",
    "product.detail.api.title": "Giao hÃ ng tá»± Ä‘á»™ng",
    "product.detail.api.bullet1": "Tá»± Ä‘á»™ng giao hÃ ng sau thanh toÃ¡n.",
    "product.detail.api.bullet2": "Há»— trá»£ tÃ­ch há»£p nhanh.",
    "product.detail.api.bullet3": "LiÃªn há»‡ Ä‘á»ƒ kÃ­ch hoáº¡t tÃ­nh nÄƒng.",
    "service.detail.pageTitle": "Chi tiáº¿t dá»‹ch vá»¥ | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Äang táº£i thÃ´ng tin...",
    "service.detail.hero.loadingDesc": "ThÃ´ng tin sáº½ hiá»ƒn thá»‹ táº¡i Ä‘Ã¢y.",
    "service.detail.info.desc": "ThÃ´ng tin chi tiáº¿t sáº½ hiá»ƒn thá»‹ khi cÃ³ dá»¯ liá»‡u.",
    "service.detail.form.desc": "Sau khi thanh toÃ¡n, khÃ¡ch hÃ ng Ä‘iá»n form Ä‘á»ƒ báº¡n xá»­ lÃ½ chÃ­nh xÃ¡c.",
    "service.detail.form.save": "LÆ°u yÃªu cáº§u",
    "service.detail.form.mockTitle": "LÆ°u Ã½",
    "service.detail.form.mockDesc": "YÃªu cáº§u sáº½ Ä‘Æ°á»£c ghi nháº­n vÃ  cáº­p nháº­t tráº¡ng thÃ¡i.",
    "service.detail.noData": "ChÆ°a cÃ³ dá»¯ liá»‡u",
    "service.detail.notFound": "KhÃ´ng tÃ¬m tháº¥y dá»‹ch vá»¥",
    "service.detail.fallback.summary": "ThÃ´ng tin chi tiáº¿t sáº½ Ä‘Æ°á»£c cáº­p nháº­t.",
    "service.detail.fallback.description": "ThÃ´ng tin chi tiáº¿t sáº½ Ä‘Æ°á»£c cáº­p nháº­t khi cÃ³ dá»¯ liá»‡u.",
    "service.defaultName": "Dá»‹ch vá»¥",
    "service.fallback.short": "Xá»­ lÃ½ theo yÃªu cáº§u sau khi thanh toÃ¡n.",
    "service.category.interaction": "TÆ°Æ¡ng tÃ¡c",
    "service.category.software": "Pháº§n má»m",
    "service.category.other": "KhÃ¡c",
    "service.header.subtitle": "Sáº¯p xáº¿p theo nhu cáº§u vÃ  chá»n nhanh háº¡ng má»¥c phÃ¹ há»£p.",
    "service.filter.facebook": "Dá»‹ch vá»¥ Facebook",
    "service.filter.tiktok": "Dá»‹ch vá»¥ TikTok",
    "service.filter.google": "Dá»‹ch vá»¥ Google",
    "service.filter.telegram": "Dá»‹ch vá»¥ Telegram",
    "service.filter.shopee": "Dá»‹ch vá»¥ Shopee",
    "service.filter.discord": "Dá»‹ch vá»¥ Discord",
    "service.filter.twitter": "Dá»‹ch vá»¥ Twitter",
    "service.filter.youtube": "Dá»‹ch vá»¥ YouTube",
    "service.filter.zalo": "Dá»‹ch vá»¥ Zalo",
    "service.filter.instagram": "Dá»‹ch vá»¥ Instagram",
    "service.filter.otherInteraction": "TÆ°Æ¡ng tÃ¡c khÃ¡c",
    "service.filter.codingTool": "CÃ´ng cá»¥ láº­p trÃ¬nh",
    "service.filter.design": "Thiáº¿t káº¿",
    "service.filter.video": "Video",
    "service.filter.otherTool": "CÃ´ng cá»¥ khÃ¡c",
    "service.type.codingTool": "Láº­p trÃ¬nh",
    "nav.services": "Dá»‹ch vá»¥",
    "footer.services": "Dá»‹ch vá»¥",
    "landing.pill.interaction": "TÆ°Æ¡ng tÃ¡c",
    "filter.searchPlaceholder.service": "Nháº­p tÃªn dá»‹ch vá»¥...",
    "profile.favorites.subtitle": "Sáº£n pháº©m vÃ  háº¡ng má»¥c báº¡n Ä‘Ã£ lÆ°u.",
    "product.data.account-us.short": "TÃ i khoáº£n US cÃ³ KYC, dÃ¹ng cho nhiá»u nhu cáº§u.",
    "task.data.tiktok-video.short": "Quay video ngáº¯n Ä‘Ã¡nh giÃ¡ háº¡ng má»¥c vá»›i hashtag yÃªu cáº§u.",
  },
  en: {
    "empty.noData": "No data available",
    "landing.featured.emptyDesc": "No data available",
    "cart.empty.desc": "Your cart is empty.",
    "cart.summary.desc": "Totals, fees, and discount codes.",
    "cart.summary.couponPlaceholder": "Enter discount code",
    "cart.summary.apply": "Apply",
    "checkout.summary.desc": "Payment summary.",
    "checkout.summary.emptyDesc": "No items in this order.",
    "checkout.summary.success": "Payment successful",
    "checkout.summary.failed": "Payment failed",
    "checkout.success.desc": "Your order has been recorded. Details will appear here.",
    "checkout.failed.desc": "The payment may have been canceled or failed. Please try again.",
    "checkout.buyer.platformPlaceholder": "Depends on item type",
    "profile.overview.quickInfoDesc": "Quick info about balance, orders, and account tier.",
    "profile.security.password.submit": "Update password",
    "profile.security.2fa.enable": "Enable 2FA",
    "profile.security.2fa.mockTitle": "Note",
    "profile.security.2fa.mockDesc": "Settings will be saved and applied after confirmation.",
    "profile.topups.bank.desc": "Scan the QR with your banking app to top up.",
    "profile.topups.bank.generate": "Generate QR",
    "profile.topups.bank.toast.created": "QR created. Scan to top up.",
    "profile.topups.bank.toast.failed": "Unable to create QR right now.",
    "profile.topups.crypto.confirm": "I've sent it",
    "profile.topups.withdraw.submit": "Submit withdrawal",
    "profile.topups.withdraw.mockTitle": "Note",
    "task.action.submitProof": "Submit proof",
    "task.note.mock": "Once approved, funds will reach your wallet.",
    "task.toast.proofSubmitted": "Proof submitted.",
    "task.detail.info.desc": "Task details will appear when data is available.",
    "task.detail.report.desc": "Submit proof of task completion.",
    "task.detail.report.submit": "Submit report",
    "task.detail.report.mockTitle": "Note",
    "task.detail.report.mockDesc": "Your report will be recorded and status updated.",
    "task.detail.fallback.description": "Detailed information will be updated when available.",
    "support.faq.seller.q11": "Automated delivery?",
    "support.faq.seller.a11": "Yes. Sellers can enable automated delivery and sync inventory.",
    "product.detail.tab.api": "Automation",
    "product.detail.api.title": "Automated delivery",
    "product.detail.api.bullet1": "Auto-deliver after payment.",
    "product.detail.api.bullet2": "Fast integration support.",
    "product.detail.api.bullet3": "Contact support to enable this.",
    "service.detail.pageTitle": "Offer detail | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Loading details...",
    "service.detail.hero.loadingDesc": "Details will appear here.",
    "service.detail.info.desc": "Details will appear when data is available.",
    "service.detail.form.desc": "After payment, the customer fills this form for accurate fulfillment.",
    "service.detail.form.save": "Save request",
    "service.detail.form.mockTitle": "Note",
    "service.detail.form.mockDesc": "The request will be recorded and status updated.",
    "service.detail.noData": "No data available",
    "service.detail.notFound": "Offer not found",
    "service.detail.fallback.summary": "Detailed information will appear here.",
    "service.detail.fallback.description": "Detailed information will appear when data is available.",
    "service.defaultName": "Offer",
    "service.fallback.short": "Processed on request after checkout.",
    "service.category.interaction": "Engagement",
    "service.category.software": "Software",
    "service.category.other": "Other",
    "service.header.subtitle": "Sort by need and pick the right offer.",
    "service.filter.facebook": "Facebook offer",
    "service.filter.tiktok": "TikTok offer",
    "service.filter.google": "Google offer",
    "service.filter.telegram": "Telegram offer",
    "service.filter.shopee": "Shopee offer",
    "service.filter.discord": "Discord offer",
    "service.filter.twitter": "Twitter offer",
    "service.filter.youtube": "YouTube offer",
    "service.filter.zalo": "Zalo offer",
    "service.filter.instagram": "Instagram offer",
    "service.filter.otherInteraction": "Other engagement",
    "service.filter.codingTool": "Coding tools",
    "service.filter.design": "Design offer",
    "service.filter.video": "Video offer",
    "service.filter.otherTool": "Other tools",
    "service.type.codingTool": "Coding",
    "nav.services": "Offers",
    "footer.services": "Offers",
    "landing.pill.interaction": "Engagement",
    "filter.searchPlaceholder.service": "Enter offer name...",
    "profile.favorites.subtitle": "Saved products and offers.",
    "product.data.account-us.short": "US account with KYC, usable for many needs.",
    "task.data.tiktok-video.short": "Record a short review video with the required hashtags.",
  },
};

Object.keys(BK_I18N).forEach((lang) => {
  const patch = BK_I18N_SAFE[lang] || BK_I18N_SAFE.en || BK_I18N_SAFE.vi;
  if (patch) {
    BK_I18N[lang] = Object.assign(BK_I18N[lang] || {}, patch);
  }
});

function getLanguageForCurrency(code) {
  const upper = String(code || "").toUpperCase();
  return BK_CURRENCY_LANGUAGE[upper] || BK_LANGUAGE_DEFAULT;
}

function getStoredCurrency() {
  try {
    return localStorage.getItem("bk_currency_selected") || "VND";
  } catch (e) {
    return "VND";
  }
}

function getCurrentLanguage() {
  const currencyApi = typeof globalThis !== "undefined" ? globalThis.BKCurrency : null;
  const currency = currencyApi && currencyApi.getSelected ? currencyApi.getSelected() : getStoredCurrency();
  return getLanguageForCurrency(currency);
}

function getI18nText(lang, key, fallback) {
  const language = lang || BK_LANGUAGE_DEFAULT;
  const table = BK_I18N[language] || BK_I18N[BK_LANGUAGE_DEFAULT] || {};
  if (Object.prototype.hasOwnProperty.call(table, key)) {
    return table[key];
  }
  if (fallback !== undefined) return fallback;
  return key;
}

function formatI18n(lang, key, fallback, vars) {
  const text = getI18nText(lang, key, fallback);
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;
    return String(vars[name]);
  });
}

function sanitizeUsername(value, fallback) {
  const cleaned = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (cleaned) return cleaned;
  return fallback || "";
}

function normalizeAuthUser(user) {
  if (!user || typeof user !== "object") return null;
  const next = { ...user };
  const fallback = "BKUser";
  const email = typeof next.email === "string" ? next.email : "";
  const username = typeof next.username === "string" ? next.username : "";
  const nameValue = typeof next.name === "string" ? next.name : "";
  const base = nameValue || username || (email ? email.split("@")[0] : "");
  const safeBase = sanitizeUsername(base, fallback);
  next.name = safeBase || fallback;
  next.username = username ? sanitizeUsername(username, "") : next.username;
  if (typeof next.id === "string" && next.id) {
    if (!next.id.includes("@")) {
      next.id = sanitizeUsername(next.id, "bk-user");
    }
  }
  return next;
}

function getUserDisplayName(user, fallback = "BKUser") {
  if (!user || typeof user !== "object") return fallback;
  const displayName = typeof user.display_name === "string" ? user.display_name.trim() : "";
  if (displayName) return displayName;
  const name = typeof user.name === "string" ? user.name.trim() : "";
  if (name) return name;
  const username = typeof user.username === "string" ? user.username.trim() : "";
  if (username) return username;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (email) {
    const base = email.includes("@") ? email.split("@")[0] : email;
    if (base) return base;
  }
  return fallback;
}

function isAdminUser(user) {
  if (!user || typeof user !== "object") return false;
  if (user.is_admin === true || user.is_admin === 1 || user.is_admin === "1") return true;
  const role = typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  if (role === "admin") return true;
  const username = typeof user.username === "string" ? user.username.trim().toLowerCase() : "";
  return username === "admin";
}

function createVerifiedBadge() {
  const badge = document.createElement("span");
  badge.className = "verified-badge";
  badge.setAttribute("aria-hidden", "true");
  badge.innerHTML = `
    <svg viewBox="0 0 20 20" role="img" focusable="false" aria-hidden="true">
      <circle class="verified-circle" cx="10" cy="10" r="10"></circle>
      <path class="verified-check" d="M8.25 13.6 4.9 10.3l1.1-1.1 2.25 2.25 5.05-5.05 1.1 1.1-6.15 6.1z"></path>
    </svg>
  `;
  return badge;
}

function createNameWithBadge({ name = "", isAdmin = false, className = "", textClass = "" } = {}) {
  const row = document.createElement("span");
  row.className = "name-row";
  if (className) row.classList.add(className);
  const text = document.createElement("span");
  text.className = "name-text";
  if (textClass) text.classList.add(textClass);
  text.textContent = name || "";
  row.appendChild(text);
  if (isAdmin) {
    row.appendChild(createVerifiedBadge());
  }
  return row;
}

function renderNameWithBadge(name, isAdmin, className, textClass) {
  if (typeof document === "undefined") return "";
  const node = createNameWithBadge({ name, isAdmin, className, textClass });
  return node ? node.outerHTML : "";
}

function applyNameWithBadge(target, options) {
  if (!target) return null;
  const node = createNameWithBadge(options || {});
  if (!node) return null;
  target.textContent = "";
  target.appendChild(node);
  return node;
}

function getAvatarUrl(user, fallback) {
  const root = typeof getRootPath === "function" ? getRootPath() : "/";
  const defaultAvatar = fallback || root + "asset/avt-macdinh.jpg";
  const adminAvatar = typeof getAdminAvatarUrl === "function" ? getAdminAvatarUrl() : resolveAssetUrl(BK_ASSET_PATHS.ADMIN_AVATAR_SRC);
  if (!user || typeof user !== "object") return defaultAvatar;
  const isAdmin = isAdminUser(user);
  if (isAdmin) return adminAvatar;
  const avatarUrl = typeof user.avatar_url === "string" ? user.avatar_url.trim() : "";
  if (avatarUrl) return avatarUrl;
  const avatar = typeof user.avatar === "string" ? user.avatar.trim() : "";
  if (avatar) return avatar;
  return defaultAvatar;
}

function getUserBadgeLabel(user, langOverride) {
  if (!user || typeof user !== "object") return "";
  const candidates = ["badge", "rank", "title", "badgeLabel"];
  for (const key of candidates) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const role = typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  if (!role) return "";
  const language = langOverride || getCurrentLanguage();
  if (role === "admin") return getI18nText(language, "seller.badge.admin", "Admin");
  if (role === "coadmin") return getI18nText(language, "seller.badge.coadmin", "Coadmin");
  if (role === "merchant") {
    const label = formatI18n(language, "seller.badge.merchant", "Merchant", { tier: "" });
    return String(label || "").trim();
  }
  if (["buyer", "seller", "tasker", "user"].includes(role)) return "";
  return role
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readAuthState() {
  try {
    const raw = localStorage.getItem(BK_AUTH_KEY);
    if (!raw) return { loggedIn: false, user: null };
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { loggedIn: false, user: null };
    const normalized = normalizeAuthUser(data);
    if (!normalized) return { loggedIn: false, user: null };
    if (JSON.stringify(normalized) !== JSON.stringify(data)) {
      localStorage.setItem(BK_AUTH_KEY, JSON.stringify(normalized));
    }
    return { loggedIn: true, user: normalized };
  } catch (e) {
    return { loggedIn: false, user: null };
  }
}

function isSellerApproved(auth) {
  if (!auth || !auth.loggedIn) return false;
  const user = auth.user || {};
  return Boolean(user.sellerApproved || user.role === "seller" || user.role === "admin");
}

function isTaskApproved(auth) {
  if (!auth || !auth.loggedIn) return false;
  const user = auth.user || {};
  return Boolean(user.taskApproved || user.canPostTasks || user.role === "tasker" || isSellerApproved(auth));
}

function setAuthState(user) {
  if (!user || typeof user !== "object") return;
  const normalized = normalizeAuthUser(user);
  if (!normalized) return;
  localStorage.setItem(BK_AUTH_KEY, JSON.stringify(normalized));
  syncAdminCookie({ user: normalized });
}

function clearAuthState() {
  localStorage.removeItem(BK_AUTH_KEY);
  syncAdminCookie(null);
}

function getLoginUrl() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  return root + (isFile ? "login/index.html" : "login/");
}

function getHomeUrl() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  return root + (isFile ? "index.html" : "");
}

function getSellerJoinUrl() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  return root + "seller/join/" + (isFile ? "index.html" : "");
}

function getSellerPanelUrl() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  return root + "seller/panel/" + (isFile ? "index.html" : "");
}

function getTaskPanelUrl() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  return root + "seller/tasks/" + (isFile ? "index.html" : "");
}

function showAuthToast(message) {
  if (!message) return;
  let toast = document.querySelector(".auth-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "auth-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showAuthToast._timer);
  showAuthToast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function redirectToLogin(message) {
  if (message) showAuthToast(message);
  const loginUrl = getLoginUrl();
  try {
    const url = new URL(loginUrl);
    url.searchParams.set("redirect", window.location.href);
    window.location.href = url.toString();
  } catch (e) {
    window.location.href = loginUrl;
  }
}

const BK_TASK_ASSIGN_KEY = "bk_task_assignments";
const BK_TASK_REVIEW_WINDOW_MS = 30 * 60 * 1000;

function getAuthUserId(auth) {
  if (!auth || !auth.loggedIn) return "";
  const user = auth.user || {};
  return String(user.id || user.username || "").trim();
}

function getAuthUserName(auth, fallback = "BKUser") {
  if (!auth || !auth.loggedIn) return fallback;
  return getUserDisplayName(auth.user || null, fallback);
}

let pingTimer = null;
let lastPingAt = 0;

function sendHeartbeat(auth, options = {}) {
  if (!auth || !auth.loggedIn) return;
  const user = auth.user || {};
  const rawId = user.id != null ? String(user.id).trim() : "";
  const hasNumericId = rawId && /^\d+$/.test(rawId);
  let userRef = hasNumericId ? rawId : "";
  if (!userRef) {
    const username = typeof user.username === "string" ? user.username.trim() : "";
    if (username) userRef = username;
  }
  if (!userRef) {
    const email = typeof user.email === "string" ? user.email.trim() : "";
    if (email) userRef = email;
  }
  if (!userRef) userRef = String(getAuthUserId(auth) || rawId || "").trim();
  if (!userRef) return;
  const now = Date.now();
  if (!options.force && now - lastPingAt < BK_PING_GRACE) return;
  lastPingAt = now;
  const payload = JSON.stringify({ userId: userRef });
  if (options.useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/ping", blob);
    return;
  }
  fetch("/api/ping", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    credentials: "include",
  }).catch(() => {});
}

function startHeartbeat(auth) {
  if (window.location.protocol === "file:") return;
  const startInterval = () => {
    if (pingTimer) clearInterval(pingTimer);
    sendHeartbeat(auth, { force: true });
    pingTimer = setInterval(() => sendHeartbeat(auth), BK_PING_INTERVAL);
  };
  startInterval();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      sendHeartbeat(auth, { force: true, useBeacon: true });
      return;
    }
    startInterval();
  });
  window.addEventListener("beforeunload", () => {
    sendHeartbeat(auth, { force: true, useBeacon: true });
  });
}

function readTaskAssignments() {
  try {
    const raw = localStorage.getItem(BK_TASK_ASSIGN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeTaskAssignments(list) {
  try {
    localStorage.setItem(BK_TASK_ASSIGN_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) {}
}

function syncTaskAssignments(list, now = Date.now()) {
  if (!Array.isArray(list) || !list.length) return [];
  let changed = false;
  list.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const status = String(item.status || "");
    const reviewDueAt = Number(item.reviewDueAt || 0);
    const deadlineAt = Number(item.deadlineAt || 0);
    if (status === "submitted" && reviewDueAt && now >= reviewDueAt) {
      item.status = "auto_approved";
      item.approvedAt = now;
      item.payoutAt = now;
      changed = true;
      return;
    }
    if ((status === "accepted" || status === "redo") && deadlineAt && now >= deadlineAt) {
      item.status = "expired";
      item.expiredAt = now;
      changed = true;
    }
  });
  if (changed) writeTaskAssignments(list);
  return list;
}

function formatTaskCountdown(ms) {
  if (!Number.isFinite(ms)) return "--:--:--";
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function applyLoginLocks(auth) {
  const requiresLogin = document.querySelectorAll("[data-requires-login]");
  requiresLogin.forEach((el) => {
    if (auth.loggedIn) {
      el.classList.remove("is-locked");
      el.removeAttribute("aria-disabled");
      return;
    }
    el.classList.add("is-locked");
    el.setAttribute("aria-disabled", "true");
    if (el.tagName === "A") {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        redirectToLogin("Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 ti\u1ebfp t\u1ee5c.");
      });
    } else if ("disabled" in el) {
      el.disabled = true;
    }
  });

  document.querySelectorAll("[data-auth-lock=\"login\"]").forEach((section) => {
    if (auth.loggedIn) {
      section.classList.remove("auth-locked");
      return;
    }
    section.classList.add("auth-locked");
    section.querySelectorAll("input, textarea, select, button").forEach((field) => {
      field.disabled = true;
      field.classList.add("is-locked");
    });
    section.querySelectorAll("a.btn").forEach((link) => {
      link.classList.add("is-locked");
      link.setAttribute("aria-disabled", "true");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        redirectToLogin("Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 ti\u1ebfp t\u1ee5c.");
      });
    });
  });

  document.querySelectorAll("[data-auth-guard]").forEach((el) => {
    el.style.display = auth.loggedIn ? "none" : "flex";
  });

  document.querySelectorAll("[data-auth-login]").forEach((el) => {
    el.href = getLoginUrl();
  });
}

function bindAuthActions(auth) {
  document.querySelectorAll("[data-auth-action]").forEach((el) => {
    const action = (el.getAttribute("data-auth-action") || "").trim();
    if (action === "checkout") {
      el.addEventListener("click", (event) => {
        if (el.disabled) return;
        if (!auth.loggedIn) {
          event.preventDefault();
          redirectToLogin("Vui l\u00f2ng \u0111\u0103ng nh\u1eadp \u0111\u1ec3 \u0111\u1eb7t h\u00e0ng.");
          return;
        }
        const root = getRootPath();
        const isFile = window.location.protocol === "file:";
        window.location.href = root + (isFile ? "checkout/index.html" : "checkout/");
      });
    }
  });
}

function updateSellerCta(auth, langOverride) {
  const approved = isSellerApproved(auth);
  const language = langOverride || getCurrentLanguage();
  const manageLabel = getI18nText(language, "cta.manageShop", "Qu\u1ea3n l\u00fd shop");
  const joinLabel = getI18nText(language, "cta.joinSeller", "Tham gia b\u00e1n h\u00e0ng");
  const sellerLinks = document.querySelectorAll('a[href*="seller/join"], a[data-seller-cta]');
  sellerLinks.forEach((link) => {
    if (approved) {
      link.textContent = manageLabel;
      link.href = getSellerPanelUrl();
      link.setAttribute("data-seller-cta", "panel");
      link.dataset.i18nKey = "cta.manageShop";
      return;
    }
    link.textContent = joinLabel;
    link.href = getSellerJoinUrl();
    link.setAttribute("data-seller-cta", "join");
    link.dataset.i18nKey = "cta.joinSeller";
  });
}

function updateTaskCta(auth, langOverride) {
  const approved = isTaskApproved(auth);
  const language = langOverride || getCurrentLanguage();
  const manageLabel = getI18nText(language, "cta.manageTasks", "Qu\u1ea3n l\u00fd nhi\u1ec7m v\u1ee5");
  const requestLabel = getI18nText(language, "cta.requestTasks", "Xin quy\u1ec1n \u0111\u0103ng b\u00e0i");
  const manageDesc = getI18nText(
    language,
    "cta.manageTasksDesc",
    "\u0110\u1ebfn trang qu\u1ea3n l\u00fd nhi\u1ec7m v\u1ee5 c\u1ee7a b\u1ea1n."
  );
  const requestDesc = getI18nText(language, "cta.requestTasksDesc", "B\u1ea1n mu\u1ed1n xin quy\u1ec1n \u0111\u0103ng b\u00e0i nhi\u1ec7m v\u1ee5?");
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  const requestUrl = root + (isFile ? "nhiemvu/tao/index.html" : "nhiemvu/tao/");
  const manageUrl = getTaskPanelUrl();

  document.querySelectorAll("[data-task-cta-title]").forEach((el) => {
    el.textContent = approved ? manageLabel : requestLabel;
  });
  document.querySelectorAll("[data-task-cta-desc]").forEach((el) => {
    el.textContent = approved ? manageDesc : requestDesc;
  });
  document.querySelectorAll("[data-task-cta]").forEach((link) => {
    if (approved) {
      link.textContent = manageLabel;
      link.href = manageUrl;
      link.setAttribute("data-task-cta", "panel");
      return;
    }
    link.textContent = requestLabel;
    link.href = requestUrl;
    link.setAttribute("data-task-cta", "request");
  });
}

let notifierLoadPromise = null;
function loadNotifierScript() {
  if (window.BKNotifier && typeof window.BKNotifier.init === "function") {
    return Promise.resolve(window.BKNotifier);
  }
  if (notifierLoadPromise) return notifierLoadPromise;
  notifierLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    const src = typeof resolveAssetUrl === "function" ? resolveAssetUrl("/asset/core/notifier.js") : "/asset/core/notifier.js";
    script.src = src;
    script.async = true;
    script.onload = () => resolve(window.BKNotifier || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return notifierLoadPromise;
}

function initGlobalNotifier() {
  loadNotifierScript().then((notifier) => {
    if (notifier && typeof notifier.init === "function") {
      notifier.init();
    }
  });
}

function setupUserMenu(auth) {
  if (!auth || !auth.loggedIn) return;
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  const user = auth.user || {};
  const avatarSrc = getAvatarUrl(user);
  const profileUrl = root + (isFile ? "profile/index.html" : "profile/");
  const publicProfileBase = root + (isFile ? "profile/public/index.html" : "u/");
  const profileUsername = user && user.username ? String(user.username).trim() : "";
  const publicProfileUrl = profileUsername
    ? isFile
      ? `${publicProfileBase}?u=${encodeURIComponent(profileUsername)}`
      : `${publicProfileBase}${encodeURIComponent(profileUsername)}`
    : publicProfileBase;
  const ordersUrl = root + (isFile ? "profile/orders/index.html" : "profile/orders/");
  const favoritesUrl = root + (isFile ? "profile/favorites/index.html" : "profile/favorites/");
  const followingUrl = root + (isFile ? "profile/following/index.html" : "profile/following/");
  const historyUrl = root + (isFile ? "profile/history/index.html" : "profile/history/");
  const topupsUrl = root + (isFile ? "profile/topups/index.html" : "profile/topups/");
  const messagesUrl = root + (isFile ? "profile/messages/index.html" : "profile/messages");
  const notificationsUrl = root + (isFile ? "profile/notifications/index.html" : "profile/notifications/");
  const badgesUrl = root + (isFile ? "profile/badges/index.html" : "profile/badges/");
  const securityUrl = root + (isFile ? "profile/security/index.html" : "profile/security/");
  const tasksUrl = root + (isFile ? "profile/tasks/index.html" : "profile/tasks/");
  const isSeller = isSellerApproved(auth);
  const canManageTasks = isTaskApproved(auth);
  const role = typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  const isAdmin = role === "admin";
  const language = getCurrentLanguage();
  const t = (key, fallback) => getI18nText(language, key, fallback);
  const displayName = getUserDisplayName(user, "BKUser");
  const badgeLabel = getUserBadgeLabel(user, language);

  const menuItems = [
    { key: "menu.overview", label: t("menu.overview", "T\u1ed5ng quan t\u00e0i kho\u1ea3n"), href: profileUrl },
    { key: "menu.profile", label: t("menu.profile", "Trang c\u00e1 nh\u00e2n"), href: publicProfileUrl },
    ...(isSeller ? [{ key: "menu.manageShop", label: t("menu.manageShop", "Qu\u1ea3n l\u00fd shop"), href: getSellerPanelUrl() }] : []),
    ...(canManageTasks
      ? [{ key: "menu.manageTasks", label: t("menu.manageTasks", "Qu\u1ea3n l\u00fd nhi\u1ec7m v\u1ee5"), href: getTaskPanelUrl() }]
      : []),
    { key: "menu.orders", label: t("menu.orders", "\u0110\u01a1n h\u00e0ng"), href: ordersUrl },
    { key: "menu.favorites", label: t("menu.favorites", "Y\u00eau th\u00edch"), href: favoritesUrl },
    { key: "menu.following", label: t("menu.following", "\u0110ang theo d\u00f5i"), href: followingUrl },
    { key: "menu.history", label: t("menu.history", "L\u1ecbch s\u1eed t\u00e0i kho\u1ea3n"), href: historyUrl },
    { key: "menu.withdraw", label: t("menu.withdraw", "R\u00fat ti\u1ec1n"), href: topupsUrl },
    { key: "menu.tasks", label: t("menu.tasks", "Nhi\u1ec7m v\u1ee5"), href: tasksUrl },
    { divider: true },
    { key: "menu.messages", label: t("menu.messages", "Tin nh\u1eafn"), href: messagesUrl },
    { key: "menu.notifications", label: t("menu.notifications", "Th\u00f4ng b\u00e1o"), href: notificationsUrl },
    { key: "menu.badges", label: t("menu.badges", "Danh hi\u1ec7u"), href: badgesUrl },
    { key: "menu.security", label: t("menu.security", "B\u1ea3o m\u1eadt 2FA"), href: securityUrl },
    { divider: true },
    { key: "menu.logout", label: t("menu.logout", "\u0110\u0103ng xu\u1ea5t"), action: "logout" },
  ];

  const containers = document.querySelectorAll("header .nav-actions, .mobile-actions");
  containers.forEach((container) => {
    const loginLink = Array.from(container.querySelectorAll("a")).find((a) => (a.textContent || "").toLowerCase().includes("login"));
    if (!loginLink || container.querySelector(".user-menu")) return;

    const menu = document.createElement("div");
    menu.className = "user-menu";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "user-menu-btn";

    const avatar = document.createElement("span");
    avatar.className = "user-avatar";
    avatar.setAttribute("data-notify-avatar", "true");
    const img = document.createElement("img");
    img.src = avatarSrc;
    img.alt = "Avatar";
    img.loading = "lazy";
    const indicator = document.createElement("span");
    indicator.className = "notif-indicator";
    indicator.setAttribute("aria-hidden", "true");
    avatar.appendChild(img);
    avatar.appendChild(indicator);

    const nameSpan = document.createElement("span");
    nameSpan.className = "user-name";
    const nameRow = createNameWithBadge({ name: displayName, isAdmin, textClass: "user-name-text" });
    nameSpan.appendChild(nameRow);
    if (badgeLabel) {
      const badge = document.createElement("span");
      badge.className = "user-badge";
      if (isAdmin || badgeLabel.trim().toLowerCase() === "admin") {
        badge.classList.add("is-admin");
      }
      badge.textContent = badgeLabel;
      nameSpan.appendChild(badge);
    }

    const caret = document.createElement("span");
    caret.className = "user-caret";
    caret.textContent = "v";

    btn.append(avatar, nameSpan, caret);

    const dropdown = document.createElement("div");
    dropdown.className = "user-dropdown";

    menuItems.forEach((item) => {
      if (item.divider) {
        const div = document.createElement("div");
        div.className = "divider";
        dropdown.appendChild(div);
        return;
      }
      if (item.action === "logout") {
        const actionBtn = document.createElement("button");
        actionBtn.type = "button";
        actionBtn.textContent = item.label;
        if (item.key) actionBtn.dataset.i18nKey = item.key;
        actionBtn.setAttribute("data-user-action", "logout");
        dropdown.appendChild(actionBtn);
        return;
      }
      const link = document.createElement("a");
      link.textContent = item.label;
      if (item.key) link.dataset.i18nKey = item.key;
      link.href = item.href || "#";
      if (item.comingSoon) link.setAttribute("data-coming-soon", "true");
      if (item.key === "menu.messages") {
        link.setAttribute("data-notify-messages", "true");
        const badge = document.createElement("span");
        badge.className = "menu-badge is-hidden";
        badge.setAttribute("data-notify-badge", "messages");
        badge.setAttribute("aria-hidden", "true");
        link.appendChild(badge);
      }
      dropdown.appendChild(link);
    });

    menu.append(btn, dropdown);
    container.replaceChild(menu, loginLink);
  });

  bindUserMenuInteractions();
}

function bindUserMenuInteractions() {
  if (!bindUserMenuInteractions._docBound) {
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".user-menu.open").forEach((menu) => {
        if (!menu.contains(event.target)) menu.classList.remove("open");
      });
    });
    bindUserMenuInteractions._docBound = true;
  }

  document.querySelectorAll(".user-menu").forEach((menu) => {
    if (menu.dataset.bound === "true") return;
    menu.dataset.bound = "true";
    const btn = menu.querySelector(".user-menu-btn");
    const dropdown = menu.querySelector(".user-dropdown");

    if (btn) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = menu.classList.toggle("open");
        if (open) {
          document.querySelectorAll(".user-menu.open").forEach((other) => {
            if (other !== menu) other.classList.remove("open");
          });
        }
      });
    }

    if (dropdown) {
      dropdown.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }

    menu.querySelectorAll("[data-coming-soon]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        showAuthToast("T\u00ednh n\u0103ng \u0111ang c\u1eadp nh\u1eadt.");
      });
    });

    menu.querySelectorAll("[data-user-action=\"logout\"]").forEach((actionBtn) => {
      actionBtn.addEventListener("click", () => {
        clearAuthState();
        window.location.href = getHomeUrl();
      });
    });
  });
}

function applyI18nText(el, key, language, fallback) {
  if (!el || !key) return;
  const next = getI18nText(language, key, fallback !== undefined ? fallback : el.textContent);
  if (next) el.textContent = next;
  el.dataset.i18nKey = key;
}

function applyFooterI18n(language) {
  const footer = document.querySelector("footer");
  if (!footer) return;
  const sections = footer.querySelectorAll(".footer-grid > div");
  if (!sections.length) return;

  if (sections.length === 3) {
    const about = sections[0];
    if (about) {
      applyI18nText(about.querySelector("h4"), "footer.about", language);
      applyI18nText(about.querySelector("p"), "footer.aboutDesc", language);
    }

    const nav = sections[1];
    if (nav) {
      applyI18nText(nav.querySelector("h4"), "footer.nav", language);
      const links = nav.querySelectorAll("a");
      const keys = ["footer.products", "footer.services", "footer.tasksMarketplace", "footer.account"];
      links.forEach((link, index) => {
        const key = keys[index];
        if (key) applyI18nText(link, key, language);
      });
    }

    const join = sections[2];
    if (join) {
      if (join.querySelector("[data-task-cta]")) return;
      applyI18nText(join.querySelector("h4"), "footer.join", language);
      applyI18nText(join.querySelector("p"), "footer.joinDesc", language);
      applyI18nText(join.querySelector(".btn"), "footer.joinBtn", language);
    }
    return;
  }

  const about = sections[0];
  if (about) {
    applyI18nText(about.querySelector("h4"), "footer.about", language);
    applyI18nText(about.querySelector("p"), "footer.aboutDesc", language);
  }

  const nav = sections[1];
  if (nav) {
    applyI18nText(nav.querySelector("h4"), "footer.nav", language);
    const links = nav.querySelectorAll("a");
    const keys = ["footer.products", "footer.services", "footer.tasksMarketplace", "footer.account"];
    links.forEach((link, index) => {
      const key = keys[index];
      if (key) applyI18nText(link, key, language);
    });
  }

  const payments = sections[2];
  if (payments) {
    applyI18nText(payments.querySelector("h4"), "footer.payments", language);
    const items = payments.querySelectorAll("p");
    const keys = ["footer.paymentDesc1", "footer.paymentDesc2", "footer.paymentDesc3"];
    items.forEach((item, index) => {
      const key = keys[index];
      if (key) applyI18nText(item, key, language);
    });
  }

  const join = sections[3];
  if (join) {
    if (join.querySelector("[data-task-cta]")) return;
    applyI18nText(join.querySelector("h4"), "footer.join", language);
    applyI18nText(join.querySelector("p"), "footer.joinDesc", language);
    applyI18nText(join.querySelector(".btn"), "footer.joinBtn", language);
  }
}

function applyI18n(lang) {
  const language = lang || getCurrentLanguage();
  const navMap = {
    sanpham: "nav.products",
    dichvu: "nav.services",
    nhiemvu: "nav.tasks",
    topups: "nav.topups",
  };

  if (document.documentElement) {
    document.documentElement.setAttribute("lang", language);
  }
  if (document.body) {
    document.body.dataset.lang = language;
  }

  Object.keys(navMap).forEach((navKey) => {
    const key = navMap[navKey];
    const label = getI18nText(language, key);
    if (!label) return;
    document.querySelectorAll(`[data-nav="${navKey}"]`).forEach((link) => {
      const badge = link.querySelector(".badge");
      if (badge) {
        const textNode = Array.from(link.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        const nextText = label + " ";
        if (textNode) {
          textNode.textContent = nextText;
        } else {
          link.insertBefore(document.createTextNode(nextText), badge);
        }
      } else {
        link.textContent = label;
      }
      link.dataset.i18nKey = key;
    });
  });

  const loginLabel = getI18nText(language, "cta.login");
  if (loginLabel) {
    document.querySelectorAll(".login-btn, [data-auth-login]").forEach((el) => {
      el.textContent = loginLabel;
      el.dataset.i18nKey = "cta.login";
    });
  }

  const registerLabel = getI18nText(language, "cta.register");
  if (registerLabel) {
    document.querySelectorAll('a[href*="register"]').forEach((el) => {
      const href = (el.getAttribute("href") || "").toLowerCase();
      if (!href.includes("register")) return;
      if (!el.textContent || !el.textContent.trim()) return;
      el.textContent = registerLabel;
      el.dataset.i18nKey = "cta.register";
    });
  }

  const noteLabel = getI18nText(language, "currency.note");
  if (noteLabel) {
    document.querySelectorAll(".currency-note").forEach((note) => {
      note.textContent = noteLabel;
      note.dataset.i18nKey = "currency.note";
    });
  }

  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    if (el.matches("[data-nav]")) return;
    const key = el.dataset.i18nKey;
    if (!key) return;
    const next = getI18nText(language, key, el.textContent);
    if (next) el.textContent = next;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!key) return;
    const next = getI18nText(language, key, el.getAttribute("placeholder") || "");
    if (next) el.setAttribute("placeholder", next);
  });

  document.querySelectorAll("[data-i18n-value]").forEach((el) => {
    const key = el.dataset.i18nValue;
    if (!key) return;
    const next = getI18nText(language, key, el.getAttribute("value") || "");
    if (next) el.setAttribute("value", next);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (!key) return;
    const next = getI18nText(language, key, el.getAttribute("title") || "");
    if (next) el.setAttribute("title", next);
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (!key) return;
    const next = getI18nText(language, key, el.getAttribute("aria-label") || "");
    if (next) el.setAttribute("aria-label", next);
  });

  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const key = el.dataset.i18nLabel;
    if (!key) return;
    const next = getI18nText(language, key, el.getAttribute("data-label") || "");
    if (next) el.setAttribute("data-label", next);
  });

  applyFooterI18n(language);
  updateSellerCta(readAuthState(), language);
  updateTaskCta(readAuthState(), language);
  try {
    document.dispatchEvent(new CustomEvent("bk:i18n", { detail: { language } }));
  } catch (e) {
    // ignore event errors
  }
}

function hydrateNavLinks() {
  const root = getRootPath();
  const isFile = window.location.protocol === "file:";
  
  // For file://, point directly to index.html to avoid directory listings.
  // When hosting via HTTP, you can rewrite /products/ -> /products/index.html.
  const map = isFile
    ? {
        sanpham: "products/index.html",
        dichvu: "dichvu/index.html",
        nhiemvu: "nhiemvu/index.html",
        topups: "profile/topups/index.html",
        home: "index.html",
        login: "login/index.html",
        profile: "profile/index.html",
      }
    : {
        sanpham: "products/",
        dichvu: "dichvu/",
        nhiemvu: "nhiemvu/",
        topups: "profile/topups/",
        home: "",
        login: "login/",
        profile: "profile/",
      };

  document.querySelectorAll("[data-nav]").forEach((a) => {
    const key = a.getAttribute("data-nav");
    if (map[key]) a.href = root + map[key];
  });

  // login / balance links in nav-actions + mobile-actions
  document.querySelectorAll("header .nav-actions a, .mobile-actions a").forEach((a) => {
    const text = (a.textContent || "").toLowerCase();
    if (text.includes("login")) a.href = root + map.login;
  });

  // footer quick links
  document.querySelectorAll("footer a").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href.includes("/products") || href.includes("/sanpham")) a.href = root + map.sanpham;
    else if (href.includes("/dichvu")) a.href = root + map.dichvu;
    else if (href.includes("/nhiemvu")) a.href = root + map.nhiemvu;
    else if (href.includes("/profile")) a.href = root + map.profile;
    else if (href.includes("/seller/join")) a.href = root + "seller/join/" + (isFile ? "index.html" : "");
  });

  // brand logo to home
  document.querySelectorAll(".brand a, .mobile-brand a").forEach((a) => {
    a.href = root + map.home;
  });

  // mobile links
  document.querySelectorAll(".mobile-links a").forEach((a) => {
    const key = a.getAttribute("data-nav");
    if (key && map[key]) a.href = root + map[key];
  });
}

async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

const BK_CURRENCY_DEFAULT = "VND";
const BK_CURRENCY_SUPPORTED = ["VND", "USD", "KRW", "JPY", "CNY"];
const BK_RATE_BASE = "USD";
const BK_RATE_URL = "https://open.er-api.com/v6/latest/USD";
const BK_RATE_CACHE_KEY = "bk_currency_rates";
const BK_RATE_NEXT_KEY = "bk_currency_rates_next";
const BK_RATE_UPDATED_KEY = "bk_currency_rates_updated";
const BK_CURRENCY_KEY = "bk_currency_selected";
const BK_CURRENCY_DECIMALS = {
  VND: 0,
  USD: 2,
  KRW: 0,
  JPY: 0,
  CNY: 2,
};

let bkRates = null;
let bkRateNext = 0;
let bkRatePromise = null;
let bkRateTimer = null;

function setPriceDataset(el, amount, maxAmount, currency) {
  if (!el) return;
  const baseCurrency = (currency || BK_CURRENCY_DEFAULT).toUpperCase();
  el.dataset.baseCurrency = baseCurrency;
  if (typeof maxAmount === "number" && maxAmount > amount) {
    el.dataset.baseMin = String(amount);
    el.dataset.baseMax = String(maxAmount);
    delete el.dataset.baseAmount;
  } else {
    el.dataset.baseAmount = String(amount);
    delete el.dataset.baseMin;
    delete el.dataset.baseMax;
  }
}

const BKCurrency = (() => {
  const normalizeCode = (code) => {
    const upper = String(code || "").toUpperCase();
    return BK_CURRENCY_SUPPORTED.includes(upper) ? upper : BK_CURRENCY_DEFAULT;
  };
  let docBound = false;

  const getSelected = () => {
    try {
      return normalizeCode(localStorage.getItem(BK_CURRENCY_KEY) || BK_CURRENCY_DEFAULT);
    } catch (e) {
      return BK_CURRENCY_DEFAULT;
    }
  };

  const setSelected = (code) => {
    const next = normalizeCode(code);
    try {
      localStorage.setItem(BK_CURRENCY_KEY, next);
    } catch (e) {}
    syncCurrencyCookie(next);
    updateBalanceButtons(next);
    updateCurrencyOptions(next);
    applyToDom();
    applyI18n(getLanguageForCurrency(next));
    return next;
  };

  const readRateCache = () => {
    if (bkRates) return true;
    try {
      const raw = localStorage.getItem(BK_RATE_CACHE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return false;
      bkRates = parsed;
      const next = parseInt(localStorage.getItem(BK_RATE_NEXT_KEY) || "0", 10);
      bkRateNext = Number.isFinite(next) ? next : 0;
      return true;
    } catch (e) {
      return false;
    }
  };

  const saveRateCache = (rates, nextUpdate) => {
    if (!rates || typeof rates !== "object") return;
    bkRates = rates;
    bkRateNext = nextUpdate || 0;
    try {
      localStorage.setItem(BK_RATE_CACHE_KEY, JSON.stringify(rates));
      localStorage.setItem(BK_RATE_NEXT_KEY, String(nextUpdate || 0));
      localStorage.setItem(BK_RATE_UPDATED_KEY, String(Date.now()));
    } catch (e) {}
  };

  const isRateFresh = () => bkRates && bkRateNext && Date.now() < bkRateNext;

  const ensureRates = async (force = false) => {
    readRateCache();
    if (!force && isRateFresh()) return bkRates;
    if (bkRatePromise) return bkRatePromise;

    bkRatePromise = fetch(BK_RATE_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("rate fetch failed"))))
      .then((data) => {
        if (!data || !data.rates) throw new Error("rate data missing");
        const nextUpdate = data.time_next_update_unix ? data.time_next_update_unix * 1000 : Date.now() + 30 * 60 * 1000;
        saveRateCache(data.rates, nextUpdate);
        scheduleRateRefresh();
        return bkRates;
      })
      .catch(() => {
        scheduleRateRefresh();
        return bkRates;
      })
      .finally(() => {
        bkRatePromise = null;
      });

    return bkRatePromise;
  };

  const scheduleRateRefresh = () => {
    if (bkRateTimer) {
      clearTimeout(bkRateTimer);
      bkRateTimer = null;
    }
    const nextAt = bkRateNext || Date.now() + 30 * 60 * 1000;
    const delay = Math.max(60 * 1000, nextAt - Date.now());
    bkRateTimer = setTimeout(() => {
      ensureRates(true).then(() => applyToDom());
    }, delay);
  };

  const formatCurrency = (amount, currency) => {
    const code = normalizeCode(currency);
    const decimals = BK_CURRENCY_DECIMALS[code] ?? 2;
    const formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
    return formatter.format(amount) + " " + code;
  };

  const formatBalanceLabel = (currency) => {
    return formatCurrency(0, currency);
  };

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    const fromCode = normalizeCode(fromCurrency);
    const toCode = normalizeCode(toCurrency);
    if (fromCode === toCode) return amount;
    if (!bkRates || !bkRates[fromCode] || !bkRates[toCode]) return amount;
    const usd = fromCode === BK_RATE_BASE ? amount : amount / bkRates[fromCode];
    return toCode === BK_RATE_BASE ? usd : usd * bkRates[toCode];
  };

  const formatAmount = (amount, baseCurrency) => {
    const baseCode = normalizeCode(baseCurrency || BK_CURRENCY_DEFAULT);
    const selected = getSelected();
    if (selected === baseCode) return formatCurrency(amount, selected);
    if (!bkRates || !bkRates[baseCode] || !bkRates[selected]) return formatCurrency(amount, baseCode);
    const converted = convertAmount(amount, baseCode, selected);
    return formatCurrency(converted, selected);
  };

  const updateBalanceButtons = (currency) => {
    const code = normalizeCode(currency || getSelected());
    const label = formatBalanceLabel(code);
    document.querySelectorAll("[data-balance]").forEach((btn) => {
      btn.textContent = label;
      btn.dataset.currency = code;
    });
  };

  const updateCurrencyOptions = (currency) => {
    const code = normalizeCode(currency || getSelected());
    document.querySelectorAll(".currency-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.currency === code);
      btn.setAttribute("aria-pressed", btn.dataset.currency === code ? "true" : "false");
    });
  };

  const detectBaseCurrency = (text) => {
    const upper = String(text || "").toUpperCase();
    const match = BK_CURRENCY_SUPPORTED.find((code) => upper.includes(code));
    return match || BK_CURRENCY_DEFAULT;
  };

  const parseAmount = (text, currency) => {
    const code = normalizeCode(currency);
    const cleaned = String(text || "").replace(/[^0-9,.-]/g, "");
    if (!cleaned) return null;
    if (code === "USD" || code === "CNY") {
      const normalized = cleaned.replace(/,/g, "");
      const value = Number(normalized);
      return Number.isFinite(value) ? value : null;
    }
    const normalized = cleaned.replace(/[.,]/g, "");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const readBaseData = (el) => {
    if (!el) return null;
    const baseCurrency = normalizeCode(el.dataset.baseCurrency || detectBaseCurrency(el.textContent));
    if (el.dataset.baseAmount) {
      const amount = Number(el.dataset.baseAmount);
      return Number.isFinite(amount) ? { baseCurrency, amount } : null;
    }
    if (el.dataset.baseMin && el.dataset.baseMax) {
      const min = Number(el.dataset.baseMin);
      const max = Number(el.dataset.baseMax);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        return { baseCurrency, min, max };
      }
    }
    const raw = el.textContent || "";
    if (raw.includes("-")) {
      const parts = raw.split("-").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const min = parseAmount(parts[0], baseCurrency);
        const max = parseAmount(parts[1], baseCurrency);
        if (min != null && max != null) {
          el.dataset.baseMin = String(min);
          el.dataset.baseMax = String(max);
          el.dataset.baseCurrency = baseCurrency;
          return { baseCurrency, min, max };
        }
      }
    }
    const amount = parseAmount(raw, baseCurrency);
    if (amount != null) {
      el.dataset.baseAmount = String(amount);
      el.dataset.baseCurrency = baseCurrency;
      return { baseCurrency, amount };
    }
    return null;
  };

  const applyToElement = (el, dataOverride) => {
    const data = dataOverride || readBaseData(el);
    if (!data) return;
    const selected = getSelected();
    const canConvert = bkRates && bkRates[data.baseCurrency] && bkRates[selected];
    const targetCurrency = canConvert ? selected : data.baseCurrency;
    if (data.amount != null) {
      const converted = canConvert ? convertAmount(data.amount, data.baseCurrency, selected) : data.amount;
      el.textContent = formatCurrency(converted, targetCurrency);
      return;
    }
    if (data.min != null && data.max != null) {
      const min = canConvert ? convertAmount(data.min, data.baseCurrency, selected) : data.min;
      const max = canConvert ? convertAmount(data.max, data.baseCurrency, selected) : data.max;
      el.textContent = formatCurrency(min, targetCurrency) + " - " + formatCurrency(max, targetCurrency);
    }
  };

  const applyToDom = (root) => {
    const selected = getSelected();
    const scope = root || document;
    const selector = [
      "[data-base-amount]",
      "[data-base-min]",
      ".price",
      ".product-price",
      ".detail-price",
    ].join(",");
    const nodes = scope.querySelectorAll(selector);
    let needsRates = false;
    if (scope.matches && scope.matches(selector)) {
      const data = readBaseData(scope);
      if (data && data.baseCurrency !== selected) needsRates = true;
      applyToElement(scope, data);
    }
    nodes.forEach((el) => {
      const data = readBaseData(el);
      if (data && data.baseCurrency !== selected) needsRates = true;
      applyToElement(el, data);
    });
    updateBalanceButtons(selected);
    updateCurrencyOptions(selected);
    if (needsRates && !isRateFresh()) {
      ensureRates().then((rates) => {
        if (rates && Object.keys(rates).length) {
          applyToDom(root);
        }
      });
    }
  };

  const buildMenuPopover = () => {
    const popover = document.createElement("div");
    popover.className = "currency-popover";
    BK_CURRENCY_SUPPORTED.forEach((code) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "currency-option";
      btn.dataset.currency = code;
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = code;
      popover.appendChild(btn);
    });
    const note = document.createElement("div");
    note.className = "currency-note";
    note.textContent = getI18nText(getCurrentLanguage(), "currency.note", "Rates update automatically.");
    note.dataset.i18nKey = "currency.note";
    popover.appendChild(note);
    return popover;
  };

  const setupMenus = () => {
    const containers = document.querySelectorAll("header .nav-actions, .mobile-actions");
    containers.forEach((container, idx) => {
      if (container.querySelector(".currency-menu")) return;
      const balance = container.querySelector("[data-balance]");
      if (!balance) return;

      const menu = document.createElement("div");
      menu.className = "currency-menu";
      const isButton = balance.tagName === "BUTTON";
      const button = isButton ? balance : document.createElement("button");
      if (!isButton) {
        button.className = balance.className || "btn balance-btn";
        button.dataset.balance = "true";
        button.type = "button";
        button.textContent = balance.textContent || "";
      } else {
        button.setAttribute("type", "button");
      }

      const popover = buildMenuPopover();
      const popoverId = "currency-popover-" + idx;
      popover.id = popoverId;
      button.setAttribute("aria-haspopup", "true");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", popoverId);

      if (isButton) {
        container.replaceChild(menu, balance);
        menu.appendChild(button);
      } else {
        menu.appendChild(button);
        container.replaceChild(menu, balance);
      }
      menu.appendChild(popover);

      bindMenu(menu);
    });
    updateBalanceButtons(getSelected());
    updateCurrencyOptions(getSelected());
  };

  const bindMenu = (menu) => {
    if (!menu || menu.dataset.bound === "true") return;
    menu.dataset.bound = "true";
    const button = menu.querySelector("[data-balance]");
    const popover = menu.querySelector(".currency-popover");
    if (button) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const open = menu.classList.toggle("open");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
          document.querySelectorAll(".currency-menu.open").forEach((other) => {
            if (other !== menu) other.classList.remove("open");
          });
        }
      });
    }
    if (popover) {
      popover.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }
    menu.querySelectorAll(".currency-option").forEach((option) => {
      option.addEventListener("click", () => {
        setSelected(option.dataset.currency);
        menu.classList.remove("open");
        if (button) button.setAttribute("aria-expanded", "false");
      });
    });
  };

  if (!docBound) {
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".currency-menu.open").forEach((menu) => {
        if (!menu.contains(event.target)) {
          menu.classList.remove("open");
          const btn = menu.querySelector("[data-balance]");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    });
    docBound = true;
  }

  return {
    supported: BK_CURRENCY_SUPPORTED.slice(),
    getSelected,
    setSelected,
    formatAmount,
    applyToDom,
    ensureRates,
    setupMenus,
    setPriceDataset,
  };
})();

function formatPrice(vnd) {
  if (typeof vnd === "string") return vnd;
  if (BKCurrency && typeof BKCurrency.formatAmount === "function") {
    return BKCurrency.formatAmount(vnd, "VND");
  }
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(vnd);
}

function formatPriceRange(item) {
  if (!item) return "--";
  const min = item.price;
  const max = item.priceMax;
  if (typeof min === "number" && typeof max === "number" && max > min) {
    return `${formatPrice(min)} - ${formatPrice(max)}`;
  }
  return formatPrice(min);
}

// Landing featured
function renderLandingFeaturedProducts(items, targetId = "product-grid") {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  const language = getCurrentLanguage();
  const t = (key, fallback, vars) => formatI18n(language, key, fallback, vars);
  if (!items || !items.length) {
    grid.innerHTML = `
      <div class="card">
        <h3>${t("landing.featured.emptyTitle")}</h3>
        <p class="hero-sub">${t("landing.featured.emptyDesc")}</p>
      </div>
    `;
    return;
  }
  grid.innerHTML = items
    .map((p) => {
      const nameKey = p && p.id ? `product.data.${p.id}.name` : "";
      const shortKey = p && p.id ? `product.data.${p.id}.short` : "";
      const name = nameKey ? t(nameKey, p.name || "") : p.name || "";
      const short = shortKey ? t(shortKey, p.short || "") : p.short || "";
      const desc = short || t("product.fallback.delivery");
      return `
    <a class="card" href="${getProductDetailPath(p.id)}">
      <h3>${name} ${p.badge ? `<span class="tag">${p.badge}</span>` : ""}</h3>
      <p class="hero-sub">${desc}</p>
      <div class="meta-row">
        <span class="price">${formatPrice(p.price)}</span>
        <span class="badge-soft">${p.stock > 0 ? t("product.fallback.stockLeft", undefined, { count: p.stock }) : t("product.fallback.outOfStock")}</span>
      </div>
    </a>
  `;
    })
    .join("");
}

// Product list grid
function renderProductGrid(items, filters = {}, targetId = "product-list") {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  const language = getCurrentLanguage();
  const t = (key, fallback, vars) => formatI18n(language, key, fallback, vars);

  let list = Array.isArray(items) ? items.slice() : [];
  if (filters.category && filters.category !== "all") {
    list = list.filter((p) => p.category === filters.category);
  }
  if (filters.sort === "price-asc") {
    list.sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (filters.sort === "price-desc") {
    list.sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  if (!list.length) {
    grid.innerHTML = `
      <div class="card empty-state" style="grid-column: 1 / -1;">
        <strong>${t("empty.noData")}</strong>
        <div style="margin-top:4px;">${t("empty.adjustFilters")}</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list
    .map((p) => {
      const nameKey = p && p.id ? `product.data.${p.id}.name` : "";
      const shortKey = p && p.id ? `product.data.${p.id}.short` : "";
      const name = nameKey ? t(nameKey, p.name || "") : p.name || "";
      const short = shortKey ? t(shortKey, p.short || "") : p.short || "";
      const desc = short || t("product.fallback.safe");
      return `
    <a class="card" href="${getProductDetailPath(p.id)}">
      <h3>${name} ${p.badge ? `<span class="tag">${p.badge}</span>` : ""}</h3>
      <p class="hero-sub">${desc}</p>
      <div class="meta-row">
        <span class="price">${formatPrice(p.price)}</span>
        <button class="btn">${t("product.action.view")}</button>
      </div>
    </a>
  `;
    })
    .join("");
}

// Services
function renderServiceGrid(items, targetId = "service-list") {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  const language = getCurrentLanguage();
  const t = (key, fallback, vars) => formatI18n(language, key, fallback, vars);
  if (!items || !items.length) {
    grid.innerHTML = `
      <div class="card empty-state" style="grid-column: 1 / -1;">
        <strong>${t("empty.noData")}</strong>
      </div>
    `;
    return;
  }
  grid.innerHTML = items
    .map((s) => {
      const nameKey = s && s.id ? `service.data.${s.id}.name` : "";
      const shortKey = s && s.id ? `service.data.${s.id}.short` : "";
      const name = nameKey ? t(nameKey, s.name || "") : s.name || "";
      const short = shortKey ? t(shortKey, s.short || "") : s.short || "";
      const desc = short || t("service.fallback.short");
      return `
    <a class="card" href="/dichvu/[id]/?id=${encodeURIComponent(s.id)}">
      <h3>${name}</h3>
      <p class="hero-sub">${desc}</p>
      <div class="meta-row">
        <span class="price">${formatPrice(s.price)}</span>
        <span class="badge-soft">${s.eta || t("service.fallback.eta")}</span>
      </div>
    </a>
  `;
    })
    .join("");
}

// Tasks
function renderTaskGrid(items, targetId = "task-list") {
  const grid = document.getElementById(targetId);
  if (!grid) return;
  const language = getCurrentLanguage();
  const translate = (key, fallback, vars) => formatI18n(language, key, fallback, vars);
  if (!items || !items.length) {
    grid.innerHTML = `
      <div class="card empty-state" style="grid-column: 1 / -1;">
        <strong>${translate("empty.noData")}</strong>
      </div>
    `;
    return;
  }
  grid.innerHTML = items
    .map((item) => {
      const titleKey = item && item.id ? `task.data.${item.id}.title` : "";
      const shortKey = item && item.id ? `task.data.${item.id}.short` : "";
      const title = titleKey ? translate(titleKey, item.title || "") : item.title || "";
      const short = shortKey ? translate(shortKey, item.short || "") : item.short || "";
      const desc = short || translate("task.fallback.short");
      const statusLabel = item.statusKey
        ? translate(item.statusKey, item.status || "")
        : item.status || translate("task.status.open");
      return `
    <a class="card" href="/nhiemvu/[id]/?id=${encodeURIComponent(item.id)}">
      <h3>${title}</h3>
      <p class="hero-sub">${desc}</p>
      <div class="meta-row">
        <span class="price">${formatPrice(item.reward)}</span>
        <span class="badge-soft">${statusLabel}</span>
      </div>
    </a>
  `;
    })
    .join("");
}

// Simple mobile nav + FAQ toggle used on all sub pages
document.addEventListener("DOMContentLoaded", () => {
  const isFile = window.location.protocol === "file:";
  const auth = readAuthState();
  syncAdminCookie(auth);
    lockViewportScale();
    stripIndexFromLocation();
    hydrateNavLinks();
    normalizeInternalLinks(isFile);
    normalizeIndexLinks(isFile);
    cleanupLogoArtifacts();
    applyLinkPreviewMetaTags();
    ensureBadgeStyles();
  if (typeof BKCurrency !== "undefined") {
    BKCurrency.setupMenus();
    BKCurrency.applyToDom();
    syncCurrencyCookie(BKCurrency.getSelected());
  }
  window.addEventListener("load", cleanupLogoArtifacts, { once: true });
  applyLoginLocks(auth);
  bindAuthActions(auth);
  updateSellerCta(auth);
  updateTaskCta(auth);
  setupUserMenu(auth);
  initGlobalNotifier();
  if (auth && auth.loggedIn) startHeartbeat(auth);
  applyI18n();

  const mobileNav = document.querySelector(".mobile-nav");
  const rootStyle = document.documentElement.style;
  let topbarMeasureTick = 0;
  const setTopbarHeight = () => {
    if (!mobileNav) return;
    const height = Math.ceil(mobileNav.getBoundingClientRect().height);
    if (!height) return;
    rootStyle.setProperty("--topbar-h", `${height}px`);
  };
  const scheduleTopbarHeight = () => {
    if (topbarMeasureTick) return;
    topbarMeasureTick = requestAnimationFrame(() => {
      topbarMeasureTick = 0;
      setTopbarHeight();
    });
  };
  if (mobileNav) {
    setTopbarHeight();
    window.addEventListener("resize", scheduleTopbarHeight, { passive: true });
    window.addEventListener("orientationchange", scheduleTopbarHeight, { passive: true });
  }

  const mobileMenu = document.getElementById("mobile-menu");
  const mobileLinks = document.querySelector(".mobile-links");
  if (mobileMenu && mobileLinks) {
    const setHeight = (open) => {
      if (!open) {
        const start = mobileLinks.getBoundingClientRect().height;
        mobileLinks.style.height = start + "px";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mobileLinks.style.height = "0px";
          });
        });
        return;
      }
      mobileLinks.style.height = "auto";
      const h = mobileLinks.scrollHeight;
      mobileLinks.style.height = "0px";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mobileLinks.style.height = h + "px";
        });
      });
    };
    mobileLinks.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "height") return;
      if (mobileLinks.classList.contains("expanded")) {
        mobileLinks.style.height = "auto";
      }
    });
    mobileMenu.addEventListener("click", (e) => {
      e.preventDefault();
      const willOpen = !mobileLinks.classList.contains("expanded");
      mobileLinks.classList.toggle("expanded");
      setHeight(willOpen);
    });
  }

  document.querySelectorAll(".faq-item button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      if (!item) return;
      item.classList.toggle("open");
    });
  });

  const path = window.location.pathname;
  const map = [
    { key: "sanpham", match: "/products/" },
    { key: "dichvu", match: "/dichvu/" },
    { key: "nhiemvu", match: "/nhiemvu/" },
    { key: "topups", match: "/profile/topups/" },
  ];
  const active = map.find((m) => path.startsWith(m.match));
  if (active) {
    document.querySelectorAll(`[data-nav="${active.key}"]`).forEach((el) => {
      el.classList.add("active");
    });
  }
});

window.BKAuth = {
  key: BK_AUTH_KEY,
  read: readAuthState,
  set: setAuthState,
  clear: clearAuthState,
  isSellerApproved: (auth) => isSellerApproved(auth || readAuthState()),
  isTaskApproved: (auth) => isTaskApproved(auth || readAuthState()),
  getLoginUrl,
  getHomeUrl,
  getSellerJoinUrl,
  getSellerPanelUrl,
  getTaskPanelUrl,
  redirectToLogin,
  showToast: showAuthToast,
};

window.BKTasks = {
  assignKey: BK_TASK_ASSIGN_KEY,
  reviewWindowMs: BK_TASK_REVIEW_WINDOW_MS,
  readAssignments: readTaskAssignments,
  writeAssignments: writeTaskAssignments,
  syncAssignments: syncTaskAssignments,
  getUserId: getAuthUserId,
  getUserName: getAuthUserName,
  formatCountdown: formatTaskCountdown,
};

window.BKCurrency = BKCurrency;
window.BKCurrency.setPriceDataset = setPriceDataset;

window.BKAssets = {
  ADMIN_AVATAR_SRC: BK_ASSET_PATHS.ADMIN_AVATAR_SRC,
  LINK_PREVIEW_IMAGE: BK_ASSET_PATHS.LINK_PREVIEW_IMAGE,
  getAssetUrl: resolveAssetUrl,
  getAbsoluteUrl,
  getSiteBaseUrl,
  getAdminAvatarUrl,
  getLinkPreviewUrl,
};

window.BKUI = {
  isAdminUser,
  createVerifiedBadge,
  createNameWithBadge,
  renderNameWithBadge,
  applyNameWithBadge,
  getAdminAvatarUrl,
  getLinkPreviewUrl,
};




