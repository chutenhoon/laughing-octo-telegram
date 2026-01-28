import { jsonResponse, readJsonBody, generateId } from "../auth/_utils.js";
import {
  buildSlug,
  requireSeller,
  toPlainText,
  PRODUCT_CATEGORIES,
  SERVICE_CATEGORIES,
  createSignedMediaToken,
  buildMediaUrl,
} from "../_catalog.js";

async function getShopColumns(db) {
  const result = await db.prepare("PRAGMA table_info(shops)").all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const cols = new Set();
  rows.forEach((row) => {
    if (row && row.name) cols.add(String(row.name));
  });
  return cols;
}

const SHOP_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    store_slug TEXT UNIQUE,
    store_type TEXT,
    category TEXT,
    subcategory TEXT,
    tags_json TEXT,
    short_desc TEXT,
    long_desc TEXT,
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    avatar_media_id TEXT,
    avatar_r2_key TEXT,
    avatar_r2_etag TEXT,
    avatar_content_type TEXT,
    avatar_size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    is_active INTEGER NOT NULL DEFAULT 1,
    rating REAL NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    stock_count INTEGER NOT NULL DEFAULT 0,
    pending_change_json TEXT,
    review_note TEXT,
    rejected_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (avatar_media_id) REFERENCES media_metadata(id) ON DELETE SET NULL
  );
`;

const SHOP_COLUMN_DEFS = [
  { name: "store_type", def: "TEXT" },
  { name: "category", def: "TEXT" },
  { name: "subcategory", def: "TEXT" },
  { name: "tags_json", def: "TEXT" },
  { name: "short_desc", def: "TEXT" },
  { name: "long_desc", def: "TEXT" },
  { name: "description", def: "TEXT" },
  { name: "contact_email", def: "TEXT" },
  { name: "contact_phone", def: "TEXT" },
  { name: "avatar_media_id", def: "TEXT" },
  { name: "avatar_r2_key", def: "TEXT" },
  { name: "avatar_r2_etag", def: "TEXT" },
  { name: "avatar_content_type", def: "TEXT" },
  { name: "avatar_size", def: "INTEGER DEFAULT 0" },
  { name: "status", def: "TEXT DEFAULT 'pending'" },
  { name: "is_active", def: "INTEGER DEFAULT 1" },
  { name: "rating", def: "REAL DEFAULT 0" },
  { name: "total_reviews", def: "INTEGER DEFAULT 0" },
  { name: "total_orders", def: "INTEGER DEFAULT 0" },
  { name: "stock_count", def: "INTEGER DEFAULT 0" },
  { name: "pending_change_json", def: "TEXT" },
  { name: "review_note", def: "TEXT" },
  { name: "rejected_at", def: "TEXT" },
  { name: "created_at", def: "TEXT" },
  { name: "updated_at", def: "TEXT" },
];

async function ensureShopSchema(db) {
  try {
    await db.prepare(SHOP_TABLE_SQL).run();
  } catch (error) {
    // ignore create failures
  }
  const cols = await getShopColumns(db);
  for (const column of SHOP_COLUMN_DEFS) {
    if (cols.has(column.name)) continue;
    try {
      await db.prepare(`ALTER TABLE shops ADD COLUMN ${column.name} ${column.def}`).run();
      cols.add(column.name);
    } catch (error) {
      // ignore add failures
    }
  }
  return cols;
}

async function ensureUniqueSlug(db, slug, shopId) {
  if (!slug) return "";
  let next = slug;
  for (let i = 0; i < 5; i += 1) {
    const row = await db.prepare("SELECT id FROM shops WHERE store_slug = ? LIMIT 1").bind(next).first();
    if (!row || (shopId && row.id === shopId)) return next;
    next = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slug}-${Date.now().toString(36).slice(-4)}`;
}

function mapShop(row) {
  return {
    id: row.id,
    name: row.store_name,
    slug: row.store_slug,
    storeType: row.store_type || "",
    category: row.category || "",
    subcategory: row.subcategory || "",
    tags: [],
    descriptionShort: row.short_desc || "",
    descriptionLong: row.long_desc || row.description || "",
    status: row.status || "pending",
    isActive: Number(row.is_active || 0) === 1,
    rating: Number(row.rating || 0),
    totalReviews: Number(row.total_reviews || 0),
    totalOrders: Number(row.total_orders || 0),
    stockCount: Number(row.stock_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    avatarId: row.avatar_media_id || "",
    avatarUrl: "",
    reviewNote: row.review_note || "",
    pendingChange: null,
  };
}

function normalizeStoreType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "service" || raw === "dichvu" || raw === "dịch vụ") return "service";
  if (raw === "product" || raw === "sanpham" || raw === "sản phẩm") return "product";
  return "";
}

