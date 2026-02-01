function getProjectRoot() {
  const isFile = window.location.protocol === "file:";
  const path = window.location.pathname.replace(/\\/g, "/");
  const lower = path.toLowerCase();
  const markers = [
    "/sanpham/",
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
  const base = isFile ? "sanpham/[id]/index.html" : "sanpham/[id]/";
  const suffix = productId ? `?id=${encodeURIComponent(productId)}` : "";
  return root + base + suffix;
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
    "sanpham/",
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
    "landing.hero.subtitle": "Nền tảng giao dịch uy tín và nhanh chóng.",
    "landing.hero.buy": "Mua hàng ngay",
    "landing.hero.explore": "Khám phá thêm",
    "landing.pill.email": "Email",
    "landing.pill.account": "Tài khoản",
    "landing.pill.software": "Phần mềm",
    "landing.pill.interaction": "Dịch vụ tương tác",
    "landing.pill.tools": "Công cụ",
    "landing.pill.other": "Khác",
    "landing.faq.title": "Câu hỏi thường gặp",
    "landing.faq.subtitle": "Tìm câu trả lời cho các thắc mắc thường gặp về polyflux.xyz",
    "landing.faq.q1": "Làm thế nào để xem đơn hàng của tôi?",
    "landing.faq.a1": "Các sản phẩm đã mua sẽ hiển thị trong lịch sử mua hàng của bạn.",
    "landing.faq.q2": "Đây có phải lừa đảo không?",
    "landing.faq.a2": "Chúng tôi dùng thanh toán đã xác minh, đánh giá công khai và chính sách hoàn tiền để bảo vệ bạn.",
    "landing.faq.q3": "Tôi có câu hỏi, liên hệ thế nào?",
    "landing.faq.a3": "Nhắn tin cho admin qua Telegram.",
    "landing.payments.title": "20+ phương thức thanh toán",
    "landing.payments.subtitle": "Chúng tôi hỗ trợ nhiều phương thức thanh toán để thanh toán nhanh và an toàn.",
    "landing.trusted.title": "Sàn giao dịch đáng tin cậy nhất.",
    "landing.trusted.subtitle": "Xem lý do khách hàng chọn chúng tôi",
    "landing.stats.orders": "Tổng đơn hàng",
    "landing.stats.vouches": "Đánh giá đã xác minh",
    "landing.stats.instantValue": "Tức thì",
    "landing.stats.deliveryLabel": "Giao hàng cho mọi sản phẩm",
    "landing.products.emptyTitle": "Không tìm thấy sản phẩm",
    "landing.products.emptyDesc": "Hãy thử điều chỉnh tìm kiếm hoặc bộ lọc danh mục.",
    "landing.products.instant": "Giao ngay và thanh toán an toàn.",
    "landing.products.add": "Thêm",
    "landing.product.email": "Email {index}",
    "landing.product.account": "Tài khoản {tier}",
    "landing.product.software": "Phần mềm {tier}",
    "landing.product.interaction": "Gói tương tác {index}",
    "landing.product.other": "Mặt hàng khác {index}",
    "landing.tier.basic": "Cơ bản",
    "landing.tier.pro": "Pro",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "Lite",
    "landing.tier.plus": "Plus",
    "support.label": "Hỗ trợ",
    "support.close": "Đóng",
    "support.header.title": "Hỗ trợ PolyFlux",
    "support.header.status": "Đang trực tuyến",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "Chat với Admin",
    "support.faq.title": "FAQ - CÂU HỎI THƯỜNG GẶP",
    "support.faq.buyer.title": "I. NGƯỜI MUA",
    "support.faq.buyer.q1": "Làm thế nào để mua sản phẩm?",
    "support.faq.buyer.a1.1": "Người mua có thể thanh toán bằng Crypto hoặc chuyển khoản ngân hàng.",
    "support.faq.buyer.a1.2": "Với Crypto: nạp vào ví cá nhân được chỉ định; sau khi giao dịch on-chain được xác nhận, số dư sẽ tự động cập nhật.",
    "support.faq.buyer.a1.3": "Với Ngân hàng: chuyển khoản theo thông tin được cung cấp; hệ thống sẽ đối soát và cập nhật số dư sau khi xác nhận thanh toán.",
    "support.faq.buyer.q2": "Email/tài khoản không trùng lặp là gì?",
    "support.faq.buyer.a2": "Hệ thống đảm bảo sản phẩm chưa từng được bán trước đó, sử dụng kiểm tra trùng lặp và huy hiệu Zero Duplicate.",
    "support.faq.buyer.q3": "Làm thế nào để nạp tiền?",
    "support.faq.buyer.a3.1": "Crypto: Chọn Nạp tiền -> chọn loại tiền điện tử -> gửi đến ví cá nhân của bạn. Hỗ trợ USDT, USDC, BTC, ETH, BNB, TRX, v.v.",
    "support.faq.buyer.a3.2": "Ngân hàng: Chọn Nạp tiền -> Chuyển khoản ngân hàng -> chuyển đúng nội dung/mã giao dịch để hệ thống tự động xác nhận.",
    "support.faq.buyer.q4": "Tôi có thể yêu cầu hoàn tiền không?",
    "support.faq.buyer.a4": "Có. Mỗi đơn hàng được bảo vệ bởi thời gian escrow 3 ngày để khiếu nại hoặc mở tranh chấp.",
    "support.faq.buyer.q5": "Tiền nạp của tôi chưa đến?",
    "support.faq.buyer.a5.1": "Crypto: có thể do sai chain, sai token, hoặc blockchain đang tắc nghẽn. Nếu vẫn chưa cập nhật sau vài phút, vui lòng gửi TXID để được hỗ trợ.",
    "support.faq.buyer.a5.2": "Ngân hàng: có thể do chuyển ngoài giờ, sai nội dung hoặc đang chờ đối soát. Liên hệ hỗ trợ kèm ảnh giao dịch.",
    "support.faq.buyer.q6": "Nếu tôi gửi sai thì sao?",
    "support.faq.buyer.a6.1": "Crypto: giao dịch blockchain không thể đảo ngược; gửi sai chain hoặc sai địa chỉ thường dẫn đến mất vĩnh viễn.",
    "support.faq.buyer.a6.2": "Ngân hàng: hệ thống chỉ hỗ trợ kiểm tra đối soát; không đảm bảo hoàn tiền nếu chuyển sai thông tin.",
    "support.faq.buyer.q7": "Tôi có cần người trung gian không?",
    "support.faq.buyer.a7": "Không. Hệ thống hoạt động như escrow tích hợp, tự động giữ tiền trong 3 ngày trước khi giải ngân cho người bán.",
    "support.faq.seller.title": "II. NGƯỜI BÁN (SELLER)",
    "support.faq.seller.q1": "Làm thế nào để đăng ký làm người bán?",
    "support.faq.seller.a1": "Đăng nhập -> Đăng ký làm Seller -> điền thông tin cần thiết -> chờ phê duyệt.",
    "support.faq.seller.q2": "Làm thế nào để tạo cửa hàng?",
    "support.faq.seller.a2": "Vào Quản lý cửa hàng -> Tạo mới -> tải lên mô tả sản phẩm, hình ảnh và tệp.",
    "support.faq.seller.q3": "Làm thế nào để tối ưu cửa hàng?",
    "support.faq.seller.a3": "Sử dụng hình ảnh chất lượng cao, tiêu đề rõ ràng, mô tả chi tiết, sản phẩm ổn định và hỗ trợ nhanh. Xếp hạng được cập nhật hàng tuần.",
    "support.faq.seller.q4": "Làm thế nào để lên top listing?",
    "support.faq.seller.a4": "Phụ thuộc vào doanh số, đánh giá khách hàng, độ tin cậy và tỷ lệ tranh chấp.",
    "support.faq.seller.q5": "Thu nhập được xử lý như thế nào?",
    "support.faq.seller.a5.1": "Sau khi đơn hàng hoàn tất, tiền sẽ ở trạng thái Pending trong 3 ngày (escrow). Hết thời gian này, người bán có thể rút tiền qua:",
    "support.faq.seller.a5.list1": "Crypto: USDT, BTC, ETH, BNB, TRX, v.v.",
    "support.faq.seller.a5.list2": "Chuyển khoản ngân hàng (theo thông tin đã xác minh).",
    "support.faq.seller.q6": "Hoa hồng được tính như thế nào?",
    "support.faq.seller.a6": "Nền tảng áp dụng phí giao dịch 5% trên mỗi đơn hàng thành công. Người bán có thể bật chế độ Reseller để tăng doanh số.",
    "support.faq.seller.q7": "Làm thế nào để rút tiền?",
    "support.faq.seller.a7": "Chọn Rút tiền -> chọn Crypto hoặc Ngân hàng -> nhập thông tin -> xác nhận.",
    "support.faq.seller.q8": "Nghĩa vụ thuế của người bán được xử lý ra sao?",
    "support.faq.seller.a8.1": "Nền tảng chỉ đóng vai trò trung gian cung cấp hạ tầng giao dịch.",
    "support.faq.seller.a8.2": "Người bán tự chịu trách nhiệm kê khai và thực hiện nghĩa vụ thuế phát sinh từ thu nhập của mình theo quy định pháp luật Việt Nam.",
    "support.faq.seller.a8.3": "Nền tảng không khấu trừ, không đại diện và không thay mặt người bán thực hiện nghĩa vụ thuế.",
    "support.faq.seller.q9": "Các mặt hàng bị cấm?",
    "support.faq.seller.a9": "Tài khoản bị hack, dữ liệu bất hợp pháp, tài khoản ngân hàng, công cụ gây hại, hoặc bất kỳ nội dung nào vi phạm pháp luật Việt Nam hay điều khoản của bên thứ ba.",
    "support.faq.seller.q10": "Giao dịch của người dùng có liên quan đến admin không?",
    "support.faq.seller.a10.1": "Các mặt hàng người dùng đăng bán hoặc đăng nhiệm vụ là giao dịch giữa người dùng với nhau, không liên quan đến admin.",
    "support.faq.seller.a10.2": "Admin không mua bán hàng hóa phạm pháp. Nếu có giao dịch trái phép hoặc cố tình vi phạm, admin có quyền xóa nội dung và đóng băng số dư. Việc tham gia bán hàng đồng nghĩa bạn đã đọc và chấp nhận điều khoản.",
    "support.faq.seller.q11": "Tích hợp API?",
    "support.faq.seller.a11": "Có. Người bán có thể tích hợp API để tự động giao hàng và đồng bộ kho.",
    "support.faq.seller.q12": "Làm thế nào để xử lý bảo hành?",
    "support.faq.seller.a12": "Vào Đơn hàng đã bán -> Bảo hành -> nhập số lượng -> hệ thống tự động gửi mã thay thế cho khách hàng.",
    "support.faq.reseller.title": "III. RESELLER",
    "support.faq.reseller.q1": "Làm thế nào để trở thành reseller?",
    "support.faq.reseller.a1": "Bật chế độ Reseller trong cài đặt tài khoản.",
    "support.faq.reseller.q2": "Làm thế nào để bán với tư cách reseller?",
    "support.faq.reseller.a2": "Chọn sản phẩm đủ điều kiện -> lấy link giới thiệu -> chia sẻ -> hệ thống tự động ghi nhận hoa hồng.",
    "support.faq.reseller.q3": "Rút hoa hồng?",
    "support.faq.reseller.a3": "Hoa hồng được giữ 3 ngày (escrow) trước khi rút qua Crypto hoặc Ngân hàng.",
    "support.faq.reseller.q4": "Thưởng hàng tháng?",
    "support.faq.reseller.a4": "Có. Nền tảng áp dụng chương trình thưởng dựa trên hiệu suất hàng tháng.",
    "support.faq.compliance.title": "IV. TUÂN THỦ PHÁP LUẬT VIỆT NAM - AML & FRAUD",
    "support.faq.compliance.q1": "Chống rửa tiền (AML)",
    "support.faq.compliance.a1.lead": "Nghiêm cấm:",
    "support.faq.compliance.a1.list1": "Lưu thông tài sản bất hợp pháp",
    "support.faq.compliance.a1.list2": "Che giấu nguồn gốc quỹ",
    "support.faq.compliance.a1.list3": "Giao dịch bất thường có dấu hiệu rửa tiền",
    "support.faq.compliance.a1.note": "Nền tảng có quyền giữ tiền, khóa tài khoản, yêu cầu xác minh danh tính và hợp tác với cơ quan chức năng khi cần thiết.",
    "support.faq.compliance.q2": "Phòng chống gian lận (Fraud)",
    "support.faq.compliance.a2.lead": "Nghiêm cấm:",
    "support.faq.compliance.a2.list1": "Đơn hàng giả",
    "support.faq.compliance.a2.list2": "Lạm dụng tranh chấp",
    "support.faq.compliance.a2.list3": "Đa tài khoản",
    "support.faq.compliance.a2.list4": "Bot, hack, khai thác lỗi hệ thống",
    "support.faq.compliance.q3": "Tuân thủ pháp luật Việt Nam",
    "support.faq.compliance.a3": "Người dùng không được mua bán các mặt hàng bất hợp pháp, xâm phạm quyền riêng tư hoặc dữ liệu cá nhân trái phép.",
    "profile.overview.pageTitle": "Tổng quan tài khoản | polyflux.xyz",
    "profile.overview.title": "Tổng quan tài khoản",
    "profile.overview.subtitle": "Theo dõi số dư, đơn hàng, bảo mật trong một nơi.",
    "profile.overview.quickInfoTitle": "Thông tin nhanh",
    "profile.overview.quickInfoDesc": "số dư, tổng đơn, cấp độ tài khoản...",
    "profile.overview.table.labelItem": "Hạng mục",
    "profile.overview.table.labelValue": "Giá trị",
    "profile.overview.table.labelStatus": "Trạng thái",
    "profile.overview.table.balanceLabel": "Số dư khả dụng",
    "profile.overview.table.balanceStatus": "Chưa nạp",
    "profile.overview.table.ordersLabel": "Tổng đơn hàng",
    "profile.overview.table.ordersStatus": "Hoàn thành",
    "profile.overview.quickLinks.title": "Điều hướng nhanh",
    "profile.overview.quickLinks.profile": "Trang cá nhân",
    "profile.overview.quickLinks.orders": "Đơn hàng",
    "profile.overview.quickLinks.topups": "Nạp tiền",
    "profile.overview.quickLinks.logins": "Nhật ký đăng nhập",
    "profile.overview.quickLinks.security": "Bảo mật & 2FA",
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
    "product.detail.pageTitle": "Chi tiết sản phẩm | polyflux.xyz",
    "breadcrumb.home": "Trang chủ",
    "breadcrumb.detail": "Chi tiết",
    "product.detail.share": "Chia sẻ",
    "product.detail.share.copied": "Đã sao chép",
    "product.detail.share.failed": "Không thể sao chép",
    "product.detail.favorite": "Yêu thích",
    "product.detail.favorite.active": "Đã yêu thích",
    "product.detail.otherTitle": "Mặt hàng khác từ gian hàng",
    "product.detail.other.empty": "Chưa có mặt hàng khác.",
    "product.detail.order": "Đặt hàng",
    "product.detail.preorder": "Đặt trước",
    "product.detail.message": "Nhắn tin",
    "product.detail.tab.shop": "Mô tả gian hàng",
    "product.detail.tab.reviews": "Đánh giá",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "Xác nhận đặt hàng",
    "product.detail.modal.quantity": "Số lượng",
    "product.detail.modal.subtotal": "Tạm tính",
    "product.detail.modal.cancel": "Hủy",
    "product.detail.modal.confirm": "Xác nhận đặt hàng",
    "product.detail.modal.processing": "Đang xử lý...",
    "product.detail.modal.max": "Tối đa {max}",
    "product.detail.toast.success": "Đặt hàng thành công. Kiểm tra trong đơn hàng của bạn.",
    "product.detail.toast.viewOrders": "Xem đơn hàng",
    "product.detail.toast.loginRequired": "Vui lòng đăng nhập để đặt hàng.",
    "product.detail.toast.orderFailed": "Đặt hàng thất bại.",
    "product.detail.notFound": "Không tìm thấy sản phẩm",
    "product.detail.description.pending": "Mô tả đang cập nhật.",
    "product.detail.rating.positive": "Tích cực",
    "product.detail.rating.neutral": "Bình thường",
    "product.detail.rating.negative": "Cần cải thiện",
    "product.detail.rating.none": "Chưa có đánh giá",
    "product.detail.shopIdLabel": "Gian hàng ID",
    "product.detail.shop.polyflux.title": "PolyFlux Official",
    "product.detail.shop.polyflux.bullet1": "Giao nhanh, kiểm tra trước khi bàn giao.",
    "product.detail.shop.polyflux.bullet2": "Hoàn tiền nếu lỗi không khắc phục được.",
    "product.detail.shop.polyflux.bullet3": "Hỗ trợ 24/7 qua Telegram.",
    "product.detail.shop.partner.title": "Đối tác Marketplace #1",
    "product.detail.shop.partner.bullet1": "Kho ổn định, giao nhanh trong vài phút.",
    "product.detail.shop.partner.bullet2": "Cam kết giá tốt cho đơn hàng số lượng lớn.",
    "product.detail.shop.partner.bullet3": "Hỗ trợ bảo hành theo chính sách niêm yết.",
    "product.detail.shop.fallbackTitle": "Gian hàng uy tín",
    "product.detail.shop.fallbackBullet1": "Kiểm tra sản phẩm ngay sau khi nhận.",
    "product.detail.shop.fallbackBullet2": "Hỗ trợ khi có vấn đề phát sinh.",
    "product.detail.review.1.text": "Giao hàng nhanh, tài khoản hoạt động tốt.",
    "product.detail.review.1.time": "2 giờ trước",
    "product.detail.review.2.text": "Shop hỗ trợ nhanh, có bảo hành rõ ràng.",
    "product.detail.review.2.time": "1 ngày trước",
    "product.detail.review.3.text": "Sản phẩm đúng mô tả, sẽ mua lại.",
    "product.detail.review.3.time": "3 ngày trước",
    "product.detail.api.title": "API giao hàng",
    "product.detail.api.bullet1": "Hỗ trợ tự động giao mã sau thanh toán.",
    "product.detail.api.bullet2": "Tương thích REST/JSON.",
    "product.detail.api.bullet3": "Liên hệ Admin để nhận key.",
    "service.detail.pageTitle": "Chi tiết dịch vụ | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Đang tải dịch vụ...",
    "service.detail.hero.loadingDesc": "Mô tả dịch vụ sẽ xuất hiện ở đây.",
    "service.detail.info.title": "Thông tin gói",
    "service.detail.info.desc": "Đọc từ /data/mock-services.json. Sau khi nối API, backend trả thêm trường mô tả chi tiết.",
    "service.detail.form.title": "Form yêu cầu sau checkout",
    "service.detail.form.desc": "Sau khi thanh toán thành công, khách điền form này để bạn xử lý dịch vụ chính xác theo yêu cầu.",
    "service.detail.form.emailLabel": "Email nhận kết quả",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "Link cần xử lý",
    "service.detail.form.linkPlaceholder": "VD: link bài viết, profile, video...",
    "service.detail.form.noteLabel": "Nội dung chi tiết",
    "service.detail.form.notePlaceholder": "Mô tả rõ yêu cầu, số lượng, tốc độ mong muốn...",
    "service.detail.form.save": "Lưu yêu cầu",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "Form chưa gửi đi đâu cả. Khi nối API, chỉ cần POST dữ liệu này vào backend.",
    "service.detail.notFound": "Không tìm thấy dịch vụ",
    "service.detail.noData": "Chưa có dữ liệu, sẽ hiện khi nối API hoặc khi thêm JSON.",
    "service.detail.fallback.summary": "Mô tả chi tiết dịch vụ sẽ hiển thị ở đây.",
    "service.detail.fallback.description": "Mô tả chi tiết dịch vụ sẽ được trả về bởi API backend và hiển thị tại đây.",
    "task.detail.pageTitle": "Chi tiết nhiệm vụ | polyflux.xyz",
    "task.detail.hero.loadingTitle": "Đang tải nhiệm vụ...",
    "task.detail.hero.loadingDesc": "Mô tả nhiệm vụ sẽ xuất hiện ở đây.",
    "task.detail.info.title": "Thông tin nhiệm vụ",
    "task.detail.info.desc": "Dữ liệu được lấy từ /data/mock-tasks.json. Khi kết nối API, thông tin sẽ được lấy từ backend.",
    "task.detail.report.title": "Nộp báo cáo",
    "task.detail.report.desc": "Nộp bằng chứng hoàn thành nhiệm vụ.",
    "task.detail.report.contactLabel": "Email / Username",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "Link bằng chứng",
    "task.detail.report.proofPlaceholder": "VD: link bài viết, video",
    "task.detail.report.noteLabel": "Ghi chú thêm",
    "task.detail.report.notePlaceholder": "Mô tả nhanh về công việc đã làm...",
    "task.detail.report.submit": "Gửi báo cáo",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "Khi kết nối API, hệ thống sẽ nhận báo cáo và duyệt tự động.",
    "task.detail.notFound": "Không tìm thấy nhiệm vụ",
    "task.detail.noData": "Chưa có dữ liệu, vui lòng thử lại sau.",
    "task.detail.titleFallback": "Nhiệm vụ",
    "task.detail.fallback.summary": "Mô tả chi tiết nhiệm vụ sẽ hiển thị tại đây.",
    "task.detail.fallback.description": "Mô tả chi tiết nhiệm vụ sẽ được cập nhật khi có API.",
    "maintenance.title": "Máy chủ bảo trì",
    "maintenance.desc": "Bảo trì hệ thống, xin lỗi vì sự bất tiện này, bảo trì sẽ không kéo dài quá 1 giờ, xin hãy yên tâm.",
    "cart.pageTitle": "Giỏ hàng | polyflux.xyz",
    "cart.items.title": "Sản phẩm trong giỏ",
    "cart.empty.title": "Giỏ hàng hiện đang trống.",
    "cart.empty.desc": "Sau khi nối API, các sản phẩm bạn chọn sẽ hiển thị tại đây.",
    "cart.summary.title": "Tóm tắt đơn hàng",
    "cart.summary.desc": "Tổng tiền, phí, mã giảm giá.",
    "cart.summary.couponLabel": "Mã giảm giá",
    "cart.summary.couponPlaceholder": "Nhập mã",
    "cart.summary.apply": "Áp dụng",
    "cart.summary.checkout": "Tiếp tục thanh toán",
    "checkout.pageTitle": "Thanh toán | polyflux.xyz",
    "checkout.buyer.title": "Thông tin người mua",
    "checkout.buyer.emailLabel": "Email nhận đơn",
    "checkout.buyer.platformLabel": "ID / Username (nếu cần)",
    "checkout.buyer.platformPlaceholder": "Tùy sản phẩm/dịch vụ",
    "checkout.note.title": "Ghi chú thêm",
    "checkout.note.label": "Ghi chú đơn hàng",
    "checkout.note.placeholder": "Ví dụ: giao file .txt, gửi qua mail...",
    "checkout.summary.title": "Tóm tắt đơn hàng",
    "checkout.summary.desc": "tổng tiền & phương thức thanh toán.",
    "checkout.summary.emptyTitle": "Chưa có dữ liệu giỏ hàng.",
    "checkout.summary.emptyDesc": "Sau khi nối API, danh sách item và total sẽ hiển thị ở đây.",
    "checkout.summary.success": "Thanh toán thành công",
    "checkout.summary.failed": "Mô phỏng thất bại",
    "checkout.success.pageTitle": "Thanh toán thành công | polyflux.xyz",
    "checkout.success.title": "Thanh toán thành công",
    "checkout.success.desc": "Đơn hàng của bạn đã được ghi nhận. Khi kết nối API, trang này sẽ hiển thị chi tiết đơn và nút tải tài nguyên.",
    "checkout.success.orders": "Xem đơn hàng của tôi",
    "checkout.success.continue": "Tiếp tục mua hàng",
    "checkout.failed.pageTitle": "Thanh toán thất bại | polyflux.xyz",
    "checkout.failed.title": "Thanh toán thất bại",
    "checkout.failed.desc": "Có thể bạn đã hủy phiên thanh toán hoặc cổng thanh toán báo lỗi. Khi nối API, trang này sẽ hiển thị mã lỗi chi tiết.",
    "checkout.failed.retry": "Thử thanh toán lại",
    "checkout.failed.backProducts": "Quay lại sản phẩm",
    "profile.orders.pageTitle": "Đơn hàng | polyflux.xyz",
    "profile.orders.title": "Đơn hàng của tôi",
    "profile.orders.subtitle": "Theo dõi trạng thái các đơn hàng và lịch sử giao dịch.",
    "profile.orders.history.title": "Lịch sử đơn hàng",
    "profile.orders.table.orderId": "Mã đơn",
    "profile.orders.table.product": "Sản phẩm",
    "profile.orders.table.total": "Tổng tiền",
    "profile.orders.table.status": "Trạng thái",
    "profile.orders.status.completed": "Hoàn thành",
    "profile.orders.status.processing": "Đang xử lý",
    "profile.orders.status.cancelled": "Đã hủy",
    "profile.orders.sample.email": "Email 1",
    "profile.orders.sample.vip": "Tài khoản VIP",
    "profile.orders.sample.interaction": "Tương tác gói 3",
    "profile.history.pageTitle": "Lịch sử tài khoản | polyflux.xyz",
    "profile.history.title": "Lịch sử tài khoản",
    "profile.history.subtitle": "Tổng hợp giao dịch nạp, rút và mua hàng gần đây.",
    "profile.history.sectionTitle": "Hoạt động gần đây",
    "profile.history.table.date": "Thời gian",
    "profile.history.table.type": "Loại",
    "profile.history.table.amount": "Số tiền",
    "profile.history.table.status": "Trạng thái",
    "profile.history.type.topup": "Nạp tiền",
    "profile.history.type.withdraw": "Rút tiền",
    "profile.history.type.order": "Đơn hàng",
    "profile.history.status.success": "Thành công",
    "profile.history.status.processing": "Đang xử lý",
    "profile.history.status.completed": "Hoàn thành",
    "profile.tasks.pageTitle": "Nhiệm vụ đang nhận | polyflux.xyz",
    "profile.tasks.title": "Nhiệm vụ đang nhận",
    "profile.tasks.subtitle": "Theo dõi các nhiệm vụ bạn đã nhận và tiến độ duyệt.",
    "profile.tasks.sectionTitle": "Danh sách nhiệm vụ đang nhận",
    "profile.tasks.table.task": "Nhiệm vụ",
    "profile.tasks.table.receivedAt": "Ngày nhận",
    "profile.tasks.table.deadline": "Hết hạn",
    "profile.tasks.table.reward": "Thưởng",
    "profile.tasks.table.status": "Trạng thái",
    "profile.tasks.emptyTitle": "Chưa có nhiệm vụ nào đang nhận.",
    "profile.tasks.emptyDesc": "Khi bạn nhận nhiệm vụ mới, hệ thống sẽ hiển thị tại đây.",
    "profile.topups.pageTitle": "Nạp tiền | polyflux.xyz",
    "profile.topups.title": "Nạp tiền vào tài khoản",
    "profile.topups.subtitle": "Nhập số tiền muốn nạp, tối thiểu 10.000đ, tối đa 499.000.000đ. QR sẽ tạo tự động cho mỗi lần nạp.",
    "profile.topups.guard.title": "Yêu cầu đăng nhập:",
    "profile.topups.guard.desc": "Bạn cần đăng nhập để nạp tiền vào ví.",
    "profile.topups.bank.title": "Nạp bằng Ngân hàng (QR)",
    "profile.topups.bank.desc": "Quét QR bằng app ngân hàng. Sau khi chuyển, hệ thống tự động cộng tiền vào ví.",
    "profile.topups.bank.qrPlaceholder": "QR sẽ hiển thị sau khi tạo.",
    "profile.topups.bank.codeLabel": "Tên chủ tài khoản",
    "profile.topups.bank.amountLabel": "Số tiền",
    "profile.topups.bank.amountInputLabel": "Số tiền muốn nạp (VND)",
    "profile.topups.bank.amountPlaceholder": "VD: 100000",
    "profile.topups.bank.amountHint": "Tối thiểu 10.000đ, tối đa 499.000.000đ.",
    "profile.topups.bank.generate": "Tạo QR",
    "profile.topups.bank.toast.invalidAmount": "Vui lòng nhập số tiền hợp lệ.",
    "profile.topups.bank.toast.range": "Số tiền phải từ {min} đến {max} đ.",
    "profile.topups.bank.toast.created": "QR đã tạo. Quét để nạp tiền.",
    "profile.topups.bank.toast.failed": "Không thể tạo QR lúc này.",
    "profile.topups.crypto.notice": "Nạp bằng crypto đang lỗi tạm thời, không sử dụng được. Hãy dùng Ngân hàng.",
    "profile.topups.crypto.title": "Nạp bằng Crypto (USDT TRC20)",
    "profile.topups.crypto.desc": "Nạp bằng USDT mạng TRC20. Khi on-chain xác nhận thành công, hệ thống sẽ cộng tiền.",
    "profile.topups.crypto.addressLabel": "Địa chỉ ví TRC20",
    "profile.topups.crypto.amountLabel": "Số lượng USDT",
    "profile.topups.crypto.amountPlaceholder": "VD: 10",
    "profile.topups.crypto.confirm": "Tôi đã chuyển",
    "profile.topups.withdraw.title": "Rút tiền",
    "profile.topups.withdraw.desc": "Nhập số tiền muốn rút theo số dư hiện có. Tối thiểu 50.000đ, tối đa 499.000.000đ.",
    "profile.topups.withdraw.balanceLabel": "Số dư khả dụng:",
    "profile.topups.withdraw.amountLabel": "Số tiền muốn rút (VND)",
    "profile.topups.withdraw.amountPlaceholder": "VD: 500000",
    "profile.topups.withdraw.amountHint": "Rút tối thiểu 50.000đ, tối đa 499.000.000đ.",
    "profile.topups.withdraw.bankLabel": "Ngân hàng",
    "profile.topups.withdraw.bankPlaceholder": "VD: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "Số tài khoản",
    "profile.topups.withdraw.accountPlaceholder": "Nhập số tài khoản",
    "profile.topups.withdraw.nameLabel": "Tên chủ tài khoản",
    "profile.topups.withdraw.namePlaceholder": "Họ và tên chủ tài khoản",
    "profile.topups.withdraw.submit": "Gửi yêu cầu rút",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "Yêu cầu sẽ được admin duyệt trước khi chuyển khoản.",
    "profile.topups.history.topup.title": "Lịch sử nạp tiền gần đây",
    "profile.topups.history.withdraw.title": "Lịch sử rút tiền",
    "profile.topups.history.table.date": "Thời gian",
    "profile.topups.history.table.amount": "Số tiền",
    "profile.topups.history.table.bank": "Ngân hàng",
    "profile.topups.history.table.status": "Trạng thái",
    "profile.topups.status.pending": "Đang duyệt",
    "profile.topups.status.completed": "Đã xử lý",
    "profile.topups.status.rejected": "Từ chối",
    "profile.security.pageTitle": "Bảo mật & 2FA | polyflux.xyz",
    "profile.security.title": "Bảo mật & 2FA",
    "profile.security.subtitle": "Tăng cường bảo mật tài khoản và kiểm soát truy cập.",
    "profile.security.password.title": "Cập nhật mật khẩu",
    "profile.security.password.desc": "Thay đổi mật khẩu định kỳ để bảo vệ tài khoản tốt hơn.",
    "profile.security.password.currentLabel": "Mật khẩu hiện tại",
    "profile.security.password.currentPlaceholder": "Nhập mật khẩu hiện tại",
    "profile.security.password.newLabel": "Mật khẩu mới",
    "profile.security.password.newPlaceholder": "Tối thiểu 8 ký tự",
    "profile.security.password.confirmLabel": "Xác nhận mật khẩu mới",
    "profile.security.password.confirmPlaceholder": "Nhập lại mật khẩu mới",
    "profile.security.password.submit": "Cập nhật mật khẩu",
    "profile.security.2fa.title": "Xác thực hai lớp (2FA)",
    "profile.security.2fa.desc": "Bật 2FA để yêu cầu mã xác thực khi đăng nhập.",
    "profile.security.2fa.recoveryLabel": "Mã khôi phục",
    "profile.security.2fa.deviceLabel": "Thiết bị tin cậy",
    "profile.security.2fa.deviceNone": "Chưa có thiết bị nào được thêm.",
    "profile.security.2fa.enable": "Bật 2FA",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "Kết nối API để lưu cấu hình 2FA và danh sách thiết bị.",
    "profile.favorites.pageTitle": "Yêu thích | polyflux.xyz",
    "profile.favorites.title": "Yêu thích",
    "profile.favorites.subtitle": "Danh sách sản phẩm, dịch vụ bạn đã lưu.",
    "profile.favorites.listTitle": "Danh sách yêu thích",
    "profile.favorites.emptyTitle": "Chưa có dữ liệu.",
    "profile.favorites.emptyDesc": "Hãy lưu sản phẩm để xem lại sau.",
    "profile.notifications.pageTitle": "Thông báo | polyflux.xyz",
    "profile.notifications.title": "Thông báo",
    "profile.notifications.subtitle": "Cập nhật đơn hàng và hệ thống sẽ hiển thị ở đây.",
    "profile.notifications.listTitle": "Thông báo mới",
    "profile.notifications.emptyTitle": "Chưa có thông báo.",
    "profile.notifications.emptyDesc": "Hãy quay lại sau.",
    "profile.badges.pageTitle": "Danh hiệu | polyflux.xyz",
    "profile.badges.title": "Danh hiệu",
    "profile.badges.subtitle": "Theo dõi cấp độ và thành tích của bạn.",
    "profile.badges.listTitle": "Danh hiệu đạt được",
    "profile.badges.emptyTitle": "Chưa có danh hiệu.",
    "profile.badges.emptyDesc": "Hoàn thành nhiệm vụ để mở khóa.",
    "profile.messages.pageTitle": "Tin nhắn | polyflux.xyz",
    "profile.messages.inboxTitle": "Hộp thư",
    "profile.messages.inboxCount": "1 cuộc trò chuyện",
    "profile.messages.searchPlaceholder": "Tìm kiếm...",
    "profile.messages.thread.name": "Bạch Kim",
    "profile.messages.thread.note": "Hỗ trợ chính thức",
    "profile.messages.thread.empty": "Không có cuộc trò chuyện khác.",
    "profile.messages.back": "Quay lại",
    "profile.messages.user.sub": "Hỗ trợ Admin",
    "profile.messages.role.admin": "Admin",
    "profile.messages.day.today": "Hôm nay",
    "profile.messages.message.1": "Xin chào, bạn cần hỗ trợ gì?",
    "profile.messages.message.2": "Cho mình hỏi thông tin đơn hàng #.",
    "profile.messages.message.3": "Mình đang kiểm tra, bạn chờ mình 1 chút nhé.",
    "profile.messages.message.4": "Cảm ơn bạn.",
    "profile.messages.emojiLabel": "Biểu cảm",
    "profile.messages.attachLabel": "Đính kèm",
    "profile.messages.inputPlaceholder": "Nhập tin nhắn...",
    "profile.messages.send": "Gửi",
    "product.data.gmail-random.name": "Gmail random name",
    "product.data.gmail-random.short": "Full quyền truy cập Gmail random, bảo hành 7 ngày.",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "Tài khoản Gmail EDU dùng để kích hoạt nhiều ưu đãi.",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "Tài khoản US đã KYC, dùng cho nhiều dịch vụ.",
    "product.data.tool-checker.name": "Tool checker tài nguyên",
    "product.data.tool-checker.short": "Tool local kiểm tra live/dead tài nguyên nhanh.",
    "service.data.fb-boost.name": "Dịch vụ tăng tương tác Facebook",
    "service.data.fb-boost.short": "Tăng like, comment, share tự nhiên, bảo hành 7 ngày.",
    "service.data.tiktok-view.name": "Tăng view TikTok",
    "service.data.tiktok-view.short": "Gói view TikTok cho video mới, phù hợp test nội dung.",
    "task.data.review-product.title": "Viết review sản phẩm trên diễn đàn",
    "task.data.review-product.short": "Viết review chi tiết và trải nghiệm mua hàng tại polyflux.xyz.",
    "task.data.tiktok-video.title": "Làm video TikTok giới thiệu shop",
    "task.data.tiktok-video.short": "Quay video ngắn review dịch vụ, đính kèm hashtag theo yêu cầu.",
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
    "profile.topups.subtitle": "Enter the amount to top up: minimum 10,000đ and maximum 499,000,000đ. A QR code will be generated for each top-up.",
    "profile.topups.guard.title": "Login required:",
    "profile.topups.guard.desc": "You need to log in to top up your wallet.",
    "profile.topups.bank.title": "Bank top up (QR)",
    "profile.topups.bank.desc": "Scan the QR code in your banking app. After transferring, funds will be credited automatically.",
    "profile.topups.bank.qrPlaceholder": "QR will appear after creation.",
    "profile.topups.bank.codeLabel": "Account name",
    "profile.topups.bank.amountLabel": "Amount",
    "profile.topups.bank.amountInputLabel": "Top-up amount (VND)",
    "profile.topups.bank.amountPlaceholder": "e.g. 100000",
    "profile.topups.bank.amountHint": "Minimum 10,000đ, maximum 499,000,000đ.",
    "profile.topups.bank.generate": "Generate QR",
    "profile.topups.bank.toast.invalidAmount": "Please enter a valid amount.",
    "profile.topups.bank.toast.range": "Amount must be between {min} and {max} đ.",
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
    "profile.topups.withdraw.desc": "Enter the amount to withdraw based on your current balance. Minimum 50,000đ, maximum 499,000,000đ.",
    "profile.topups.withdraw.balanceLabel": "Available balance:",
    "profile.topups.withdraw.amountLabel": "Withdrawal amount (VND)",
    "profile.topups.withdraw.amountPlaceholder": "e.g. 500000",
    "profile.topups.withdraw.amountHint": "Minimum 50,000đ, maximum 499,000,000đ.",
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
    "landing.hero.subtitle": "믿을 수 있고 빠른 거래 플랫폼입니다.",
    "landing.hero.buy": "지금 구매",
    "landing.hero.explore": "더 알아보기",
    "landing.pill.email": "이메일",
    "landing.pill.account": "계정",
    "landing.pill.software": "소프트웨어",
    "landing.pill.interaction": "인터랙션 서비스",
    "landing.pill.tools": "도구",
    "landing.pill.other": "기타",
    "landing.faq.title": "자주 묻는 질문",
    "landing.faq.subtitle": "polyflux.xyz 관련 자주 묻는 질문을 확인하세요",
    "landing.faq.q1": "내 주문을 어떻게 확인하나요?",
    "landing.faq.a1": "구매한 상품은 구매 내역에서 확인할 수 있습니다.",
    "landing.faq.q2": "사기인가요?",
    "landing.faq.a2": "검증된 결제, 공개 리뷰, 환불 정책으로 안전을 보장합니다.",
    "landing.faq.q3": "문의가 있는데 어떻게 연락하나요?",
    "landing.faq.a3": "Telegram으로 관리자에게 문의하세요.",
    "landing.payments.title": "20개 이상의 결제 옵션",
    "landing.payments.subtitle": "빠르고 안전한 결제를 위해 다양한 결제 수단을 지원합니다.",
    "landing.trusted.title": "가장 신뢰받는 마켓.",
    "landing.trusted.subtitle": "고객이 우리를 선택하는 이유를 확인하세요",
    "landing.stats.orders": "총 주문",
    "landing.stats.vouches": "검증된 리뷰",
    "landing.stats.instantValue": "즉시",
    "landing.stats.deliveryLabel": "모든 상품 즉시 전달",
    "landing.products.emptyTitle": "상품이 없습니다",
    "landing.products.emptyDesc": "검색어나 카테고리 필터를 조정해 보세요.",
    "landing.products.instant": "즉시 전달 및 안전한 결제.",
    "landing.products.add": "추가",
    "landing.product.email": "이메일 {index}",
    "landing.product.account": "계정 {tier}",
    "landing.product.software": "소프트웨어 {tier}",
    "landing.product.interaction": "인터랙션 패키지 {index}",
    "landing.product.other": "기타 상품 {index}",
    "landing.tier.basic": "기본",
    "landing.tier.pro": "프로",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "라이트",
    "landing.tier.plus": "플러스",
    "support.label": "지원",
    "support.close": "닫기",
    "support.header.title": "PolyFlux 지원",
    "support.header.status": "온라인",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "관리자와 채팅",
    "support.faq.title": "FAQ - 자주 묻는 질문",
    "support.faq.buyer.title": "I. 구매자",
    "support.faq.buyer.q1": "제품을 어떻게 구매하나요?",
    "support.faq.buyer.a1.1": "구매자는 암호화폐 또는 은행 이체로 결제할 수 있습니다.",
    "support.faq.buyer.a1.2": "암호화폐: 지정된 개인 지갑으로 입금하며, 온체인 거래가 확인되면 잔액이 자동으로 업데이트됩니다.",
    "support.faq.buyer.a1.3": "은행: 제공된 정보로 이체하면, 결제가 확인된 뒤 시스템이 대조하여 잔액을 업데이트합니다.",
    "support.faq.buyer.q2": "이메일/계정 중복 없음은 무엇인가요?",
    "support.faq.buyer.a2": "시스템은 중복 검사를 통해 이전에 판매되지 않은 상품만 제공하며 Zero Duplicate 배지를 표시합니다.",
    "support.faq.buyer.q3": "어떻게 충전하나요?",
    "support.faq.buyer.a3.1": "암호화폐: 충전 선택 -> 코인 선택 -> 개인 지갑으로 전송. USDT, USDC, BTC, ETH, BNB, TRX 등 지원.",
    "support.faq.buyer.a3.2": "은행: 충전 선택 -> 은행 이체 -> 올바른 메모/거래 코드를 입력하면 시스템이 자동 확인합니다.",
    "support.faq.buyer.q4": "환불 요청이 가능한가요?",
    "support.faq.buyer.a4": "가능합니다. 모든 주문은 3일 에스크로 기간 동안 보호되어 이의 제기나 분쟁을 진행할 수 있습니다.",
    "support.faq.buyer.q5": "충전이 아직 도착하지 않았나요?",
    "support.faq.buyer.a5.1": "암호화폐: 체인/토큰 오류 또는 네트워크 혼잡일 수 있습니다. 몇 분 후에도 업데이트되지 않으면 TXID를 보내주세요.",
    "support.faq.buyer.a5.2": "은행: 영업시간 외 이체, 메모 오류, 또는 대조 대기일 수 있습니다. 이체 증빙을 첨부해 문의하세요.",
    "support.faq.buyer.q6": "잘못 보내면 어떻게 되나요?",
    "support.faq.buyer.a6.1": "암호화폐: 블록체인 거래는 되돌릴 수 없으며, 잘못된 체인/주소로 보내면 영구 손실될 수 있습니다.",
    "support.faq.buyer.a6.2": "은행: 시스템은 대조 확인만 지원하며, 잘못된 이체에 대한 환불은 보장되지 않습니다.",
    "support.faq.buyer.q7": "중개인이 필요한가요?",
    "support.faq.buyer.a7": "아니요. 시스템은 내장 에스크로로 동작하며 3일 동안 보관 후 판매자에게 지급합니다.",
    "support.faq.seller.title": "II. 판매자",
    "support.faq.seller.q1": "판매자 등록은 어떻게 하나요?",
    "support.faq.seller.a1": "로그인 -> 판매자 등록 -> 정보 입력 -> 승인 대기.",
    "support.faq.seller.q2": "상점을 어떻게 만들나요?",
    "support.faq.seller.a2": "상점 관리 -> 새로 만들기 -> 상품 설명/이미지/파일 업로드.",
    "support.faq.seller.q3": "상점을 어떻게 최적화하나요?",
    "support.faq.seller.a3": "고품질 이미지, 명확한 제목, 상세 설명, 안정적인 상품, 빠른 지원을 제공하세요. 순위는 매주 업데이트됩니다.",
    "support.faq.seller.q4": "상위 노출은 어떻게 하나요?",
    "support.faq.seller.a4": "매출, 고객 평가, 신뢰도, 분쟁률에 따라 결정됩니다.",
    "support.faq.seller.q5": "수익은 어떻게 처리되나요?",
    "support.faq.seller.a5.1": "주문 완료 후 자금은 3일간 Pending(에스크로) 상태로 유지됩니다. 이후 판매자는 다음으로 출금할 수 있습니다:",
    "support.faq.seller.a5.list1": "암호화폐: USDT, BTC, ETH, BNB, TRX 등.",
    "support.faq.seller.a5.list2": "은행 이체(확인된 계좌 정보 기준).",
    "support.faq.seller.q6": "수수료는 어떻게 계산되나요?",
    "support.faq.seller.a6": "플랫폼은 성공 주문당 5% 거래 수수료를 부과합니다. 판매자는 리셀러 모드를 켜서 매출을 늘릴 수 있습니다.",
    "support.faq.seller.q7": "출금은 어떻게 하나요?",
    "support.faq.seller.a7": "출금 선택 -> 암호화폐 또는 은행 선택 -> 정보 입력 -> 확인.",
    "support.faq.seller.q8": "판매자의 세금 의무는 어떻게 처리되나요?",
    "support.faq.seller.a8.1": "플랫폼은 거래 인프라를 제공하는 중개 역할만 합니다.",
    "support.faq.seller.a8.2": "판매자는 베트남 법률에 따라 자신의 소득에 대한 세금을 신고·납부할 책임이 있습니다.",
    "support.faq.seller.a8.3": "플랫폼은 세금을 원천징수하거나 판매자를 대표하거나 대신 납부하지 않습니다.",
    "support.faq.seller.q9": "금지 품목은 무엇인가요?",
    "support.faq.seller.a9": "해킹된 계정, 불법 데이터, 은행 계정, 악성 도구, 또는 베트남 법률이나 제3자 약관을 위반하는 모든 콘텐츠.",
    "support.faq.seller.q10": "사용자 거래가 관리자와 관련이 있나요?",
    "support.faq.seller.a10.1": "사용자가 판매 등록하거나 작업을 올린 항목은 사용자 간 거래이며 관리자와는 관련이 없습니다.",
    "support.faq.seller.a10.2": "관리자는 불법 물품을 거래하지 않습니다. 불법 거래 또는 고의적 위반이 발생하면 관리자에게는 게시물 삭제 및 잔액 동결 권한이 있습니다. 이 플랫폼에서 판매에 참여하는 것은 약관을 읽고 동의한 것으로 간주됩니다.",
    "support.faq.seller.q11": "API 연동?",
    "support.faq.seller.a11": "가능합니다. 판매자는 API를 연동해 자동 배송 및 재고 동기화를 할 수 있습니다.",
    "support.faq.seller.q12": "보증 처리는 어떻게 하나요?",
    "support.faq.seller.a12": "판매된 주문 -> 보증 -> 수량 입력 -> 시스템이 고객에게 대체 코드를 자동 발송합니다.",
    "support.faq.reseller.title": "III. 리셀러",
    "support.faq.reseller.q1": "리셀러가 되려면?",
    "support.faq.reseller.a1": "계정 설정에서 리셀러 모드를 켜세요.",
    "support.faq.reseller.q2": "리셀러로 판매하는 방법은?",
    "support.faq.reseller.a2": "조건을 충족하는 상품 선택 -> 추천 링크 발급 -> 공유 -> 시스템이 수수료를 자동 기록합니다.",
    "support.faq.reseller.q3": "수수료 출금?",
    "support.faq.reseller.a3": "수수료는 3일(에스크로) 보관 후 암호화폐 또는 은행으로 출금됩니다.",
    "support.faq.reseller.q4": "월간 보너스?",
    "support.faq.reseller.a4": "있습니다. 플랫폼은 월간 성과 기반 보너스 프로그램을 운영합니다.",
    "support.faq.compliance.title": "IV. 베트남 법률 준수 - AML & 사기",
    "support.faq.compliance.q1": "자금세탁 방지(AML)",
    "support.faq.compliance.a1.lead": "엄격히 금지:",
    "support.faq.compliance.a1.list1": "불법 자산 유통",
    "support.faq.compliance.a1.list2": "자금 출처 은닉",
    "support.faq.compliance.a1.list3": "자금세탁 의심 거래",
    "support.faq.compliance.a1.note": "플랫폼은 필요 시 자금 보류, 계정 잠금, 신원 확인 요청 및 당국 협조를 할 수 있습니다.",
    "support.faq.compliance.q2": "사기 방지",
    "support.faq.compliance.a2.lead": "엄격히 금지:",
    "support.faq.compliance.a2.list1": "가짜 주문",
    "support.faq.compliance.a2.list2": "분쟁 악용",
    "support.faq.compliance.a2.list3": "다중 계정",
    "support.faq.compliance.a2.list4": "봇, 해킹, 시스템 취약점 악용",
    "support.faq.compliance.q3": "베트남 법률 준수",
    "support.faq.compliance.a3": "사용자는 불법 상품을 거래하거나 개인정보/프라이버시를 침해해서는 안 됩니다.",
    "profile.overview.pageTitle": "계정 개요 | polyflux.xyz",
    "profile.overview.title": "계정 개요",
    "profile.overview.subtitle": "잔액, 주문, 보안을 한 곳에서 확인하세요.",
    "profile.overview.quickInfoTitle": "빠른 정보",
    "profile.overview.quickInfoDesc": "잔액, 총 주문, 계정 등급...",
    "profile.overview.table.labelItem": "항목",
    "profile.overview.table.labelValue": "값",
    "profile.overview.table.labelStatus": "상태",
    "profile.overview.table.balanceLabel": "사용 가능 잔액",
    "profile.overview.table.balanceStatus": "미충전",
    "profile.overview.table.ordersLabel": "총 주문",
    "profile.overview.table.ordersStatus": "완료",
    "profile.overview.quickLinks.title": "빠른 탐색",
    "profile.overview.quickLinks.profile": "프로필",
    "profile.overview.quickLinks.orders": "주문",
    "profile.overview.quickLinks.topups": "충전",
    "profile.overview.quickLinks.logins": "로그인 기록",
    "profile.overview.quickLinks.security": "보안 & 2FA",
    "profile.public.pageTitle": "프로필 | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "가입",
    "profile.public.badgeLabel": "칭호",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "??? ?? ??",
    "profile.public.copySuccess": "??? ??? ??????.",
    "profile.public.copyFail": "??? ??? ??? ? ????.",
    "profile.public.follow": "팔로우",
    "profile.public.following": "팔로잉",
    "profile.public.followersLabel": "팔로워",
    "profile.public.followingLabel": "팔로잉",
    "profile.public.stats.purchased": "구매",
    "profile.public.stats.sold": "판매",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "상점 보기",
    "profile.public.featured.title": "주요 게시물",
    "profile.public.featured.manage": "주요 게시물 편집",
    "profile.public.featured.note": "주요 게시물은 30일 후 자동 삭제됩니다.",
    "profile.public.featured.emptyTitle": "이 사용자는 아직 주요 게시물을 올리지 않았습니다.",
    "profile.public.featured.emptyDesc": "새 게시물은 30일 후 자동으로 숨겨집니다.",
    "profile.public.story.defaultTitle": "게시물 #{index}",
    "profile.public.story.type.video": "비디오",
    "profile.public.story.type.image": "이미지",
    "profile.public.story.titleFallback": "주요 게시물",
    "profile.public.story.alt": "스토리",
    "profile.public.manage.title": "프로필 관리",
    "profile.public.manage.titlePlaceholder": "게시물 제목",
    "profile.public.manage.upload": "업로드",
    "profile.public.manage.remove": "삭제",
    "profile.public.manage.help": "???? 9:16?? ??? ?? 2MB???. ??? ?? 60??? ???? ???? ? ????.",
    "profile.public.manage.close": "닫기",
    "profile.public.manage.save": "변경 저장",
    "profile.public.manage.slotLabel": "슬롯 {index}",
    "profile.public.manage.limit.pro": "최대 4개 게시물, 비디오 지원.",
    "profile.public.manage.limit.basic": "조건 미충족, 사진 1개만 가능.",
    "profile.public.toast.saveFail": "주요 게시물을 저장할 수 없습니다.",
    "profile.public.toast.loginRequired": "팔로우하려면 로그인하세요.",
    "profile.public.toast.imageOrVideoOnly": "이미지 또는 비디오만 지원합니다.",
    "profile.public.toast.notEligible": "비디오 또는 여러 게시물을 업로드할 수 없습니다.",
    "profile.public.toast.uploadFail": "업로드 실패.",
    "profile.public.toast.imageTooLarge": "???? 2MB? ?????.",
    "profile.public.toast.imageRatio": "이미지는 9:16 비율이어야 합니다.",
    "profile.public.toast.imageReadFail": "이미지를 읽을 수 없습니다.",
    "profile.public.toast.videoNotEligible": "비디오는 조건을 충족한 계정에서만 가능합니다.",
    "profile.public.toast.videoTooLarge": "비디오가 25MB를 초과합니다.",
    "profile.public.toast.videoRatio": "비디오는 9:16 비율이어야 합니다.",
    "profile.public.toast.videoDuration": "비디오가 60초를 초과합니다.",
    "profile.public.toast.videoReadFail": "비디오를 읽을 수 없습니다.",
    "profile.public.toast.coverReadFail": "커버 이미지를 읽을 수 없습니다.",
    "product.detail.pageTitle": "상품 상세 | polyflux.xyz",
    "breadcrumb.home": "홈",
    "breadcrumb.detail": "상세",
    "product.detail.share": "공유",
    "product.detail.share.copied": "복사됨",
    "product.detail.share.failed": "복사 실패",
    "product.detail.favorite": "찜",
    "product.detail.favorite.active": "찜됨",
    "product.detail.otherTitle": "이 상점의 다른 상품",
    "product.detail.other.empty": "다른 상품이 없습니다.",
    "product.detail.order": "주문하기",
    "product.detail.preorder": "예약 주문",
    "product.detail.message": "메시지",
    "product.detail.tab.shop": "상점 설명",
    "product.detail.tab.reviews": "리뷰",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "주문 확인",
    "product.detail.modal.quantity": "수량",
    "product.detail.modal.subtotal": "소계",
    "product.detail.modal.cancel": "취소",
    "product.detail.modal.confirm": "주문 확인",
    "product.detail.modal.processing": "처리 중...",
    "product.detail.modal.max": "최대 {max}",
    "product.detail.toast.success": "주문이 완료되었습니다. 내 주문에서 확인하세요.",
    "product.detail.toast.viewOrders": "주문 보기",
    "product.detail.toast.loginRequired": "주문하려면 로그인하세요.",
    "product.detail.toast.orderFailed": "주문 실패.",
    "product.detail.notFound": "상품을 찾을 수 없습니다",
    "product.detail.description.pending": "설명이 업데이트 중입니다.",
    "product.detail.rating.positive": "긍정적",
    "product.detail.rating.neutral": "보통",
    "product.detail.rating.negative": "개선 필요",
    "product.detail.rating.none": "평가 없음",
    "product.detail.shopIdLabel": "상점 ID",
    "product.detail.shop.polyflux.title": "PolyFlux 공식",
    "product.detail.shop.polyflux.bullet1": "빠른 배송, 전달 전 사전 확인.",
    "product.detail.shop.polyflux.bullet2": "해결 불가 시 환불.",
    "product.detail.shop.polyflux.bullet3": "Telegram 24/7 지원.",
    "product.detail.shop.partner.title": "파트너 마켓플레이스 #1",
    "product.detail.shop.partner.bullet1": "안정적인 재고, 몇 분 내 빠른 배송.",
    "product.detail.shop.partner.bullet2": "대량 주문에 최적가 제공.",
    "product.detail.shop.partner.bullet3": "공지된 정책에 따른 보증 지원.",
    "product.detail.shop.fallbackTitle": "신뢰할 수 있는 상점",
    "product.detail.shop.fallbackBullet1": "수령 즉시 상품 확인.",
    "product.detail.shop.fallbackBullet2": "문제 발생 시 지원.",
    "product.detail.review.1.text": "배송이 빠르고 계정이 잘 작동합니다.",
    "product.detail.review.1.time": "2시간 전",
    "product.detail.review.2.text": "지원이 빠르고 보증이 명확합니다.",
    "product.detail.review.2.time": "1일 전",
    "product.detail.review.3.text": "설명 그대로라 다시 구매할게요.",
    "product.detail.review.3.time": "3일 전",
    "product.detail.api.title": "배송 API",
    "product.detail.api.bullet1": "결제 후 자동으로 코드 전달.",
    "product.detail.api.bullet2": "REST/JSON 호환.",
    "product.detail.api.bullet3": "키 발급은 관리자에게 문의.",
    "service.detail.pageTitle": "서비스 상세 | polyflux.xyz",
    "service.detail.hero.loadingTitle": "서비스 로딩 중...",
    "service.detail.hero.loadingDesc": "서비스 설명이 여기에 표시됩니다.",
    "service.detail.info.title": "패키지 정보",
    "service.detail.info.desc": "/data/mock-services.json에서 읽어옵니다. API 연결 시 상세 설명이 제공됩니다.",
    "service.detail.form.title": "결제 후 요청 폼",
    "service.detail.form.desc": "결제 완료 후 고객이 이 폼을 작성하면 정확한 서비스 처리가 가능합니다.",
    "service.detail.form.emailLabel": "결과 수신 이메일",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "대상 링크",
    "service.detail.form.linkPlaceholder": "예: 게시물/프로필/영상 링크...",
    "service.detail.form.noteLabel": "상세 요청",
    "service.detail.form.notePlaceholder": "요구사항, 수량, 원하는 속도 등을 설명...",
    "service.detail.form.save": "요청 저장",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "이 폼은 어디에도 전송되지 않습니다. API 연결 후 이 데이터를 백엔드로 POST하세요.",
    "service.detail.notFound": "서비스를 찾을 수 없습니다",
    "service.detail.noData": "데이터가 없습니다. API 연결 또는 JSON 추가 시 표시됩니다.",
    "service.detail.fallback.summary": "서비스 상세 내용이 여기에 표시됩니다.",
    "service.detail.fallback.description": "서비스 상세 정보는 백엔드 API에서 반환되어 여기에 표시됩니다.",
    "task.detail.pageTitle": "작업 상세 | polyflux.xyz",
    "task.detail.hero.loadingTitle": "작업 로딩 중...",
    "task.detail.hero.loadingDesc": "작업 설명이 여기에 표시됩니다.",
    "task.detail.info.title": "작업 정보",
    "task.detail.info.desc": "데이터는 /data/mock-tasks.json에서 로드됩니다. API 연결 시 백엔드에서 가져옵니다.",
    "task.detail.report.title": "보고 제출",
    "task.detail.report.desc": "작업 완료 증빙을 제출하세요.",
    "task.detail.report.contactLabel": "이메일 / 사용자명",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "증빙 링크",
    "task.detail.report.proofPlaceholder": "예: 게시물 링크, 영상",
    "task.detail.report.noteLabel": "추가 메모",
    "task.detail.report.notePlaceholder": "완료한 작업을 간단히 설명...",
    "task.detail.report.submit": "보고 제출",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "API 연결 후 시스템이 보고서를 수신하고 자동 검토합니다.",
    "task.detail.notFound": "작업을 찾을 수 없습니다",
    "task.detail.noData": "데이터가 없습니다. 잠시 후 다시 시도하세요.",
    "task.detail.titleFallback": "작업",
    "task.detail.fallback.summary": "작업 상세 설명이 여기에 표시됩니다.",
    "task.detail.fallback.description": "API가 준비되면 작업 상세 정보가 업데이트됩니다.",
    "maintenance.title": "서버 점검",
    "maintenance.desc": "시스템 점검 중입니다. 불편을 드려 죄송합니다. 점검은 1시간을 넘기지 않을 예정입니다.",
    "cart.pageTitle": "장바구니 | polyflux.xyz",
    "cart.items.title": "장바구니 상품",
    "cart.empty.title": "장바구니가 비어 있습니다.",
    "cart.empty.desc": "API가 연결되면 선택한 상품이 여기에 표시됩니다.",
    "cart.summary.title": "주문 요약",
    "cart.summary.desc": "총액, 수수료, 할인 코드.",
    "cart.summary.couponLabel": "할인 코드",
    "cart.summary.couponPlaceholder": "코드 입력",
    "cart.summary.apply": "적용",
    "cart.summary.checkout": "결제 진행",
    "checkout.pageTitle": "결제 | polyflux.xyz",
    "checkout.buyer.title": "구매자 정보",
    "checkout.buyer.emailLabel": "주문 이메일",
    "checkout.buyer.platformLabel": "ID / 사용자명(선택)",
    "checkout.buyer.platformPlaceholder": "상품/서비스에 따라 다름",
    "checkout.note.title": "추가 메모",
    "checkout.note.label": "주문 메모",
    "checkout.note.placeholder": "예: .txt 파일 전달, 이메일로 전송...",
    "checkout.summary.title": "주문 요약",
    "checkout.summary.desc": "총액 및 결제 수단.",
    "checkout.summary.emptyTitle": "장바구니 데이터가 없습니다.",
    "checkout.summary.emptyDesc": "API 연결 후 항목과 합계가 여기에 표시됩니다.",
    "checkout.summary.success": "결제 성공",
    "checkout.summary.failed": "실패 시뮬레이션",
    "checkout.success.pageTitle": "결제 성공 | polyflux.xyz",
    "checkout.success.title": "결제 성공",
    "checkout.success.desc": "주문이 기록되었습니다. API 연결 후 주문 상세와 다운로드 버튼이 표시됩니다.",
    "checkout.success.orders": "내 주문 보기",
    "checkout.success.continue": "계속 쇼핑하기",
    "checkout.failed.pageTitle": "결제 실패 | polyflux.xyz",
    "checkout.failed.title": "결제 실패",
    "checkout.failed.desc": "결제를 취소했거나 결제 게이트웨이 오류일 수 있습니다. API 연결 후 상세 오류 코드가 표시됩니다.",
    "checkout.failed.retry": "다시 결제하기",
    "checkout.failed.backProducts": "상품으로 돌아가기",
    "profile.orders.pageTitle": "주문 | polyflux.xyz",
    "profile.orders.title": "내 주문",
    "profile.orders.subtitle": "주문 상태와 거래 내역을 확인하세요.",
    "profile.orders.history.title": "주문 내역",
    "profile.orders.table.orderId": "주문 번호",
    "profile.orders.table.product": "상품",
    "profile.orders.table.total": "총액",
    "profile.orders.table.status": "상태",
    "profile.orders.status.completed": "완료",
    "profile.orders.status.processing": "처리 중",
    "profile.orders.status.cancelled": "취소됨",
    "profile.orders.sample.email": "이메일 1",
    "profile.orders.sample.vip": "VIP 계정",
    "profile.orders.sample.interaction": "인터랙션 패키지 3",
    "profile.history.pageTitle": "계정 내역 | polyflux.xyz",
    "profile.history.title": "계정 내역",
    "profile.history.subtitle": "최근 충전, 인출 및 구매 내역을 확인하세요.",
    "profile.history.sectionTitle": "최근 활동",
    "profile.history.table.date": "날짜",
    "profile.history.table.type": "유형",
    "profile.history.table.amount": "금액",
    "profile.history.table.status": "상태",
    "profile.history.type.topup": "충전",
    "profile.history.type.withdraw": "인출",
    "profile.history.type.order": "주문",
    "profile.history.status.success": "성공",
    "profile.history.status.processing": "처리 중",
    "profile.history.status.completed": "완료",
    "profile.tasks.pageTitle": "수락한 작업 | polyflux.xyz",
    "profile.tasks.title": "수락한 작업",
    "profile.tasks.subtitle": "수락한 작업을 확인하세요.",
    "profile.tasks.sectionTitle": "수락한 작업 목록",
    "profile.tasks.table.task": "작업",
    "profile.tasks.table.receivedAt": "수락일",
    "profile.tasks.table.deadline": "마감일",
    "profile.tasks.table.reward": "보상",
    "profile.tasks.table.status": "상태",
    "profile.tasks.emptyTitle": "수락한 작업이 없습니다.",
    "profile.tasks.emptyDesc": "새 작업을 수락하면 여기에 표시됩니다.",
    "profile.topups.pageTitle": "충전 | polyflux.xyz",
    "profile.topups.title": "계정 충전",
    "profile.topups.subtitle": "충전 금액을 입력하세요: 최소 10,000đ, 최대 499,000,000đ. 각 충전에 대해 QR이 생성됩니다.",
    "profile.topups.guard.title": "로그인 필요:",
    "profile.topups.guard.desc": "지갑에 충전하려면 로그인해야 합니다.",
    "profile.topups.bank.title": "은행 충전 (QR)",
    "profile.topups.bank.desc": "은행 앱으로 QR을 스캔하세요. 이체 후 자동으로 잔액이 충전됩니다.",
    "profile.topups.bank.qrPlaceholder": "QR은 생성 후 표시됩니다.",
    "profile.topups.bank.codeLabel": "예금주명",
    "profile.topups.bank.amountLabel": "금액",
    "profile.topups.bank.amountInputLabel": "충전 금액 (VND)",
    "profile.topups.bank.amountPlaceholder": "예: 100000",
    "profile.topups.bank.amountHint": "최소 10,000đ, 최대 499,000,000đ.",
    "profile.topups.bank.generate": "QR 생성",
    "profile.topups.bank.toast.invalidAmount": "유효한 금액을 입력하세요.",
    "profile.topups.bank.toast.range": "금액은 {min} ~ {max} đ 사이여야 합니다.",
    "profile.topups.bank.toast.created": "QR이 생성되었습니다. 스캔하여 충전하세요.",
    "profile.topups.bank.toast.failed": "지금은 QR을 생성할 수 없습니다.",
    "profile.topups.crypto.notice": "암호화폐 충전은 일시적으로 사용할 수 없습니다. 은행을 이용하세요.",
    "profile.topups.crypto.title": "암호화폐 충전 (USDT TRC20)",
    "profile.topups.crypto.desc": "USDT TRC20으로 충전합니다. 온체인 확인 후 잔액이 추가됩니다.",
    "profile.topups.crypto.addressLabel": "TRC20 지갑 주소",
    "profile.topups.crypto.amountLabel": "USDT 수량",
    "profile.topups.crypto.amountPlaceholder": "예: 10",
    "profile.topups.crypto.confirm": "이체 완료",
    "profile.topups.withdraw.title": "출금",
    "profile.topups.withdraw.desc": "현재 잔액에 따라 출금 금액을 입력하세요. 최소 50,000đ, 최대 499,000,000đ.",
    "profile.topups.withdraw.balanceLabel": "사용 가능 잔액:",
    "profile.topups.withdraw.amountLabel": "출금 금액 (VND)",
    "profile.topups.withdraw.amountPlaceholder": "예: 500000",
    "profile.topups.withdraw.amountHint": "최소 50,000đ, 최대 499,000,000đ.",
    "profile.topups.withdraw.bankLabel": "은행",
    "profile.topups.withdraw.bankPlaceholder": "예: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "계좌 번호",
    "profile.topups.withdraw.accountPlaceholder": "계좌 번호 입력",
    "profile.topups.withdraw.nameLabel": "예금주명",
    "profile.topups.withdraw.namePlaceholder": "예금주 성명",
    "profile.topups.withdraw.submit": "출금 요청 제출",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "요청은 이체 전에 관리자 승인을 거칩니다.",
    "profile.topups.history.topup.title": "최근 충전 내역",
    "profile.topups.history.withdraw.title": "출금 내역",
    "profile.topups.history.table.date": "일시",
    "profile.topups.history.table.amount": "금액",
    "profile.topups.history.table.bank": "은행",
    "profile.topups.history.table.status": "상태",
    "profile.topups.status.pending": "검토 중",
    "profile.topups.status.completed": "처리 완료",
    "profile.topups.status.rejected": "거절",
    "profile.security.pageTitle": "보안 & 2FA | polyflux.xyz",
    "profile.security.title": "보안 & 2FA",
    "profile.security.subtitle": "계정 보안을 강화하고 접근을 제어하세요.",
    "profile.security.password.title": "비밀번호 변경",
    "profile.security.password.desc": "정기적으로 비밀번호를 변경하여 계정을 더 안전하게 보호하세요.",
    "profile.security.password.currentLabel": "현재 비밀번호",
    "profile.security.password.currentPlaceholder": "현재 비밀번호 입력",
    "profile.security.password.newLabel": "새 비밀번호",
    "profile.security.password.newPlaceholder": "최소 8자",
    "profile.security.password.confirmLabel": "새 비밀번호 확인",
    "profile.security.password.confirmPlaceholder": "새 비밀번호 다시 입력",
    "profile.security.password.submit": "비밀번호 변경",
    "profile.security.2fa.title": "2단계 인증 (2FA)",
    "profile.security.2fa.desc": "로그인 시 인증 코드를 요구하도록 2FA를 활성화하세요.",
    "profile.security.2fa.recoveryLabel": "복구 코드",
    "profile.security.2fa.deviceLabel": "신뢰 기기",
    "profile.security.2fa.deviceNone": "추가된 기기가 없습니다.",
    "profile.security.2fa.enable": "2FA 활성화",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "API 연결 후 2FA 설정과 기기 목록을 저장합니다.",
    "profile.favorites.pageTitle": "즐겨찾기 | polyflux.xyz",
    "profile.favorites.title": "즐겨찾기",
    "profile.favorites.subtitle": "저장한 상품과 서비스를 확인하세요.",
    "profile.favorites.listTitle": "즐겨찾기 목록",
    "profile.favorites.emptyTitle": "데이터가 없습니다.",
    "profile.favorites.emptyDesc": "상품을 저장하면 나중에 다시 볼 수 있습니다.",
    "profile.notifications.pageTitle": "알림 | polyflux.xyz",
    "profile.notifications.title": "알림",
    "profile.notifications.subtitle": "주문 및 시스템 업데이트가 여기에 표시됩니다.",
    "profile.notifications.listTitle": "새 알림",
    "profile.notifications.emptyTitle": "알림이 없습니다.",
    "profile.notifications.emptyDesc": "나중에 다시 확인하세요.",
    "profile.badges.pageTitle": "배지 | polyflux.xyz",
    "profile.badges.title": "배지",
    "profile.badges.subtitle": "레벨과 성과를 확인하세요.",
    "profile.badges.listTitle": "획득한 배지",
    "profile.badges.emptyTitle": "아직 배지가 없습니다.",
    "profile.badges.emptyDesc": "작업을 완료해 잠금 해제하세요.",
    "profile.messages.pageTitle": "메시지 | polyflux.xyz",
    "profile.messages.inboxTitle": "받은편지함",
    "profile.messages.inboxCount": "대화 1개",
    "profile.messages.searchPlaceholder": "검색...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "공식 지원",
    "profile.messages.thread.empty": "다른 대화가 없습니다.",
    "profile.messages.back": "뒤로",
    "profile.messages.user.sub": "관리자 지원",
    "profile.messages.role.admin": "관리자",
    "profile.messages.day.today": "오늘",
    "profile.messages.message.1": "안녕하세요, 무엇을 도와드릴까요?",
    "profile.messages.message.2": "주문 # 정보를 문의하고 싶습니다.",
    "profile.messages.message.3": "확인 중입니다. 잠시만 기다려 주세요.",
    "profile.messages.message.4": "감사합니다.",
    "profile.messages.emojiLabel": "이모지",
    "profile.messages.attachLabel": "첨부",
    "profile.messages.inputPlaceholder": "메시지 입력...",
    "profile.messages.send": "보내기",
    "product.data.gmail-random.name": "Gmail 랜덤 이름",
    "product.data.gmail-random.short": "Gmail 랜덤 전체 권한, 7일 보증.",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "여러 혜택을 활성화하는 Gmail EDU 계정.",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "KYC 완료된 미국 계정, 다양한 서비스에 사용.",
    "product.data.tool-checker.name": "리소스 체커 도구",
    "product.data.tool-checker.short": "라이브/데드 리소스를 빠르게 확인하는 로컬 도구.",
    "service.data.fb-boost.name": "Facebook 참여 증대 서비스",
    "service.data.fb-boost.short": "자연스러운 좋아요/댓글/공유 증가, 7일 보증.",
    "service.data.tiktok-view.name": "TikTok 조회수 증가",
    "service.data.tiktok-view.short": "새 영상용 TikTok 조회수 패키지, 콘텐츠 테스트에 적합.",
    "task.data.review-product.title": "포럼에 상품 리뷰 작성",
    "task.data.review-product.short": "polyflux.xyz 구매 경험과 상세 리뷰 작성.",
    "task.data.tiktok-video.title": "샵 소개 TikTok 영상 제작",
    "task.data.tiktok-video.short": "서비스 리뷰 짧은 영상 촬영, 요구 해시태그 포함.",
  },
  ja: {
    "landing.hero.subtitle": "信頼できる高速な取引プラットフォームです。",
    "landing.hero.buy": "今すぐ購入",
    "landing.hero.explore": "もっと見る",
    "landing.pill.email": "メール",
    "landing.pill.account": "アカウント",
    "landing.pill.software": "ソフトウェア",
    "landing.pill.interaction": "エンゲージメントサービス",
    "landing.pill.tools": "ツール",
    "landing.pill.other": "その他",
    "landing.faq.title": "よくある質問",
    "landing.faq.subtitle": "polyflux.xyz に関するよくある質問の回答を確認できます",
    "landing.faq.q1": "注文を確認するには？",
    "landing.faq.a1": "購入した商品は購入履歴に表示されます。",
    "landing.faq.q2": "詐欺ですか？",
    "landing.faq.a2": "認証済み決済、公開レビュー、返金ポリシーで安全を守ります。",
    "landing.faq.q3": "質問があります。どうやって連絡すればいいですか？",
    "landing.faq.a3": "Telegramで管理者に連絡してください。",
    "landing.payments.title": "20種類以上の支払い方法",
    "landing.payments.subtitle": "スピーディーで安全な決済のため、多様な支払い方法に対応しています。",
    "landing.trusted.title": "最も信頼されるマーケット。",
    "landing.trusted.subtitle": "お客様が選ぶ理由をご覧ください",
    "landing.stats.orders": "総注文数",
    "landing.stats.vouches": "検証済みレビュー",
    "landing.stats.instantValue": "即時",
    "landing.stats.deliveryLabel": "すべて即時配達",
    "landing.products.emptyTitle": "商品が見つかりません",
    "landing.products.emptyDesc": "検索やカテゴリのフィルターを調整してみてください。",
    "landing.products.instant": "即時配送と安全な決済。",
    "landing.products.add": "追加",
    "landing.product.email": "メール {index}",
    "landing.product.account": "アカウント {tier}",
    "landing.product.software": "ソフトウェア {tier}",
    "landing.product.interaction": "インタラクションパッケージ {index}",
    "landing.product.other": "その他アイテム {index}",
    "landing.tier.basic": "ベーシック",
    "landing.tier.pro": "プロ",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "ライト",
    "landing.tier.plus": "プラス",
    "support.label": "サポート",
    "support.close": "閉じる",
    "support.header.title": "PolyFlux サポート",
    "support.header.status": "オンライン",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "管理者とチャット",
    "support.faq.title": "FAQ - よくある質問",
    "support.faq.buyer.title": "I. 購入者",
    "support.faq.buyer.q1": "商品はどう購入しますか？",
    "support.faq.buyer.a1.1": "購入者は暗号資産または銀行振込で支払えます。",
    "support.faq.buyer.a1.2": "暗号資産: 指定された個人ウォレットに入金し、オンチェーン取引の確認後に残高が自動更新されます。",
    "support.faq.buyer.a1.3": "銀行: 提供された情報に従って振込し、決済確認後にシステムが照合して残高を更新します。",
    "support.faq.buyer.q2": "メール/アカウントの重複なしとは？",
    "support.faq.buyer.a2": "重複チェックとZero Duplicateバッジにより、以前に販売されていない商品であることを保証します。",
    "support.faq.buyer.q3": "チャージするには？",
    "support.faq.buyer.a3.1": "暗号資産: チャージを選択 -> コインを選択 -> 個人ウォレットへ送金。USDT、USDC、BTC、ETH、BNB、TRXなどに対応。",
    "support.faq.buyer.a3.2": "銀行: チャージ -> 銀行振込 -> 正しい入金内容/取引コードで送金すると自動確認されます。",
    "support.faq.buyer.q4": "返金を依頼できますか？",
    "support.faq.buyer.a4": "はい。各注文には3日間のエスクロー期間があり、問題があれば異議申立てや紛争を開始できます。",
    "support.faq.buyer.q5": "入金がまだ届きません",
    "support.faq.buyer.a5.1": "暗号資産: チェーン/トークンの誤りやネットワーク混雑の可能性があります。数分経っても更新されない場合はTXIDを送ってください。",
    "support.faq.buyer.a5.2": "銀行: 営業時間外の送金、記載内容の誤り、照合待ちの可能性があります。取引証明の画像を添えてサポートに連絡してください。",
    "support.faq.buyer.q6": "誤送金した場合は？",
    "support.faq.buyer.a6.1": "暗号資産: ブロックチェーン取引は取り消せず、誤ったチェーン/アドレスへの送金は永久に失われる可能性があります。",
    "support.faq.buyer.a6.2": "銀行: システムは照合確認のみを支援し、誤った送金の返金は保証されません。",
    "support.faq.buyer.q7": "仲介は必要ですか？",
    "support.faq.buyer.a7": "いいえ。システムは統合エスクローとして動作し、3日間保留した後に販売者へ支払います。",
    "support.faq.seller.title": "II. 販売者",
    "support.faq.seller.q1": "販売者登録はどう行いますか？",
    "support.faq.seller.a1": "ログイン -> Seller登録 -> 必要情報入力 -> 承認待ち。",
    "support.faq.seller.q2": "ショップを作成するには？",
    "support.faq.seller.a2": "ショップ管理 -> 新規作成 -> 商品説明、画像、ファイルをアップロード。",
    "support.faq.seller.q3": "ショップ最適化の方法は？",
    "support.faq.seller.a3": "高品質の画像、明確なタイトル、詳細な説明、安定した商品、迅速なサポートを提供してください。ランキングは毎週更新されます。",
    "support.faq.seller.q4": "上位表示には？",
    "support.faq.seller.a4": "売上、顧客評価、信頼度、紛争率により決まります。",
    "support.faq.seller.q5": "収益はどう処理されますか？",
    "support.faq.seller.a5.1": "注文完了後、資金は3日間（エスクロー）保留されます。その後、販売者は以下で出金できます：",
    "support.faq.seller.a5.list1": "暗号資産: USDT, BTC, ETH, BNB, TRX など。",
    "support.faq.seller.a5.list2": "銀行振込（確認済みの口座情報）。",
    "support.faq.seller.q6": "手数料はどう計算されますか？",
    "support.faq.seller.a6": "プラットフォームは成功した注文ごとに5%の取引手数料を適用します。販売者はリセラーモードを有効にして売上を伸ばせます。",
    "support.faq.seller.q7": "出金方法は？",
    "support.faq.seller.a7": "出金を選択 -> 暗号資産または銀行を選択 -> 情報入力 -> 確認。",
    "support.faq.seller.q8": "販売者の税務義務はどう扱われますか？",
    "support.faq.seller.a8.1": "プラットフォームは取引インフラを提供する仲介役に過ぎません。",
    "support.faq.seller.a8.2": "販売者はベトナム法に基づき、自身の収入に関する税務申告と納税を行う責任があります。",
    "support.faq.seller.a8.3": "プラットフォームは源泉徴収や代理申告、代行納付を行いません。",
    "support.faq.seller.q9": "禁止されている商品は？",
    "support.faq.seller.a9": "ハッキングされたアカウント、不正データ、銀行口座、悪用ツール、またはベトナム法や第三者の規約に違反するコンテンツ。",
    "support.faq.seller.q10": "ユーザー取引は管理者と関係がありますか？",
    "support.faq.seller.a10.1": "ユーザーが出品またはタスクを掲載する商品はユーザー間の取引であり、管理者とは無関係です。",
    "support.faq.seller.a10.2": "管理者は違法商品の売買を行いません。違法取引や故意の違反があった場合、管理者は掲載の削除や残高の凍結を行う権限があります。本プラットフォームで販売に参加することは、規約を読み同意したものとみなされます。",
    "support.faq.seller.q11": "API連携？",
    "support.faq.seller.a11": "はい。販売者はAPIを連携して自動配送や在庫同期ができます。",
    "support.faq.seller.q12": "保証対応はどう行いますか？",
    "support.faq.seller.a12": "販売済み注文 -> 保証 -> 数量入力 -> システムが代替コードを自動送信します。",
    "support.faq.reseller.title": "III. リセラー",
    "support.faq.reseller.q1": "リセラーになるには？",
    "support.faq.reseller.a1": "アカウント設定でリセラーモードを有効にしてください。",
    "support.faq.reseller.q2": "リセラーとして販売するには？",
    "support.faq.reseller.a2": "対象商品を選択 -> 紹介リンクを取得 -> 共有 -> システムが手数料を自動記録します。",
    "support.faq.reseller.q3": "手数料の出金は？",
    "support.faq.reseller.a3": "手数料は3日間（エスクロー）保留された後、暗号資産または銀行で出金できます。",
    "support.faq.reseller.q4": "月間ボーナス？",
    "support.faq.reseller.a4": "はい。プラットフォームは月間実績に基づくボーナス制度を実施しています。",
    "support.faq.compliance.title": "IV. ベトナム法令遵守 - AML・不正",
    "support.faq.compliance.q1": "マネーロンダリング対策（AML）",
    "support.faq.compliance.a1.lead": "厳禁:",
    "support.faq.compliance.a1.list1": "違法資産の流通",
    "support.faq.compliance.a1.list2": "資金源の隠蔽",
    "support.faq.compliance.a1.list3": "マネーロンダリングの疑いがある取引",
    "support.faq.compliance.a1.note": "プラットフォームは必要に応じて資金の保留、アカウントの凍結、本人確認の要求、関係当局との協力を行うことがあります。",
    "support.faq.compliance.q2": "不正防止",
    "support.faq.compliance.a2.lead": "厳禁:",
    "support.faq.compliance.a2.list1": "偽の注文",
    "support.faq.compliance.a2.list2": "紛争の乱用",
    "support.faq.compliance.a2.list3": "複数アカウント",
    "support.faq.compliance.a2.list4": "ボット、ハック、システム脆弱性の悪用",
    "support.faq.compliance.q3": "ベトナム法令遵守",
    "support.faq.compliance.a3": "ユーザーは違法商品の売買やプライバシー・個人データの侵害をしてはなりません。",
    "profile.overview.pageTitle": "アカウント概要 | polyflux.xyz",
    "profile.overview.title": "アカウント概要",
    "profile.overview.subtitle": "残高、注文、セキュリティを一か所で確認できます。",
    "profile.overview.quickInfoTitle": "クイック情報",
    "profile.overview.quickInfoDesc": "残高、総注文数、アカウント等級...",
    "profile.overview.table.labelItem": "項目",
    "profile.overview.table.labelValue": "値",
    "profile.overview.table.labelStatus": "状態",
    "profile.overview.table.balanceLabel": "利用可能残高",
    "profile.overview.table.balanceStatus": "未入金",
    "profile.overview.table.ordersLabel": "合計注文",
    "profile.overview.table.ordersStatus": "完了",
    "profile.overview.quickLinks.title": "クイックナビ",
    "profile.overview.quickLinks.profile": "プロフィール",
    "profile.overview.quickLinks.orders": "注文",
    "profile.overview.quickLinks.topups": "チャージ",
    "profile.overview.quickLinks.logins": "ログイン履歴",
    "profile.overview.quickLinks.security": "セキュリティ & 2FA",
    "profile.public.pageTitle": "プロフィール | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "参加",
    "profile.public.badgeLabel": "称号",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "?????????????",
    "profile.public.copySuccess": "??????????????????",
    "profile.public.copyFail": "???????????????????",
    "profile.public.follow": "フォロー",
    "profile.public.following": "フォロー中",
    "profile.public.followersLabel": "フォロワー",
    "profile.public.followingLabel": "フォロー中",
    "profile.public.stats.purchased": "購入済み",
    "profile.public.stats.sold": "販売済み",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "ショップを見る",
    "profile.public.featured.title": "注目投稿",
    "profile.public.featured.manage": "注目投稿を編集",
    "profile.public.featured.note": "注目投稿は30日後に自動削除されます。",
    "profile.public.featured.emptyTitle": "このユーザーはまだ注目投稿をしていません。",
    "profile.public.featured.emptyDesc": "新しい投稿は30日後に自動で非表示になります。",
    "profile.public.story.defaultTitle": "投稿 #{index}",
    "profile.public.story.type.video": "動画",
    "profile.public.story.type.image": "画像",
    "profile.public.story.titleFallback": "注目投稿",
    "profile.public.story.alt": "ストーリー",
    "profile.public.manage.title": "プロフィール管理",
    "profile.public.manage.titlePlaceholder": "投稿タイトル",
    "profile.public.manage.upload": "アップロード",
    "profile.public.manage.remove": "削除",
    "profile.public.manage.help": "???9:16???????????2MB????????60??????????????????",
    "profile.public.manage.close": "閉じる",
    "profile.public.manage.save": "変更を保存",
    "profile.public.manage.slotLabel": "スロット {index}",
    "profile.public.manage.limit.pro": "最大4件、動画対応。",
    "profile.public.manage.limit.basic": "条件未達のため、写真1枚のみ。",
    "profile.public.toast.saveFail": "注目投稿を保存できません。",
    "profile.public.toast.loginRequired": "フォローするにはログインしてください。",
    "profile.public.toast.imageOrVideoOnly": "画像または動画のみ対応しています。",
    "profile.public.toast.notEligible": "動画や複数投稿をアップロードできません。",
    "profile.public.toast.uploadFail": "アップロードに失敗しました。",
    "profile.public.toast.imageTooLarge": "???2MB????????",
    "profile.public.toast.imageRatio": "画像は9:16比率が必要です。",
    "profile.public.toast.imageReadFail": "画像を読み取れません。",
    "profile.public.toast.videoNotEligible": "動画は条件を満たしたアカウントのみ利用できます。",
    "profile.public.toast.videoTooLarge": "動画が25MBを超えています。",
    "profile.public.toast.videoRatio": "動画は9:16比率が必要です。",
    "profile.public.toast.videoDuration": "動画が60秒を超えています。",
    "profile.public.toast.videoReadFail": "動画を読み取れません。",
    "profile.public.toast.coverReadFail": "カバー画像を読み取れません。",
    "product.detail.pageTitle": "商品詳細 | polyflux.xyz",
    "breadcrumb.home": "ホーム",
    "breadcrumb.detail": "詳細",
    "product.detail.share": "共有",
    "product.detail.share.copied": "コピーしました",
    "product.detail.share.failed": "コピーできませんでした",
    "product.detail.favorite": "お気に入り",
    "product.detail.favorite.active": "お気に入り済み",
    "product.detail.otherTitle": "同じショップの他の商品",
    "product.detail.other.empty": "他の商品はありません。",
    "product.detail.order": "注文する",
    "product.detail.preorder": "予約注文",
    "product.detail.message": "メッセージ",
    "product.detail.tab.shop": "ショップ説明",
    "product.detail.tab.reviews": "レビュー",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "注文確認",
    "product.detail.modal.quantity": "数量",
    "product.detail.modal.subtotal": "小計",
    "product.detail.modal.cancel": "キャンセル",
    "product.detail.modal.confirm": "注文確定",
    "product.detail.modal.processing": "処理中...",
    "product.detail.modal.max": "最大 {max}",
    "product.detail.toast.success": "注文が完了しました。注文履歴で確認してください。",
    "product.detail.toast.viewOrders": "注文を見る",
    "product.detail.toast.loginRequired": "注文するにはログインしてください。",
    "product.detail.toast.orderFailed": "注文に失敗しました。",
    "product.detail.notFound": "商品が見つかりません",
    "product.detail.description.pending": "説明を更新中です。",
    "product.detail.rating.positive": "良い",
    "product.detail.rating.neutral": "普通",
    "product.detail.rating.negative": "改善が必要",
    "product.detail.rating.none": "評価なし",
    "product.detail.shopIdLabel": "ショップID",
    "product.detail.shop.polyflux.title": "PolyFlux公式",
    "product.detail.shop.polyflux.bullet1": "迅速配送、引き渡し前に確認。",
    "product.detail.shop.polyflux.bullet2": "解決できない場合は返金。",
    "product.detail.shop.polyflux.bullet3": "Telegramで24/7サポート。",
    "product.detail.shop.partner.title": "パートナーマーケット #1",
    "product.detail.shop.partner.bullet1": "安定した在庫、数分で配送。",
    "product.detail.shop.partner.bullet2": "大量注文に最適価格。",
    "product.detail.shop.partner.bullet3": "掲載ポリシーに沿った保証対応。",
    "product.detail.shop.fallbackTitle": "信頼できるショップ",
    "product.detail.shop.fallbackBullet1": "受取後すぐに商品を確認。",
    "product.detail.shop.fallbackBullet2": "問題があればサポート。",
    "product.detail.review.1.text": "配送が早く、アカウントも問題なし。",
    "product.detail.review.1.time": "2時間前",
    "product.detail.review.2.text": "サポートが早く、保証も明確。",
    "product.detail.review.2.time": "1日前",
    "product.detail.review.3.text": "説明通りで、また購入します。",
    "product.detail.review.3.time": "3日前",
    "product.detail.api.title": "配送API",
    "product.detail.api.bullet1": "決済後にコードを自動送信。",
    "product.detail.api.bullet2": "REST/JSON対応。",
    "product.detail.api.bullet3": "キー取得は管理者へ連絡。",
    "service.detail.pageTitle": "サービス詳細 | polyflux.xyz",
    "service.detail.hero.loadingTitle": "サービスを読み込み中...",
    "service.detail.hero.loadingDesc": "サービス説明がここに表示されます。",
    "service.detail.info.title": "パッケージ情報",
    "service.detail.info.desc": "/data/mock-services.json から読み込み。API接続後、詳細説明が返されます。",
    "service.detail.form.title": "決済後のリクエストフォーム",
    "service.detail.form.desc": "決済後、顧客がこのフォームを入力すると正確に対応できます。",
    "service.detail.form.emailLabel": "結果受取メール",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "対象リンク",
    "service.detail.form.linkPlaceholder": "例: 投稿/プロフィール/動画リンク...",
    "service.detail.form.noteLabel": "詳細リクエスト",
    "service.detail.form.notePlaceholder": "要件、数量、希望速度などを記載...",
    "service.detail.form.save": "リクエスト保存",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "このフォームは送信されません。API接続後にバックエンドへPOSTしてください。",
    "service.detail.notFound": "サービスが見つかりません",
    "service.detail.noData": "データがありません。API接続またはJSON追加後に表示されます。",
    "service.detail.fallback.summary": "サービスの詳細はここに表示されます。",
    "service.detail.fallback.description": "詳細情報はバックエンドAPIから返され、ここに表示されます。",
    "task.detail.pageTitle": "タスク詳細 | polyflux.xyz",
    "task.detail.hero.loadingTitle": "タスク読み込み中...",
    "task.detail.hero.loadingDesc": "タスク説明がここに表示されます。",
    "task.detail.info.title": "タスク情報",
    "task.detail.info.desc": "/data/mock-tasks.json から読み込み。API接続後にバックエンドから取得します。",
    "task.detail.report.title": "報告を提出",
    "task.detail.report.desc": "タスク完了の証拠を提出。",
    "task.detail.report.contactLabel": "メール / ユーザー名",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "証拠リンク",
    "task.detail.report.proofPlaceholder": "例: 投稿リンク、動画",
    "task.detail.report.noteLabel": "追加メモ",
    "task.detail.report.notePlaceholder": "実施した内容を簡潔に...",
    "task.detail.report.submit": "報告を送信",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "API接続後、システムが報告を受け取り自動審査します。",
    "task.detail.notFound": "タスクが見つかりません",
    "task.detail.noData": "データがありません。後で再試行してください。",
    "task.detail.titleFallback": "タスク",
    "task.detail.fallback.summary": "タスクの詳細はここに表示されます。",
    "task.detail.fallback.description": "API利用可能後にタスク詳細が更新されます。",
    "maintenance.title": "サーバーメンテナンス",
    "maintenance.desc": "システムメンテナンス中です。ご不便をおかけして申し訳ありません。1時間以内に終了する予定です。",
    "cart.pageTitle": "カート | polyflux.xyz",
    "cart.items.title": "カート内の商品",
    "cart.empty.title": "カートは空です。",
    "cart.empty.desc": "API接続後、選択した商品がここに表示されます。",
    "cart.summary.title": "注文サマリー",
    "cart.summary.desc": "合計、手数料、割引コード。",
    "cart.summary.couponLabel": "割引コード",
    "cart.summary.couponPlaceholder": "コードを入力",
    "cart.summary.apply": "適用",
    "cart.summary.checkout": "決済に進む",
    "checkout.pageTitle": "決済 | polyflux.xyz",
    "checkout.buyer.title": "購入者情報",
    "checkout.buyer.emailLabel": "受取メール",
    "checkout.buyer.platformLabel": "ID / ユーザー名（任意）",
    "checkout.buyer.platformPlaceholder": "商品/サービスによって異なります",
    "checkout.note.title": "追加メモ",
    "checkout.note.label": "注文メモ",
    "checkout.note.placeholder": "例：.txtファイルを納品、メールで送信...",
    "checkout.summary.title": "注文サマリー",
    "checkout.summary.desc": "合計 & 支払い方法。",
    "checkout.summary.emptyTitle": "カートデータがありません。",
    "checkout.summary.emptyDesc": "API接続後、アイテムと合計が表示されます。",
    "checkout.summary.success": "決済成功",
    "checkout.summary.failed": "失敗をシミュレーション",
    "checkout.success.pageTitle": "決済成功 | polyflux.xyz",
    "checkout.success.title": "決済成功",
    "checkout.success.desc": "注文が記録されました。API接続後、詳細とダウンロードボタンが表示されます。",
    "checkout.success.orders": "自分の注文を見る",
    "checkout.success.continue": "買い物を続ける",
    "checkout.failed.pageTitle": "決済失敗 | polyflux.xyz",
    "checkout.failed.title": "決済失敗",
    "checkout.failed.desc": "決済をキャンセルしたか、ゲートウェイがエラーを返した可能性があります。API接続後、詳細なエラーコードが表示されます。",
    "checkout.failed.retry": "再試行する",
    "checkout.failed.backProducts": "商品に戻る",
    "profile.orders.pageTitle": "注文 | polyflux.xyz",
    "profile.orders.title": "私の注文",
    "profile.orders.subtitle": "注文の状態と取引履歴を確認できます。",
    "profile.orders.history.title": "注文履歴",
    "profile.orders.table.orderId": "注文番号",
    "profile.orders.table.product": "商品",
    "profile.orders.table.total": "合計",
    "profile.orders.table.status": "状態",
    "profile.orders.status.completed": "完了",
    "profile.orders.status.processing": "処理中",
    "profile.orders.status.cancelled": "キャンセル済み",
    "profile.orders.sample.email": "メール 1",
    "profile.orders.sample.vip": "VIPアカウント",
    "profile.orders.sample.interaction": "インタラクションパック 3",
    "profile.history.pageTitle": "アカウント履歴 | polyflux.xyz",
    "profile.history.title": "アカウント履歴",
    "profile.history.subtitle": "最近の取引履歴を確認できます。",
    "profile.history.sectionTitle": "最近のアクティビティ",
    "profile.history.table.date": "日付",
    "profile.history.table.type": "種類",
    "profile.history.table.amount": "金額",
    "profile.history.table.status": "状態",
    "profile.history.type.topup": "チャージ",
    "profile.history.type.withdraw": "出金",
    "profile.history.type.order": "注文",
    "profile.history.status.success": "成功",
    "profile.history.status.processing": "処理中",
    "profile.history.status.completed": "完了",
    "profile.tasks.pageTitle": "受けたタスク | polyflux.xyz",
    "profile.tasks.title": "受けたタスク",
    "profile.tasks.subtitle": "受けたタスクを確認できます。",
    "profile.tasks.sectionTitle": "受けたタスク一覧",
    "profile.tasks.table.task": "タスク",
    "profile.tasks.table.receivedAt": "受取日",
    "profile.tasks.table.deadline": "期限",
    "profile.tasks.table.reward": "報酬",
    "profile.tasks.table.status": "状態",
    "profile.tasks.emptyTitle": "受けたタスクはありません。",
    "profile.tasks.emptyDesc": "新しいタスクを受けると、ここに表示されます。",
    "profile.topups.pageTitle": "チャージ | polyflux.xyz",
    "profile.topups.title": "アカウントにチャージ",
    "profile.topups.subtitle": "チャージ金額を入力してください。最小10,000đ、最大499,000,000đ。各チャージでQRが生成されます。",
    "profile.topups.guard.title": "ログインが必要:",
    "profile.topups.guard.desc": "ウォレットにチャージするにはログインが必要です。",
    "profile.topups.bank.title": "銀行チャージ（QR）",
    "profile.topups.bank.desc": "銀行アプリでQRをスキャンしてください。送金後、自動的に反映されます。",
    "profile.topups.bank.qrPlaceholder": "生成後にQRが表示されます。",
    "profile.topups.bank.codeLabel": "口座名義",
    "profile.topups.bank.amountLabel": "金額",
    "profile.topups.bank.amountInputLabel": "チャージ金額 (VND)",
    "profile.topups.bank.amountPlaceholder": "例: 100000",
    "profile.topups.bank.amountHint": "最小10,000đ、最大499,000,000đ。",
    "profile.topups.bank.generate": "QR生成",
    "profile.topups.bank.toast.invalidAmount": "有効な金額を入力してください。",
    "profile.topups.bank.toast.range": "金額は {min} 〜 {max} đ の間です。",
    "profile.topups.bank.toast.created": "QRを作成しました。スキャンしてチャージしてください。",
    "profile.topups.bank.toast.failed": "現在QRを生成できません。",
    "profile.topups.crypto.notice": "暗号資産のチャージは一時的に利用できません。銀行をご利用ください。",
    "profile.topups.crypto.title": "暗号資産チャージ (USDT TRC20)",
    "profile.topups.crypto.desc": "USDT TRC20でチャージします。オンチェーン確認後に反映されます。",
    "profile.topups.crypto.addressLabel": "TRC20ウォレットアドレス",
    "profile.topups.crypto.amountLabel": "USDT数量",
    "profile.topups.crypto.amountPlaceholder": "例: 10",
    "profile.topups.crypto.confirm": "送金しました",
    "profile.topups.withdraw.title": "出金",
    "profile.topups.withdraw.desc": "現在の残高に応じて出金額を入力してください。最小50,000đ、最大499,000,000đ。",
    "profile.topups.withdraw.balanceLabel": "利用可能残高:",
    "profile.topups.withdraw.amountLabel": "出金額 (VND)",
    "profile.topups.withdraw.amountPlaceholder": "例: 500000",
    "profile.topups.withdraw.amountHint": "最小50,000đ、最大499,000,000đ。",
    "profile.topups.withdraw.bankLabel": "銀行",
    "profile.topups.withdraw.bankPlaceholder": "例: Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "口座番号",
    "profile.topups.withdraw.accountPlaceholder": "口座番号を入力",
    "profile.topups.withdraw.nameLabel": "口座名義",
    "profile.topups.withdraw.namePlaceholder": "口座名義人の氏名",
    "profile.topups.withdraw.submit": "出金申請",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "送金前に管理者が申請を承認します。",
    "profile.topups.history.topup.title": "最近のチャージ履歴",
    "profile.topups.history.withdraw.title": "出金履歴",
    "profile.topups.history.table.date": "日時",
    "profile.topups.history.table.amount": "金額",
    "profile.topups.history.table.bank": "銀行",
    "profile.topups.history.table.status": "状態",
    "profile.topups.status.pending": "審査中",
    "profile.topups.status.completed": "処理済み",
    "profile.topups.status.rejected": "拒否",
    "profile.security.pageTitle": "セキュリティ & 2FA | polyflux.xyz",
    "profile.security.title": "セキュリティ & 2FA",
    "profile.security.subtitle": "アカウントの安全性を高め、アクセスを管理します。",
    "profile.security.password.title": "パスワード更新",
    "profile.security.password.desc": "定期的にパスワードを変更して安全性を高めましょう。",
    "profile.security.password.currentLabel": "現在のパスワード",
    "profile.security.password.currentPlaceholder": "現在のパスワードを入力",
    "profile.security.password.newLabel": "新しいパスワード",
    "profile.security.password.newPlaceholder": "最低8文字",
    "profile.security.password.confirmLabel": "新しいパスワードを確認",
    "profile.security.password.confirmPlaceholder": "新しいパスワードを再入力",
    "profile.security.password.submit": "パスワード更新",
    "profile.security.2fa.title": "二要素認証 (2FA)",
    "profile.security.2fa.desc": "ログイン時に認証コードを要求するため2FAを有効にします。",
    "profile.security.2fa.recoveryLabel": "復旧コード",
    "profile.security.2fa.deviceLabel": "信頼済みデバイス",
    "profile.security.2fa.deviceNone": "追加されたデバイスはありません。",
    "profile.security.2fa.enable": "2FAを有効化",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "API接続で2FA設定とデバイス一覧を保存します。",
    "profile.favorites.pageTitle": "お気に入り | polyflux.xyz",
    "profile.favorites.title": "お気に入り",
    "profile.favorites.subtitle": "保存した商品・サービスを確認できます。",
    "profile.favorites.listTitle": "お気に入り一覧",
    "profile.favorites.emptyTitle": "データがありません。",
    "profile.favorites.emptyDesc": "商品を保存すると後で確認できます。",
    "profile.notifications.pageTitle": "通知 | polyflux.xyz",
    "profile.notifications.title": "通知",
    "profile.notifications.subtitle": "注文やシステムの更新がここに表示されます。",
    "profile.notifications.listTitle": "新しい通知",
    "profile.notifications.emptyTitle": "通知はありません。",
    "profile.notifications.emptyDesc": "後でもう一度ご確認ください。",
    "profile.badges.pageTitle": "バッジ | polyflux.xyz",
    "profile.badges.title": "バッジ",
    "profile.badges.subtitle": "レベルと実績を確認できます。",
    "profile.badges.listTitle": "獲得したバッジ",
    "profile.badges.emptyTitle": "バッジはまだありません。",
    "profile.badges.emptyDesc": "タスクを完了して解除してください。",
    "profile.messages.pageTitle": "メッセージ | polyflux.xyz",
    "profile.messages.inboxTitle": "受信箱",
    "profile.messages.inboxCount": "会話 1 件",
    "profile.messages.searchPlaceholder": "検索...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "公式サポート",
    "profile.messages.thread.empty": "他の会話はありません。",
    "profile.messages.back": "戻る",
    "profile.messages.user.sub": "管理者サポート",
    "profile.messages.role.admin": "管理者",
    "profile.messages.day.today": "今日",
    "profile.messages.message.1": "こんにちは、どのようにお手伝いできますか？",
    "profile.messages.message.2": "注文 # について問い合わせたいです。",
    "profile.messages.message.3": "確認中です。少々お待ちください。",
    "profile.messages.message.4": "ありがとうございます。",
    "profile.messages.emojiLabel": "絵文字",
    "profile.messages.attachLabel": "添付",
    "profile.messages.inputPlaceholder": "メッセージを入力...",
    "profile.messages.send": "送信",
    "product.data.gmail-random.name": "Gmail ランダム名",
    "product.data.gmail-random.short": "Gmailランダムのフルアクセス、7日保証。",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "複数の特典を有効化できる Gmail EDU アカウント。",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "KYC 済みの米国アカウント、各種サービスに利用可能。",
    "product.data.tool-checker.name": "リソースチェッカー工具",
    "product.data.tool-checker.short": "リソースの生存/死活を素早く確認するローカルツール。",
    "service.data.fb-boost.name": "Facebook エンゲージメント増加",
    "service.data.fb-boost.short": "自然な「いいね・コメント・シェア」を増加、7日保証。",
    "service.data.tiktok-view.name": "TikTok 再生数増加",
    "service.data.tiktok-view.short": "新しい動画向けのTikTok再生パッケージ、コンテンツテストに最適。",
    "task.data.review-product.title": "フォーラムに商品レビュー投稿",
    "task.data.review-product.short": "polyflux.xyz の購入体験と詳細レビューを投稿。",
    "task.data.tiktok-video.title": "ショップ紹介TikTok動画作成",
    "task.data.tiktok-video.short": "サービスレビューの短い動画を撮影し、指定ハッシュタグを付けてください。",
  },
  zh: {
    "landing.hero.subtitle": "可信且快速的交易平台。",
    "landing.hero.buy": "立即购买",
    "landing.hero.explore": "查看更多",
    "landing.pill.email": "邮箱",
    "landing.pill.account": "账号",
    "landing.pill.software": "软件",
    "landing.pill.interaction": "互动服务",
    "landing.pill.tools": "工具",
    "landing.pill.other": "其他",
    "landing.faq.title": "常见问题",
    "landing.faq.subtitle": "查找关于 polyflux.xyz 的常见问题解答",
    "landing.faq.q1": "如何查看我的订单？",
    "landing.faq.a1": "已购买的商品会显示在购买记录中。",
    "landing.faq.q2": "这是骗局吗？",
    "landing.faq.a2": "我们采用已验证的支付、公开评价和退款政策来保障安全。",
    "landing.faq.q3": "有问题要咨询，如何联系你们？",
    "landing.faq.a3": "通过 Telegram 联系管理员。",
    "landing.payments.title": "20+ 种支付方式",
    "landing.payments.subtitle": "我们支持多种支付方式，确保结账快速安全。",
    "landing.trusted.title": "最值得信赖的市场。",
    "landing.trusted.subtitle": "看看客户选择我们的原因",
    "landing.stats.orders": "订单总数",
    "landing.stats.vouches": "已验证评价",
    "landing.stats.instantValue": "即时",
    "landing.stats.deliveryLabel": "全品类即时交付",
    "landing.products.emptyTitle": "未找到商品",
    "landing.products.emptyDesc": "请尝试调整搜索或分类筛选。",
    "landing.products.instant": "即时交付，安全结账。",
    "landing.products.add": "添加",
    "landing.product.email": "邮箱 {index}",
    "landing.product.account": "账号 {tier}",
    "landing.product.software": "软件 {tier}",
    "landing.product.interaction": "互动套餐 {index}",
    "landing.product.other": "其他商品 {index}",
    "landing.tier.basic": "基础",
    "landing.tier.pro": "专业",
    "landing.tier.vip": "VIP",
    "landing.tier.lite": "轻量",
    "landing.tier.plus": "Plus",
    "support.label": "支持",
    "support.close": "关闭",
    "support.header.title": "PolyFlux 支持",
    "support.header.status": "在线",
    "support.tab.faq": "FAQ",
    "support.tab.chat": "与管理员聊天",
    "support.faq.title": "FAQ - 常见问题",
    "support.faq.buyer.title": "I. 买家",
    "support.faq.buyer.q1": "如何购买商品？",
    "support.faq.buyer.a1.1": "买家可以使用加密货币或银行转账付款。",
    "support.faq.buyer.a1.2": "加密货币：充值到指定的个人钱包，链上交易确认后余额将自动更新。",
    "support.faq.buyer.a1.3": "银行：按提供的信息转账，付款确认后系统会对账并更新余额。",
    "support.faq.buyer.q2": "邮箱/账号不重复是什么意思？",
    "support.faq.buyer.a2": "系统通过重复检测和 Zero Duplicate 徽章，确保商品从未售出过。",
    "support.faq.buyer.q3": "如何充值？",
    "support.faq.buyer.a3.1": "加密货币：选择充值 -> 选择币种 -> 转入个人钱包。支持 USDT、USDC、BTC、ETH、BNB、TRX 等。",
    "support.faq.buyer.a3.2": "银行：选择充值 -> 银行转账 -> 按正确的备注/交易码转账以便系统自动确认。",
    "support.faq.buyer.q4": "可以申请退款吗？",
    "support.faq.buyer.a4": "可以。每笔订单都有 3 天的托管期，可用于投诉或发起争议。",
    "support.faq.buyer.q5": "充值未到账？",
    "support.faq.buyer.a5.1": "加密货币：可能是链/代币错误或区块链拥堵。若几分钟后仍未更新，请提供 TXID 以便支持。",
    "support.faq.buyer.a5.2": "银行：可能是非工作时间转账、备注错误或待对账。请联系支持并附上转账截图。",
    "support.faq.buyer.q6": "如果转错了怎么办？",
    "support.faq.buyer.a6.1": "加密货币：区块链交易不可撤销，转错链或地址通常会造成永久损失。",
    "support.faq.buyer.a6.2": "银行：系统仅协助对账，转账信息错误不保证退款。",
    "support.faq.buyer.q7": "需要中间人吗？",
    "support.faq.buyer.a7": "不需要。系统为内置托管，资金保留 3 天后再放款给卖家。",
    "support.faq.seller.title": "II. 卖家",
    "support.faq.seller.q1": "如何注册成为卖家？",
    "support.faq.seller.a1": "登录 -> 申请成为卖家 -> 填写信息 -> 等待审核。",
    "support.faq.seller.q2": "如何创建店铺？",
    "support.faq.seller.a2": "进入店铺管理 -> 新建 -> 上传商品描述、图片和文件。",
    "support.faq.seller.q3": "如何优化店铺？",
    "support.faq.seller.a3": "使用高质量图片、清晰标题、详细描述、稳定的产品和快速支持。排名每周更新。",
    "support.faq.seller.q4": "如何进入推荐/置顶？",
    "support.faq.seller.a4": "取决于销量、客户评价、信誉度和纠纷率。",
    "support.faq.seller.q5": "收入如何处理？",
    "support.faq.seller.a5.1": "订单完成后，资金将处于 Pending 状态 3 天（托管）。之后卖家可通过以下方式提现：",
    "support.faq.seller.a5.list1": "加密货币：USDT、BTC、ETH、BNB、TRX 等。",
    "support.faq.seller.a5.list2": "银行转账（按已验证的账户信息）。",
    "support.faq.seller.q6": "佣金如何计算？",
    "support.faq.seller.a6": "平台对每笔成功订单收取 5% 交易费。卖家可开启 Reseller 模式以提升销量。",
    "support.faq.seller.q7": "如何提现吗？",
    "support.faq.seller.a7": "选择提现 -> 选择加密货币或银行 -> 填写信息 -> 确认。",
    "support.faq.seller.q8": "卖家的税务义务如何处理？",
    "support.faq.seller.a8.1": "平台仅作为提供交易基础设施的中介。",
    "support.faq.seller.a8.2": "卖家需根据越南法律自行申报并履行因收入产生的税务义务。",
    "support.faq.seller.a8.3": "平台不代扣、不代表或代替卖家履行税务义务。",
    "support.faq.seller.q9": "禁止商品有哪些？",
    "support.faq.seller.a9": "被黑账号、非法数据、银行账户、恶意工具或任何违反越南法律或第三方条款的内容。",
    "support.faq.seller.q10": "用户交易与管理员有关吗？",
    "support.faq.seller.a10.1": "用户发布的商品或任务发布属于用户之间的交易，与管理员无关。",
    "support.faq.seller.a10.2": "管理员不参与非法物品交易。如发生违规或故意违法交易，管理员有权删除内容并冻结余额。参与在本平台销售即视为已阅读并同意条款。",
    "support.faq.seller.q11": "API 集成？",
    "support.faq.seller.a11": "可以。卖家可集成 API 以自动发货并同步库存。",
    "support.faq.seller.q12": "如何处理保修？",
    "support.faq.seller.a12": "进入已售订单 -> 保修 -> 输入数量 -> 系统自动向客户发送替换码。",
    "support.faq.reseller.title": "III. 转售商",
    "support.faq.reseller.q1": "如何成为转售商？",
    "support.faq.reseller.a1": "在账号设置中开启 Reseller 模式。",
    "support.faq.reseller.q2": "如何以转售商身份销售？",
    "support.faq.reseller.a2": "选择符合条件的商品 -> 获取推广链接 -> 分享 -> 系统自动记录佣金。",
    "support.faq.reseller.q3": "佣金提现吗？",
    "support.faq.reseller.a3": "佣金将托管 3 天，之后可通过加密货币或银行提现。",
    "support.faq.reseller.q4": "每月奖励？",
    "support.faq.reseller.a4": "有。平台提供基于月度表现的奖励计划。",
    "support.faq.compliance.title": "IV. 遵守越南法律 - AML 与欺诈",
    "support.faq.compliance.q1": "反洗钱（AML）",
    "support.faq.compliance.a1.lead": "严格禁止：",
    "support.faq.compliance.a1.list1": "流通非法资产",
    "support.faq.compliance.a1.list2": "隐瞒资金来源",
    "support.faq.compliance.a1.list3": "疑似洗钱的异常交易",
    "support.faq.compliance.a1.note": "平台有权在必要时冻结资金、锁定账号、要求身份验证并配合有关部门。",
    "support.faq.compliance.q2": "欺诈防范",
    "support.faq.compliance.a2.lead": "严格禁止：",
    "support.faq.compliance.a2.list1": "虚假订单",
    "support.faq.compliance.a2.list2": "滥用争议",
    "support.faq.compliance.a2.list3": "多账号",
    "support.faq.compliance.a2.list4": "机器人、黑客或利用系统漏洞",
    "support.faq.compliance.q3": "遵守越南法律",
    "support.faq.compliance.a3": "用户不得买卖非法物品或侵犯隐私与个人数据。",
    "profile.overview.pageTitle": "账户概览 | polyflux.xyz",
    "profile.overview.title": "账户概览",
    "profile.overview.subtitle": "在一处查看余额、订单与安全。",
    "profile.overview.quickInfoTitle": "快速信息",
    "profile.overview.quickInfoDesc": "余额、总订单、账号等级...",
    "profile.overview.table.labelItem": "项目",
    "profile.overview.table.labelValue": "数值",
    "profile.overview.table.labelStatus": "状态",
    "profile.overview.table.balanceLabel": "可用余额",
    "profile.overview.table.balanceStatus": "未充值",
    "profile.overview.table.ordersLabel": "订单总数",
    "profile.overview.table.ordersStatus": "完成",
    "profile.overview.quickLinks.title": "快速导航",
    "profile.overview.quickLinks.profile": "个人主页",
    "profile.overview.quickLinks.orders": "订单",
    "profile.overview.quickLinks.topups": "充值",
    "profile.overview.quickLinks.logins": "登录记录",
    "profile.overview.quickLinks.security": "安全 & 2FA",
    "profile.public.pageTitle": "个人主页 | polyflux.xyz",
    "profile.public.userFallback": "BKUser",
    "profile.public.joinedLabel": "加入",
    "profile.public.badgeLabel": "徽章",
    "profile.public.idLabel": "ID",
    "profile.public.copyLink": "????????",
    "profile.public.copySuccess": "??????????",
    "profile.public.copyFail": "???????????",
    "profile.public.follow": "关注",
    "profile.public.following": "已关注",
    "profile.public.followersLabel": "粉丝",
    "profile.public.followingLabel": "关注中",
    "profile.public.stats.purchased": "已购买",
    "profile.public.stats.sold": "已售出",
    "profile.public.stats.rank": "Top",
    "profile.public.stats.shop": "查看店铺",
    "profile.public.featured.title": "精选内容",
    "profile.public.featured.manage": "编辑精选内容",
    "profile.public.featured.note": "精选内容会在 30 天后自动删除。",
    "profile.public.featured.emptyTitle": "该用户暂无精选内容。",
    "profile.public.featured.emptyDesc": "新内容将在 30 天后自动隐藏。",
    "profile.public.story.defaultTitle": "动态 #{index}",
    "profile.public.story.type.video": "视频",
    "profile.public.story.type.image": "图片",
    "profile.public.story.titleFallback": "精选内容",
    "profile.public.story.alt": "动态",
    "profile.public.manage.title": "管理个人主页",
    "profile.public.manage.titlePlaceholder": "标题",
    "profile.public.manage.upload": "上传",
    "profile.public.manage.remove": "移除",
    "profile.public.manage.help": "?????? 9:16??? 2MB????? 60 ???????????",
    "profile.public.manage.close": "关闭",
    "profile.public.manage.save": "保存更改",
    "profile.public.manage.slotLabel": "位置 {index}",
    "profile.public.manage.limit.pro": "最多 4 条，支持视频。",
    "profile.public.manage.limit.basic": "未满足条件，仅可发布 1 张图片。",
    "profile.public.toast.saveFail": "无法保存精选内容。",
    "profile.public.toast.loginRequired": "请登录后关注。",
    "profile.public.toast.imageOrVideoOnly": "仅支持图片或视频。",
    "profile.public.toast.notEligible": "暂不支持上传视频或多条内容。",
    "profile.public.toast.uploadFail": "上传失败。",
    "profile.public.toast.imageTooLarge": "???? 2MB?",
    "profile.public.toast.imageRatio": "图片比例必须为 9:16。",
    "profile.public.toast.imageReadFail": "无法读取图片。",
    "profile.public.toast.videoNotEligible": "视频仅限符合条件的账号。",
    "profile.public.toast.videoTooLarge": "视频超过 25MB。",
    "profile.public.toast.videoRatio": "视频比例必须为 9:16。",
    "profile.public.toast.videoDuration": "视频超过 60 秒。",
    "profile.public.toast.videoReadFail": "无法读取视频。",
    "profile.public.toast.coverReadFail": "无法读取封面图片。",
    "product.detail.pageTitle": "商品详情 | polyflux.xyz",
    "breadcrumb.home": "首页",
    "breadcrumb.detail": "详情",
    "product.detail.share": "分享",
    "product.detail.share.copied": "已复制",
    "product.detail.share.failed": "复制失败",
    "product.detail.favorite": "收藏",
    "product.detail.favorite.active": "已收藏",
    "product.detail.otherTitle": "该店铺的其他商品",
    "product.detail.other.empty": "暂无其他商品。",
    "product.detail.order": "下单",
    "product.detail.preorder": "预订",
    "product.detail.message": "私信",
    "product.detail.tab.shop": "店铺描述",
    "product.detail.tab.reviews": "评价",
    "product.detail.tab.api": "API",
    "product.detail.modal.title": "确认下单",
    "product.detail.modal.quantity": "数量",
    "product.detail.modal.subtotal": "小计",
    "product.detail.modal.cancel": "取消",
    "product.detail.modal.confirm": "确认下单",
    "product.detail.modal.processing": "处理中...",
    "product.detail.modal.max": "最多 {max}",
    "product.detail.toast.success": "下单成功，请在订单中查看。",
    "product.detail.toast.viewOrders": "查看订单",
    "product.detail.toast.loginRequired": "请登录后下单。",
    "product.detail.toast.orderFailed": "下单失败。",
    "product.detail.notFound": "未找到商品",
    "product.detail.description.pending": "描述更新中。",
    "product.detail.rating.positive": "好评",
    "product.detail.rating.neutral": "一般",
    "product.detail.rating.negative": "有待改进",
    "product.detail.rating.none": "暂无评价",
    "product.detail.shopIdLabel": "店铺 ID",
    "product.detail.shop.polyflux.title": "PolyFlux 官方",
    "product.detail.shop.polyflux.bullet1": "快速交付，交付前检查。",
    "product.detail.shop.polyflux.bullet2": "问题无法解决可退款。",
    "product.detail.shop.polyflux.bullet3": "Telegram 24/7 支持。",
    "product.detail.shop.partner.title": "合作商店 #1",
    "product.detail.shop.partner.bullet1": "库存稳定，几分钟内交付。",
    "product.detail.shop.partner.bullet2": "大额订单享受更优价格。",
    "product.detail.shop.partner.bullet3": "按上架政策提供保修支持。",
    "product.detail.shop.fallbackTitle": "可信店铺",
    "product.detail.shop.fallbackBullet1": "收货后立即检查商品。",
    "product.detail.shop.fallbackBullet2": "出现问题可获得支持。",
    "product.detail.review.1.text": "发货很快，账号正常。",
    "product.detail.review.1.time": "2 小时前",
    "product.detail.review.2.text": "支持很快，保修明确。",
    "product.detail.review.2.time": "1 天前",
    "product.detail.review.3.text": "与描述一致，会再次购买。",
    "product.detail.review.3.time": "3 天前",
    "product.detail.api.title": "交付 API",
    "product.detail.api.bullet1": "付款后自动发货代码。",
    "product.detail.api.bullet2": "兼容 REST/JSON。",
    "product.detail.api.bullet3": "联系管理员获取密钥。",
    "service.detail.pageTitle": "服务详情 | polyflux.xyz",
    "service.detail.hero.loadingTitle": "服务加载中...",
    "service.detail.hero.loadingDesc": "服务描述将显示在这里。",
    "service.detail.info.title": "套餐信息",
    "service.detail.info.desc": "从 /data/mock-services.json 读取。连接 API 后会返回详细描述。",
    "service.detail.form.title": "付款后的需求表单",
    "service.detail.form.desc": "支付成功后，用户填写此表单以便准确处理服务。",
    "service.detail.form.emailLabel": "结果邮箱",
    "service.detail.form.emailPlaceholder": "you@example.com",
    "service.detail.form.linkLabel": "目标链接",
    "service.detail.form.linkPlaceholder": "例如：帖子/主页/视频链接...",
    "service.detail.form.noteLabel": "详细需求",
    "service.detail.form.notePlaceholder": "描述需求、数量、期望速度...",
    "service.detail.form.save": "保存需求",
    "service.detail.form.mockTitle": "Note:",
    "service.detail.form.mockDesc": "此表单不会提交。连接 API 后将数据 POST 至后端。",
    "service.detail.notFound": "未找到服务",
    "service.detail.noData": "暂无数据，连接 API 或添加 JSON 后显示。",
    "service.detail.fallback.summary": "服务详情将显示在这里。",
    "service.detail.fallback.description": "服务详细信息将由后端 API 返回并显示在此处。",
    "task.detail.pageTitle": "任务详情 | polyflux.xyz",
    "task.detail.hero.loadingTitle": "任务加载中...",
    "task.detail.hero.loadingDesc": "任务描述将显示在这里。",
    "task.detail.info.title": "任务信息",
    "task.detail.info.desc": "数据来自 /data/mock-tasks.json。连接 API 后将从后端获取。",
    "task.detail.report.title": "提交报告",
    "task.detail.report.desc": "提交任务完成证明。",
    "task.detail.report.contactLabel": "邮箱 / 用户名",
    "task.detail.report.contactPlaceholder": "you@example.com",
    "task.detail.report.proofLabel": "证明链接",
    "task.detail.report.proofPlaceholder": "例如：帖子链接、视频",
    "task.detail.report.noteLabel": "补充说明",
    "task.detail.report.notePlaceholder": "简要说明已完成的工作...",
    "task.detail.report.submit": "提交报告",
    "task.detail.report.mockTitle": "Note:",
    "task.detail.report.mockDesc": "连接 API 后系统将接收报告并自动审核。",
    "task.detail.notFound": "未找到任务",
    "task.detail.noData": "暂无数据，请稍后再试。",
    "task.detail.titleFallback": "任务",
    "task.detail.fallback.summary": "任务详情将显示在这里。",
    "task.detail.fallback.description": "API 可用后将更新任务详细信息。",
    "maintenance.title": "服务器维护",
    "maintenance.desc": "系统维护中，给您带来不便敬请谅解，预计不会超过 1 小时。",
    "cart.pageTitle": "购物车 | polyflux.xyz",
    "cart.items.title": "购物车商品",
    "cart.empty.title": "购物车为空。",
    "cart.empty.desc": "连接 API 后，你选择的商品将显示在这里。",
    "cart.summary.title": "订单摘要",
    "cart.summary.desc": "总额、费用、优惠码。",
    "cart.summary.couponLabel": "优惠码",
    "cart.summary.couponPlaceholder": "输入优惠码",
    "cart.summary.apply": "应用",
    "cart.summary.checkout": "继续结算",
    "checkout.pageTitle": "结算 | polyflux.xyz",
    "checkout.buyer.title": "买家信息",
    "checkout.buyer.emailLabel": "订单邮箱",
    "checkout.buyer.platformLabel": "ID / 用户名（可选）",
    "checkout.buyer.platformPlaceholder": "视产品/服务而定",
    "checkout.note.title": "附加说明",
    "checkout.note.label": "订单备注",
    "checkout.note.placeholder": "例如：交付 .txt 文件，通过邮件发送...",
    "checkout.summary.title": "订单摘要",
    "checkout.summary.desc": "总额与支付方式。",
    "checkout.summary.emptyTitle": "暂无购物车数据。",
    "checkout.summary.emptyDesc": "连接 API 后，商品列表和总额会显示在这里。",
    "checkout.summary.success": "支付成功",
    "checkout.summary.failed": "模拟失败",
    "checkout.success.pageTitle": "支付成功 | polyflux.xyz",
    "checkout.success.title": "支付成功",
    "checkout.success.desc": "你的订单已记录。连接 API 后将显示订单详情和下载按钮。",
    "checkout.success.orders": "查看我的订单",
    "checkout.success.continue": "继续购物",
    "checkout.failed.pageTitle": "支付失败 | polyflux.xyz",
    "checkout.failed.title": "支付失败",
    "checkout.failed.desc": "你可能取消了支付或支付网关返回错误。连接 API 后将显示详细错误码。",
    "checkout.failed.retry": "重新支付",
    "checkout.failed.backProducts": "返回商品",
    "profile.orders.pageTitle": "订单 | polyflux.xyz",
    "profile.orders.title": "我的订单",
    "profile.orders.subtitle": "跟踪订单状态和交易记录。",
    "profile.orders.history.title": "订单历史",
    "profile.orders.table.orderId": "订单号",
    "profile.orders.table.product": "商品",
    "profile.orders.table.total": "总额",
    "profile.orders.table.status": "状态",
    "profile.orders.status.completed": "已完成",
    "profile.orders.status.processing": "处理中",
    "profile.orders.status.cancelled": "已取消",
    "profile.orders.sample.email": "邮箱 1",
    "profile.orders.sample.vip": "VIP 账号",
    "profile.orders.sample.interaction": "互动套餐 3",
    "profile.history.pageTitle": "账户记录 | polyflux.xyz",
    "profile.history.title": "账户记录",
    "profile.history.subtitle": "汇总近期充值、提现和购买记录。",
    "profile.history.sectionTitle": "近期活动",
    "profile.history.table.date": "时间",
    "profile.history.table.type": "类型",
    "profile.history.table.amount": "金额",
    "profile.history.table.status": "状态",
    "profile.history.type.topup": "充值",
    "profile.history.type.withdraw": "提现",
    "profile.history.type.order": "订单",
    "profile.history.status.success": "成功",
    "profile.history.status.processing": "处理中",
    "profile.history.status.completed": "已完成",
    "profile.tasks.pageTitle": "已接任务 | polyflux.xyz",
    "profile.tasks.title": "已接任务",
    "profile.tasks.subtitle": "跟踪你已接的任务和审核进度。",
    "profile.tasks.sectionTitle": "已接任务列表",
    "profile.tasks.table.task": "任务",
    "profile.tasks.table.receivedAt": "接取日期",
    "profile.tasks.table.deadline": "到期",
    "profile.tasks.table.reward": "奖励",
    "profile.tasks.table.status": "状态",
    "profile.tasks.emptyTitle": "暂无已接任务。",
    "profile.tasks.emptyDesc": "当你接取新任务时，会显示在这里。",
    "profile.topups.pageTitle": "充值 | polyflux.xyz",
    "profile.topups.title": "账户充值",
    "profile.topups.subtitle": "请输入充值金额：最低 10,000đ，最高 499,000,000đ。每次充值都会生成 QR。",
    "profile.topups.guard.title": "需要登录：",
    "profile.topups.guard.desc": "需要登录才能为钱包充值。",
    "profile.topups.bank.title": "银行充值（QR）",
    "profile.topups.bank.desc": "用银行 App 扫描 QR。转账后系统会自动入账。",
    "profile.topups.bank.qrPlaceholder": "创建后将显示 QR。",
    "profile.topups.bank.codeLabel": "开户名",
    "profile.topups.bank.amountLabel": "金额",
    "profile.topups.bank.amountInputLabel": "充值金额 (VND)",
    "profile.topups.bank.amountPlaceholder": "例如：100000",
    "profile.topups.bank.amountHint": "最低 10,000đ，最高 499,000,000đ。",
    "profile.topups.bank.generate": "生成 QR",
    "profile.topups.bank.toast.invalidAmount": "请输入有效金额。",
    "profile.topups.bank.toast.range": "金额必须在 {min} 到 {max} đ 之间。",
    "profile.topups.bank.toast.created": "已生成 QR。扫描即可充值。",
    "profile.topups.bank.toast.failed": "暂时无法生成 QR。",
    "profile.topups.crypto.notice": "加密货币充值暂不可用，请使用银行转账。",
    "profile.topups.crypto.title": "加密货币充值（USDT TRC20）",
    "profile.topups.crypto.desc": "通过 USDT TRC20 充值。链上确认后系统将入账。",
    "profile.topups.crypto.addressLabel": "TRC20 钱包地址",
    "profile.topups.crypto.amountLabel": "USDT 数量",
    "profile.topups.crypto.amountPlaceholder": "例如：10",
    "profile.topups.crypto.confirm": "我已转账",
    "profile.topups.withdraw.title": "提现",
    "profile.topups.withdraw.desc": "根据当前余额输入提现金额。最低 50,000đ，最高 499,000,000đ。",
    "profile.topups.withdraw.balanceLabel": "可用余额：",
    "profile.topups.withdraw.amountLabel": "提现金额 (VND)",
    "profile.topups.withdraw.amountPlaceholder": "例如：500000",
    "profile.topups.withdraw.amountHint": "最低 50,000đ，最高 499,000,000đ。",
    "profile.topups.withdraw.bankLabel": "银行",
    "profile.topups.withdraw.bankPlaceholder": "例如：Vietcombank, ACB...",
    "profile.topups.withdraw.accountLabel": "账号",
    "profile.topups.withdraw.accountPlaceholder": "输入账号",
    "profile.topups.withdraw.nameLabel": "开户名",
    "profile.topups.withdraw.namePlaceholder": "开户人姓名",
    "profile.topups.withdraw.submit": "提交提现申请",
    "profile.topups.withdraw.mockTitle": "Note:",
    "profile.topups.withdraw.mockDesc": "转账前需管理员审核。",
    "profile.topups.history.topup.title": "最近充值记录",
    "profile.topups.history.withdraw.title": "提现记录",
    "profile.topups.history.table.date": "时间",
    "profile.topups.history.table.amount": "金额",
    "profile.topups.history.table.bank": "银行",
    "profile.topups.history.table.status": "状态",
    "profile.topups.status.pending": "审核中",
    "profile.topups.status.completed": "已处理",
    "profile.topups.status.rejected": "已拒绝",
    "profile.security.pageTitle": "安全 & 2FA | polyflux.xyz",
    "profile.security.title": "安全 & 2FA",
    "profile.security.subtitle": "加强账户安全并控制访问。",
    "profile.security.password.title": "更新密码",
    "profile.security.password.desc": "定期修改密码以更好保护账户。",
    "profile.security.password.currentLabel": "当前密码",
    "profile.security.password.currentPlaceholder": "输入当前密码",
    "profile.security.password.newLabel": "新密码",
    "profile.security.password.newPlaceholder": "至少 8 个字符",
    "profile.security.password.confirmLabel": "确认新密码",
    "profile.security.password.confirmPlaceholder": "再次输入新密码",
    "profile.security.password.submit": "更新密码",
    "profile.security.2fa.title": "双重验证 (2FA)",
    "profile.security.2fa.desc": "启用 2FA 以在登录时要求验证码。",
    "profile.security.2fa.recoveryLabel": "恢复码",
    "profile.security.2fa.deviceLabel": "可信设备",
    "profile.security.2fa.deviceNone": "暂无已添加设备。",
    "profile.security.2fa.enable": "启用 2FA",
    "profile.security.2fa.mockTitle": "Note:",
    "profile.security.2fa.mockDesc": "连接 API 以保存 2FA 设置和设备列表。",
    "profile.favorites.pageTitle": "收藏 | polyflux.xyz",
    "profile.favorites.title": "收藏",
    "profile.favorites.subtitle": "查看你已收藏的商品与服务。",
    "profile.favorites.listTitle": "收藏列表",
    "profile.favorites.emptyTitle": "暂无数据。",
    "profile.favorites.emptyDesc": "收藏商品后可稍后查看。",
    "profile.notifications.pageTitle": "通知 | polyflux.xyz",
    "profile.notifications.title": "通知",
    "profile.notifications.subtitle": "订单和系统更新会显示在这里。",
    "profile.notifications.listTitle": "新通知",
    "profile.notifications.emptyTitle": "暂无通知。",
    "profile.notifications.emptyDesc": "请稍后再查看。",
    "profile.badges.pageTitle": "徽章 | polyflux.xyz",
    "profile.badges.title": "徽章",
    "profile.badges.subtitle": "查看你的等级与成就。",
    "profile.badges.listTitle": "已获得徽章",
    "profile.badges.emptyTitle": "暂无徽章。",
    "profile.badges.emptyDesc": "完成任务即可解锁。",
    "profile.messages.pageTitle": "消息 | polyflux.xyz",
    "profile.messages.inboxTitle": "收件箱",
    "profile.messages.inboxCount": "1 个会话",
    "profile.messages.searchPlaceholder": "搜索...",
    "profile.messages.thread.name": "Bach Kim",
    "profile.messages.thread.note": "官方支持",
    "profile.messages.thread.empty": "没有其他会话。",
    "profile.messages.back": "返回",
    "profile.messages.user.sub": "管理员支持",
    "profile.messages.role.admin": "管理员",
    "profile.messages.day.today": "今天",
    "profile.messages.message.1": "你好，需要什么帮助？",
    "profile.messages.message.2": "我想咨询订单 # 的信息。",
    "profile.messages.message.3": "正在查看，请稍等。",
    "profile.messages.message.4": "谢谢。",
    "profile.messages.emojiLabel": "表情",
    "profile.messages.attachLabel": "附件",
    "profile.messages.inputPlaceholder": "输入消息...",
    "profile.messages.send": "发送",
    "product.data.gmail-random.name": "Gmail 随机名",
    "product.data.gmail-random.short": "Gmail 随机全权限，7 天保修。",
    "product.data.gmail-edu.name": "Gmail EDU",
    "product.data.gmail-edu.short": "用于激活多种福利的 Gmail EDU 账号。",
    "product.data.account-us.name": "Account US verified",
    "product.data.account-us.short": "已完成 KYC 的美国账号，可用于多种服务。",
    "product.data.tool-checker.name": "资源检测工具",
    "product.data.tool-checker.short": "用于快速检测资源存活/失效的本地工具。",
    "service.data.fb-boost.name": "Facebook 互动提升服务",
    "service.data.fb-boost.short": "自然提升点赞、评论、分享，7 天保修。",
    "service.data.tiktok-view.name": "TikTok 播放量提升",
    "service.data.tiktok-view.short": "适用于新视频的 TikTok 播放量套餐，适合内容测试。",
    "task.data.review-product.title": "在论坛撰写产品评价",
    "task.data.review-product.short": "撰写 polyflux.xyz 的详细购买体验与评价。",
    "task.data.tiktok-video.title": "制作介绍店铺的 TikTok 视频",
    "task.data.tiktok-video.short": "拍摄服务评测短视频，并按要求添加话题标签。",
  },
};

