import { jsonResponse, readJsonBody, generateId } from "./auth/_utils.js";
import { requireUser, computeEtag } from "./_catalog.js";

const TYPE_SELLER = "seller";
const TYPE_TASK = "task";

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
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_approval_requests_user ON approval_requests(user_id)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_approval_requests_type_status ON approval_requests(type, status)").run();
  } catch (error) {
    // ignore create failures
  }
}

function normalizeType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === TYPE_SELLER) return TYPE_SELLER;
  if (raw === "task_posting" || raw === "mission" || raw === TYPE_TASK) return TYPE_TASK;
  return "";
}

function parsePayload(body) {
  const payload = body && typeof body === "object" ? body.payload || body.detail || body.data || body : null;
  if (!payload || typeof payload !== "object") return {};
  const trimmed = {};
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (value == null) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (text) trimmed[key] = text;
      return;
    }
    trimmed[key] = value;
  });
  return trimmed;
}

function validatePayload(type, payload) {
  if (type === TYPE_SELLER) {
    if (!payload.fullName && !payload.full_name) return "FULL_NAME_REQUIRED";
    if (!payload.birthDate && !payload.birth) return "BIRTH_REQUIRED";
    return "";
  }
  if (type === TYPE_TASK) {
    if (!payload.contact) return "CONTACT_REQUIRED";
    if (payload.budget == null || payload.budget === "") return "BUDGET_REQUIRED";
  }
  return "";
}

function mapRow(row) {
  let payload = {};
  if (row && row.payload_json) {
    try {
      payload = JSON.parse(row.payload_json) || {};
    } catch (error) {
      payload = {};
    }
  }
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    reason: row.reason || "",
    payload,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    reviewedAt: row.reviewed_at || null,
  };
}

export async function onRequestGet(context) {
  const auth = await requireUser(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  await ensureApprovalTable(db);

  const url = new URL(context.request.url);
  const type = normalizeType(url.searchParams.get("type"));
  const binds = [userId];
  const where = ["user_id = ?"];
  if (type) {
    where.push("type = ?");
    binds.push(type);
  }

  const sql = `
    SELECT id, type, status, payload_json, reason, created_at, updated_at, reviewed_at
      FROM approval_requests
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
  `;
  const rows = await db.prepare(sql).bind(...binds).all();
  const rawRows = rows && Array.isArray(rows.results) ? rows.results : [];
  const etagSeed = rawRows
    .map((row) => [row.id, row.updated_at, row.status, row.reason].map((v) => String(v || "")).join("|"))
    .join(";");
  const etag = `"${await computeEtag(`${type || "all"}:${etagSeed}`)}"`;
  const ifNoneMatch = context.request.headers.get("if-none-match") || "";
  const cacheHeaders = {
    "content-type": "application/json",
    "cache-control": "private, max-age=0, must-revalidate",
    vary: "Cookie",
    etag,
  };
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }
  const list = rawRows.map(mapRow);
  return new Response(JSON.stringify({ ok: true, items: list }), { status: 200, headers: cacheHeaders });
}

export async function onRequestPost(context) {
  const auth = await requireUser(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const user = auth.user || {};
  const userId = user.resolvedId || user.id;

  await ensureApprovalTable(db);

  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  const type = normalizeType(body.type || body.requestType || body.kind);
  if (!type) return jsonResponse({ ok: false, error: "INVALID_TYPE" }, 400);

  if (type === TYPE_SELLER) {
    const approved = Number(user.seller_approved || 0) === 1 || String(user.role || "").toLowerCase() === "seller";
    if (approved || String(user.role || "").toLowerCase() === "admin") {
      return jsonResponse({ ok: false, error: "ALREADY_APPROVED" }, 409);
    }
  }
  if (type === TYPE_TASK) {
    const approved =
      Number(user.task_approved || 0) === 1 ||
      Number(user.can_post_tasks || 0) === 1 ||
      Number(user.seller_approved || 0) === 1 ||
      String(user.role || "").toLowerCase() === "seller";
    if (approved || String(user.role || "").toLowerCase() === "admin") {
      return jsonResponse({ ok: false, error: "ALREADY_APPROVED" }, 409);
    }
  }

  const payload = parsePayload(body);
  const validationError = validatePayload(type, payload);
  if (validationError) return jsonResponse({ ok: false, error: validationError }, 400);

  const now = new Date().toISOString();
  const existing = await db
    .prepare("SELECT id, status FROM approval_requests WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1")
    .bind(userId, type)
    .first();

  if (existing && existing.id) {
    const status = String(existing.status || "").toLowerCase();
    if (status === "approved") return jsonResponse({ ok: false, error: "ALREADY_APPROVED" }, 409);
    if (status === "pending") {
      await db
        .prepare(
          `UPDATE approval_requests
              SET payload_json = ?, updated_at = ?
            WHERE id = ?`
        )
        .bind(JSON.stringify(payload), now, existing.id)
        .run();
      const row = await db
        .prepare("SELECT id, type, status, payload_json, reason, created_at, updated_at, reviewed_at FROM approval_requests WHERE id = ?")
        .bind(existing.id)
        .first();
      return jsonResponse({ ok: true, request: mapRow(row) });
    }
    await db
      .prepare(
        `UPDATE approval_requests
            SET status = ?, payload_json = ?, reason = ?, updated_at = ?, reviewed_at = ?, reviewer_id = ?
          WHERE id = ?`
      )
      .bind("pending", JSON.stringify(payload), null, now, null, null, existing.id)
      .run();
    const updated = await db
      .prepare("SELECT id, type, status, payload_json, reason, created_at, updated_at, reviewed_at FROM approval_requests WHERE id = ?")
      .bind(existing.id)
      .first();
    return jsonResponse({ ok: true, request: mapRow(updated) });
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO approval_requests (id, user_id, type, status, payload_json, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, type, "pending", JSON.stringify(payload), null, now, now)
    .run();

  const row = await db
    .prepare("SELECT id, type, status, payload_json, reason, created_at, updated_at, reviewed_at FROM approval_requests WHERE id = ?")
    .bind(id)
    .first();
  return jsonResponse({ ok: true, request: mapRow(row) });
}
