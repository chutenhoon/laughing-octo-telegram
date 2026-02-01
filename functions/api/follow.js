import { jsonResponse, logError, normalizeEmail, normalizeUsername, readJsonBody } from "./auth/_utils.js";

const DEFAULT_FOLLOW_LIMIT = 15;
const MAX_FOLLOW_LIMIT = 50;

async function getTableColumns(db, table) {
  if (!db || !table) return new Set();
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    return new Set();
  }
}

function getUserIdField(columns) {
  return columns && columns.has("id") ? "id" : "rowid";
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

async function ensureFollowTable(db) {
  if (!db) return;
  try {
    await db
      .prepare(
        "CREATE TABLE IF NOT EXISTS follows (id INTEGER PRIMARY KEY AUTOINCREMENT, follower_user_id TEXT NOT NULL, following_user_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), UNIQUE (follower_user_id, following_user_id))"
      )
      .run();
  } catch (error) {}
}

async function ensureFollowColumns(db) {
  await ensureFollowTable(db);
  const cols = await getTableColumns(db, "follows");
  if (!cols.size) return cols;
  const defs = [
    { name: "follower_user_id", def: "TEXT" },
    { name: "following_user_id", def: "TEXT" },
    { name: "created_at", def: "INTEGER" },
  ];
  for (const def of defs) {
    if (cols.has(def.name)) continue;
    try {
      await db.prepare(`ALTER TABLE follows ADD COLUMN ${def.name} ${def.def}`).run();
      cols.add(def.name);
    } catch (error) {}
  }
  return cols;
}

async function ensureFollowIndexes(db) {
  if (!db) return;
  try {
    await db
      .prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_pair ON follows(follower_user_id, following_user_id)")
      .run();
  } catch (error) {}
}

async function resolveUserId(db, raw) {
  const ref = String(raw || "").trim();
  if (!db || !ref) return null;
  const cols = await getTableColumns(db, "users");
  if (!cols.size) return null;
  const idField = getUserIdField(cols);
  const email = normalizeEmail(ref);
  const username = normalizeUsername(ref);
  const conditions = [];
  const binds = [];
  const isNumericRef = /^\d+$/.test(ref);
  if (idField === "id" && cols.has("id")) {
    conditions.push("id = ?");
    binds.push(ref);
    if (isNumericRef) {
      conditions.push("rowid = ?");
      binds.push(Number(ref));
    }
  } else if (idField === "rowid" && isNumericRef) {
    conditions.push("rowid = ?");
    binds.push(Number(ref));
  }
  if (cols.has("username")) {
    conditions.push("lower(username) = ?");
    binds.push(username);
  }
  if (cols.has("email")) {
    conditions.push("lower(email) = ?");
    binds.push(email);
  }
  if (!conditions.length) return null;
  const select = cols.has("id") ? "id, rowid AS row_id" : "rowid AS row_id";
  const row = await db
    .prepare(`SELECT ${select} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`)
    .bind(...binds)
    .first();
  if (!row) return null;
  if (idField === "id") {
    const rawId = row.id;
    const idValue = rawId == null || String(rawId).trim() === "" ? null : rawId;
    const rowValue = row.row_id ?? null;
    if (idValue == null && rowValue != null) {
      try {
        await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(rowValue, rowValue).run();
      } catch (error) {}
      return String(rowValue);
    }
    return idValue != null ? String(idValue) : null;
  }
  return row.row_id != null ? String(row.row_id) : null;
}

async function hasFollowTable(db) {
  const cols = await ensureFollowColumns(db);
  return cols.has("follower_user_id") && cols.has("following_user_id");
}

function readCachedCount(row, primaryField, fallbackField) {
  const primaryValue = Number(row && row[primaryField] != null ? row[primaryField] : NaN);
  if (Number.isFinite(primaryValue)) return primaryValue;
  const fallbackValue = Number(row && row[fallbackField] != null ? row[fallbackField] : NaN);
  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

async function getCachedCounts(db, userId, columns, idField) {
  if (!db || !userId) return { followers: 0, following: 0 };
  const cols = columns || (await getTableColumns(db, "users"));
  if (!cols.size) return { followers: 0, following: 0 };
  const select = [];
  if (cols.has("followers")) select.push("followers");
  if (cols.has("following")) select.push("following");
  if (cols.has("follower_count")) select.push("follower_count");
  if (cols.has("following_count")) select.push("following_count");
  if (!select.length) return { followers: 0, following: 0 };
  const field = idField || getUserIdField(cols);
  const whereSql = field === "id" ? "id = ?" : "rowid = ?";
  const row = await db.prepare(`SELECT ${select.join(", ")} FROM users WHERE ${whereSql} LIMIT 1`).bind(userId).first();
  if (!row) return { followers: 0, following: 0 };
  return {
    followers: readCachedCount(row, "followers", "follower_count"),
    following: readCachedCount(row, "following", "following_count"),
  };
}

function getChanges(result) {
  const changes = result && result.meta && typeof result.meta.changes === "number" ? result.meta.changes : 0;
  return Number.isFinite(changes) ? changes : 0;
}

function appendDeltaUpdate(updates, binds, column, delta) {
  const abs = Math.abs(delta);
  if (!Number.isFinite(abs) || abs === 0) return;
  if (delta > 0) {
    updates.push(`${column} = COALESCE(${column}, 0) + ?`);
    binds.push(abs);
    return;
  }
  updates.push(`${column} = MAX(COALESCE(${column}, 0) - ?, 0)`);
  binds.push(abs);
}

async function applyCountDelta(db, userId, columns, deltas) {
  if (!db || !userId || !columns || !deltas) return;
  const followersDelta = Number(deltas.followers || 0);
  const followingDelta = Number(deltas.following || 0);
  const updates = [];
  const binds = [];
  if (Number.isFinite(followersDelta) && followersDelta !== 0) {
    if (columns.has("followers")) appendDeltaUpdate(updates, binds, "followers", followersDelta);
    if (columns.has("follower_count")) appendDeltaUpdate(updates, binds, "follower_count", followersDelta);
  }
  if (Number.isFinite(followingDelta) && followingDelta !== 0) {
    if (columns.has("following")) appendDeltaUpdate(updates, binds, "following", followingDelta);
    if (columns.has("following_count")) appendDeltaUpdate(updates, binds, "following_count", followingDelta);
  }
  if (!updates.length) return;
  const idField = getUserIdField(columns);
  const whereSql = idField === "id" ? "id = ?" : "rowid = ?";
  binds.push(userId);
  await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE ${whereSql}`).bind(...binds).run();
}

async function listUsers(db, userId, listType, options = {}, columns, idField) {
  if (!db || !userId) {
    return { items: [], page: 1, limit: DEFAULT_FOLLOW_LIMIT, total: 0, totalPages: 0 };
  }
  const cols = columns || (await getTableColumns(db, "users"));
  if (!cols.size) {
    return { items: [], page: 1, limit: DEFAULT_FOLLOW_LIMIT, total: 0, totalPages: 0 };
  }
  const field = idField || getUserIdField(cols);
  const select = [field === "id" ? "u.id AS id" : "u.rowid AS id"];
  if (cols.has("username")) select.push("u.username");
  if (cols.has("display_name")) select.push("u.display_name");
  if (cols.has("avatar_url")) select.push("u.avatar_url");
  const joinField = listType === "followers" ? "f.follower_user_id" : "f.following_user_id";
  const whereField = listType === "followers" ? "f.following_user_id" : "f.follower_user_id";
  const joinCondition = field === "id" ? `u.id = ${joinField}` : `u.rowid = ${joinField}`;
  const search = typeof options.search === "string" ? options.search.trim().toLowerCase() : "";
  const limitRaw = parsePositiveInt(options.limit, DEFAULT_FOLLOW_LIMIT);
  const limit = Math.min(Math.max(limitRaw, 1), MAX_FOLLOW_LIMIT);
  let page = parsePositiveInt(options.page, 1);
  const counts = await getCachedCounts(db, userId, cols, field);
  const total = listType === "followers" ? counts.followers : counts.following;
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  const conditions = [`${whereField} = ?`];
  const binds = [userId];
  if (search) {
    const term = `%${search}%`;
    const searchConditions = [];
    if (cols.has("username")) {
      searchConditions.push("lower(u.username) LIKE ?");
      binds.push(term);
    }
    if (cols.has("display_name")) {
      searchConditions.push("lower(u.display_name) LIKE ?");
      binds.push(term);
    }
    if (searchConditions.length) {
      conditions.push(`(${searchConditions.join(" OR ")})`);
    }
  }
  const whereSql = conditions.join(" AND ");
  if (totalPages > 0 && page > totalPages) page = totalPages;
  if (totalPages === 0) page = 1;
  const offset = Math.max(0, (page - 1) * limit);
  const result = await db
    .prepare(
      `
      SELECT ${select.join(", ")}
      FROM follows f
      JOIN users u ON ${joinCondition}
      WHERE ${whereSql}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `
    )
    .bind(...binds, limit, offset)
    .all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const items = rows.map((row) => ({
    id: row.id,
    username: row.username || "",
    display_name: row.display_name || "",
    avatar_url: row.avatar_url || "",
  }));
  return { items, page, limit, total, totalPages };
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    if (!(await hasFollowTable(db))) return jsonResponse({ ok: false, error: "DB_NOT_READY" }, 500);
    await ensureFollowIndexes(db);
    const userColumns = await getTableColumns(db, "users");
    const idField = getUserIdField(userColumns);
    const url = new URL(context.request.url);
    const userRef = url.searchParams.get("userId") || url.searchParams.get("user_id") || "";
    const targetRef = url.searchParams.get("targetId") || url.searchParams.get("target") || "";
    const listType = (url.searchParams.get("list") || "").toLowerCase();
    const search = url.searchParams.get("q") || url.searchParams.get("search") || "";
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const limit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_FOLLOW_LIMIT);
    const headerRef = context?.request?.headers?.get("x-user-id") || context?.request?.headers?.get("x-user-ref") || "";
    const subjectRef = targetRef || userRef || "";
    if (!subjectRef) return jsonResponse({ ok: false, error: "INVALID_INPUT" }, 400);
    const subjectId = await resolveUserId(db, subjectRef);
    if (!subjectId) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
    const viewerRef = userRef || headerRef;
    const viewerId = viewerRef ? await resolveUserId(db, viewerRef) : null;
    const counts = await getCachedCounts(db, subjectId, userColumns, idField);

    let isFollowing = false;
    if (viewerId && String(viewerId) !== String(subjectId)) {
      const row = await db
        .prepare("SELECT 1 FROM follows WHERE follower_user_id = ? AND following_user_id = ? LIMIT 1")
        .bind(viewerId, subjectId)
        .first();
      isFollowing = Boolean(row);
    }

    if (listType === "followers" || listType === "following") {
      const result = await listUsers(db, subjectId, listType, { search, page, limit }, userColumns, idField);
      return jsonResponse(
        {
          ok: true,
          counts,
          follower_count: counts.followers,
          following_count: counts.following,
          listType,
          items: result.items,
          users: result.items,
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        200
      );
    }

    return jsonResponse(
      { ok: true, counts, follower_count: counts.followers, following_count: counts.following, isFollowing },
      200
    );
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const stack = error && error.stack ? error.stack : "";
    logError("FOLLOW_GET_FAILED", new Error(`${message}${stack ? `\n${stack}` : ""}`));
    return jsonResponse({ ok: false, error: "INTERNAL", debug_code: "FOLLOW_GET_FAILED" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    if (!(await hasFollowTable(db))) return jsonResponse({ ok: false, error: "DB_NOT_READY" }, 500);
    await ensureFollowIndexes(db);
    const userColumns = await getTableColumns(db, "users");
    const idField = getUserIdField(userColumns);
    const body = await readJsonBody(context.request);
    if (!body) return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
    const userRef = body.userId || body.user_id || "";
    const targetRef = body.targetId || body.target_id || body.followId || body.followingId || "";
    const actionRaw = String(body.action || "").toLowerCase();
    const followFlag = body.follow === true || body.follow === "1";
    const action = actionRaw || (followFlag ? "follow" : "unfollow");
    if (!userRef || !targetRef) return jsonResponse({ ok: false, error: "INVALID_INPUT" }, 400);
    if (action !== "follow" && action !== "unfollow") {
      return jsonResponse({ ok: false, error: "INVALID_ACTION" }, 400);
    }
    const userId = await resolveUserId(db, userRef);
    const targetId = await resolveUserId(db, targetRef);
    if (!userId || !targetId) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
    if (String(userId) === String(targetId)) return jsonResponse({ ok: false, error: "INVALID_TARGET" }, 400);

    const createdAt = Math.floor(Date.now() / 1000);
    let isFollowing = false;
    if (action === "follow") {
      const result = await db
        .prepare("INSERT OR IGNORE INTO follows (follower_user_id, following_user_id, created_at) VALUES (?, ?, ?)")
        .bind(userId, targetId, createdAt)
        .run();
      const changes = getChanges(result);
      if (changes === 1) {
        await applyCountDelta(db, userId, userColumns, { following: 1 });
        await applyCountDelta(db, targetId, userColumns, { followers: 1 });
      }
      isFollowing = true;
    } else {
      const result = await db
        .prepare("DELETE FROM follows WHERE follower_user_id = ? AND following_user_id = ?")
        .bind(userId, targetId)
        .run();
      const changes = getChanges(result);
      if (changes === 1) {
        await applyCountDelta(db, userId, userColumns, { following: -1 });
        await applyCountDelta(db, targetId, userColumns, { followers: -1 });
      }
      isFollowing = false;
    }

    const counts = await getCachedCounts(db, targetId, userColumns, idField);
    return jsonResponse(
      {
        ok: true,
        isFollowing,
        counts,
        follower_count: counts.followers,
        following_count: counts.following,
      },
      200
    );
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const stack = error && error.stack ? error.stack : "";
    logError("FOLLOW_POST_FAILED", new Error(`${message}${stack ? `\n${stack}` : ""}`));
    return jsonResponse({ ok: false, error: "INTERNAL", debug_code: "FOLLOW_POST_FAILED" }, 500);
  }
}
