import { jsonResponse } from "../../../auth/_utils.js";
import { requireSeller } from "../../../_catalog.js";

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user ? auth.user.resolvedId || auth.user.id : "";
  const isAdmin = auth.user && String(auth.user.role || "").toLowerCase() === "admin";

  const shopId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!shopId) return jsonResponse({ ok: false, error: "INVALID_SHOP" }, 400);

  const shop = await db
    .prepare("SELECT id, user_id, status FROM shops WHERE id = ? LIMIT 1")
    .bind(shopId)
    .first();
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(shop.user_id || "") !== String(userId || "")) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const status = normalizeStatus(shop.status);
  if (status !== "pending" && status !== "pending_update") {
    return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 409);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE shops
          SET status = ?, pending_change_json = ?, updated_at = ?
        WHERE id = ?`
    )
    .bind("withdrawn", null, now, shopId)
    .run();

  return jsonResponse({ ok: true, status: "withdrawn", updatedAt: now, shopId });
}
