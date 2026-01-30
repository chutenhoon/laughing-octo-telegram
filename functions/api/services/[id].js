import { jsonResponse } from "../auth/_utils.js";
import { getSessionUser, findUserByRef, toSafeHtml, toPlainText, jsonCachedResponse } from "../_catalog.js";

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
    if (!id) return jsonResponse({ ok: false, error: "INVALID_SERVICE" }, 400);

    const sql = `
      SELECT p.id, p.shop_id, p.name, p.description_short, p.description, p.description_html,
             p.category, p.subcategory, p.tags_json, p.price, p.price_max, p.thumbnail_media_id,
             p.status, p.is_active, p.is_published, p.created_at,
             s.store_name, s.store_slug, s.short_desc, s.long_desc, s.description AS shop_desc,
             s.rating AS shop_rating, s.status AS shop_status, s.is_active AS shop_active,
             s.category AS store_category, s.subcategory AS store_subcategory, s.tags_json AS store_tags_json,
             s.user_id AS owner_user_id,
             u.display_name, u.username, u.badge, u.title, u.rank, u.role,
             (
               SELECT COUNT(1)
                 FROM service_requests sr
                WHERE sr.service_id = p.id
             ) AS request_count
        FROM products p
        JOIN shops s ON s.id = p.shop_id
        LEFT JOIN users u ON u.id = s.user_id
       WHERE p.id = ?
         AND p.kind = 'service'
       LIMIT 1
    `;
    const row = await db.prepare(sql).bind(id).first();
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

    const service = {
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
      requestCount: Number(row.request_count || 0),
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

    const payload = { ok: true, service };
    return jsonCachedResponse(context.request, payload, {
      cacheControl: "private, max-age=0, must-revalidate",
      vary: "Cookie",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
