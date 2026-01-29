import { jsonResponse } from "../../../auth/_utils.js";
import { requireAdmin } from "../../../_catalog.js";

const ALLOWED_FIELDS = new Set([
  "store_name",
  "store_slug",
  "store_type",
  "category",
  "subcategory",
  "tags_json",
  "short_desc",
  "long_desc",
  "description",
  "contact_email",
  "contact_phone",
]);

function parsePendingChange(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const storeId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!storeId) return jsonResponse({ ok: false, error: "INVALID_STORE" }, 400);

  const shop = await db
    .prepare("SELECT id, pending_change_json FROM shops WHERE id = ? LIMIT 1")
    .bind(storeId)
    .first();
  if (!shop || !shop.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

  const now = new Date().toISOString();
  const updates = [];
  const binds = [];

  const pending = parsePendingChange(shop.pending_change_json);
  if (pending) {
    Object.entries(pending).forEach(([key, value]) => {
      if (!ALLOWED_FIELDS.has(key)) return;
      updates.push(`${key} = ?`);
      binds.push(value);
    });
  }

  updates.push("status = ?");
  binds.push("approved");
  updates.push("review_note = ?");
  binds.push(null);
  updates.push("pending_change_json = ?");
  binds.push(null);
  if (updates.length) {
    updates.push("updated_at = ?");
    binds.push(now);
  }
  binds.push(storeId);

  await db.prepare(`UPDATE shops SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();

  return jsonResponse({ ok: true, storeId });
}
