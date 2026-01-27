import { jsonResponse, readJsonBody, generateId } from "../auth/_utils.js";
import { buildSlug, requireSeller, toPlainText } from "../_catalog.js";

async function getShopColumns(db) {
  const result = await db.prepare("PRAGMA table_info(shops)").all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const cols = new Set();
  rows.forEach((row) => {
    if (row && row.name) cols.add(String(row.name));
  });
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
    category: row.category || "",
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
  };
}

export async function onRequestGet(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  const sql = `
    SELECT id, store_name, store_slug, category, short_desc, long_desc, description, avatar_media_id,
           status, is_active, rating, total_reviews, total_orders, stock_count, created_at, updated_at
      FROM shops
     WHERE user_id = ?
     ORDER BY created_at DESC
  `;
  const rows = await db.prepare(sql).bind(userId).all();
  const list = (rows && Array.isArray(rows.results) ? rows.results : []).map(mapShop);
  return jsonResponse({ ok: true, items: list });
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const name = String(body.name || body.store_name || body.storeName || "").trim();
  if (!name) return jsonResponse({ ok: false, error: "NAME_REQUIRED" }, 400);
  const category = String(body.category || "").trim();
  const shortDesc = String(body.description_short || body.short_desc || body.shortDesc || "").trim();
  const longDescRaw = String(body.description_long || body.long_desc || body.description || body.longDesc || "").trim();

  const shopColumns = await getShopColumns(db);
  const now = new Date().toISOString();
  let shopId = body.id ? String(body.id).trim() : "";

  if (shopId) {
    const row = await db.prepare("SELECT id, user_id FROM shops WHERE id = ? LIMIT 1").bind(shopId).first();
    if (!row || String(row.user_id) !== String(userId)) {
      return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
    }
  } else {
    const existing = await db.prepare("SELECT id FROM shops WHERE user_id = ? LIMIT 1").bind(userId).first();
    if (existing && existing.id) shopId = String(existing.id);
  }

  let slug = String(body.slug || body.store_slug || body.storeSlug || "").trim();
  if (!slug) slug = buildSlug(name);
  slug = await ensureUniqueSlug(db, slug, shopId);

  if (!shopId) {
    shopId = generateId();
    const sql = `
      INSERT INTO shops (id, user_id, store_name, store_slug, category, short_desc, long_desc, description, status, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `;
    const description = toPlainText(longDescRaw);
    await db.prepare(sql).bind(
      shopId,
      userId,
      name,
      slug,
      category || null,
      shortDesc || null,
      longDescRaw || null,
      description || null,
      "pending",
      now,
      now
    ).run();
  } else {
    const updates = [];
    const binds = [];
    const push = (col, val) => {
      if (shopColumns.has(col)) {
        updates.push(`${col} = ?`);
        binds.push(val);
      }
    };
    push("store_name", name);
    push("store_slug", slug || null);
    push("category", category || null);
    push("short_desc", shortDesc || null);
    push("long_desc", longDescRaw || null);
    push("description", toPlainText(longDescRaw) || null);
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
    `SELECT id, store_name, store_slug, category, short_desc, long_desc, description, avatar_media_id,
            status, is_active, rating, total_reviews, total_orders, stock_count, created_at, updated_at
       FROM shops WHERE id = ? LIMIT 1`
  ).bind(shopId).first();

  return jsonResponse({ ok: true, shop: mapShop(refreshed || {}) });
}
