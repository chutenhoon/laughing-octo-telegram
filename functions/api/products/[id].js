import { jsonResponse } from "../auth/_utils.js";
import { getSessionUser, findUserByRef, toSafeHtml, toPlainText, jsonCachedResponse } from "../_catalog.js";

const SOLD_STATUSES = ["delivered", "completed", "success"];

function isApprovedStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "approved" || value === "active" || value === "published" || value === "pending_update";
}

function flagTrue(column) {
  return `(${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${flagTrue(column)})`;
}

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isVisibleProductStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return true;
  return value !== "disabled" && value !== "blocked" && value !== "banned";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_PATTERN = /^[0-9a-f]{32}$/i;
const SAFE_ID_PATTERN = /^[a-z0-9]+$/i;

const PRODUCT_CATEGORY_KEYS = new Set(["email", "tool", "account", "other"]);
const CATEGORY_ALIASES = new Map([
  ["software", "tool"],
  ["phan mem", "tool"],
  ["phan-mem", "tool"],
  ["mail", "email"],
  ["e-mail", "email"],
  ["tai khoan", "account"],
  ["acc", "account"],
  ["khac", "other"],
  ["misc", "other"],
  ["others", "other"],
]);

function slugifyText(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function encodeProductSlugId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return raw;
  if (UUID_PATTERN.test(raw)) return raw.replace(/-/g, "").toLowerCase();
  if (SAFE_ID_PATTERN.test(raw)) return raw.toLowerCase();
  return raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function buildProductSlug(name, id) {
  const base = slugifyText(name || "product");
  const suffix = encodeProductSlugId(id);
  if (!suffix) return base;
  if (!base) return suffix;
  return `${base}-${suffix}`;
}

function buildShopSlug(name, id) {
  const base = slugifyText(name || "shop");
  const suffix = encodeProductSlugId(id);
  if (!suffix) return base;
  if (!base) return suffix;
  return `${base}-${suffix}`;
}

const CATEGORY_FALLBACK_VALUES = {
  email: [
    "gmail",
    "gmail edu",
    "gmail.edu",
    "hotmail",
    "outlookmail",
    "outlook",
    "rumail",
    "ru mail",
    "domainemail",
    "domain email",
    "yahoomail",
    "yahoo",
    "protonmail",
    "proton",
    "emailkhac",
    "email khac",
    "email",
    "mail",
    "e-mail",
  ],
  tool: [
    "toolfacebook",
    "toolgoogle",
    "toolyoutube",
    "toolcrypto",
    "toolptc",
    "toolcaptcha",
    "tooloffer",
    "toolptu",
    "toolkhac",
    "tool other",
    "facebook tool",
    "google tool",
    "youtube tool",
    "crypto tool",
    "ptc tool",
    "captcha tool",
    "offer tool",
    "ptu tool",
    "checker",
    "phan mem",
    "phan-mem",
    "software",
    "app",
  ],
  account: [
    "accfacebook",
    "accbm",
    "acczalo",
    "acctwitter",
    "acctelegram",
    "accinstagram",
    "accshopee",
    "accdiscord",
    "acctiktok",
    "keyantivirus",
    "acccapcut",
    "keywindows",
    "acckhac",
    "facebook account",
    "tiktok account",
    "discord account",
    "zalo account",
    "telegram account",
    "instagram account",
    "shopee account",
    "twitter account",
    "business manager",
    "bm",
    "account",
    "tai khoan",
    "tai-khoan",
  ],
  other: ["giftcard", "gift card", "vps", "khac", "other"],
};

const CATEGORY_VALUE_MAP = new Map();
Object.entries(CATEGORY_FALLBACK_VALUES).forEach(([category, values]) => {
  values.forEach((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return;
    if (!CATEGORY_VALUE_MAP.has(key)) CATEGORY_VALUE_MAP.set(key, category);
  });
});

function normalizeCategory(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (PRODUCT_CATEGORY_KEYS.has(trimmed)) return trimmed;
  return CATEGORY_ALIASES.get(trimmed) || "";
}

function resolveCategoryFromValue(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  return CATEGORY_VALUE_MAP.get(key) || "";
}

function resolveCategory(row, tags) {
  const direct = normalizeCategory(row.category || row.store_category || "");
  if (direct) return direct;
  const subValue = resolveCategoryFromValue(row.subcategory || row.store_subcategory || "");
  if (subValue) return subValue;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const match = resolveCategoryFromValue(tag);
      if (match) return match;
    }
  }
  return "";
}

