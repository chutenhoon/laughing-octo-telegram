import { jsonResponse } from "./auth/_utils.js";
import { toPlainText } from "./_catalog.js";

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

function buildWhere(params, binds) {
  const clauses = [
    "p.kind = 'product'",
    "p.is_active = 1",
    "p.is_published = 1",
    "s.is_active = 1",
    "s.status IN ('approved','active','published')",
  ];

  if (params.category) {
    clauses.push("COALESCE(p.category, s.category) = ?");
    binds.push(params.category);
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
  if (sort === "rating") return "ORDER BY shop_rating DESC, sold_count DESC, p.created_at DESC";
  if (sort === "newest") return "ORDER BY p.created_at DESC";
  return "ORDER BY sold_count DESC, p.created_at DESC";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const url = new URL(context.request.url);
    const params = {
      category: String(url.searchParams.get("category") || "").trim() || "",
      subcategories: parseList(url.searchParams.get("subcategory") || url.searchParams.get("subcategories") || ""),
      search: buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || ""),
      sort: String(url.searchParams.get("sort") || "popular").trim(),
      shopId: String(url.searchParams.get("shop") || url.searchParams.get("shopId") || "").trim(),
      page: normalizeNumber(url.searchParams.get("page"), 1),
      perPage: normalizeNumber(url.searchParams.get("perPage") || url.searchParams.get("limit"), 10),
    };
    params.page = Math.max(1, Math.floor(params.page));
    params.perPage = Math.min(40, Math.max(1, Math.floor(params.perPage)));

    const binds = [];
    const whereClause = buildWhere(params, binds);
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

    const soldCondition = SOLD_STATUSES.map(() => "?").join(", ");
    const soldBinds = [...binds, ...SOLD_STATUSES, params.perPage, offset];
    const listSql = `
      SELECT p.id, p.shop_id, p.name, p.description_short, p.description, p.category, p.subcategory, p.tags_json,
             p.price, p.price_max, p.stock_count, p.thumbnail_media_id, p.status, p.created_at,
             s.store_name, s.store_slug, s.rating AS shop_rating, s.category AS store_category, s.subcategory AS store_subcategory, s.tags_json AS store_tags_json,
             u.badge, u.role, u.display_name, u.title, u.rank,
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
      return {
        id: row.id,
        shopId: row.shop_id,
        title: row.name,
        descriptionShort: row.description_short || toPlainText(row.description || ""),
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
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
