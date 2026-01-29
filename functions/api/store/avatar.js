import { jsonResponse, generateId } from "../auth/_utils.js";
import { requireSeller, createSignedMediaToken, buildMediaUrl } from "../_catalog.js";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 6;
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

function normalizeStoreId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : "";
}

function resolveExtension(file, contentType) {
  if (contentType && ALLOWED_TYPES[contentType]) return ALLOWED_TYPES[contentType];
  const name = String(file?.name || "");
  const idx = name.lastIndexOf(".");
  if (idx > -1 && idx < name.length - 1) {
    const ext = name.slice(idx + 1).toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "jpg";
    if (ext === "png") return "png";
    if (ext === "webp") return "webp";
    if (ext === "gif") return "gif";
    if (ext === "avif") return "avif";
  }
  return "";
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const user = auth.user || {};
  const userId = user.resolvedId || user.id;
  const isAdmin = String(user.role || "").toLowerCase() === "admin";

  const rateKey = `${userId || "guest"}:avatar`;
  if (!allowRequest(rateKey)) return jsonResponse({ ok: false, error: "RATE_LIMITED" }, 429);

  const bucket = context?.env?.R2_STORE_AVATARS || context?.env?.R2_BUCKET;
  if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);

  const secret = context?.env?.MEDIA_SIGNING_SECRET ? String(context.env.MEDIA_SIGNING_SECRET).trim() : "";
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

  const storeId = normalizeStoreId(form.get("storeId") || form.get("shopId") || form.get("id"));
  if (!storeId) return jsonResponse({ ok: false, error: "INVALID_STORE" }, 400);

  const file = form.get("file");
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    return jsonResponse({ ok: false, error: "FILE_REQUIRED" }, 400);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return jsonResponse({ ok: false, error: "FILE_TOO_LARGE" }, 413);
  }

  const type = String(file.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    return jsonResponse({ ok: false, error: "INVALID_FILE_TYPE" }, 415);
  }

  const ext = resolveExtension(file, type);
  if (!ext) return jsonResponse({ ok: false, error: "INVALID_FILE_TYPE" }, 415);

  const shop = await db.prepare("SELECT id, user_id, avatar_r2_key FROM shops WHERE id = ? LIMIT 1").bind(storeId).first();
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(shop.user_id || "") !== String(userId)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const key = `store-avatar/${storeId}/${generateId()}.${ext}`;
  const buffer = await file.arrayBuffer();

  let etag = "";
  try {
    const put = await bucket.put(key, buffer, {
      httpMetadata: { contentType: type || `image/${ext}` },
    });
    etag = put && put.etag ? String(put.etag) : "";
  } catch (error) {
    return jsonResponse({ ok: false, error: "R2_WRITE_FAILED" }, 502);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE shops
          SET avatar_r2_key = ?, avatar_r2_etag = ?, avatar_content_type = ?, avatar_size = ?, updated_at = ?
        WHERE id = ?`
    )
    .bind(key, etag || null, type || null, Number(file.size || 0), now, storeId)
    .run();

  if (shop.avatar_r2_key && shop.avatar_r2_key !== key) {
    try {
      await bucket.delete(shop.avatar_r2_key);
    } catch (error) {}
  }

  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const token = await createSignedMediaToken(secret, key, exp, "store-avatar");
  const url = token ? buildMediaUrl(context.request.url, token) : "";

  return jsonResponse({
    ok: true,
    storeId,
    avatar: {
      key,
      etag,
      size: Number(file.size || 0),
      contentType: type || "",
      url,
    },
  });
}
