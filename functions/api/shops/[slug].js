import {
  jsonCachedResponse,
  getSessionUser,
  findUserByRef,
  createSignedMediaToken,
  buildMediaUrl,
  requireAdmin,
} from "../_catalog.js";
import { jsonResponse } from "../auth/_utils.js";

async function getShopBySlug(db, slug) {
  const sql = `
    SELECT s.id, s.user_id, s.store_name, s.store_slug, s.store_type, s.category, s.subcategory, s.tags_json,
           s.short_desc, s.long_desc, s.description, s.avatar_media_id, s.avatar_r2_key,
           s.status, s.is_active, s.rating, s.total_reviews, s.total_orders, s.stock_count,
           s.created_at, s.updated_at,
           u.display_name, u.username, u.badge, u.title, u.rank, u.role
      FROM shops s
      LEFT JOIN users u ON u.id = s.user_id
     WHERE lower(s.store_slug) = lower(?)
     LIMIT 1
  `;
  return db.prepare(sql).bind(slug).first();
}

async function getShopById(db, id) {
  const sql = `
    SELECT s.id, s.user_id, s.store_name, s.store_slug, s.store_type, s.category, s.subcategory, s.tags_json,
           s.short_desc, s.long_desc, s.description, s.avatar_media_id, s.avatar_r2_key,
           s.status, s.is_active, s.rating, s.total_reviews, s.total_orders, s.stock_count,
           s.created_at, s.updated_at,
           u.display_name, u.username, u.badge, u.title, u.rank, u.role
      FROM shops s
      LEFT JOIN users u ON u.id = s.user_id
     WHERE s.id = ?
     LIMIT 1
  `;
  return db.prepare(sql).bind(id).first();
}

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (value === null || value === undefined || value === "") return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isApproved(shop) {
  const status = String(shop.status || "").trim().toLowerCase();
  const active = isTruthyFlag(shop.is_active);
  return (
    active &&
    [
      "approved",
      "active",
      "published",
      "pending_update",
      "da duyet",
      "đã duyệt",
      "cho cap nhat",
      "chờ cập nhật",
    ].includes(status)
  );
}

async function ensureShopImagesTable(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS shop_images (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL,
          r2_object_key TEXT NOT NULL,
          content_type TEXT,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 1,
          uploaded_by_role TEXT NOT NULL DEFAULT 'seller',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
        );`
      )
      .run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_shop_images_shop_pos ON shop_images(shop_id, position)").run();
  } catch (error) {
    // ignore missing table errors
  }
}

async function loadShopImages(db, shopId, secret, requestUrl) {
  if (!shopId || !secret) return [];
  await ensureShopImagesTable(db);
  let rows = [];
  try {
    const result = await db
      .prepare(
        `SELECT id, r2_object_key, position, created_at
           FROM shop_images
          WHERE shop_id = ?
          ORDER BY position ASC, created_at ASC
          LIMIT 5`
      )
      .bind(shopId)
      .all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    rows = [];
  }
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const items = [];
  for (const row of rows) {
    const key = row.r2_object_key;
    if (!key) continue;
    const token = await createSignedMediaToken(secret, key, exp, "store-image");
    if (!token) continue;
    items.push({
      id: row.id,
      url: buildMediaUrl(requestUrl, token),
      position: Number(row.position || 0),
    });
  }
  return items;
}

export async function onRequestGet(context) {
  const db = context?.env?.DB;
  if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

  const slug = context?.params?.slug ? String(context.params.slug) : "";
  if (!slug) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  let shop = await getShopBySlug(db, slug);
  if (!shop) shop = await getShopById(db, slug);
  if (!shop) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  let isAdmin = false;
  const adminAuth = await requireAdmin(context);
  if (adminAuth.ok) {
    isAdmin = true;
  }
  const session = getSessionUser(context.request);
  let viewer = null;
  if (session && session.id) viewer = await findUserByRef(db, session.id);
  const isOwner = viewer && String(viewer.resolvedId || viewer.id) === String(shop.user_id || "");
  if (viewer && String(viewer.role || "").toLowerCase() === "admin") {
    isAdmin = true;
  }

  if (!isApproved(shop) && !isOwner && !isAdmin) {
    return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  }

  const secret =
    context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  let avatarUrl = "";
  if (secret && shop.avatar_r2_key) {
    const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const token = await createSignedMediaToken(secret, shop.avatar_r2_key, exp, "store-avatar");
    avatarUrl = token ? buildMediaUrl(context.request.url, token) : "";
  }
  const images = await loadShopImages(db, shop.id, secret, context.request.url);
  let tags = [];
  if (shop.tags_json) {
    try {
      tags = JSON.parse(shop.tags_json) || [];
    } catch (error) {
      tags = [];
    }
  }

  const payload = {
    ok: true,
    shop: {
      id: shop.id,
      ownerUserId: shop.user_id,
      name: shop.store_name,
      slug: shop.store_slug,
      storeType: shop.store_type || "",
      category: shop.category || "",
      subcategory: shop.subcategory || "",
      tags,
      descriptionShort: shop.short_desc || "",
      descriptionLong: shop.long_desc || shop.description || "",
      status: shop.status || "pending",
      isActive: Number(shop.is_active || 0) === 1,
      rating: Number(shop.rating || 0),
      totalReviews: Number(shop.total_reviews || 0),
      totalOrders: Number(shop.total_orders || 0),
      stockCount: Number(shop.stock_count || 0),
      createdAt: shop.created_at || null,
      updatedAt: shop.updated_at || null,
      avatarUrl,
      images,
      owner: {
        username: shop.username || "",
        displayName: shop.display_name || shop.username || "",
        badge: shop.badge || "",
        title: shop.title || "",
        rank: shop.rank || "",
        role: shop.role || "",
      },
    },
  };

  return jsonCachedResponse(context.request, payload, {
    cacheControl: "private, max-age=0, must-revalidate",
    vary: "Cookie",
  });
}
