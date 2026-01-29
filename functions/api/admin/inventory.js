import { jsonResponse } from "../auth/_utils.js";
import { requireAdmin } from "../_catalog.js";

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

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const url = new URL(context.request.url);
  const search = buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || "");
  const productId = String(url.searchParams.get("productId") || "").trim();
  const shopId = String(url.searchParams.get("shopId") || "").trim();
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(50, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), 10))));
  const offset = (page - 1) * perPage;

  const where = [];
  const binds = [];
  if (productId) {
    where.push("i.product_id = ?");
    binds.push(productId);
  }
  if (shopId) {
    where.push("p.shop_id = ?");
    binds.push(shopId);
  }
  if (search) {
    where.push("(p.name LIKE ? OR s.store_name LIKE ?)");
    binds.push(search, search);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(1) AS total
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN shops s ON s.id = p.shop_id
     ${whereClause}
  `;
  const countRow = await db.prepare(countSql).bind(...binds).first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const sql = `
    SELECT i.id, i.product_id, i.line_count, i.consumed_count, i.status, i.r2_object_etag, i.created_at, i.updated_at,
           p.name AS product_name, p.shop_id, s.store_name
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN shops s ON s.id = p.shop_id
     ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const rows = await db.prepare(sql).bind(...binds, perPage, offset).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => {
    const lineCount = Number(row.line_count || 0);
    const consumed = Number(row.consumed_count || 0);
    return {
      id: row.id,
      productId: row.product_id,
      productName: row.product_name || "",
      shopId: row.shop_id,
      shopName: row.store_name || "",
      lineCount,
      consumedCount: consumed,
      availableCount: Math.max(lineCount - consumed, 0),
      status: row.status || "available",
      etag: row.r2_object_etag || "",
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  });

  return jsonResponse({ ok: true, items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
}
