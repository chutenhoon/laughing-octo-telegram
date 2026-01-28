import { jsonResponse, readJsonBody, generateId } from "../../auth/_utils.js";
import { requireUser } from "../../_catalog.js";
const MAX_RESERVE_ATTEMPTS = 5;

function isApprovedStatus(status) {
  const value = String(status || "").toLowerCase();
  return value === "approved" || value === "active" || value === "published";
}

async function reserveInventoryLine(db, productId) {
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt += 1) {
    const row = await db
      .prepare(
        `SELECT id, line_count, consumed_count, r2_object_key, r2_object_etag
           FROM inventory
          WHERE product_id = ?
            AND status = 'available'
            AND line_count > consumed_count
          ORDER BY created_at ASC
          LIMIT 1`
      )
      .bind(productId)
      .first();
    if (!row) return null;
    const consumed = Number(row.consumed_count || 0);
    const lineCount = Number(row.line_count || 0);
    if (lineCount <= consumed) continue;
    const update = await db
      .prepare(
        `UPDATE inventory
            SET consumed_count = consumed_count + 1,
                updated_at = ?
          WHERE id = ?
            AND consumed_count = ?
            AND line_count > consumed_count`
      )
      .bind(now, row.id, consumed)
      .run();
    if (update && update.meta && update.meta.changes === 1) {
      return {
        id: row.id,
        index: consumed,
        lineCount,
        r2Key: row.r2_object_key,
        r2Etag: row.r2_object_etag,
      };
    }
  }
  return null;
}

async function recomputeStock(db, productId, shopId) {
  const now = new Date().toISOString();
  const row = await db
    .prepare("SELECT COALESCE(SUM(line_count - consumed_count), 0) AS stock FROM inventory WHERE product_id = ?")
    .bind(productId)
    .first();
  const stock = Number(row && row.stock ? row.stock : 0);
  await db.prepare("UPDATE products SET stock_count = ?, updated_at = ? WHERE id = ?").bind(stock, now, productId).run();
  if (shopId) {
    const shopRow = await db
      .prepare("SELECT COALESCE(SUM(stock_count), 0) AS stock FROM products WHERE shop_id = ?")
      .bind(shopId)
      .first();
    const shopStock = Number(shopRow && shopRow.stock ? shopRow.stock : 0);
    await db.prepare("UPDATE shops SET stock_count = ?, updated_at = ? WHERE id = ?").bind(shopStock, now, shopId).run();
  }
  return stock;
}

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    if (!auth.ok) return auth.response;
    const db = auth.db;
    const userId = auth.user.resolvedId || auth.user.id;
    const productId = context?.params?.productId ? String(context.params.productId).trim() : "";
    if (!productId) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

    const productRow = await db
      .prepare(
        `SELECT p.id, p.shop_id, p.name, p.price, p.price_max, p.status, p.is_active, p.is_published,
                s.status AS shop_status, s.is_active AS shop_active
           FROM products p
           JOIN shops s ON s.id = p.shop_id
          WHERE p.id = ?
            AND p.kind = 'product'
          LIMIT 1`
      )
      .bind(productId)
      .first();
    if (!productRow) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

    const productActive =
      Number(productRow.is_active || 0) === 1 && Number(productRow.is_published || 0) === 1 && isApprovedStatus(productRow.status);
    const shopActive = Number(productRow.shop_active || 0) === 1 && isApprovedStatus(productRow.shop_status);
    if (!productActive || !shopActive) return jsonResponse({ ok: false, error: "PRODUCT_UNAVAILABLE" }, 403);

    const body = await readJsonBody(context.request);
    const qty = body && body.quantity != null ? Number(body.quantity) : 1;
    if (!Number.isFinite(qty) || qty !== 1) {
      return jsonResponse({ ok: false, error: "QUANTITY_NOT_SUPPORTED" }, 400);
    }

    const reservation = await reserveInventoryLine(db, productId);
    if (!reservation) return jsonResponse({ ok: false, error: "OUT_OF_STOCK" }, 409);

    const bucket = context?.env?.R2_INVENTORY;
    if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);
    const object = await bucket.get(reservation.r2Key);
    if (!object) return jsonResponse({ ok: false, error: "INVENTORY_MISSING" }, 500);
    const text = await object.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const delivered = lines[reservation.index] || "";
    if (!delivered) return jsonResponse({ ok: false, error: "INVENTORY_INVALID" }, 500);

    const now = new Date().toISOString();
    const orderId = generateId();
    const orderItemId = generateId();
    const price = Number(productRow.price || 0);

    await db
      .prepare(
        `INSERT INTO orders
          (id, buyer_user_id, status, payment_status, currency, subtotal, discount, fee, tax, total, created_at, updated_at, paid_at)
         VALUES (?, ?, 'completed', 'paid', 'VND', ?, 0, 0, 0, ?, ?, ?, ?)`
      )
      .bind(orderId, userId, price, price, now, now, now)
      .run();

    const deliveryKey = `deliveries/${orderId}/${orderItemId}.txt`;
    const deliveryPut = await bucket.put(deliveryKey, delivered, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });
    const deliveryEtag = deliveryPut && deliveryPut.etag ? String(deliveryPut.etag) : "";

    await db
      .prepare(
        `INSERT INTO order_items
          (id, order_id, product_id, shop_id, inventory_id, quantity, unit_price, line_total, currency, fulfillment_status, content_r2_key, content_r2_etag, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'VND', 'delivered', ?, ?, ?, ?)`
      )
      .bind(orderItemId, orderId, productId, productRow.shop_id, reservation.id, price, price, deliveryKey, deliveryEtag, now, now)
      .run();

    await db
      .prepare("UPDATE inventory SET status = 'sold_out', updated_at = ? WHERE id = ? AND consumed_count >= line_count")
      .bind(now, reservation.id)
      .run();
    await db.prepare("UPDATE shops SET total_orders = total_orders + 1, updated_at = ? WHERE id = ?").bind(now, productRow.shop_id).run();

    const stock = await recomputeStock(db, productId, productRow.shop_id);

    return jsonResponse({
      ok: true,
      orderId,
      orderItemId,
      productId,
      deliveryId: orderItemId,
      downloadUrl: `/api/inventory/download?id=${encodeURIComponent(orderItemId)}`,
      stockCount: stock,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
