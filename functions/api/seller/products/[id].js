import { jsonResponse } from "../../auth/_utils.js";
import { requireSeller } from "../../_catalog.js";

export async function onRequestDelete(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const isAdmin = String(auth.user.role || "").toLowerCase() === "admin";

  const productId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!productId) return jsonResponse({ ok: false, error: "INVALID_PRODUCT" }, 400);

  const row = await db
    .prepare(
      `SELECT p.id, p.shop_id, s.user_id
         FROM products p
         JOIN shops s ON s.id = p.shop_id
        WHERE p.id = ?
          AND (p.kind = 'product' OR p.kind IS NULL)
        LIMIT 1`
    )
    .bind(productId)
    .first();
  if (!row) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (!isAdmin && String(row.user_id || "") !== String(userId)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
  }

  const now = new Date().toISOString();
  await db
    .prepare("UPDATE products SET is_active = 0, is_published = 0, status = 'deleted', updated_at = ? WHERE id = ?")
    .bind(now, productId)
    .run();

  return jsonResponse({ ok: true, id: productId });
}
