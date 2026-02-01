import { jsonResponse, readJsonBody, generateId } from "../../auth/_utils.js";
import { requireAdmin } from "../../_catalog.js";

async function ensureApprovalTable(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS approval_requests (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          payload_json TEXT,
          reason TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          reviewed_at TEXT,
          reviewer_id TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`
      )
      .run();
  } catch (error) {}
}

function normalizeStatus(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "approved" || raw === "rejected") return raw;
  return "";
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  await ensureApprovalTable(db);

  const approvalId = context?.params?.id ? String(context.params.id).trim() : "";
  if (!approvalId) return jsonResponse({ ok: false, error: "INVALID_REQUEST" }, 400);

  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const status = normalizeStatus(body.status || body.action || (body.approved === true ? "approved" : body.approved === false ? "rejected" : ""));
  if (!status) return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 400);
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "";

  const requestRow = await db
    .prepare("SELECT id, user_id, type, status FROM approval_requests WHERE id = ? LIMIT 1")
    .bind(approvalId)
    .first();
  if (!requestRow || !requestRow.id) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);
  if (String(requestRow.status || "").toLowerCase() !== "pending") {
    return jsonResponse({ ok: false, error: "INVALID_STATUS" }, 409);
  }

  const now = new Date().toISOString();
  const reviewerId = auth.user ? auth.user.resolvedId || auth.user.id : "admin";
  const updateBinds = [status, status === "rejected" ? reason : null, now, now, reviewerId, approvalId];
  await db
    .prepare(
      `UPDATE approval_requests
          SET status = ?, reason = ?, updated_at = ?, reviewed_at = ?, reviewer_id = ?
        WHERE id = ?`
    )
    .bind(...updateBinds)
    .run();

  if (status === "approved") {
    if (String(requestRow.type || "").toLowerCase() === "seller") {
      await db
        .prepare(
          `UPDATE users
              SET seller_approved = 1, task_approved = 1, can_post_tasks = 1, updated_at = strftime('%s','now')
            WHERE id = ? OR rowid = ?`
        )
        .bind(requestRow.user_id, requestRow.user_id)
        .run();
    } else if (String(requestRow.type || "").toLowerCase() === "task") {
      await db
        .prepare(
          `UPDATE users
              SET task_approved = 1, can_post_tasks = 1, updated_at = strftime('%s','now')
            WHERE id = ? OR rowid = ?`
        )
        .bind(requestRow.user_id, requestRow.user_id)
        .run();
    }
  }

  try {
    const title = status === "approved" ? "Yêu cầu đã được duyệt" : "Yêu cầu bị từ chối";
    const bodyText =
      status === "approved"
        ? "Yêu cầu của bạn đã được duyệt."
        : reason
          ? `Lý do: ${reason}`
          : "Yêu cầu của bạn chưa được chấp nhận.";
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId(),
        requestRow.user_id,
        "approval",
        title,
        bodyText,
        JSON.stringify({ approvalId, status, type: requestRow.type || "" }),
        now
      )
      .run();
  } catch (error) {}

  return jsonResponse({ ok: true, id: approvalId, status, reason });
}
