import { jsonResponse, generateId } from "../../../../auth/_utils.js";
import { requireSeller } from "../../../../_catalog.js";

const encoder = new TextEncoder();

function normalizeScope(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "all") return "all";
  return "available";
}

function normalizeFormat(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "csv") return "csv";
  return "txt";
}

function normalizeMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "keys" || raw === "key") return "keys";
  return "full";
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

async function getInventoryTotal(db, productId, scope) {
  const select = scope === "all" ? "SUM(line_count)" : "SUM(line_count - consumed_count)";
  const row = await db
    .prepare(`SELECT COALESCE(${select}, 0) AS total FROM inventory WHERE product_id = ?`)
    .bind(productId)
    .first();
  return Number(row && row.total ? row.total : 0);
}

async function loadInventoryRows(db, productId) {
  const rows = await db
    .prepare(
      `SELECT id, line_count, consumed_count, r2_object_key, content_text, created_at
         FROM inventory
        WHERE product_id = ?
        ORDER BY created_at ASC`
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

function toCsvLine(line) {
  const parts = String(line || "")
    .split("|")
    .map((part) => String(part || "").trim());
  return parts.map((part) => `"${part.replace(/\"/g, "\"\"")}"`).join(",");
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
  const scope = normalizeScope(url.searchParams.get("scope"));
  const format = normalizeFormat(url.searchParams.get("format"));
  const mode = normalizeMode(url.searchParams.get("mode"));

  const bucket = context?.env?.R2_INVENTORY || context?.env?.R2_BUCKET;
  const rows = await loadInventoryRows(db, productId);
  if (!bucket && rows.some((row) => row && row.r2_object_key)) {
    return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);
  }

  const totalAvailable = await getInventoryTotal(db, productId, scope);

  const filenameParts = ["inventory", productId, mode === "keys" ? "keys" : "items", scope];
  const filename = `${filenameParts.filter(Boolean).join("-")}.${format}`;
  const headers = new Headers();
  headers.set("content-type", format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8");
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  headers.set("cache-control", "private, no-store");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const row of rows) {
          const lineCount = Number(row.line_count || 0);
          const consumed = Number(row.consumed_count || 0);
          const available = scope === "all" ? lineCount : Math.max(lineCount - consumed, 0);
          if (available <= 0) continue;
          const lines = await loadInventoryLines(bucket, row);
          if (!lines.length) continue;
          const startIndex = scope === "all" ? 0 : Math.min(consumed, lines.length);
          const endIndex = Math.min(startIndex + available, lines.length);
          for (let i = startIndex; i < endIndex; i += 1) {
            const raw = lines[i];
            if (!raw) continue;
            let output = raw;
            if (mode === "keys") {
              const key = String(raw).split("|")[0] || raw;
              const keyText = String(key).trim();
              output = format === "csv" ? `"${keyText.replace(/\"/g, "\"\"")}"` : keyText;
            } else if (format === "csv") {
              output = toCsvLine(raw);
            }
            controller.enqueue(encoder.encode(`${output}\n`));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  await logInventoryEvent(db, {
    productId,
    shopId: owner.shop_id,
    action: mode === "keys" ? "export" : "download",
    count: totalAvailable,
    note: mode === "keys" ? "Export keys" : "Download stock",
  });

  return new Response(stream, { status: 200, headers });
}
