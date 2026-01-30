import { jsonResponse, normalizeEmail, normalizeUsername, readJsonBody } from "./auth/_utils.js";

const encoder = new TextEncoder();
let mediaSigningKeyCache = { secret: "", key: null };

export const PRODUCT_CATEGORIES = [
  {
    id: "email",
    labelKey: "product.category.email",
    subcategories: [
      { id: "Gmail", labelKey: "product.subcategory.gmail", label: "Gmail" },
      { id: "HotMail", label: "HotMail" },
      { id: "OutlookMail", label: "OutlookMail" },
      { id: "RuMail", label: "RuMail" },
      { id: "DomainEmail", labelKey: "product.subcategory.domainEmail", label: "Domain Email" },
      { id: "YahooMail", label: "YahooMail" },
      { id: "ProtonMail", label: "ProtonMail" },
      { id: "EmailKhac", labelKey: "product.subcategory.otherEmail", label: "Other email" },
    ],
  },
  {
    id: "tool",
    labelKey: "product.category.tool",
    subcategories: [
      { id: "ToolFacebook", labelKey: "product.subcategory.toolFacebook", label: "Facebook tool" },
      { id: "ToolGoogle", labelKey: "product.subcategory.toolGoogle", label: "Google tool" },
      { id: "ToolYouTube", labelKey: "product.subcategory.toolYouTube", label: "YouTube tool" },
      { id: "ToolCrypto", labelKey: "product.subcategory.toolCrypto", label: "Crypto tool" },
      { id: "ToolPTC", labelKey: "product.subcategory.toolPTC", label: "PTC tool" },
      { id: "ToolCaptcha", labelKey: "product.subcategory.toolCaptcha", label: "Captcha tool" },
      { id: "ToolOffer", labelKey: "product.subcategory.toolOffer", label: "Offer tool" },
      { id: "ToolPTU", labelKey: "product.subcategory.toolPTU", label: "PTU tool" },
      { id: "ToolKhac", labelKey: "product.subcategory.toolOther", label: "Other tools" },
    ],
  },
  {
    id: "account",
    labelKey: "product.category.account",
    subcategories: [
      { id: "AccFacebook", labelKey: "product.subcategory.accFacebook", label: "Facebook account" },
      { id: "AccBM", labelKey: "product.subcategory.accBM", label: "Business Manager" },
      { id: "AccZalo", labelKey: "product.subcategory.accZalo", label: "Zalo account" },
      { id: "AccTwitter", labelKey: "product.subcategory.accTwitter", label: "Twitter account" },
      { id: "AccTelegram", labelKey: "product.subcategory.accTelegram", label: "Telegram account" },
      { id: "AccInstagram", labelKey: "product.subcategory.accInstagram", label: "Instagram account" },
      { id: "AccShopee", labelKey: "product.subcategory.accShopee", label: "Shopee account" },
      { id: "AccDiscord", labelKey: "product.subcategory.accDiscord", label: "Discord account" },
      { id: "AccTikTok", labelKey: "product.subcategory.accTikTok", label: "TikTok account" },
      { id: "KeyAntivirus", labelKey: "product.subcategory.keyAntivirus", label: "Antivirus key" },
      { id: "AccCapCut", labelKey: "product.subcategory.accCapCut", label: "CapCut account" },
      { id: "KeyWindows", labelKey: "product.subcategory.keyWindows", label: "Windows key" },
      { id: "AccKhac", labelKey: "product.subcategory.accOther", label: "Other accounts" },
    ],
  },
  {
    id: "other",
    labelKey: "product.category.other",
    subcategories: [
      { id: "GiftCard", labelKey: "product.subcategory.giftCard", label: "Gift card" },
      { id: "VPS", labelKey: "product.subcategory.vps", label: "VPS" },
      { id: "Khac", labelKey: "product.subcategory.other", label: "Other" },
    ],
  },
];

