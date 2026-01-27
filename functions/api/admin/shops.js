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
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(50, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), 10))));
  const offset = (page - 1) * perPage;

  const where = [];
  const binds = [];
  if (status) {
    where.push("lower(s.status) = ?");
    binds.push(status);
  }
  if (search) {
    where.push("(s.store_name LIKE ? OR s.store_slug LIKE ?)");
    binds.push(search, search);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(1) AS total
      FROM shops s
     ${whereClause}
  `;
  const countRow = await db.prepare(countSql).bind(...binds).first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const sql = `
    SELECT s.id, s.user_id, s.store_name, s.store_slug, s.category, s.short_desc, s.long_desc,
           s.status, s.is_active, s.rating, s.total_orders, s.stock_count, s.created_at, s.updated_at,
           u.username, u.display_name, u.email
      FROM shops s
      LEFT JOIN users u ON u.id = s.user_id
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const rows = await db.prepare(sql).bind(...binds, perPage, offset).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => ({
    id: row.id,
    ownerUserId: row.user_id,
    name: row.store_name,
    slug: row.store_slug,
    category: row.category || "",
    descriptionShort: row.short_desc || "",
    descriptionLong: row.long_desc || "",
    status: row.status || "pending",
    isActive: Number(row.is_active || 0) === 1,
    rating: Number(row.rating || 0),
    totalOrders: Number(row.total_orders || 0),
    stockCount: Number(row.stock_count || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    owner: {
      username: row.username || "",
      displayName: row.display_name || "",
      email: row.email || "",
    },
  }));

  return jsonResponse({ ok: true, items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) });
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  const id = String(body.id || "").trim();
  if (!id) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

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
  if (body.reviewNote != null) {
    updates.push("review_note = ?");
    binds.push(String(body.reviewNote || "").trim());
  }
  if (!updates.length) return jsonResponse({ ok: false, error: "NO_UPDATES" }, 400);
  updates.push("updated_at = ?");
  binds.push(new Date().toISOString());
  binds.push(id);
  await db.prepare(`UPDATE shops SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  return jsonResponse({ ok: true });
}
