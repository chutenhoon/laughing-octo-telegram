import { jsonResponse } from "../../auth/_utils.js";
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
          content_type TEXT,
          size_bytes INTEGER NOT NULL DEFAULT 0,
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

async function reindexPositions(db, shopId) {
  const rows = await db
    .prepare("SELECT id FROM shop_images WHERE shop_id = ? ORDER BY position ASC, created_at ASC")
    .bind(shopId)
    .all();
  const list = rows && Array.isArray(rows.results) ? rows.results : [];
  for (let i = 0; i < list.length; i += 1) {
    const id = list[i].id;
    await db.prepare("UPDATE shop_images SET position = ? WHERE id = ?").bind(i + 1, id).run();
  }
}

async function handleDelete(context) {
  const auth = await resolveAuth(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";
  const isAdmin = auth.isAdmin || (auth.user && String(auth.user.role || "").toLowerCase() === "admin");

  const imageId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!imageId) return jsonResponse({ ok: false, error: "INVALID_IMAGE" }, 400);

  await ensureShopImagesTable(db);
  const row = await db
    .prepare(
      `SELECT i.id, i.shop_id, i.r2_object_key, s.user_id
         FROM shop_images i
         JOIN shops s ON s.id = i.shop_id
        WHERE i.id = ?
        LIMIT 1`
    )
    .bind(imageId)
    .first();
  if (!row || !row.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(row.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  await db.prepare("DELETE FROM shop_images WHERE id = ?").bind(imageId).run();

  const bucket = context?.env?.R2_STORE_AVATARS || context?.env?.R2_BUCKET;
  if (bucket && row.r2_object_key) {
    try {
      await bucket.delete(row.r2_object_key);
    } catch (error) {}
  }

  await reindexPositions(db, row.shop_id);

  return jsonResponse({ ok: true, id: imageId });
}

export async function onRequestDelete(context) {
  return handleDelete(context);
}

export async function onRequestPost(context) {
  return handleDelete(context);
}
