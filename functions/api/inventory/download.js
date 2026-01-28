import { jsonResponse } from "../auth/_utils.js";
import { requireAdmin, requireUser } from "../_catalog.js";

function normalizeId(value) {
  const raw = String(value || "").trim();
  return raw ? raw : "";
}

export async function onRequestGet(context) {
  let db = null;
  let viewer = null;
  let isAdmin = false;

  const adminAuth = await requireAdmin(context);
  if (adminAuth.ok) {
    db = adminAuth.db;
    viewer = adminAuth.user || null;
    isAdmin = true;
  } else {
    const userAuth = await requireUser(context);
    if (!userAuth.ok) return userAuth.response;
    db = userAuth.db;
    viewer = userAuth.user || null;
  }

  const url = new URL(context.request.url);
  const orderItemId = normalizeId(url.searchParams.get("id") || url.searchParams.get("orderItemId") || url.searchParams.get("itemId"));
  if (!orderItemId) return jsonResponse({ ok: false, error: "INVALID_ITEM" }, 400);

  const row = await db
    .prepare(
      `SELECT oi.id, oi.order_id, oi.content_r2_key, oi.content_r2_etag, oi.content_text,
              o.buyer_user_id
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = ?
        LIMIT 1`
    )
    .bind(orderItemId)
    .first();
  if (!row || !row.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  const buyerId = String(row.buyer_user_id || "");
  const viewerId = viewer ? String(viewer.resolvedId || viewer.id || "") : "";
  if (!isAdmin && (!viewerId || viewerId !== buyerId)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const headers = new Headers();
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", "inline");

  if (row.content_r2_key) {
    const bucket = context?.env?.R2_INVENTORY || context?.env?.R2_BUCKET;
    if (!bucket) return jsonResponse({ ok: false, error: "R2_NOT_CONFIGURED" }, 500);
    const object = await bucket.get(row.content_r2_key);
    if (!object) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
    if (object.etag) headers.set("etag", object.etag);
    if (object.uploaded) headers.set("last-modified", new Date(object.uploaded).toUTCString());
    if (Number.isFinite(object.size)) headers.set("content-length", String(object.size));
    return new Response(object.body, { status: 200, headers });
  }

  if (row.content_text) {
    const text = String(row.content_text || "");
    headers.set("content-length", String(new TextEncoder().encode(text).length));
    return new Response(text, { status: 200, headers });
  }

  return jsonResponse({ ok: false, error: "DELIVERY_MISSING" }, 404);
}