export const SERVICE_CATEGORIES = [
  {
    id: "interaction",
    labelKey: "service.category.interaction",
    subcategories: [
      { id: "Facebook", labelKey: "service.filter.facebook", label: "Facebook" },
      { id: "TikTok", labelKey: "service.filter.tiktok", label: "TikTok" },
      { id: "Google", labelKey: "service.filter.google", label: "Google" },
      { id: "Telegram", labelKey: "service.filter.telegram", label: "Telegram" },
      { id: "Shopee", labelKey: "service.filter.shopee", label: "Shopee" },
      { id: "Discord", labelKey: "service.filter.discord", label: "Discord" },
      { id: "Twitter", labelKey: "service.filter.twitter", label: "Twitter" },
      { id: "YouTube", labelKey: "service.filter.youtube", label: "YouTube" },
      { id: "Zalo", labelKey: "service.filter.zalo", label: "Zalo" },
      { id: "Instagram", labelKey: "service.filter.instagram", label: "Instagram" },
      { id: "OtherInteraction", labelKey: "service.filter.otherInteraction", label: "Other" },
    ],
  },
  {
    id: "software",
    labelKey: "service.category.software",
    subcategories: [
      { id: "CodingTool", labelKey: "service.filter.codingTool", label: "Coding tool" },
      { id: "Design", labelKey: "service.filter.design", label: "Design" },
      { id: "Video", labelKey: "service.filter.video", label: "Video" },
      { id: "OtherTool", labelKey: "service.filter.otherTool", label: "Other tool" },
    ],
  },
  {
    id: "blockchain",
    labelKey: "service.category.blockchain",
    subcategories: [],
  },
  {
    id: "other",
    labelKey: "service.category.other",
    subcategories: [],
  },
];

export function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
    return map[char] || char;
  });
}

export function toSafeHtml(value) {
  if (!value) return "";
  const escaped = escapeHtml(value);
  return escaped.replace(/\r?\n/g, "<br>");
}

export function toPlainText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function getSessionUser(request) {
  if (!request) return null;
  const headers = request.headers;
  const headerRef = headers.get("x-user-id") || headers.get("x-user") || headers.get("x-user-ref");
  const email = headers.get("x-user-email") || "";
  const username = headers.get("x-user-username") || "";
  const id = String(headerRef || email || username || "").trim();
  if (!id) return null;
  return { id, email, username };
}

function authError(code, status) {
  return jsonResponse({ ok: false, error: code, status }, status);
}

function isTruthy(value) {
  if (value === true) return true;
  if (value === 1) return true;
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function getUserColumns(db) {
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
    return new Set();
  }
}

export async function findUserByRef(db, userRef) {
  if (!db || !userRef) return null;
  const ref = String(userRef || "").trim();
  if (!ref) return null;
  const cols = await getUserColumns(db);
  const conditions = [];
  const binds = [];
  if (cols.has("id")) {
    conditions.push("id = ?");
    binds.push(ref);
  }
  conditions.push("rowid = ?");
  binds.push(ref);
  if (cols.has("username")) {
    conditions.push("lower(username) = ?");
    binds.push(normalizeUsername(ref));
  }
  if (cols.has("email")) {
    conditions.push("lower(email) = ?");
    binds.push(normalizeEmail(ref));
  }
  if (!conditions.length) return null;
  const select = ["rowid AS row_id"];
  ["id", "email", "username", "display_name", "role", "status", "seller_approved", "badge"].forEach((field) => {
    if (cols.has(field)) select.push(field);
  });
  const sql = `SELECT ${select.join(", ")} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`;
  const row = await db.prepare(sql).bind(...binds).first();
  if (!row) return null;
  const resolvedId = row.id != null && row.id !== "" ? String(row.id) : String(row.row_id || "");
  return { ...row, resolvedId };
}

export async function requireUser(context) {
  const db = context?.env?.DB;
  if (!db) return { ok: false, response: authError("DB_NOT_CONFIGURED", 500) };
  const session = getSessionUser(context.request);
  if (!session || !session.id) {
    return { ok: false, response: authError("AUTH_REQUIRED", 401) };
  }
  const user = await findUserByRef(db, session.id);
  if (!user) {
    return { ok: false, response: authError("AUTH_REQUIRED", 401) };
  }
  if (String(user.status || "active").toLowerCase() !== "active") {
    return { ok: false, response: authError("ACCOUNT_DISABLED", 403) };
  }
  return { ok: true, db, user };
}

