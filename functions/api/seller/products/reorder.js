import { jsonResponse, readJsonBody } from "../auth/_utils.js";
import { requireSeller } from "../_catalog.js";

function normalizeId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : "";
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const shopId = normalizeId(body.shopId || body.storeId || "");
  const orderInput = Array.isArray(body.order) ? body.order : [];
  if (!shopId) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);
  if (!orderInput.length) return jsonResponse({ ok: false, error: "INVALID_ORDER" }, 400);

  const shop = await db.prepare("SELECT id, user_id FROM shops WHERE id = ? LIMIT 1").bind(shopId).first();
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (String(shop.user_id || "") !== String(userId)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const rows = await db
    .prepare("SELECT id FROM products WHERE shop_id = ? AND kind = 'product' ORDER BY sort_order ASC, created_at DESC")
    .bind(shopId)
    .all();
  const existing = rows && Array.isArray(rows.results) ? rows.results.map((row) => String(row.id)) : [];
  const allowed = new Set(existing);
  const seen = new Set();
  const ordered = [];
  orderInput.forEach((id) => {
    const value = normalizeId(id);
    if (!value || seen.has(value) || !allowed.has(value)) return;
    seen.add(value);
    ordered.push(value);
  });
  existing.forEach((id) => {
    if (!seen.has(id)) ordered.push(id);
  });

  if (!ordered.length) return jsonResponse({ ok: false, error: "INVALID_ORDER" }, 400);

  const now = new Date().toISOString();
  for (let i = 0; i < ordered.length; i += 1) {
    await db
      .prepare("UPDATE products SET sort_order = ?, updated_at = ? WHERE id = ?")
      .bind(i + 1, now, ordered[i])
      .run();
  }

  return jsonResponse({ ok: true, order: ordered });
}
