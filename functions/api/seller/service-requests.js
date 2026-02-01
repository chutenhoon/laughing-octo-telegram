import { jsonResponse } from "../auth/_utils.js";
import { requireSeller } from "../_catalog.js";

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

export async function onRequestGet(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  const url = new URL(context.request.url);
  const status = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(40, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), 10))));
  const offset = (page - 1) * perPage;

  const where = ["s.user_id = ?", "p.kind = 'service'"];
  const binds = [userId];
  if (status) {
    where.push("sr.status = ?");
    binds.push(status);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(1) AS total
      FROM service_requests sr
      JOIN products p ON p.id = sr.service_id
      JOIN shops s ON s.id = p.shop_id
     ${whereClause}
  `;
  const countRow = await db.prepare(countSql).bind(...binds).first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const sql = `
    SELECT sr.id, sr.service_id, sr.order_id, sr.note_text, sr.status, sr.created_at, sr.updated_at,
           p.name AS service_name,
           u.display_name AS buyer_name, u.username AS buyer_username
      FROM service_requests sr
      JOIN products p ON p.id = sr.service_id
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN users u ON u.id = sr.buyer_user_id
     ${whereClause}
     ORDER BY sr.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const rows = await db.prepare(sql).bind(...binds, perPage, offset).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => ({
    id: row.id,
    serviceId: row.service_id,
    orderId: row.order_id || "",
    serviceName: row.service_name || "",
    buyer: {
      name: row.buyer_name || "",
      username: row.buyer_username || "",
    },
    noteText: row.note_text || "",
    status: row.status || "pending",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }));

  return jsonResponse({
    ok: true,
    items,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  });
}
