import { jsonResponse, readJsonBody } from "../../auth/_utils.js";
import { requireSeller } from "../../_catalog.js";

const ALLOWED_STATUS = new Set(["pending", "in_progress", "completed", "rejected", "cancelled"]);

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const requestId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!requestId) return jsonResponse({ ok: false, error: "INVALID_REQUEST" }, 400);

  const body = await readJsonBody(context.request);
  const nextStatus = body && body.status ? String(body.status).trim().toLowerCase() : "";
  if (!nextStatus || !ALLOWED_STATUS.has(nextStatus)) {
    return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 400);
  }

  const row = await db
    .prepare(
      `SELECT sr.id
         FROM service_requests sr
         JOIN products p ON p.id = sr.service_id
         JOIN shops s ON s.id = p.shop_id
        WHERE sr.id = ?
          AND s.user_id = ?
        LIMIT 1`
    )
    .bind(requestId, userId)
    .first();
  if (!row) return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);

  const now = new Date().toISOString();
  await db.prepare("UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?").bind(nextStatus, now, requestId).run();
  return jsonResponse({ ok: true, id: requestId, status: nextStatus, updatedAt: now });
}
