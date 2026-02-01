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

function isPublicProduct(row) {
  if (row.product_active != null && !isTruthy(row.product_active)) return false;
  if (row.product_published != null && !isTruthy(row.product_published)) return false;
  const status = String(row.product_status || "").trim().toLowerCase();
  if (!status) return true;
  return !["deleted", "hidden", "draft", "blocked", "banned", "disabled"].includes(status);
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

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

async function loadProductImages(db, productId, secret, requestUrl) {
  if (!db || !productId) return [];
  let rows = [];
  try {
    const result = await db
      .prepare(
        `SELECT id, r2_key, sort_order
           FROM product_images
          WHERE product_id = ?
          ORDER BY sort_order ASC, created_at ASC
          LIMIT 8`
      )
      .bind(productId)
      .all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    rows = [];
  }
  if (!secret) return [];
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const images = [];
  for (const row of rows) {
    if (!row.r2_key) continue;
    const token = await createSignedMediaToken(secret, row.r2_key, exp, "product-image");
    if (!token) continue;
    images.push({
      id: row.id,
      url: buildMediaUrl(requestUrl, token),
      sortOrder: Number(row.sort_order || 0),
    });
  }
  return images;
}

async function loadRelatedProducts(db, productId, shopId, isPrivileged, secret, requestUrl) {
  if (!db || !shopId) return [];
  const clauses = ["p.shop_id = ?", "p.id != ?"];
  const binds = [shopId, productId];
  if (!isPrivileged) {
    clauses.push("(p.status IS NULL OR trim(p.status) = '' OR lower(p.status) IN ('active','published'))");
    clauses.push(flagTrueOrNull("p.is_active"));
    clauses.push(flagTrueOrNull("p.is_published"));
  } else {
    clauses.push("lower(trim(coalesce(p.status,''))) <> 'deleted'");
  }

  const whereClause = `WHERE ${clauses.join(" AND ")}`;
  const sql = `
    SELECT p.id, p.slug, p.title, p.name,
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
     LIMIT 4
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
  if (!slugParam) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

  const productSql = `
    SELECT p.id, p.slug, p.title, p.name, p.description, p.description_short, p.description_html,
           p.category_slug, p.category, p.subcategory,
           p.price_min, p.price, p.price_max,
           p.stock_count, p.sold_count, p.rating, p.is_hot,
           p.status AS product_status, p.is_active AS product_active, p.is_published AS product_published,
           p.created_at, p.updated_at, p.thumbnail_media_id,
           s.id AS shop_id, s.slug AS shop_slug, s.store_slug, s.name AS shop_name, s.store_name,
           s.owner_user_id, s.user_id, s.is_public, s.status AS shop_status, s.is_active AS shop_active,
           s.rating AS shop_rating, s.total_orders, s.total_reviews,
           u.display_name, u.username, u.badge, u.role,
           c.label AS category_label, c.group_name AS category_group
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN categories c ON lower(c.slug) = lower(COALESCE(p.category_slug, p.subcategory, p.category))
     WHERE lower(p.slug) = lower(?) OR p.id = ? OR lower(p.sku) = lower(?)
     LIMIT 1
  `;

  const row = await db.prepare(productSql).bind(slugParam, slugParam, slugParam).first();
  if (!row) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  let viewer = null;
  const session = getSessionUser(context.request);
  if (session && session.id) {
    viewer = await findUserByRef(db, session.id);
  }
  const viewerId = viewer ? String(viewer.resolvedId || viewer.id || "") : "";
  const ownerId = String(row.owner_user_id || row.user_id || "");
  const isOwner = viewerId && ownerId && viewerId === ownerId;
  const isAdmin = viewer && String(viewer.role || "").toLowerCase() === "admin";

  if (!isOwner && !isAdmin) {
    if (!isPublicShop(row) || !isPublicProduct(row)) {
      return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
    }
  }

  const secret =
    context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  const images = await loadProductImages(db, row.id, secret, context.request.url);
  let thumbnailUrl = "";
  if (images.length) {
    thumbnailUrl = images[0].url || "";
  }
  if (!thumbnailUrl && row.thumbnail_media_id) {
    thumbnailUrl = buildMediaProxyUrl(context.request.url, row.thumbnail_media_id);
  }

  const priceMin = row.price_min != null ? Number(row.price_min || 0) : Number(row.price || 0);
  const priceMaxRaw = row.price_max != null ? Number(row.price_max || 0) : null;
  const priceMax = priceMaxRaw != null && priceMaxRaw > priceMin ? priceMaxRaw : null;

  const product = {
    id: row.id,
    slug: String(row.slug || row.id || "").trim(),
    title: String(row.title || row.name || "").trim(),
    description: row.description || "",
    descriptionShort: row.description_short || "",
    descriptionHtml: row.description_html || "",
    categoryLabel: String(row.category_label || row.subcategory || row.category || "").trim(),
    categorySlug: String(row.category_slug || row.subcategory || row.category || "").trim(),
    categoryGroup: String(row.category_group || "").trim(),
    priceMin,
    priceMax,
    stock: Number(row.stock_count || 0),
    sold: Number(row.sold_count || 0),
    rating: Number(row.rating || row.shop_rating || 0),
    isHot: Number(row.is_hot || 0) === 1,
    status: row.product_status || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    images,
    thumbnailUrl,
    shop: {
      id: row.shop_id,
      slug: String(row.shop_slug || row.store_slug || "").trim(),
      name: String(row.shop_name || row.store_name || "").trim(),
      rating: Number(row.shop_rating || 0),
      totalOrders: Number(row.total_orders || 0),
      totalReviews: Number(row.total_reviews || 0),
    },
    seller: {
      displayName: row.display_name || row.username || "",
      username: row.username || "",
      badge: row.badge || "",
      role: row.role || "",
    },
  };

  const related = await loadRelatedProducts(db, row.id, row.shop_id, isOwner || isAdmin, secret, context.request.url);

  const publicView = !isOwner && !isAdmin && isPublicShop(row) && isPublicProduct(row) && !(session && session.id);
  return jsonCachedResponse(
    context.request,
    {
      ok: true,
      product,
      related,
    },
    {
      cacheControl: publicView ? "public, max-age=120, stale-while-revalidate=300" : "private, max-age=0, must-revalidate",
      vary: publicView ? "Accept-Encoding" : "x-user-id, x-user-email, x-user-username",
    }
  );
}
