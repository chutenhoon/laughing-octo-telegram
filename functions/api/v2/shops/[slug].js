import { jsonCachedResponse, getSessionUser, findUserByRef, createSignedMediaToken, buildMediaUrl } from "../_catalog.js";
import { jsonResponse } from "../../auth/_utils.js";

function normalizeParam(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > 120) return "";
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return "";
  return raw;
}

function isTruthy(value) {
  if (value === true || value === 1) return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isPublicShop(row) {
  if (row.is_public != null && !isTruthy(row.is_public)) return false;
  if (row.shop_active != null && !isTruthy(row.shop_active)) return false;
  const status = String(row.shop_status || "").trim().toLowerCase();
  if (status && !["approved", "active", "published", "pending_update"].includes(status)) return false;
  return true;
}

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function buildMediaProxyUrl(requestUrl, mediaId) {
  const id = String(mediaId || "").trim();
  if (!id) return "";
  try {
    const url = new URL(requestUrl);
    url.pathname = "/api/media";
    url.search = `id=${encodeURIComponent(id)}`;
    return url.toString();
  } catch (error) {
    return `/api/media?id=${encodeURIComponent(id)}`;
  }
}

async function loadShopProducts(db, shopId, isPrivileged, secret, requestUrl) {
  if (!db || !shopId) return [];
  const clauses = ["p.shop_id = ?"];
  const binds = [shopId];
  if (!isPrivileged) {
    clauses.push("(p.status IS NULL OR trim(p.status) = '' OR lower(p.status) IN ('active','published'))");
    clauses.push(flagTrueOrNull("p.is_active"));
    clauses.push(flagTrueOrNull("p.is_published"));
  } else {
    clauses.push("lower(trim(coalesce(p.status,''))) <> 'deleted'");
  }

  const whereClause = `WHERE ${clauses.join(" AND ")}`;
  const sql = `
    SELECT p.id, p.slug, p.title, p.name, p.description_short,
           p.category_slug, p.category, p.subcategory,
           p.price_min, p.price, p.price_max, p.stock_count, p.sold_count, p.rating, p.is_hot,
           p.thumbnail_media_id,
           (
             SELECT r2_key
               FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.sort_order ASC, pi.created_at ASC
              LIMIT 1
           ) AS image_key
      FROM products p
     ${whereClause}
     ORDER BY COALESCE(p.sold_count, 0) DESC, p.created_at DESC
  `;

  let rows = [];
  try {
    const result = await db.prepare(sql).bind(...binds).all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    rows = [];
  }

  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const items = [];
  for (const row of rows) {
    const priceMin = row.price_min != null ? Number(row.price_min || 0) : Number(row.price || 0);
    const priceMaxRaw = row.price_max != null ? Number(row.price_max || 0) : null;
    const priceMax = priceMaxRaw != null && priceMaxRaw > priceMin ? priceMaxRaw : null;
    let imageUrl = "";
    if (secret && row.image_key) {
      const token = await createSignedMediaToken(secret, row.image_key, exp, "product-image");
      imageUrl = token ? buildMediaUrl(requestUrl, token) : "";
    }
    if (!imageUrl && row.thumbnail_media_id) {
      imageUrl = buildMediaProxyUrl(requestUrl, row.thumbnail_media_id);
    }

    items.push({
      id: row.id,
      slug: String(row.slug || row.id || "").trim(),
      title: String(row.title || row.name || "").trim(),
      descriptionShort: row.description_short || "",
      categoryLabel: String(row.category_slug || row.subcategory || row.category || "").trim(),
      priceMin,
      priceMax,
      stock: Number(row.stock_count || 0),
      sold: Number(row.sold_count || 0),
      rating: Number(row.rating || 0),
      isHot: Number(row.is_hot || 0) === 1,
      imageUrl,
    });
  }
  return items;
}

export async function onRequestGet(context) {
  const db = context?.env?.DB;
  if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

  const slugParam = normalizeParam(context?.params?.slug);
  if (!slugParam) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  const shopSql = `
    SELECT s.id, s.slug, s.name, s.description, s.owner_user_id,
           s.store_slug, s.store_name, s.user_id, s.is_public,
           s.status AS shop_status, s.is_active AS shop_active,
           s.rating, s.total_orders, s.total_reviews, s.created_at, s.updated_at,
           u.display_name, u.username, u.badge, u.role
      FROM shops s
      LEFT JOIN users u ON u.id = s.user_id
     WHERE lower(s.slug) = lower(?) OR lower(s.store_slug) = lower(?) OR s.id = ?
     LIMIT 1
  `;

  const shop = await db.prepare(shopSql).bind(slugParam, slugParam, slugParam).first();
  if (!shop) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  let viewer = null;
  const session = getSessionUser(context.request);
  if (session && session.id) {
    viewer = await findUserByRef(db, session.id);
  }
  const viewerId = viewer ? String(viewer.resolvedId || viewer.id || "") : "";
  const ownerId = String(shop.owner_user_id || shop.user_id || "");
  const isOwner = viewerId && ownerId && viewerId === ownerId;
  const isAdmin = viewer && String(viewer.role || "").toLowerCase() === "admin";

  if (!isOwner && !isAdmin && !isPublicShop(shop)) {
    return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  }

  const secret =
    context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  const products = await loadShopProducts(db, shop.id, isOwner || isAdmin, secret, context.request.url);

  const payload = {
    ok: true,
    shop: {
      id: shop.id,
      slug: String(shop.slug || shop.store_slug || "").trim(),
      name: String(shop.name || shop.store_name || "").trim(),
      description: shop.description || "",
      isPublic: shop.is_public == null ? true : isTruthy(shop.is_public),
      rating: Number(shop.rating || 0),
      totalOrders: Number(shop.total_orders || 0),
      totalReviews: Number(shop.total_reviews || 0),
      createdAt: shop.created_at || null,
      updatedAt: shop.updated_at || null,
      owner: {
        displayName: shop.display_name || shop.username || "",
        username: shop.username || "",
        badge: shop.badge || "",
        role: shop.role || "",
      },
    },
    products,
  };

  const publicView = !isOwner && !isAdmin && isPublicShop(shop) && !(session && session.id);
  return jsonCachedResponse(context.request, payload, {
    cacheControl: publicView ? "public, max-age=120, stale-while-revalidate=300" : "private, max-age=0, must-revalidate",
    vary: publicView ? "Accept-Encoding" : "x-user-id, x-user-email, x-user-username",
  });
}