function getCategoryList(type) {
  return type === "service" ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
}

function findCategory(type, categoryId) {
  const list = getCategoryList(type);
  return list.find((item) => String(item.id) === String(categoryId)) || null;
}

function normalizeTags(input, category) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const allowed = new Set(
    (category && Array.isArray(category.subcategories) ? category.subcategories : []).map((item) => String(item.id))
  );
  const tags = [];
  raw.forEach((item) => {
    const value = String(item || "").trim();
    if (!value) return;
    if (allowed.size && !allowed.has(value)) return;
    if (!tags.includes(value)) tags.push(value);
  });
  return tags;
}

async function buildAvatarUrl(requestUrl, env, key) {
  const r2Key = String(key || "").trim();
  if (!r2Key) return "";
  const secret = env && typeof env.MEDIA_SIGNING_SECRET === "string" ? env.MEDIA_SIGNING_SECRET.trim() : "";
  if (!secret) return "";
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const token = await createSignedMediaToken(secret, r2Key, exp, "store-avatar");
  return token ? buildMediaUrl(requestUrl, token) : "";
}

function parsePendingChange(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

export async function onRequestGet(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  const sql = `
    SELECT id, store_name, store_slug, store_type, category, subcategory, tags_json,
           short_desc, long_desc, description, avatar_media_id, avatar_r2_key,
           status, is_active, rating, total_reviews, total_orders, stock_count, review_note, pending_change_json,
           created_at, updated_at
      FROM shops
     WHERE user_id = ?
     ORDER BY created_at DESC
  `;
  const rows = await db.prepare(sql).bind(userId).all();
  const list = await Promise.all(
    (rows && Array.isArray(rows.results) ? rows.results : []).map(async (row) => {
      const mapped = mapShop(row);
      if (row.tags_json) {
        try {
          mapped.tags = JSON.parse(row.tags_json || "[]") || [];
        } catch (error) {
          mapped.tags = [];
        }
      }
      mapped.avatarUrl = await buildAvatarUrl(context.request.url, context.env, row.avatar_r2_key);
      mapped.pendingChange = parsePendingChange(row.pending_change_json);
      return mapped;
    })
  );
  return jsonResponse({ ok: true, items: list });
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const isAdmin = String(auth.user.role || "").toLowerCase() === "admin";
  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const name = String(body.name || body.store_name || body.storeName || "").trim();
  if (!name) return jsonResponse({ ok: false, error: "NAME_REQUIRED" }, 400);
  const requestedType = normalizeStoreType(body.storeType || body.store_type || body.type || body.kind);
  const category = String(body.category || "").trim();
  const subcategoryInput = String(body.subcategory || "").trim();
  const tagsInput = body.tags || body.tags_json || body.tagList || null;
  const shortDesc = String(body.description_short || body.short_desc || body.shortDesc || "").trim();
  const longDescRaw = String(body.description_long || body.long_desc || body.description || body.longDesc || "").trim();

  const shopColumns = await ensureShopSchema(db);
  const now = new Date().toISOString();
  let shopId = body.id ? String(body.id).trim() : "";

  let existingRow = null;
  if (shopId) {
    const row = await db
      .prepare("SELECT id, user_id, status, store_type, category, subcategory, tags_json FROM shops WHERE id = ? LIMIT 1")
      .bind(shopId)
      .first();
    if (!row || String(row.user_id) !== String(userId)) {
      return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
    }
    shopId = String(row.id);
    existingRow = row;
  } else {
    const existing = await db.prepare("SELECT id FROM shops WHERE user_id = ? LIMIT 1").bind(userId).first();
    if (existing && existing.id) shopId = String(existing.id);
  }

  let slug = String(body.slug || body.store_slug || body.storeSlug || "").trim();
  if (!slug) slug = buildSlug(name);

  if (!shopId) {
    const storeType = requestedType;
    if (!storeType) return jsonResponse({ ok: false, error: "TYPE_REQUIRED" }, 400);
    const categoryInfo = findCategory(storeType, category);
    if (!categoryInfo) return jsonResponse({ ok: false, error: "CATEGORY_REQUIRED" }, 400);
    const tags = normalizeTags(tagsInput, categoryInfo);
    const primaryTag = tags.length ? tags[0] : subcategoryInput || "";
    if (primaryTag && !categoryInfo.subcategories?.some((item) => String(item.id) === String(primaryTag))) {
      return jsonResponse({ ok: false, error: "INVALID_TAG" }, 400);
    }
    shopId = generateId();
    if (!slug) slug = `store-${shopId.slice(0, 8)}`;
    slug = await ensureUniqueSlug(db, slug, shopId);
    const description = toPlainText(longDescRaw);
    const columns = ["id", "user_id", "store_name"];
    const values = [shopId, userId, name];
    const push = (col, val) => {
      if (!shopColumns.has(col)) return;
      columns.push(col);
      values.push(val);
    };
    push("store_slug", slug || null);
    push("store_type", storeType || null);
    push("category", category || null);
    push("subcategory", primaryTag || null);
    push("tags_json", JSON.stringify(tags));
    push("short_desc", shortDesc || null);
    push("long_desc", longDescRaw || null);
    push("description", description || null);
    push("status", "pending");
    push("is_active", 1);
    push("created_at", now);
    push("updated_at", now);
    const placeholders = columns.map(() => "?").join(", ");
    await db.prepare(`INSERT INTO shops (${columns.join(", ")}) VALUES (${placeholders})`).bind(...values).run();
  } else {
    const updates = [];
    const binds = [];
    const push = (col, val) => {
      if (shopColumns.has(col)) {
        updates.push(`${col} = ?`);
        binds.push(val);
      }
    };
    const row = existingRow || {};
    const currentStatus = String(row.status || "").toLowerCase();
    const isApproved = currentStatus === "approved" || currentStatus === "active" || currentStatus === "published";
    const currentType = normalizeStoreType(row.store_type) || requestedType;
    const categoryInfo = category ? findCategory(currentType || "product", category) : null;
    const tags = normalizeTags(tagsInput, categoryInfo);
    const primaryTag = tags.length ? tags[0] : subcategoryInput || "";

    if (!slug) slug = `store-${shopId.slice(0, 8)}`;
    slug = await ensureUniqueSlug(db, slug, shopId);

    const patch = {
      store_name: name,
      store_slug: slug || null,
      store_type: currentType || null,
      category: category || null,
      subcategory: primaryTag || null,
      tags_json: tags.length ? JSON.stringify(tags) : null,
      short_desc: shortDesc || null,
      long_desc: longDescRaw || null,
      description: toPlainText(longDescRaw) || null,
    };

    const canDirectUpdate = !isApproved;
    if (!canDirectUpdate && !isAdmin) {
      const pending = {
        ...patch,
        submittedAt: now,
      };
      push("pending_change_json", JSON.stringify(pending));
      push("status", "pending_update");
    } else {
      Object.entries(patch).forEach(([key, val]) => push(key, val));
    }
    if (!isAdmin && (currentStatus === "rejected" || currentStatus === "withdrawn")) {
      push("status", "pending");
      push("review_note", null);
      push("pending_change_json", null);
    }

    if (body.isActive != null) push("is_active", body.isActive ? 1 : 0);
    if (shopColumns.has("updated_at")) {
      updates.push("updated_at = ?");
      binds.push(now);
    }
    if (updates.length) {
      binds.push(shopId);
      await db.prepare(`UPDATE shops SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
    }
  }

  const refreshed = await db.prepare(
    `SELECT id, store_name, store_slug, store_type, category, subcategory, tags_json, short_desc, long_desc, description,
            avatar_media_id, avatar_r2_key, status, is_active, rating, total_reviews, total_orders, stock_count,
            review_note, pending_change_json, created_at, updated_at
       FROM shops WHERE id = ? LIMIT 1`
  ).bind(shopId).first();

  const mapped = mapShop(refreshed || {});
  if (refreshed && refreshed.tags_json) {
    try {
      mapped.tags = JSON.parse(refreshed.tags_json || "[]") || [];
    } catch (error) {
      mapped.tags = [];
    }
  }
  mapped.avatarUrl = await buildAvatarUrl(context.request.url, context.env, refreshed && refreshed.avatar_r2_key);
  mapped.pendingChange = parsePendingChange(refreshed && refreshed.pending_change_json);
  return jsonResponse({ ok: true, shop: mapped });
}
