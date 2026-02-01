import { jsonResponse, normalizeEmail, normalizeUsername } from "../auth/_utils.js";
import {
  buildHeartbeatEtag,
  getConversationVersion,
  getOnlineStatus,
  getUnreadCount,
  matchEtagHeader,
  normalizeUserKey,
  recordOnlinePing,
} from "../chat_state.js";

const CACHE_CONTROL = "no-store, no-cache, must-revalidate";
const DB_ONLINE_WINDOW_MS = 60 * 1000;
const LAST_SEEN_CACHE_TTL_MS = 45 * 1000;
const lastSeenCache = new Map();
let userColumnsCache = null;

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

function buildNotModified(etag) {
  return new Response(null, {
    status: 304,
    headers: {
      "cache-control": CACHE_CONTROL,
      pragma: "no-cache",
      etag,
    },
  });
}

function withNoStore(response) {
  if (response && response.headers && typeof response.headers.set === "function") {
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
  }
  return response;
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const db = context?.env?.DB;
    const userId =
      url.searchParams.get("userId") || url.searchParams.get("user_id") || url.searchParams.get("id") || "";
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
    const conversationsVersion = userId ? getConversationVersion(userId) : "";
    const unreadCount = userId ? getUnreadCount(userId) : 0;
    const etag = buildHeartbeatEtag(userId || "guest", statusRef || "", DB_ONLINE_WINDOW_MS);
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
        userId: userId || "",
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
    return response;
  } catch (error) {
    return withNoStore(jsonResponse({ ok: false, error: "INTERNAL" }, 500));
  }
}
