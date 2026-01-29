import { jsonResponse, generateId } from "../auth/_utils.js";
import { requireAdmin, requireSeller, createSignedMediaToken, buildMediaUrl } from "../_catalog.js";

const IMAGE_LIMIT = 5;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 12;
const rateState = new Map();

function allowRequest(key) {
  if (!key) return true;
  const now = Date.now();
  const entry = rateState.get(key);
  if (!entry || now - entry.ts > RATE_WINDOW_MS) {
    rateState.set(key, { ts: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  entry.ts = now;
  rateState.set(key, entry);
  if (rateState.size > 1000) {
    rateState.forEach((value, storedKey) => {
      if (!value || now - value.ts > RATE_WINDOW_MS * 2) rateState.delete(storedKey);
    });
  }
  return true;
}

function normalizeShopId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : "";
}

function resolveExtension(file, contentType) {
  const type = String(contentType || "").toLowerCase();
  if (ALLOWED_TYPES[type]) return ALLOWED_TYPES[type];
  const name = String(file?.name || "");
  const idx = name.lastIndexOf(".");
  if (idx > -1 && idx < name.length - 1) {
    const ext = name.slice(idx + 1).toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "jpg";
    if (ext === "png") return "png";
    if (ext === "webp") return "webp";
  }
  return "";
}

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

async function findShop(db, shopRef) {
  const ref = normalizeShopId(shopRef);
  if (!ref) return null;
  let row = await db
    .prepare("SELECT id, user_id, status, is_active FROM shops WHERE id = ? LIMIT 1")
    .bind(ref)
    .first();
  if (row) return row;
  row = await db
    .prepare("SELECT id, user_id, status, is_active FROM shops WHERE lower(store_slug) = lower(?) LIMIT 1")
    .bind(ref)
    .first();
  return row || null;
}

function buildImageUrl(secret, requestUrl, key) {
  if (!secret || !key) return "";
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  return createSignedMediaToken(secret, key, exp, "store-image").then((token) => (token ? buildMediaUrl(requestUrl, token) : ""));
}

async function listImages(db, shopId, limit) {
  const hasLimit = Number.isFinite(Number(limit)) && Number(limit) > 0;
  const sql = `
    SELECT id, r2_object_key, content_type, size_bytes, position, uploaded_by_role, created_at
      FROM shop_images
     WHERE shop_id = ?
     ORDER BY position ASC, created_at ASC
     ${hasLimit ? "LIMIT ?" : ""}
  `;
  const stmt = db.prepare(sql);
  const bound = hasLimit ? stmt.bind(shopId, Number(limit)) : stmt.bind(shopId);
  const result = await bound.all();
  return result && Array.isArray(result.results) ? result.results : [];
}

async function getMaxPosition(db, shopId) {
  const row = await db.prepare("SELECT COALESCE(MAX(position), 0) AS max_pos FROM shop_images WHERE shop_id = ?").bind(shopId).first();
  return Number(row && row.max_pos ? row.max_pos : 0);
}

export async function onRequestGet(context) {
  const auth = await resolveAuth(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";
  const isAdmin = auth.isAdmin || (auth.user && String(auth.user.role || "").toLowerCase() === "admin");

  const url = new URL(context.request.url);
  const shopRef =
    url.searchParams.get("shopId") ||
    url.searchParams.get("storeId") ||
    url.searchParams.get("id") ||
    url.searchParams.get("slug") ||
    "";
  if (!shopRef) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  await ensureShopImagesTable(db);
  const shop = await findShop(db, shopRef);
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(shop.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const secret = context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  if (!secret) return jsonResponse({ ok: false, error: "MEDIA_SIGNING_NOT_CONFIGURED" }, 503);

  const rows = await listImages(db, shop.id, IMAGE_LIMIT);
  const items = [];
  for (const row of rows) {
    const urlValue = await buildImageUrl(secret, context.request.url, row.r2_object_key);
    items.push({
      id: row.id,
      url: urlValue,
      position: Number(row.position || 0),
      uploadedByRole: row.uploaded_by_role || "seller",
      contentType: row.content_type || "",
      sizeBytes: Number(row.size_bytes || 0),
      createdAt: row.created_at || null,
    });
  }
  return jsonResponse({ ok: true, items });
}

export async function onRequestPost(context) {
  const auth = await resolveAuth(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";
  const isAdmin = auth.isAdmin || (auth.user && String(auth.user.role || "").toLowerCase() === "admin");

  const bucket = context?.env?.R2_STORE_IMAGES || context?.env?.R2_STORE_AVATARS || context?.env?.R2_BUCKET;
  if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);

  const secret = context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  if (!secret) return jsonResponse({ ok: false, error: "MEDIA_SIGNING_NOT_CONFIGURED" }, 503);

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

  const shopId = normalizeShopId(form.get("shopId") || form.get("storeId") || form.get("id"));
  if (!shopId) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  await ensureShopImagesTable(db);
  const shop = await findShop(db, shopId);
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(shop.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const rateKey = `${userId || "guest"}:${shop.id}:upload`;
  if (!allowRequest(rateKey)) return jsonResponse({ ok: false, error: "RATE_LIMITED" }, 429);

  const files = [];
  for (const value of form.values()) {
    if (value && typeof value.arrayBuffer === "function") files.push(value);
  }
  if (!files.length) return jsonResponse({ ok: false, error: "FILE_REQUIRED" }, 400);

  const row = await db.prepare("SELECT COUNT(1) AS count FROM shop_images WHERE shop_id = ?").bind(shop.id).first();
  const current = Number(row && row.count ? row.count : 0);
  if (current + files.length > IMAGE_LIMIT) {
    return jsonResponse({ ok: false, error: "IMAGE_LIMIT", limit: IMAGE_LIMIT, current }, 400);
  }

  const maxPos = await getMaxPosition(db, shop.id);
  const now = new Date().toISOString();
  const uploadedByRole = isAdmin ? "admin" : "seller";
  const items = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const fileType = String(file.type || "").toLowerCase();
    const ext = resolveExtension(file, fileType);
    if (!ext) return jsonResponse({ ok: false, error: "INVALID_FILE_TYPE" }, 415);
    if (file.size > MAX_IMAGE_SIZE) {
      return jsonResponse({ ok: false, error: "FILE_TOO_LARGE" }, 413);
    }

    const imageId = generateId();
    const key = `store-image/${shop.id}/${imageId}.${ext}`;
    const buffer = await file.arrayBuffer();
    const put = await bucket.put(key, buffer, {
      httpMetadata: { contentType: fileType || `image/${ext}` },
    });
    const position = maxPos + index + 1;
    await db
      .prepare(
        `INSERT INTO shop_images (id, shop_id, r2_object_key, content_type, size_bytes, position, uploaded_by_role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(imageId, shop.id, key, fileType || null, Number(file.size || 0), position, uploadedByRole, now)
      .run();

    const urlValue = await buildImageUrl(secret, context.request.url, key);
    items.push({
      id: imageId,
      url: urlValue,
      position,
      uploadedByRole,
      contentType: fileType || "",
      sizeBytes: Number(file.size || 0),
      createdAt: now,
      etag: put && put.etag ? String(put.etag) : "",
    });
  }

  return jsonResponse({ ok: true, items });
}
