import { jsonResponse, normalizeEmail, normalizeUsername } from "../auth/_utils.js";
import { getSessionUser } from "../auth/session.js";
import { getOnlineStatus, matchEtagHeader, normalizeUserKey, recordOnlinePing } from "../chat_state.js";

const CACHE_CONTROL = "private, max-age=0, must-revalidate";
const VARY_HEADER = "Cookie";
const DB_ONLINE_WINDOW_MS = 60 * 1000;
const LAST_SEEN_CACHE_TTL_MS = 45 * 1000;
const lastSeenCache = new Map();
let userColumnsCache = null;

function normalizeId(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw;
}

async function getUserColumns(db) {
  if (userColumnsCache) return userColumnsCache;
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    userColumnsCache = cols;
    return cols;
  } catch (error) {
    return new Set();
  }
}

async function readLastSeenFromDb(db, ref) {
  if (!db || !ref) return 0;
  const key = normalizeUserKey(ref);
  if (!key) return 0;
  const cached = lastSeenCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < LAST_SEEN_CACHE_TTL_MS) {
    return cached.lastSeenMs || 0;
  }
  const columns = await getUserColumns(db);
  const raw = String(ref || "").trim();
  const isNumeric = /^\d+$/.test(raw);
  const idRef = isNumeric ? String(Number(raw)) : "";
  let username = "";
  let email = "";
  if (!idRef) {
    if (raw.includes("@")) {
      email = normalizeEmail(raw);
    } else {
      username = normalizeUsername(raw);
    }
  }
  const conditions = [];
  const binds = [];
  if (columns.has("id") && idRef) {
    conditions.push("id = ?");
    binds.push(idRef);
  }
  if (columns.has("username") && username) {
    conditions.push("lower(username) = ?");
    binds.push(username);
  }
  if (columns.has("email") && email) {
    conditions.push("lower(email) = ?");
    binds.push(email);
  }
  if (idRef) {
    conditions.push("rowid = ?");
    binds.push(Number(idRef));
  }
  if (!conditions.length) {
    lastSeenCache.set(key, { lastSeenMs: 0, fetchedAt: Date.now() });
    return 0;
  }
  try {
    const row = await db
      .prepare(`SELECT last_seen_at FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`)
      .bind(...binds)
      .first();
    const lastSeenAt = row && row.last_seen_at != null ? Number(row.last_seen_at) : 0;
    const lastSeenMs = Number.isFinite(lastSeenAt) && lastSeenAt > 0 ? lastSeenAt * 1000 : 0;
    lastSeenCache.set(key, { lastSeenMs, fetchedAt: Date.now() });
    return lastSeenMs;
  } catch (error) {
    lastSeenCache.set(key, { lastSeenMs: 0, fetchedAt: Date.now() });
    return 0;
  }
}

async function readConversationStats(db, userId) {
  if (!db || !userId) return { version: "", unreadCount: 0 };
  try {
    const row = await db
      .prepare(
        `
        SELECT
          COUNT(*) AS convo_count,
          MAX(c.updated_at) AS max_updated,
          MAX(c.last_message_at) AS max_last,
          MAX(c.last_message_id) AS max_last_id,
          COALESCE(SUM(p.unread_count), 0) AS unread_total
        FROM conversations c
        JOIN conversation_participants p ON p.conversation_id = c.id
        WHERE p.user_id = ?
      `
      )
      .bind(userId)
      .first();
    const count = row && row.convo_count != null ? Number(row.convo_count) : 0;
    const maxUpdated = row && row.max_updated != null ? Number(row.max_updated) : 0;
    const maxLast = row && row.max_last != null ? Number(row.max_last) : 0;
    const maxLastId = row && row.max_last_id != null ? Number(row.max_last_id) : 0;
    const unreadTotal = row && row.unread_total != null ? Number(row.unread_total) : 0;
    const version = `${Number.isFinite(count) ? count : 0}:${Number.isFinite(maxUpdated) ? maxUpdated : 0}:${
      Number.isFinite(maxLast) ? maxLast : 0
    }:${Number.isFinite(maxLastId) ? maxLastId : 0}:${Number.isFinite(unreadTotal) ? unreadTotal : 0}`;
    return { version, unreadCount: Number.isFinite(unreadTotal) ? unreadTotal : 0 };
  } catch (error) {
    return { version: "", unreadCount: 0 };
  }
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
      pragma: "no-cache",
      vary: VARY_HEADER,
      etag,
    },
  });
}

function withNoStore(response) {
  if (response && response.headers && typeof response.headers.set === "function") {
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
    response.headers.set("vary", VARY_HEADER);
  }
  return response;
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    const sessionUser = await getSessionUser(context.request, context.env);
    const sessionId = sessionUser && sessionUser.id ? normalizeId(sessionUser.id) : "";
    if (!sessionId) {
      return withNoStore(jsonResponse({ ok: false, error: "NOT_LOGGED_IN" }, 401));
    }

    const url = new URL(context.request.url);
    const statusRef =
      url.searchParams.get("u") ||
      url.searchParams.get("user") ||
      url.searchParams.get("target") ||
      url.searchParams.get("target_id") ||
      "";

    const status = statusRef ? getOnlineStatus(statusRef, DB_ONLINE_WINDOW_MS) : { online: false, lastSeenMs: 0 };
    const now = Date.now();
    let lastSeenAt = status.lastSeenMs || 0;
    let online = status.online === true;
    let source = "memory";
    if (statusRef && db && (!lastSeenAt || now - lastSeenAt > DB_ONLINE_WINDOW_MS)) {
      const dbLastSeen = await readLastSeenFromDb(db, statusRef);
      if (dbLastSeen) {
        const dbOnline = now - dbLastSeen <= DB_ONLINE_WINDOW_MS;
        if (!lastSeenAt || dbLastSeen > lastSeenAt) {
          lastSeenAt = dbLastSeen;
          source = "db";
        }
        if (!online && dbOnline) {
          online = true;
          source = "db";
        }
        if (dbLastSeen > status.lastSeenMs) {
          recordOnlinePing(statusRef, { nowMs: dbLastSeen });
        }
      }
    }

    const stats = await readConversationStats(db, sessionId);
    const conversationsVersion = stats.version || "";
    const unreadCount = Number(stats.unreadCount || 0) || 0;
    const bucket = lastSeenAt ? Math.floor(lastSeenAt / 60000) : 0;
    const etag = buildEtag([sessionId, conversationsVersion, unreadCount, statusRef || "", online ? "1" : "0", bucket]);
    const ifNoneMatch = context.request.headers.get("if-none-match") || "";
    if (matchEtagHeader(ifNoneMatch, etag)) {
      return buildNotModified(etag);
    }

    const response = jsonResponse(
      {
        ok: true,
        online,
        lastSeenAt,
        lastSeen: lastSeenAt,
        lastSeenMs: lastSeenAt,
        source,
        userId: sessionId,
        unreadCount,
        unread_count: unreadCount,
        conversationsVersion,
        conversations_version: conversationsVersion,
        updatedAt: Date.now(),
      },
      200
    );
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
    response.headers.set("etag", etag);
    response.headers.set("vary", VARY_HEADER);
    return response;
  } catch (error) {
    return withNoStore(jsonResponse({ ok: false, error: "INTERNAL" }, 500));
  }
}
