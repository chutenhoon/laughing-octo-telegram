import { jsonResponse, readJsonBody, generateId } from "../../auth/_utils.js";
import { requireUser, toPlainText } from "../../_catalog.js";

function isApprovedStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return (
    value === "approved" ||
    value === "active" ||
    value === "published" ||
    value === "pending_update" ||
    value === "da duyet" ||
    value === "đã duyệt" ||
    value === "đã duyệt" ||
    value === "cho cap nhat" ||
    value === "chờ cập nhật" ||
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

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    if (!auth.ok) return auth.response;
    const db = auth.db;
    const userId = auth.user.resolvedId || auth.user.id;
    const serviceId = context?.params?.serviceId ? String(context.params.serviceId).trim() : "";
    if (!serviceId) return jsonResponse({ ok: false, error: "INVALID_SERVICE" }, 400);

    const serviceRow = await db
      .prepare(
        `SELECT p.id, p.shop_id, p.name, p.price, p.price_max, p.status, p.is_active, p.is_published,
                s.status AS shop_status, s.is_active AS shop_active
           FROM products p
           JOIN shops s ON s.id = p.shop_id
          WHERE p.id = ?
            AND p.kind = 'service'
          LIMIT 1`
      )
      .bind(serviceId)
      .first();
    if (!serviceRow) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

    const productActive =
      isTruthyFlag(serviceRow.is_active) &&
      isTruthyFlag(serviceRow.is_published) &&
      isVisibleProductStatus(serviceRow.status);
    const shopActive = isTruthyFlag(serviceRow.shop_active) && isApprovedStatus(serviceRow.shop_status);
    if (!productActive || !shopActive) return jsonResponse({ ok: false, error: "SERVICE_UNAVAILABLE" }, 403);

    const body = await readJsonBody(context.request);
    const noteRaw = body && body.note ? String(body.note) : body && body.note_text ? String(body.note_text) : "";
    const noteText = toPlainText(noteRaw).slice(0, 4000);

    const now = new Date().toISOString();
    const orderId = generateId();
    const orderItemId = generateId();
    const requestId = generateId();
    const price = Number(serviceRow.price || 0);

    await db
      .prepare(
        `INSERT INTO orders
          (id, buyer_user_id, status, payment_status, currency, subtotal, discount, fee, tax, total, created_at, updated_at)
         VALUES (?, ?, 'pending', 'unpaid', 'VND', ?, 0, 0, 0, ?, ?, ?)`
      )
      .bind(orderId, userId, price, price, now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO order_items
          (id, order_id, product_id, shop_id, quantity, unit_price, line_total, currency, fulfillment_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, 'VND', 'pending', ?, ?)`
      )
      .bind(orderItemId, orderId, serviceId, serviceRow.shop_id, price, price, now, now)
      .run();

    await db
      .prepare(
        `INSERT INTO service_requests
          (id, service_id, buyer_user_id, order_id, note_text, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(requestId, serviceId, userId, orderId, noteText, now, now)
      .run();

    await db.prepare("UPDATE shops SET total_orders = total_orders + 1, updated_at = ? WHERE id = ?").bind(now, serviceRow.shop_id).run();

    return jsonResponse({
      ok: true,
      orderId,
      serviceId,
      requestId,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
