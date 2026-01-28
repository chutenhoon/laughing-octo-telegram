import { jsonResponse, readJsonBody } from "../../auth/_utils.js";
import { requireAdmin, requireSeller } from "../../_catalog.js";

async function resolveAuth(context) {
  const adminAuth = await requireAdmin(context);
  if (adminAuth.ok) return { ok: true, db: adminAuth.db, user: adminAuth.user || null, isAdmin: true };
  const sellerAuth = await requireSeller(context);
  if (!sellerAuth.ok) return { ok: false, response: sellerAuth.response };
  return { ok: true, db: sellerAuth.db, user: sellerAuth.user || null, isAdmin: false };
}

async function ensureShopImagesTable(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS shop_images (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL,
          r2_object_key TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 1,
          uploaded_by_role TEXT NOT NULL DEFAULT 'seller',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
        );`
      )
      .run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_shop_images_shop_pos ON shop_images(shop_id, position)").run();
  } catch (error) {
    // ignore create failures
  }
}

async function findShop(db, ref) {
  const value = String(ref || "").trim();
  if (!value) return null;
  let row = await db.prepare("SELECT id, user_id FROM shops WHERE id = ? LIMIT 1").bind(value).first();
  if (row) return row;
  row = await db.prepare("SELECT id, user_id FROM shops WHERE lower(store_slug) = lower(?) LIMIT 1").bind(value).first();
  return row || null;
}

export async function onRequestPost(context) {
  const auth = await resolveAuth(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";
  const isAdmin = auth.isAdmin || (auth.user && String(auth.user.role || "").toLowerCase() === "admin");

  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  const shopId = String(body.shopId || body.storeId || body.id || "").trim();
  const orderInput = Array.isArray(body.order) ? body.order : [];
  if (!shopId) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);
  if (!orderInput.length) return jsonResponse({ ok: false, error: "INVALID_ORDER" }, 400);

  await ensureShopImagesTable(db);
  const shop = await findShop(db, shopId);
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(shop.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const rows = await db
    .prepare("SELECT id, position FROM shop_images WHERE shop_id = ? ORDER BY position ASC, created_at ASC")
    .bind(shop.id)
    .all();
  const raw = rows && Array.isArray(rows.results) ? rows.results : [];
  const existing = raw.map((row) => String(row.id));
  const visible = isAdmin ? existing : raw.filter((row) => Number(row.position || 0) <= 5).map((row) => String(row.id));
  const existingSet = new Set(existing);
  const visibleSet = new Set(visible);
  const seen = new Set();
  const ordered = [];
  orderInput.forEach((id) => {
    const value = String(id || "").trim();
    if (!value || seen.has(value) || !existingSet.has(value)) return;
    if (!isAdmin && !visibleSet.has(value)) return;
    seen.add(value);
    ordered.push(value);
  });
  const remainder = isAdmin ? existing : visible;
  remainder.forEach((id) => {
    if (!seen.has(id)) ordered.push(id);
  });

  if (!isAdmin && !ordered.length) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  for (let i = 0; i < ordered.length; i += 1) {
    await db.prepare("UPDATE shop_images SET position = ? WHERE id = ?").bind(i + 1, ordered[i]).run();
  }

  return jsonResponse({ ok: true, order: ordered });
}
