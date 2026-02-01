import { jsonResponse } from "../../../../auth/_utils.js";
import { requireSeller } from "../../../../_catalog.js";

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

async function getProductOwner(db, productId) {
  const row = await db
    .prepare(
      `SELECT p.id, p.shop_id, s.user_id
         FROM products p
         JOIN shops s ON s.id = p.shop_id
        WHERE p.id = ?
          AND p.kind = 'product'
        LIMIT 1`
    )
    .bind(productId)
    .first();
  return row || null;
}

async function ensureInventoryEvents(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS inventory_events (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          shop_id TEXT NOT NULL,
          action TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
        );`
      )
      .run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_events_product ON inventory_events(product_id, created_at)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_inventory_events_shop ON inventory_events(shop_id, created_at)").run();
  } catch (error) {
    // ignore create failures
  }
}

export async function onRequestGet(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const productId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!productId) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

  const owner = await getProductOwner(db, productId);
  if (!owner || String(owner.user_id) !== String(userId)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  await ensureInventoryEvents(db);

  const url = new URL(context.request.url);
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(100, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), 20))));
  const offset = (page - 1) * perPage;

  const countRow = await db
    .prepare("SELECT COUNT(1) AS total FROM inventory_events WHERE product_id = ?")
    .bind(productId)
    .first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const rows = await db
    .prepare(
      `SELECT id, action, count, note, created_at
         FROM inventory_events
        WHERE product_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`
    )
    .bind(productId, perPage, offset)
    .all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => ({
    id: row.id,
    action: row.action || "",
    count: Number(row.count || 0),
    note: row.note || "",
    createdAt: row.created_at || null,
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
