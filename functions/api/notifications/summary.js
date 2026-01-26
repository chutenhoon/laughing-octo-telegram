import { jsonResponse, logError, normalizeEmail, normalizeUsername } from "../auth/_utils.js";
import { matchEtagHeader } from "../chat_state.js";

const CACHE_CONTROL = "private, max-age=0, must-revalidate";

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

function toMs(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 1000000000000) return Math.floor(numeric);
  if (numeric > 10000000000) return Math.floor(numeric);
  return Math.floor(numeric * 1000);
}

function parseIsoToMs(value) {
  if (!value) return 0;
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

function buildEtag(parts) {
  const seed = parts.filter((part) => part != null && part !== "").map(String).join("|");
  return `"${hashString(seed)}"`;
}

function buildNotModified(etag) {
  return new Response(null, {
    status: 304,
    headers: {
      "cache-control": CACHE_CONTROL,
      etag,
    },
  });
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const url = new URL(context.request.url);
    const headerRef =
      context.request.headers.get("x-user-id") ||
      context.request.headers.get("x-user") ||
      context.request.headers.get("x-user-ref") ||
      "";
    const queryRef =
      url.searchParams.get("userId") ||
      url.searchParams.get("user_id") ||
      url.searchParams.get("id") ||
      url.searchParams.get("u") ||
      url.searchParams.get("username") ||
      "";
    const rawRef = headerRef || queryRef || "";
    if (!rawRef) {
      return jsonResponse(
        {
          ok: true,
          hasNewNotifications: false,
          unreadMessages: 0,
          unread_messages: 0,
          lastNotificationAt: 0,
          lastMessageAt: 0,
          userId: null,
        },
        200
      );
    }
    const userId = await resolveUserId(db, rawRef);
    if (!userId) {
      return jsonResponse(
        {
          ok: true,
          hasNewNotifications: false,
          unreadMessages: 0,
          unread_messages: 0,
          lastNotificationAt: 0,
          lastMessageAt: 0,
          userId: null,
        },
        200
      );
    }

    let unreadMessages = 0;
    let lastMessageAt = 0;
    const convoCols = await getTableColumns(db, "conversation_participants");
    if (convoCols.size && convoCols.has("user_id")) {
      const unreadRow = await db
        .prepare("SELECT COALESCE(SUM(unread_count), 0) AS unread_count FROM conversation_participants WHERE user_id = ?")
        .bind(userId)
        .first();
      unreadMessages = Number(unreadRow && unreadRow.unread_count ? unreadRow.unread_count : 0) || 0;
      const convoTableCols = await getTableColumns(db, "conversations");
      if (convoTableCols.size) {
        const lastMessageRow = await db
          .prepare(
            `
            SELECT MAX(c.last_message_at) AS last_message_at
            FROM conversations c
            JOIN conversation_participants p ON p.conversation_id = c.id
            WHERE p.user_id = ?
          `
          )
          .bind(userId)
          .first();
        lastMessageAt = toMs(lastMessageRow && lastMessageRow.last_message_at);
      }
    }

    let unreadNotifications = 0;
    let lastNotificationAt = 0;
    const notifyCols = await getTableColumns(db, "notifications");
    if (notifyCols.size && notifyCols.has("user_id")) {
      const notificationRow = await db
        .prepare(
          `
          SELECT
            COUNT(1) AS unread_count,
            MAX(created_at) AS last_created_at
          FROM notifications
          WHERE user_id = ?
            AND (read_at IS NULL OR read_at = "")
        `
        )
        .bind(userId)
        .first();
      unreadNotifications =
        Number(notificationRow && notificationRow.unread_count ? notificationRow.unread_count : 0) || 0;
      lastNotificationAt = parseIsoToMs(notificationRow && notificationRow.last_created_at);
    }

    const payload = {
      ok: true,
      hasNewNotifications: unreadNotifications > 0,
      unreadMessages,
      unread_messages: unreadMessages,
      lastNotificationAt,
      lastMessageAt,
      userId,
    };
    const etag = buildEtag([userId, unreadNotifications, unreadMessages, lastNotificationAt, lastMessageAt]);
    const ifNoneMatch = context.request.headers.get("if-none-match") || "";
    if (matchEtagHeader(ifNoneMatch, etag)) {
      return buildNotModified(etag);
    }
    const response = jsonResponse(payload, 200);
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("etag", etag);
    return response;
  } catch (error) {
    logError("NOTIFICATION_SUMMARY_FAILED", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
