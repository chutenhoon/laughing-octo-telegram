import { jsonResponse } from "./auth/_utils.js";
import { toPlainText, requireAdmin } from "./_catalog.js";

const SOLD_STATUSES = ["delivered", "completed", "success"];

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function buildSearch(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return `%${trimmed.replace(/\s+/g, "%")}%`;
}

function parseList(value) {
  const raw = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function flagTrue(column) {
  return `(${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${flagTrue(column)})`;
}

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
const CATEGORY_DB_ALIASES = {
  email: ["mail", "e-mail"],
  tool: ["software", "phan mem", "phan-mem"],
  account: ["tai khoan", "tai-khoan", "acc"],
  other: ["khac", "misc", "others"],
};

function normalizeCategory(value) {
  const trimmed = String(value || "").trim();
  const key = trimmed ? trimmed.toLowerCase() : "";
  if (PRODUCT_CATEGORY_KEYS.has(key)) return key;
  return CATEGORY_ALIASES.get(key) || "";
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

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getCategoryDbValues(category) {
  const key = normalizeCategory(category);
  if (!key) return [];
  const base = [key, ...(CATEGORY_DB_ALIASES[key] || [])].map(normalizeValue).filter(Boolean);
  return Array.from(new Set(base));
}

function resolveCategoryFromValue(value) {
  const key = normalizeValue(value);
  if (!key) return "";
  return CATEGORY_VALUE_MAP.get(key) || "";
}

function buildCategoryFallbackClause(category, binds) {
  const values = CATEGORY_FALLBACK_VALUES[category] || [];
  if (!values.length) return "";
  const normalized = values.map(normalizeValue).filter(Boolean);
  if (!normalized.length) return "";
  const parts = [];
  const subPlaceholders = normalized.map(() => "?").join(", ");
  parts.push(`lower(trim(COALESCE(p.subcategory, s.subcategory, ''))) IN (${subPlaceholders})`);
  binds.push(...normalized);
  const tagClauses = normalized.map(() => "lower(COALESCE(p.tags_json, s.tags_json, '')) LIKE ?").join(" OR ");
  if (tagClauses) {
    parts.push(`(${tagClauses})`);
    normalized.forEach((value) => {
      binds.push(`%${value}%`);
    });
  }
  return parts.length ? `(${parts.join(" OR ")})` : "";
}

function buildCategoryClause(category, binds) {
  const key = normalizeCategory(category);
  if (!key) return "";
  const baseExpr = "lower(trim(COALESCE(NULLIF(p.category, ''), NULLIF(s.category, ''))))";
  const missingExpr = "(COALESCE(NULLIF(trim(p.category), ''), NULLIF(trim(s.category), '')) IS NULL)";
  const baseValues = getCategoryDbValues(key);
  const basePlaceholders = baseValues.map(() => "?").join(", ");
  const baseClause = baseValues.length ? `${baseExpr} IN (${basePlaceholders})` : "";
  const fallbackBinds = [];
  const fallbackClause = buildCategoryFallbackClause(key, fallbackBinds);
  if (fallbackClause && baseClause) {
    binds.push(...baseValues, ...fallbackBinds);
    return `(${baseClause} OR (${missingExpr} AND ${fallbackClause}))`;
  }
  if (baseClause) {
    binds.push(...baseValues);
    return baseClause;
  }
  return "";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[a-z0-9]+$/i;

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

function buildWhere(params, binds, options = {}) {
  const clauses = [
    "(lower(trim(p.kind)) = 'product' OR (p.kind IS NULL AND (p.type IS NULL OR lower(trim(p.type)) <> 'service')))",
  ];
  if (!options.includeInactive) {
    clauses.push(flagTrueOrNull("p.is_active"));
  }
  if (!options.includeUnpublished) {
    clauses.push(flagTrueOrNull("p.is_published"));
  }
  clauses.push(flagTrueOrNull("s.is_active"));
  if (!options.includeUnapproved) {
    clauses.push("lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update')");
  }

  if (params.category) {
    const categoryClause = buildCategoryClause(params.category, binds);
    if (categoryClause) clauses.push(categoryClause);
  }
  if (params.subcategories.length) {
    const placeholders = params.subcategories.map(() => "?").join(", ");
    const tagClauses = params.subcategories.map(() => "COALESCE(p.tags_json, s.tags_json, '') LIKE ?").join(" OR ");
    clauses.push(`(COALESCE(p.subcategory, s.subcategory) IN (${placeholders}) OR ${tagClauses})`);
    binds.push(...params.subcategories);
    params.subcategories.forEach((tag) => {
      binds.push(`%\"${tag}\"%`);
    });
  }
  if (params.shopId) {
    clauses.push("p.shop_id = ?");
    binds.push(params.shopId);
  }
  if (params.search) {
    clauses.push("(p.name LIKE ? OR p.description LIKE ? OR p.description_short LIKE ?)");
    binds.push(params.search, params.search, params.search);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function buildOrder(sort) {
  if (sort === "custom" || sort === "order") {
    return "ORDER BY CASE WHEN p.sort_order IS NULL OR p.sort_order = 0 THEN 1 ELSE 0 END, p.sort_order ASC, p.created_at DESC";
  }
  if (sort === "rating") return "ORDER BY shop_rating DESC, sold_count DESC, p.created_at DESC";
  if (sort === "newest") return "ORDER BY p.created_at DESC";
  return "ORDER BY sold_count DESC, p.created_at DESC";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const url = new URL(context.request.url);
    const preview = String(url.searchParams.get("preview") || "").toLowerCase();
    let includeUnapproved = false;
    let includeUnpublished = false;
    let includeInactive = false;
    if (preview === "1" || preview === "true") {
      const adminAuth = await requireAdmin(context);
      if (adminAuth && adminAuth.ok) {
        includeUnapproved = true;
        includeUnpublished = true;
        includeInactive = true;
      }
    }
    const includeCounts = ["1", "true", "yes"].includes(String(url.searchParams.get("includeCounts") || "").toLowerCase());
    const shopId = String(url.searchParams.get("shop") || url.searchParams.get("shopId") || "").trim();
    const sortParam = url.searchParams.get("sort");
    const categoryValue = normalizeCategory(url.searchParams.get("category"));
    const params = {
      category: categoryValue,
      subcategories: parseList(url.searchParams.get("subcategory") || url.searchParams.get("subcategories") || ""),
      search: buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || ""),
      sort: String(sortParam || (shopId ? "custom" : "popular")).trim(),
      shopId,
      page: normalizeNumber(url.searchParams.get("page"), 1),
      perPage: normalizeNumber(url.searchParams.get("perPage") || url.searchParams.get("limit"), 10),
    };
    params.page = Math.max(1, Math.floor(params.page));
    params.perPage = Math.min(40, Math.max(1, Math.floor(params.perPage)));

    const binds = [];
    const whereClause = buildWhere(params, binds, { includeUnapproved, includeUnpublished, includeInactive });
    const orderClause = buildOrder(params.sort);
    const offset = (params.page - 1) * params.perPage;

    const countSql = `
      SELECT COUNT(1) AS total
        FROM products p
        JOIN shops s ON s.id = p.shop_id
       ${whereClause}
    `;
    const countRow = await db.prepare(countSql).bind(...binds).first();
    const total = Number(countRow && countRow.total ? countRow.total : 0);

    let subcategoryCounts = null;
    if (includeCounts) {
      const countParams = { ...params, subcategories: [] };
      const countBinds = [];
      const countWhere = buildWhere(countParams, countBinds, { includeUnapproved, includeUnpublished, includeInactive });
      const subcategorySql = `
        SELECT COALESCE(NULLIF(p.subcategory, ''), NULLIF(s.subcategory, '')) AS subcategory,
               COUNT(1) AS total
          FROM products p
          JOIN shops s ON s.id = p.shop_id
         ${countWhere}
         GROUP BY COALESCE(NULLIF(p.subcategory, ''), NULLIF(s.subcategory, ''))
      `;
      const subRows = await db.prepare(subcategorySql).bind(...countBinds).all();
      const counts = {};
      const results = subRows && Array.isArray(subRows.results) ? subRows.results : [];
      results.forEach((row) => {
        const key = row && row.subcategory ? String(row.subcategory).trim() : "";
        if (!key) return;
        counts[key] = Number(row.total || 0);
      });
      subcategoryCounts = counts;
    }

    const soldCondition = SOLD_STATUSES.map(() => "?").join(", ");
    const soldBinds = [...SOLD_STATUSES, ...binds, params.perPage, offset];
    const listSql = `
      SELECT p.id, p.shop_id, p.name, p.description_short, p.description, p.category, p.subcategory, p.tags_json,
             p.price, p.price_max, p.stock_count, p.thumbnail_media_id, p.status, p.created_at,
             p.is_active, p.is_published, p.kind, p.type,
             s.store_name, s.store_slug, s.rating AS shop_rating, s.category AS store_category, s.subcategory AS store_subcategory, s.tags_json AS store_tags_json,
             u.badge, u.role, u.display_name, u.username, u.title, u.rank,
             (
               SELECT COALESCE(SUM(oi.quantity), 0)
                 FROM order_items oi
                WHERE oi.product_id = p.id
                  AND oi.fulfillment_status IN (${soldCondition})
             ) AS sold_count
        FROM products p
        JOIN shops s ON s.id = p.shop_id
        LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       ${orderClause}
       LIMIT ? OFFSET ?
    `;
    const rows = await db.prepare(listSql).bind(...soldBinds).all();
    const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => {
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
      const shopSlug = row.shop_id ? buildShopSlug(row.store_name || row.store_slug || "shop", row.shop_id) : row.store_slug || "";
      return {
        id: row.id,
        slug: buildProductSlug(row.name, row.id),
        shopId: row.shop_id,
        shopSlug,
        title: row.name,
        descriptionShort: row.description_short || toPlainText(row.description || ""),
        category: resolvedCategory,
        subcategory: row.subcategory || row.store_subcategory || "",
        tags,
        price: Number(row.price || 0),
        priceMax: row.price_max != null ? Number(row.price_max || 0) : null,
        stockCount: Number(row.stock_count || 0),
        soldCount: Number(row.sold_count || 0),
        rating: Number(row.shop_rating || 0),
        status: row.status || "draft",
        isActive: row.is_active != null ? Number(row.is_active || 0) === 1 : null,
        isPublished: row.is_published != null ? Number(row.is_published || 0) === 1 : null,
        kind: row.kind || "",
        type: row.type || "",
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
      };
    });

    return jsonResponse({
      ok: true,
      items,
      page: params.page,
      perPage: params.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.perPage)),
      ...(subcategoryCounts ? { subcategoryCounts } : {}),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
