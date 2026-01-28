import { jsonCachedResponse, getSessionUser, findUserByRef, createSignedMediaToken, buildMediaUrl } from "../_catalog.js";
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

function isApproved(shop) {
  const status = String(shop.status || "").toLowerCase();
  const active = Number(shop.is_active || 0) === 1;
  return active && (status === "approved" || status === "active" || status === "published");
}

export async function onRequestGet(context) {
  const db = context?.env?.DB;
  if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

  const slug = context?.params?.slug ? String(context.params.slug) : "";
  if (!slug) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  let shop = await getShopBySlug(db, slug);
  if (!shop) shop = await getShopById(db, slug);
  if (!shop) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  const session = getSessionUser(context.request);
  let viewer = null;
  if (session && session.id) viewer = await findUserByRef(db, session.id);
  const isOwner = viewer && String(viewer.resolvedId || viewer.id) === String(shop.user_id || "");
  const isAdmin = viewer && String(viewer.role || "").toLowerCase() === "admin";

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
      owner: {
        username: shop.username || "",
        displayName: shop.display_name || shop.store_name,
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
