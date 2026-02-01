import { jsonResponse, generateId } from "../../../../auth/_utils.js";
import { requireSeller } from "../../../../_catalog.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LINES = 50000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function normalizeScope(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "all") return "all";
  return "available";
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

async function getInventoryColumns(db) {
  const result = await db.prepare("PRAGMA table_info(inventory)").all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const cols = new Set();
  rows.forEach((row) => {
    if (row && row.name) cols.add(String(row.name));
  });
  return cols;
}

const INVENTORY_COLUMN_DEFS = [
  { name: "r2_object_key", def: "TEXT" },
  { name: "r2_object_etag", def: "TEXT" },
  { name: "r2_object_size", def: "INTEGER" },
  { name: "line_count", def: "INTEGER DEFAULT 0" },
  { name: "consumed_count", def: "INTEGER DEFAULT 0" },
];

async function ensureInventorySchema(db) {
  const cols = await getInventoryColumns(db);
  for (const column of INVENTORY_COLUMN_DEFS) {
    if (cols.has(column.name)) continue;
    try {
      await db.prepare(`ALTER TABLE inventory ADD COLUMN ${column.name} ${column.def}`).run();
      cols.add(column.name);
    } catch (error) {
      // ignore add failures
    }
  }
  return cols;
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

async function getInventoryTotal(db, productId, scope) {
  const select = scope === "all" ? "SUM(line_count)" : "SUM(line_count - consumed_count)";
  const row = await db
    .prepare(`SELECT COALESCE(${select}, 0) AS total FROM inventory WHERE product_id = ?`)
    .bind(productId)
    .first();
  return Number(row && row.total ? row.total : 0);
}

async function loadInventoryRows(db, productId, sort) {
  const order = sort === "oldest" ? "ASC" : "DESC";
  const rows = await db
    .prepare(
      `SELECT id, line_count, consumed_count, r2_object_key, r2_object_etag, content_text, created_at
         FROM inventory
        WHERE product_id = ?
        ORDER BY created_at ${order}`
    )
    .bind(productId)
    .all();
  return rows && Array.isArray(rows.results) ? rows.results : [];
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

  const url = new URL(context.request.url);
  const page = Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("page"), 1)));
  const perPage = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(normalizeNumber(url.searchParams.get("perPage"), DEFAULT_PAGE_SIZE))));
  const sort = String(url.searchParams.get("sort") || "newest").toLowerCase();
  const scope = normalizeScope(url.searchParams.get("scope"));

  const rows = await loadInventoryRows(db, productId, sort);
  const totalAvailable = await getInventoryTotal(db, productId, scope);
  const totalPages = Math.max(1, Math.ceil(totalAvailable / perPage));
  const offset = (page - 1) * perPage;

  const bucket = context?.env?.R2_INVENTORY || context?.env?.R2_BUCKET;
  if (!bucket) {
    const hasR2 = rows.some((row) => row && row.r2_object_key);
    if (hasR2) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);
  }

  const items = [];
  let skip = offset;
  let remaining = perPage;

  for (const row of rows) {
    if (remaining <= 0) break;
    const lineCount = Number(row.line_count || 0);
    const consumed = Number(row.consumed_count || 0);
    const available = scope === "all" ? lineCount : Math.max(lineCount - consumed, 0);
    if (available <= 0) continue;
    if (skip >= available) {
      skip -= available;
      continue;
    }
    const lines = await loadInventoryLines(bucket, row);
    if (!lines.length) continue;
    const baseIndex = scope === "all" ? 0 : Math.min(consumed, lines.length);
    let start = baseIndex + skip;
    if (start >= lines.length) {
      skip = 0;
      continue;
    }
    let end = Math.min(baseIndex + available, start + remaining, lines.length);
    for (let i = start; i < end; i += 1) {
      const line = lines[i];
      if (!line) continue;
      const status = scope === "all" && i < consumed ? "consumed" : "available";
      items.push({ line, status, createdAt: row.created_at || null });
    }
    remaining -= Math.max(0, end - start);
    skip = 0;
  }

  return jsonResponse({
    ok: true,
    items,
    page,
    perPage,
    totalAvailable,
    totalPages,
  });
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

  const bucket = context?.env?.R2_INVENTORY || context?.env?.R2_BUCKET;
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
  const noteRaw = form.get("note");
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
  const size = Number(file.size || 0);

  const now = new Date().toISOString();
  const inventoryId = generateId();
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim() : filename || null;
  const inventoryCols = await ensureInventorySchema(db);
  const columns = [
    "id",
    "product_id",
    "status",
    "quantity",
    "line_count",
    "consumed_count",
    "r2_object_key",
    "r2_object_etag",
  ];
  const values = [inventoryId, productId, "available", lines.length, lines.length, 0, key, etag];
  if (inventoryCols.has("r2_object_size")) {
    columns.push("r2_object_size");
    values.push(size);
  }
  columns.push("notes", "created_at", "updated_at");
  values.push(note, now, now);
  const placeholders = columns.map(() => "?").join(", ");
  await db
    .prepare(`INSERT INTO inventory (${columns.join(", ")}) VALUES (${placeholders})`)
    .bind(...values)
    .run();

  await logInventoryEvent(db, {
    productId,
    shopId: owner.shop_id,
    action: "upload",
    count: lines.length,
    note,
  });
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
