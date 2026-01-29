import { jsonResponse, readJsonBody, generateId } from "../../../../auth/_utils.js";
import { requireSeller } from "../../../../_catalog.js";

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function extractKeys(lines) {
  const keys = new Set();
  const full = new Set();
  (lines || []).forEach((line) => {
    const raw = String(line || "").trim();
    if (!raw) return;
    full.add(raw);
    const key = raw.split("|")[0] || raw;
    if (key) keys.add(String(key).trim());
  });
  return { keys, full };
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

async function logInventoryEvent(db, { productId, shopId, action, count, note }) {
  if (!productId || !shopId || !action) return;
  await ensureInventoryEvents(db);
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO inventory_events (id, product_id, shop_id, action, count, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(generateId(), productId, shopId, action, Number(count || 0), note || null, now)
      .run();
  } catch (error) {
    // ignore log failures
  }
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

async function loadInventoryRows(db, productId) {
  const rows = await db
    .prepare(
      `SELECT id, line_count, consumed_count, r2_object_key, r2_object_etag, content_text
         FROM inventory
        WHERE product_id = ?
        ORDER BY created_at ASC`
    )
    .bind(productId)
    .all();
  return rows && Array.isArray(rows.results) ? rows.results : [];
}

async function getInventoryColumns(db) {
  const result = await db.prepare("PRAGMA table_info(inventory)").all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const cols = new Set();
  rows.forEach((row) => {
    if (row && row.name) cols.add(String(row.name));
  });
  return cols;
}

async function loadInventoryLines(bucket, row) {
  if (row && row.content_text) {
    return String(row.content_text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (!bucket || !row || !row.r2_object_key) return [];
  const object = await bucket.get(row.r2_object_key);
  if (!object) return [];
  const text = await object.text();
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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

  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const text = typeof body.text === "string" ? body.text : "";
  const lines = Array.isArray(body.lines) ? body.lines : text.split(/\r?\n/);
  const count = normalizeNumber(body.count, 0);
  const input = lines.map((line) => String(line || "").trim()).filter(Boolean);
  const useKeys = input.length > 0;

  if (!useKeys && count <= 0) {
    return jsonResponse({ ok: false, error: "INVALID_COUNT" }, 400);
  }

  const bucket = context?.env?.R2_INVENTORY || context?.env?.R2_BUCKET;
  if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);

  const rows = await loadInventoryRows(db, productId);
  const inventoryCols = await getInventoryColumns(db);
  const hasSize = inventoryCols.has("r2_object_size");
  const targets = useKeys ? extractKeys(input) : { keys: new Set(), full: new Set() };
  let remainingCount = count;
  let removed = 0;

  for (const row of rows) {
    if (useKeys && targets.keys.size === 0 && targets.full.size === 0) break;
    if (!useKeys && remainingCount <= 0) break;

    const lineCount = Number(row.line_count || 0);
    const consumed = Number(row.consumed_count || 0);
    const available = Math.max(lineCount - consumed, 0);
    if (available <= 0) continue;

    const linesList = await loadInventoryLines(bucket, row);
    if (!linesList.length) continue;

    const startIndex = Math.min(consumed, linesList.length);
    let changed = false;
    const remainingLines = [];

    for (let i = startIndex; i < linesList.length; i += 1) {
      const line = linesList[i];
      if (!line) continue;
      if (useKeys) {
        const key = String(line).split("|")[0] || line;
        if (targets.full.has(line) || targets.keys.has(String(key).trim())) {
          targets.full.delete(line);
          targets.keys.delete(String(key).trim());
          removed += 1;
          changed = true;
          continue;
        }
        remainingLines.push(line);
        continue;
      }
      if (remainingCount > 0) {
        remainingCount -= 1;
        removed += 1;
        changed = true;
        continue;
      }
      remainingLines.push(line);
    }

    if (!changed) continue;

    if (!remainingLines.length) {
      await db.prepare("DELETE FROM inventory WHERE id = ?").bind(row.id).run();
      if (row.r2_object_key) {
        try {
          await bucket.delete(row.r2_object_key);
        } catch (error) {}
      }
      continue;
    }

    const updatedText = remainingLines.join("\n");
    const put = await bucket.put(row.r2_object_key, updatedText, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });
    const etag = put && put.etag ? String(put.etag) : row.r2_object_etag || "";
    const size = new TextEncoder().encode(updatedText).length;
    const now = new Date().toISOString();
    const updateFields = [
      "line_count = ?",
      "consumed_count = 0",
      "status = 'available'",
      "r2_object_etag = ?",
    ];
    const binds = [remainingLines.length, etag];
    if (hasSize) {
      updateFields.push("r2_object_size = ?");
      binds.push(size);
    }
    updateFields.push("updated_at = ?");
    binds.push(now, row.id);
    await db.prepare(`UPDATE inventory SET ${updateFields.join(", ")} WHERE id = ?`).bind(...binds).run();
  }

  if (removed <= 0) {
    return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  }

  await logInventoryEvent(db, {
    productId,
    shopId: owner.shop_id,
    action: "delete",
    count: removed,
    note: useKeys ? "Delete by keys" : "Delete by count",
  });

  const stock = await recomputeStock(db, productId, owner.shop_id);
  return jsonResponse({ ok: true, removed, stockCount: stock });
}