function expandCompactUuid(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!COMPACT_UUID_PATTERN.test(raw)) return "";
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function parseSlugToId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (UUID_PATTERN.test(raw)) return raw.toLowerCase();
  const parts = raw.split("-").filter(Boolean);
  if (!parts.length) return "";
  const suffix = parts[parts.length - 1];
  if (/^\d+$/.test(suffix)) return suffix;
  if (COMPACT_UUID_PATTERN.test(suffix)) return expandCompactUuid(suffix);
  if (SAFE_ID_PATTERN.test(suffix)) return suffix.toLowerCase();
  return "";
}

async function findProductIdBySlug(db, slug) {
  const raw = String(slug || "").trim().toLowerCase();
  if (!raw) return "";
  const base = raw.replace(/-[^-]+$/, "");
  const search = base.replace(/-/g, " ").trim();
  if (!search) return "";
  const like = `%${search.replace(/\s+/g, "%")}%`;
  const result = await db
    .prepare("SELECT id, name FROM products WHERE kind = 'product' AND name LIKE ? LIMIT 50")
    .bind(like)
    .all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  for (const row of rows) {
    if (!row) continue;
    const candidate = buildProductSlug(row.name, row.id);
    if (candidate === raw) return row.id;
  }
  return "";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const rawRef = context?.params?.id ? String(context.params.id).trim() : "";
    if (!rawRef) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);
    let productId = parseSlugToId(rawRef);

    const soldCondition = SOLD_STATUSES.map(() => "?").join(", ");
    const sql = `
      SELECT p.id, p.shop_id, p.name, p.description_short, p.description, p.description_html,
             p.category, p.subcategory, p.tags_json, p.price, p.price_max, p.stock_count, p.thumbnail_media_id,
             p.status, p.is_active, p.is_published, p.created_at,
             s.store_name, s.store_slug, s.short_desc, s.long_desc, s.description AS shop_desc,
             s.category AS store_category, s.subcategory AS store_subcategory, s.tags_json AS store_tags_json,
             s.user_id AS owner_user_id,
             s.rating AS shop_rating, s.status AS shop_status, s.is_active AS shop_active,
             u.display_name, u.username, u.badge, u.title, u.rank, u.role,
             (
               SELECT COALESCE(SUM(oi.quantity), 0)
                 FROM order_items oi
                WHERE oi.product_id = p.id
                  AND oi.fulfillment_status IN (${soldCondition})
             ) AS sold_count
        FROM products p
        JOIN shops s ON s.id = p.shop_id
        LEFT JOIN users u ON u.id = s.user_id
       WHERE p.id = ?
         AND p.kind = 'product'
       LIMIT 1
    `;
    let row = null;
    if (productId) {
      row = await db.prepare(sql).bind(...SOLD_STATUSES, productId).first();
    }
    if (!row && rawRef && rawRef !== productId) {
      row = await db.prepare(sql).bind(...SOLD_STATUSES, rawRef).first();
      if (row) productId = row.id;
    }
    if (!row) {
      const fallbackId = await findProductIdBySlug(db, rawRef);
      if (fallbackId) {
        row = await db.prepare(sql).bind(...SOLD_STATUSES, fallbackId).first();
        if (row) productId = row.id;
      }
    }
    if (!row) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

    const session = getSessionUser(context.request);
    let viewer = null;
    if (session && session.id) viewer = await findUserByRef(db, session.id);
    const isOwner = viewer && String(viewer.resolvedId || viewer.id) === String(row.owner_user_id || "");
    const isAdmin = viewer && String(viewer.role || "").toLowerCase() === "admin";

    const productActive = isTruthyFlag(row.is_active) && isTruthyFlag(row.is_published) && isVisibleProductStatus(row.status);
    const shopActive = isTruthyFlag(row.shop_active) && isApprovedStatus(row.shop_status);
    if (!productActive || !shopActive) {
      if (!isOwner && !isAdmin) {
        return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
      }
    }

    let tags = [];
    const tagsSource = row.tags_json || row.store_tags_json;
    if (tagsSource) {
      try {
        tags = JSON.parse(tagsSource) || [];
      } catch (error) {
        tags = [];
      }
    }

    const resolvedCategory = resolveCategory(row, tags);
    const shopSlug = buildShopSlug(row.store_name || row.store_slug || "shop", row.shop_id);
    const product = {
      id: row.id,
      slug: buildProductSlug(row.name, row.id),
      shopId: row.shop_id,
      title: row.name,
      descriptionShort: row.description_short || toPlainText(row.description || ""),
      descriptionHtml: row.description_html ? row.description_html : toSafeHtml(row.description || ""),
      category: resolvedCategory,
      subcategory: row.subcategory || row.store_subcategory || "",
      tags,
      price: Number(row.price || 0),
      priceMax: row.price_max != null ? Number(row.price_max || 0) : null,
      stockCount: Number(row.stock_count || 0),
      soldCount: Number(row.sold_count || 0),
      rating: Number(row.shop_rating || 0),
      status: row.status || "draft",
      createdAt: row.created_at || null,
      thumbnailId: row.thumbnail_media_id || "",
      seller: {
        name: row.store_name || "",
        slug: shopSlug,
        badge: row.badge || "",
        role: row.role || "",
        username: row.username || "",
        displayName: row.display_name || "",
        title: row.title || "",
        rank: row.rank || "",
      },
      shopSlug,
      shop: {
        id: row.shop_id,
        name: row.store_name || "",
        slug: shopSlug,
        storeSlug: row.store_slug || "",
        rating: Number(row.shop_rating || 0),
        descriptionShort: row.short_desc || "",
        descriptionHtml: toSafeHtml(row.long_desc || row.shop_desc || ""),
      },
    };

    const canPreviewShopItems = isOwner || isAdmin;
    const visibilityClause = canPreviewShopItems
      ? "1=1"
      : `${flagTrueOrNull("is_active")} AND ${flagTrueOrNull("is_published")} AND lower(trim(coalesce(status,''))) NOT IN ('disabled','blocked','banned')`;

    const shopItemsSql = `
      SELECT id, name, price, price_max, stock_count, thumbnail_media_id, sort_order, created_at
        FROM products
       WHERE shop_id = ?
         AND (lower(trim(kind)) = 'product' OR (kind IS NULL AND (type IS NULL OR lower(trim(type)) <> 'service')))
         AND ${visibilityClause}
       ORDER BY CASE WHEN sort_order IS NULL OR sort_order = 0 THEN 1 ELSE 0 END, sort_order ASC, created_at DESC
       LIMIT 40
    `;
    const shopItemRows = await db.prepare(shopItemsSql).bind(row.shop_id).all();
    const shopItems = (shopItemRows && Array.isArray(shopItemRows.results) ? shopItemRows.results : []).map((item) => ({
      id: item.id,
      slug: buildProductSlug(item.name, item.id),
      title: item.name,
      price: Number(item.price || 0),
      priceMax: item.price_max != null ? Number(item.price_max || 0) : null,
      stockCount: Number(item.stock_count || 0),
      thumbnailId: item.thumbnail_media_id || "",
      createdAt: item.created_at || null,
    }));
    const others = shopItems.filter((item) => String(item.id) !== String(row.id));

    const payload = { ok: true, product, shopItems, others };
    return jsonCachedResponse(context.request, payload, {
      cacheControl: "private, max-age=0, must-revalidate",
      vary: "Cookie",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
