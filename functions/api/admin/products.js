import { jsonResponse, readJsonBody } from "../auth/_utils.js";
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
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const search = buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || "");
  const shopId = String(url.searchParams.get("shopId") || url.searchParams.get("shop") || "").trim();
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(50, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), 10))));
  const offset = (page - 1) * perPage;

  const where = ["p.kind = 'product'"];
  const binds = [];
  if (status) {
    where.push("lower(p.status) = ?");
    binds.push(status);
  }
  if (shopId) {
    where.push("p.shop_id = ?");
    binds.push(shopId);
  }
  if (search) {
    where.push("(p.name LIKE ? OR p.description LIKE ?)");
    binds.push(search, search);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(1) AS total
      FROM products p
     ${whereClause}
  `;
  const countRow = await db.prepare(countSql).bind(...binds).first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const sql = `
    SELECT p.id, p.shop_id, p.name, p.category, p.subcategory, p.tags_json, p.price, p.price_max, p.stock_count,
           p.status, p.is_active, p.is_published, p.created_at, p.updated_at,
           s.store_name, s.store_slug
      FROM products p
      LEFT JOIN shops s ON s.id = p.shop_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const rows = await db.prepare(sql).bind(...binds, perPage, offset).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => {
    let tags = [];
    if (row.tags_json) {
      try {
        tags = JSON.parse(row.tags_json) || [];
      } catch (error) {
        tags = [];
      }
    }
    return {
      id: row.id,
      shopId: row.shop_id,
      name: row.name,
      category: row.category || "",
      subcategory: row.subcategory || "",
      tags,
      price: Number(row.price || 0),
      priceMax: row.price_max != null ? Number(row.price_max || 0) : null,
      stockCount: Number(row.stock_count || 0),
      status: row.status || "draft",
      isActive: Number(row.is_active || 0) === 1,
      isPublished: Number(row.is_published || 0) === 1,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      shop: {
        name: row.store_name || "",
        slug: row.store_slug || "",
      },
    };
  });

  return jsonResponse({ ok: true, items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

  const updates = [];
  const binds = [];
  if (body.status) {
    updates.push("status = ?");
    binds.push(String(body.status).trim().toLowerCase());
  }
  if (body.isActive != null) {
    updates.push("is_active = ?");
    binds.push(body.isActive ? 1 : 0);
  }
  if (body.isPublished != null) {
    updates.push("is_published = ?");
    binds.push(body.isPublished ? 1 : 0);
  }
  if (!updates.length) return jsonResponse({ ok: false, error: "NO_UPDATES" }, 400);
  updates.push("updated_at = ?");
  binds.push(new Date().toISOString());
  binds.push(id);
  await db.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return jsonResponse({ ok: true });
}
