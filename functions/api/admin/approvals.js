import { jsonResponse } from "../auth/_utils.js";
import { requireAdmin, computeEtag } from "../_catalog.js";

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
  } catch (error) {}
}

function normalizeType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "seller") return "seller";
  if (raw === "task") return "task";
  return "";
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pending" || raw === "approved" || raw === "rejected") return raw;
  return "";
}

function buildSearch(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return `%${trimmed.replace(/\s+/g, "%")}%`;
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
    user: {
      id: row.user_id,
      username: row.username || "",
      email: row.email || "",
      displayName: row.display_name || row.username || "",
      role: row.role || "",
      sellerApproved: Number(row.seller_approved || 0) === 1,
      taskApproved: Number(row.task_approved || 0) === 1,
      canPostTasks: Number(row.can_post_tasks || 0) === 1,
    },
  };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  await ensureApprovalTable(db);

  const url = new URL(context.request.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const type = normalizeType(url.searchParams.get("type"));
  const search = buildSearch(url.searchParams.get("search") || url.searchParams.get("q"));
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get("perPage") || 20)));
  const offset = (page - 1) * perPage;

  const where = [];
  const binds = [];
  if (status) {
    where.push("lower(a.status) = ?");
    binds.push(status);
  }
  if (type) {
    where.push("lower(a.type) = ?");
    binds.push(type);
  }
  if (search) {
    where.push("(u.username LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)");
    binds.push(search, search, search);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRow = await db
    .prepare(
      `SELECT COUNT(1) AS total
        FROM approval_requests a
        LEFT JOIN users u ON u.id = a.user_id
       ${whereClause}`
    )
    .bind(...binds)
    .first();
  const total = Number(countRow && countRow.total ? countRow.total : 0);

  const sql = `
    SELECT a.id, a.user_id, a.type, a.status, a.payload_json, a.reason, a.created_at, a.updated_at, a.reviewed_at,
           u.username, u.email, u.display_name, u.role, u.seller_approved, u.task_approved, u.can_post_tasks
      FROM approval_requests a
      LEFT JOIN users u ON u.id = a.user_id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const rows = await db.prepare(sql).bind(...binds, perPage, offset).all();
  const rawRows = rows && Array.isArray(rows.results) ? rows.results : [];
  const etagSeed = rawRows
    .map((row) => [row.id, row.updated_at, row.status, row.reason].map((v) => String(v || "")).join("|"))
    .join(";");
  const etag = `"${await computeEtag(`${status}:${type}:${search}:${page}:${perPage}:${etagSeed}`)}"`;
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

  const items = rawRows.map(mapRow);
  return new Response(
    JSON.stringify({ ok: true, items, page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) }),
    { status: 200, headers: cacheHeaders }
  );
}
