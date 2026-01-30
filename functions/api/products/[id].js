import { jsonResponse } from "../auth/_utils.js";
import { getSessionUser, findUserByRef, toSafeHtml, toPlainText, jsonCachedResponse } from "../_catalog.js";

const SOLD_STATUSES = ["delivered", "completed", "success"];

function isApprovedStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return (
    value === "approved" ||
    value === "active" ||
    value === "published" ||
    value === "pending_update" ||
    value === "da duyet" ||
    value === "đã duyệt" ||
    value === "cho cap nhat" ||
    value === "chờ cập nhật"
  );
}

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  if (value === null || value === undefined || value === "") return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isVisibleProductStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return true;
  return value !== "disabled" && value !== "blocked" && value !== "banned";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const id = context?.params?.id ? String(context.params.id).trim() : "";
    if (!id) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

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
    const row = await db.prepare(sql).bind(...SOLD_STATUSES, id).first();
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

    const product = {
      id: row.id,
      shopId: row.shop_id,
      title: row.name,
      descriptionShort: row.description_short || toPlainText(row.description || ""),
      descriptionHtml: row.description_html ? row.description_html : toSafeHtml(row.description || ""),
      category: row.category || row.store_category || "",
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
        slug: row.store_slug || "",
        badge: row.badge || "",
        role: row.role || "",
        username: row.username || "",
        displayName: row.display_name || "",
        title: row.title || "",
        rank: row.rank || "",
      },
      shop: {
        id: row.shop_id,
        name: row.store_name || "",
        slug: row.store_slug || "",
        rating: Number(row.shop_rating || 0),
        descriptionShort: row.short_desc || "",
        descriptionHtml: toSafeHtml(row.long_desc || row.shop_desc || ""),
      },
    };

    const otherSql = `
      SELECT id, name, price, price_max, stock_count, thumbnail_media_id
        FROM products
       WHERE shop_id = ?
         AND kind = 'product'
         AND id != ?
         AND is_active = 1
         AND is_published = 1
         AND status IN ('approved','active','published')
       ORDER BY created_at DESC
       LIMIT 4
    `;
    const otherRows = await db.prepare(otherSql).bind(row.shop_id, row.id).all();
    const others = (otherRows && Array.isArray(otherRows.results) ? otherRows.results : []).map((item) => ({
      id: item.id,
      title: item.name,
      price: Number(item.price || 0),
      priceMax: item.price_max != null ? Number(item.price_max || 0) : null,
      stockCount: Number(item.stock_count || 0),
      thumbnailId: item.thumbnail_media_id || "",
    }));

    const payload = { ok: true, product, others };
    return jsonCachedResponse(context.request, payload, {
      cacheControl: "private, max-age=0, must-revalidate",
      vary: "Cookie",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
