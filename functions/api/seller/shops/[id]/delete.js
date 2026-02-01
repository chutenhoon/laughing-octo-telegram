import { jsonResponse, readJsonBody, verifyPassword } from "../../../auth/_utils.js";
import { requireSeller } from "../../../_catalog.js";

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

async function getUserPassword(db, userId) {
  if (!userId) return null;
  const row = await db
    .prepare("SELECT password_hash, password_salt FROM users WHERE id = ? OR rowid = ? LIMIT 1")
    .bind(userId, userId)
    .first();
  if (!row || !row.password_hash || !row.password_salt) return null;
  return row;
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";

  const shopId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!shopId) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  const body = await readJsonBody(context.request);
  const password = body && typeof body.password === "string" ? body.password.trim() : "";
  if (!password) return jsonResponse({ ok: false, error: "PASSWORD_REQUIRED" }, 400);

  const shop = await db
    .prepare("SELECT id, user_id, avatar_r2_key FROM shops WHERE id = ? LIMIT 1")
    .bind(shopId)
    .first();
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (String(shop.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  await ensureShopImagesTable(db);
  const userRow = await getUserPassword(db, userId);
  if (!userRow) return jsonResponse({ ok: false, error: "INVALID_USER" }, 403);
  const valid = await verifyPassword(password, userRow.password_salt, userRow.password_hash);
  if (!valid) return jsonResponse({ ok: false, error: "INVALID_PASSWORD" }, 401);

  let imageKeys = [];
  try {
    const imageRows = await db
      .prepare("SELECT r2_object_key FROM shop_images WHERE shop_id = ?")
      .bind(shop.id)
      .all();
    imageKeys = (imageRows && Array.isArray(imageRows.results) ? imageRows.results : [])
      .map((row) => String(row.r2_object_key || "").trim())
      .filter(Boolean);
  } catch (error) {
    imageKeys = [];
  }
  const avatarKey = String(shop.avatar_r2_key || "").trim();

  try {
    await db.batch([
      db.prepare("DELETE FROM shop_images WHERE shop_id = ?").bind(shop.id),
      db.prepare("DELETE FROM shops WHERE id = ?").bind(shop.id),
    ]);
  } catch (error) {
    return jsonResponse({ ok: false, error: "DELETE_FAILED" }, 500);
  }

  const avatarBucket = context?.env?.R2_STORE_AVATARS || context?.env?.R2_BUCKET || context?.env?.R2_STORE_IMAGES;
  const imageBucket = context?.env?.R2_STORE_IMAGES || context?.env?.R2_BUCKET || context?.env?.R2_STORE_AVATARS;
  let cleanupFailed = false;
  if (avatarBucket && avatarKey) {
    try {
      await avatarBucket.delete(avatarKey);
    } catch (error) {
      cleanupFailed = true;
    }
  }
  if (imageBucket) {
    for (const key of imageKeys) {
      if (!key) continue;
      try {
        await imageBucket.delete(key);
      } catch (error) {
        cleanupFailed = true;
      }
    }
  }

  return jsonResponse({ ok: true, shopId: shop.id, cleanupFailed });
}