Object.keys(BK_I18N_EXT).forEach((lang) => {
  BK_I18N[lang] = Object.assign(BK_I18N[lang] || {}, BK_I18N_EXT[lang]);
});

const BK_I18N_SAFE = {
  vi: {
    "empty.noData": "Chưa có dữ liệu",
    "landing.featured.emptyDesc": "Chưa có dữ liệu",
    "cart.empty.desc": "Chưa có sản phẩm trong giỏ.",
    "cart.summary.desc": "Tổng tiền, phí và mã giảm giá.",
    "cart.summary.couponPlaceholder": "Nhập mã giảm giá",
    "cart.summary.apply": "Áp dụng",
    "checkout.summary.desc": "Tóm tắt thanh toán.",
    "checkout.summary.emptyDesc": "Chưa có sản phẩm trong đơn.",
    "checkout.summary.success": "Thanh toán thành công",
    "checkout.summary.failed": "Thanh toán không thành công",
    "checkout.success.desc": "Đơn hàng đã được ghi nhận. Chi tiết sẽ hiển thị tại đây.",
    "checkout.failed.desc": "Có thể bạn đã hủy hoặc thanh toán gặp lỗi. Vui lòng thử lại.",
    "checkout.buyer.platformPlaceholder": "Tùy theo loại sản phẩm/hạng mục",
    "profile.overview.quickInfoDesc": "Thông tin nhanh về số dư, đơn hàng và cấp độ tài khoản.",
    "profile.security.password.submit": "Cập nhật mật khẩu",
    "profile.security.2fa.enable": "Bật 2FA",
    "profile.security.2fa.mockTitle": "Lưu ý",
    "profile.security.2fa.mockDesc": "Thiết lập sẽ được lưu và áp dụng sau khi xác nhận.",
    "profile.topups.bank.desc": "Quét QR bằng ứng dụng ngân hàng để nạp tiền.",
    "profile.topups.bank.generate": "Tạo QR",
    "profile.topups.bank.toast.created": "QR đã tạo. Quét để nạp tiền.",
    "profile.topups.bank.toast.failed": "Không thể tạo QR lúc này.",
    "profile.topups.crypto.confirm": "Tôi đã chuyển",
    "profile.topups.withdraw.submit": "Gửi yêu cầu rút",
    "profile.topups.withdraw.mockTitle": "Lưu ý",
    "task.action.submitProof": "Gửi bằng chứng",
    "task.note.mock": "Sau khi được duyệt, tiền sẽ về ví của bạn.",
    "task.toast.proofSubmitted": "Đã gửi bằng chứng.",
    "task.detail.info.desc": "Thông tin nhiệm vụ sẽ hiển thị khi có dữ liệu.",
    "task.detail.report.desc": "Nộp bằng chứng hoàn thành nhiệm vụ.",
    "task.detail.report.submit": "Gửi báo cáo",
    "task.detail.report.mockTitle": "Lưu ý",
    "task.detail.report.mockDesc": "Báo cáo sẽ được ghi nhận và cập nhật trạng thái.",
    "task.detail.fallback.description": "Thông tin chi tiết sẽ được cập nhật khi có dữ liệu.",
    "support.faq.seller.q11": "Tự động giao hàng?",
    "support.faq.seller.a11": "Có. Gian hàng có thể bật giao hàng tự động và đồng bộ tồn kho.",
    "product.detail.tab.api": "Tự động",
    "product.detail.api.title": "Giao hàng tự động",
    "product.detail.api.bullet1": "Tự động giao hàng sau thanh toán.",
    "product.detail.api.bullet2": "Hỗ trợ tích hợp nhanh.",
    "product.detail.api.bullet3": "Liên hệ để kích hoạt tính năng.",
    "service.detail.pageTitle": "Chi tiết dịch vụ | polyflux.xyz",
    "service.detail.hero.loadingTitle": "Đang tải thông tin...",
    "service.detail.hero.loadingDesc": "Thông tin sẽ hiển thị tại đây.",
    "service.detail.info.desc": "Thông tin chi tiết sẽ hiển thị khi có dữ liệu.",
    "service.detail.form.desc": "Sau khi thanh toán, khách hàng điền form để bạn xử lý chính xác.",
    "service.detail.form.save": "Lưu yêu cầu",
    "service.detail.form.mockTitle": "Lưu ý",
    "service.detail.form.mockDesc": "Yêu cầu sẽ được ghi nhận và cập nhật trạng thái.",
    "service.detail.noData": "Chưa có dữ liệu",
    "service.detail.notFound": "Không tìm thấy dịch vụ",
    "service.detail.fallback.summary": "Thông tin chi tiết sẽ được cập nhật.",
    "service.detail.fallback.description": "Thông tin chi tiết sẽ được cập nhật khi có dữ liệu.",
    "service.defaultName": "Dịch vụ",
    "service.fallback.short": "Xử lý theo yêu cầu sau khi thanh toán.",
    "service.category.interaction": "Tương tác",
    "service.category.software": "Phần mềm",
    "service.category.other": "Khác",
    "service.header.subtitle": "Sắp xếp theo nhu cầu và chọn nhanh hạng mục phù hợp.",
    "service.filter.facebook": "Dịch vụ Facebook",
    "service.filter.tiktok": "Dịch vụ TikTok",
    "service.filter.google": "Dịch vụ Google",
    "service.filter.telegram": "Dịch vụ Telegram",
    "service.filter.shopee": "Dịch vụ Shopee",
    "service.filter.discord": "Dịch vụ Discord",
    "service.filter.twitter": "Dịch vụ Twitter",
    "service.filter.youtube": "Dịch vụ YouTube",
    "service.filter.zalo": "Dịch vụ Zalo",
    "service.filter.instagram": "Dịch vụ Instagram",
    "service.filter.otherInteraction": "Tương tác khác",
    "service.filter.codingTool": "Công cụ lập trình",
    "service.filter.design": "Thiết kế",
    "service.filter.video": "Video",
    "service.filter.otherTool": "Công cụ khác",
    "service.type.codingTool": "Lập trình",
    "nav.services": "Dịch vụ",
    "footer.services": "Dịch vụ",
    "landing.pill.interaction": "Tương tác",
    "filter.searchPlaceholder.service": "Nhập tên dịch vụ...",
    "profile.favorites.subtitle": "Sản phẩm và hạng mục bạn đã lưu.",
    "product.data.account-us.short": "Tài khoản US có KYC, dùng cho nhiều nhu cầu.",
    "task.data.tiktok-video.short": "Quay video ngắn đánh giá hạng mục với hashtag yêu cầu.",
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
  // When hosting via HTTP, you can rewrite /sanpham/ -> /sanpham/index.html.
  const map = isFile
    ? {
        sanpham: "sanpham/index.html",
        dichvu: "dichvu/index.html",
        nhiemvu: "nhiemvu/index.html",
        topups: "profile/topups/index.html",
        home: "index.html",
        login: "login/index.html",
        profile: "profile/index.html",
      }
    : {
        sanpham: "sanpham/",
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
    if (href.includes("/sanpham")) a.href = root + map.sanpham;
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
    { key: "sanpham", match: "/sanpham/" },
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



