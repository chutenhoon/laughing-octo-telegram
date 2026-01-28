import { jsonResponse, readJsonBody } from "../../../auth/_utils.js";
import { requireAdmin } from "../../../_catalog.js";

const DEFAULT_REASON = "Gian hàng chưa đạt yêu cầu";

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const storeId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!storeId) return jsonResponse({ ok: false, error: "INVALID_STORE" }, 400);

  let reason = DEFAULT_REASON;
  try {
    const body = await readJsonBody(context.request);
    if (body && typeof body.reason === "string" && body.reason.trim()) reason = body.reason.trim();
    if (body && typeof body.reviewNote === "string" && body.reviewNote.trim()) reason = body.reviewNote.trim();
  } catch (error) {}

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE shops
          SET status = ?, review_note = ?, rejected_at = ?, pending_change_json = ?, updated_at = ?
        WHERE id = ?`
    )
    .bind("rejected", reason, now, null, now, storeId)
    .run();

  return jsonResponse({ ok: true, storeId, reason });
}
