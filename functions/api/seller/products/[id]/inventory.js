import { jsonResponse, generateId } from "../../../auth/_utils.js";
import { requireSeller } from "../../../_catalog.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LINES = 50000;

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

  const rows = await db
    .prepare(
      `SELECT id, line_count, consumed_count, status, r2_object_etag, created_at, updated_at
         FROM inventory
        WHERE product_id = ?
        ORDER BY created_at DESC`
    )
    .bind(productId)
    .all();
  const list = (rows && Array.isArray(rows.results) ? rows.results : []).map((row) => {
    const lineCount = Number(row.line_count || 0);
    const consumed = Number(row.consumed_count || 0);
    return {
      id: row.id,
      lineCount,
      consumedCount: consumed,
      availableCount: Math.max(lineCount - consumed, 0),
      status: row.status || "available",
      etag: row.r2_object_etag || "",
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  });
  const totalAvailable = list.reduce((sum, item) => sum + Number(item.availableCount || 0), 0);
  return jsonResponse({ ok: true, items: list, totalAvailable });
}

export async function onRequestPost(context) {
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

  const bucket = context?.env?.R2_INVENTORY;
  if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);

  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ ok: false, error: "INVALID_CONTENT_TYPE" }, 415);
  }

  let form;
  try {
    form = await context.request.formData();
  } catch (error) {
    return jsonResponse({ ok: false, error: "INVALID_FORM" }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return jsonResponse({ ok: false, error: "FILE_REQUIRED" }, 400);
  }
  const filename = String(file.name || "").toLowerCase();
  const fileType = String(file.type || "").toLowerCase();
  const isText = fileType.startsWith("text/") || filename.endsWith(".txt") || filename.endsWith(".csv");
  if (!isText) return jsonResponse({ ok: false, error: "INVALID_FILE_TYPE" }, 415);
  if (file.size > MAX_FILE_SIZE) return jsonResponse({ ok: false, error: "FILE_TOO_LARGE" }, 413);

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return jsonResponse({ ok: false, error: "EMPTY_FILE" }, 400);
  if (lines.length > MAX_LINES) return jsonResponse({ ok: false, error: "TOO_MANY_LINES" }, 413);

  const normalized = lines.join("\n");
  const key = `inventory/${productId}/${generateId()}.txt`;
  const put = await bucket.put(key, normalized, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
  const etag = put && put.etag ? String(put.etag) : "";

  const now = new Date().toISOString();
  const inventoryId = generateId();
  await db
    .prepare(
      `INSERT INTO inventory
         (id, product_id, status, quantity, line_count, consumed_count, r2_object_key, r2_object_etag, notes, created_at, updated_at)
       VALUES (?, ?, 'available', ?, ?, 0, ?, ?, ?, ?, ?)`
    )
    .bind(inventoryId, productId, lines.length, lines.length, key, etag, filename || null, now, now)
    .run();

  const stock = await recomputeStock(db, productId, owner.shop_id);
  return jsonResponse({
    ok: true,
    inventory: {
      id: inventoryId,
      lineCount: lines.length,
      consumedCount: 0,
      availableCount: lines.length,
      status: "available",
      etag,
      createdAt: now,
      updatedAt: now,
    },
    stockCount: stock,
  });
}