export async function requireSeller(context) {
  const base = await requireUser(context);
  if (!base.ok) return base;
  const user = base.user;
  const role = String(user.role || "").toLowerCase();
  const sellerApproved = isTruthy(user.seller_approved);
  if (role === "admin" || role === "seller" || sellerApproved) return base;
  const db = base.db;
  const userId = user.resolvedId || user.id;
  if (db && userId) {
    try {
      const row = await db
        .prepare(
          "SELECT 1 FROM shops WHERE user_id = ? AND (is_active = 1 OR lower(is_active) IN ('true','yes')) AND lower(trim(coalesce(status,''))) IN ('approved','active','published','pending_update','da duyet','đã duyệt','cho cap nhat','chờ cập nhật') LIMIT 1"
        )
        .bind(userId)
        .first();
      if (row) return base;
    } catch (error) {
      // ignore lookup failures
    }
  }
  return { ok: false, response: authError("SELLER_REQUIRED", 403) };
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

function getAdminPanelKeys(env) {
  const user =
    env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER
      ? env.ADMIN_PANEL_USER
      : env && typeof env.ADMIN_AUTH_KEY === "string"
        ? env.ADMIN_AUTH_KEY
        : "";
  const pass =
    env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS
      ? env.ADMIN_PANEL_PASS
      : env && typeof env.ADMIN_PANEL_KEY === "string"
        ? env.ADMIN_PANEL_KEY
        : "";
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
}

export async function requireAdmin(context) {
  const db = context?.env?.DB;
  if (!db) return { ok: false, response: authError("DB_NOT_CONFIGURED", 500) };
  const keys = getAdminPanelKeys(context?.env);
  const headerUser = context?.request?.headers?.get("x-admin-user") || "";
  const headerPass = context?.request?.headers?.get("x-admin-pass") || "";
  if (keys && safeEqual(headerUser, keys.authKey) && safeEqual(headerPass, keys.panelKey)) {
    return { ok: true, db, admin: true };
  }
  const session = getSessionUser(context.request);
  if (!session || !session.id) {
    return { ok: false, response: authError("UNAUTHORIZED", 401) };
  }
  const user = await findUserByRef(db, session.id);
  const role = user && user.role ? String(user.role).toLowerCase() : "";
  if (role === "admin") {
    return { ok: true, db, admin: true, user };
  }
  return { ok: false, response: authError("UNAUTHORIZED", 401) };
}

export function buildSlug(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function computeEtag(payload) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(encoder.encode(String(value)));
}

async function getMediaSigningKey(secret) {
  if (!secret) return null;
  if (mediaSigningKeyCache.key && mediaSigningKeyCache.secret === secret) return mediaSigningKeyCache.key;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  mediaSigningKeyCache = { secret, key };
  return key;
}

async function signMediaPayload(payloadB64, secret) {
  const key = await getMediaSigningKey(secret);
  if (!key) return "";
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export async function createSignedMediaToken(secret, key, exp, kind) {
  if (!secret || !key) return "";
  const payload = { key, exp };
  if (kind) payload.kind = kind;
  const payloadB64 = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signMediaPayload(payloadB64, secret);
  if (!signature) return "";
  return `${payloadB64}.${signature}`;
}

export function buildMediaUrl(requestUrl, token) {
  const safeToken = token ? encodeURIComponent(token) : "";
  if (!safeToken) return "";
  try {
    const url = new URL(requestUrl);
    return `${url.origin}/media/${safeToken}`;
  } catch (error) {
    return `/media/${safeToken}`;
  }
}

export async function jsonCachedResponse(request, payload, options = {}) {
  const body = JSON.stringify(payload);
  const etag = await computeEtag(body);
  const tag = `"${etag}"`;
  const cacheHeaders = {
    "content-type": "application/json",
    "cache-control": options.cacheControl || "private, max-age=0, must-revalidate",
    vary: options.vary || "Cookie",
    etag: tag,
  };
  if (request && request.headers && request.headers.get("if-none-match") === tag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }
  return new Response(body, { status: 200, headers: cacheHeaders });
}

export { jsonResponse, readJsonBody };
