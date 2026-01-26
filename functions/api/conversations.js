import { jsonResponse } from "./auth/_utils.js";
import { SCHEMA_USER_VERSION } from "./admin/migrate.js";
import {
  buildUserProfile,
  ensureAdminUser,
  ensureChatSchemaReady,
  ensureUser,
  getOrCreateSupportConversation,
  resolveAdminAccess,
} from "./messages.js";
import {
  buildConversationEtag,
  getConversationVersion,
  matchEtagHeader,
  setConversationVersion,
  setUnreadCount,
} from "./chat_state.js";
import { createRequestTiming } from "./_timing.js";

const SUPPORT_TYPE = "support";
const SLOW_QUERY_MS = 300;
const CACHE_CONTROL = "no-store, no-cache, must-revalidate";
const CHAT_SCHEMA_VERSION = SCHEMA_USER_VERSION;

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw;
}

function toIso(seconds) {
  if (!seconds && seconds !== 0) return "";
  return new Date(Number(seconds) * 1000).toISOString();
}

function withNoStore(response) {
  if (response && response.headers && typeof response.headers.set === "function") {
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
  }
  return response;
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

function chatSchemaErrorResponse(error) {
  const code = String((error && error.message) || "");
  if (code === "CHAT_SCHEMA_MIGRATION_REQUIRED" || code === "CHAT_SCHEMA_MISSING") {
    const currentVersion = Number.isFinite(error && error.currentVersion) ? error.currentVersion : undefined;
    const requiredVersion = Number.isFinite(error && error.requiredVersion) ? error.requiredVersion : CHAT_SCHEMA_VERSION;
    return withNoStore(
      jsonResponse(
        {
          ok: false,
          error: "CHAT_SCHEMA_MIGRATION_REQUIRED",
          next: "/api/admin/migrate",
          currentVersion,
          requiredVersion,
        },
        409
      )
    );
  }
  return null;
}

function computeConversationVersion(conversations) {
  const list = Array.isArray(conversations) ? conversations : [];
  let maxUpdated = 0;
  let maxLast = 0;
  let hash = 0;
  list.forEach((item) => {
    const updatedAt = Date.parse(item.updatedAt || item.updated_at || "") || 0;
    const lastAt = Date.parse(item.lastAt || "") || 0;
    if (updatedAt > maxUpdated) maxUpdated = updatedAt;
    if (lastAt > maxLast) maxLast = lastAt;
    const seed = `${item.conversationId || ""}|${item.updatedAt || item.updated_at || ""}|${item.lastAt || ""}|${
      item.lastMessage || ""
    }|${item.lastType || ""}|${item.unreadCount || 0}`;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
  });
  const digest = (hash >>> 0).toString(36);
  return `${list.length}:${maxUpdated}:${maxLast}:${digest}`;
}

async function getUserColumns(db) {
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
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

function buildUserSelect(columns, prefix) {
  const cols = columns || new Set();
  const select = [];
  const add = (field) => {
    if (cols.has(field)) select.push(`u.${field} AS ${prefix}${field}`);
  };
  add("email");
  add("username");
  add("display_name");
  add("name");
  add("avatar_url");
  add("role");
  return select;
}

function buildUserRowFromJoin(row, prefix, fallbackId) {
  if (!row) return null;
  const userRow = { row_id: row[`${prefix}row_id`] };
  if (fallbackId) userRow.id = fallbackId;
  const assign = (field) => {
    const key = `${prefix}${field}`;
    if (row[key] != null) userRow[field] = row[key];
  };
  assign("email");
  assign("username");
  assign("display_name");
  assign("name");
  assign("avatar_url");
  assign("role");
  return userRow;
}

async function findUserRow(db, userId) {
  if (!db || !userId) return null;
  const cols = await getUserColumns(db);
  if (!cols.size) return null;
  const idField = cols.has("id") ? "id" : "rowid";
  try {
    return await db
      .prepare(`SELECT rowid AS row_id, * FROM users WHERE ${idField} = ? LIMIT 1`)
      .bind(userId)
      .first();
  } catch (error) {
    return null;
  }
}

function resolveLastType(preview) {
  const text = String(preview || "");
  if (!text) return "";
  const normalized = text.trim().toLowerCase();
  if (normalized === "ảnh" || normalized === "anh") return "image";
  if (normalized === "tệp" || normalized === "tep") return "file";
  return "text";
}

async function listUserConversations(db, userId, adminId, adminProfile, selfProfile) {
  const userColumns = await getUserColumns(db);
  const userSelect = buildUserSelect(userColumns, "other_");
  const selectUserSql = userSelect.length ? `, ${userSelect.join(", ")}` : "";
  const sql = `
    SELECT c.id AS conversation_id,
           c.type AS type,
           c.updated_at AS updated_at,
           c.last_message_at AS last_message_at,
           c.last_message_preview AS last_message_preview,
           p_self.unread_count AS unread_count,
           p_other.user_id AS other_id,
           u.rowid AS other_row_id${selectUserSql}
      FROM conversations c
      JOIN conversation_participants p_self
        ON p_self.conversation_id = c.id AND p_self.user_id = ?
      LEFT JOIN conversation_participants p_other
        ON p_other.conversation_id = c.id AND p_other.user_id != ?
      LEFT JOIN users u
        ON u.id = p_other.user_id OR u.rowid = p_other.user_id
     ORDER BY (c.type = ?) DESC, c.updated_at DESC
  `;
  const result = await db.prepare(sql).bind(userId, userId, SUPPORT_TYPE).all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return [];

  return rows.map((row) => {
    const conversationId = row.conversation_id ? String(row.conversation_id) : "";
    const type = row.type || SUPPORT_TYPE;
    let otherId = normalizeId(row.other_id) || (type === SUPPORT_TYPE ? adminId || "" : "");
    const updatedAt = row.updated_at != null ? toIso(row.updated_at) : "";
    const lastAt = row.last_message_at != null ? toIso(row.last_message_at) : "";
    const lastMessage = row.last_message_preview ? String(row.last_message_preview) : "";
    const lastType = resolveLastType(lastMessage);
    const unreadCount = row.unread_count != null ? Number(row.unread_count) : 0;
    let otherProfile = null;
    if (type === SUPPORT_TYPE && adminProfile) {
      otherProfile = adminProfile;
    } else if (otherId) {
      const otherRow = buildUserRowFromJoin(row, "other_", otherId);
      otherProfile = buildUserProfile(otherRow, otherId);
    }
    if (!otherProfile && !otherId && selfProfile) {
      otherId = userId;
      otherProfile = selfProfile;
    }
    if (!otherProfile && otherId) {
      otherProfile = { id: otherId, display_name: "User", avatar_url: "", role: "user", is_admin: false };
    }
    return {
      conversationId,
      type,
      userId: otherId || userId,
      user: otherProfile,
      lastAt,
      lastMessage,
      lastType,
      updatedAt,
      updated_at: updatedAt,
      unreadCount,
      unread_count: unreadCount,
    };
  });
}

async function listAdminConversations(db, adminId, filterUserId) {
  const userColumns = await getUserColumns(db);
  const userSelect = buildUserSelect(userColumns, "user_");
  const selectUserSql = userSelect.length ? `, ${userSelect.join(", ")}` : "";
  const params = [adminId, adminId, SUPPORT_TYPE];
  let sql = `
    SELECT c.id AS conversation_id,
           c.type AS type,
           c.updated_at AS updated_at,
           c.last_message_at AS last_message_at,
           c.last_message_preview AS last_message_preview,
           p_admin.unread_count AS unread_count,
           p_user.user_id AS user_id,
           u.rowid AS user_row_id${selectUserSql}
      FROM conversations c
      JOIN conversation_participants p_admin
        ON p_admin.conversation_id = c.id AND p_admin.user_id = ?
      JOIN conversation_participants p_user
        ON p_user.conversation_id = c.id AND p_user.user_id != ?
      LEFT JOIN users u
        ON u.id = p_user.user_id OR u.rowid = p_user.user_id
     WHERE c.type = ?
  `;
  if (filterUserId) {
    sql += " AND p_user.user_id = ?";
    params.push(filterUserId);
  }
  sql += " ORDER BY c.updated_at DESC";
  const result = await db.prepare(sql).bind(...params).all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return [];
  return rows.map((row) => {
    const conversationId = row.conversation_id ? String(row.conversation_id) : "";
    const type = row.type || SUPPORT_TYPE;
    const userId = row.user_id ? String(row.user_id) : "";
    const userRow = buildUserRowFromJoin(row, "user_", userId);
    const userProfile =
      buildUserProfile(userRow, userId) || { id: userId, display_name: "User", avatar_url: "", role: "user", is_admin: false };
    const updatedAt = row.updated_at != null ? toIso(row.updated_at) : "";
    const lastAt = row.last_message_at != null ? toIso(row.last_message_at) : "";
    const lastMessage = row.last_message_preview ? String(row.last_message_preview) : "";
    const lastType = resolveLastType(lastMessage);
    const unreadCount = row.unread_count != null ? Number(row.unread_count) : 0;
    return {
      conversationId,
      type,
      userId,
      user: userProfile,
      lastAt,
      lastMessage,
      lastType,
      updatedAt,
      updated_at: updatedAt,
      unreadCount,
      unread_count: unreadCount,
    };
  });
}

export async function onRequestGet(context) {
  const timing = createRequestTiming(context?.env, "/api/conversations", { slowQueryMs: SLOW_QUERY_MS });
  const db = context?.env?.DB;
  if (!db) return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500)), db);
  const dbTimed = timing.wrapDb(db);

  try {
    await ensureChatSchemaReady(dbTimed, context.env);

    const url = new URL(context.request.url);
    const ifNoneMatch = context.request.headers.get("if-none-match") || "";
    const isAdminRequest = url.searchParams.get("admin") === "1" || url.searchParams.get("admin") === "true";
    const filterUserId = normalizeId(url.searchParams.get("userId") || url.searchParams.get("user_id") || "");
    const adminId = normalizeId(url.searchParams.get("adminId") || url.searchParams.get("admin_id") || "");
    const adminAccess = await resolveAdminAccess(dbTimed, context.env, context.request, adminId);
    const sessionUser = adminAccess.sessionUser;
    const isAdmin = adminAccess.isAdmin;

    if (isAdminRequest) {
      if (!isAdmin) {
        return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "FORBIDDEN" }, 403)), db);
      }
      const admin = adminAccess.admin || (await ensureAdminUser(dbTimed, context.env));
      if (!admin)
        return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "ADMIN_NOT_CONFIGURED" }, 500)), db);
      const adminVersion = getConversationVersion(admin.id);
      const adminEtag = buildConversationEtag(admin.id, ["admin", filterUserId || "all"]);
      if (adminVersion && matchEtagHeader(ifNoneMatch, adminEtag)) {
        return await timing.finalize(buildNotModified(adminEtag), db);
      }
      const conversations = await listAdminConversations(dbTimed, admin.id, filterUserId || "");
      const totalUnread = conversations.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0);
      setUnreadCount(admin.id, totalUnread);
      const computedVersion = computeConversationVersion(conversations);
      setConversationVersion(admin.id, computedVersion);
      const response = jsonResponse(
        {
          ok: true,
          adminId: admin.id,
          admin: admin.profile,
          conversations,
          conversationsVersion: computedVersion,
          conversations_version: computedVersion,
        },
        200
      );
      response.headers.set("cache-control", CACHE_CONTROL);
      response.headers.set("pragma", "no-cache");
      response.headers.set("etag", buildConversationEtag(admin.id, ["admin", filterUserId || "all"]));
      return await timing.finalize(response, db);
    }

    const userId = filterUserId || (sessionUser && normalizeId(sessionUser.id));
    if (!userId) {
      return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "NOT_LOGGED_IN" }, 401)), db);
    }
    const ensuredId = await ensureUser({ id: userId }, dbTimed);
    if (!ensuredId) {
      return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404)), db);
    }
    const admin = await ensureAdminUser(dbTimed, context.env);
    if (!admin)
      return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "ADMIN_NOT_CONFIGURED" }, 500)), db);

    const userVersion = getConversationVersion(ensuredId);
    const userEtag = buildConversationEtag(ensuredId, ["user"]);
    if (userVersion && matchEtagHeader(ifNoneMatch, userEtag)) {
      return await timing.finalize(buildNotModified(userEtag), db);
    }

    await getOrCreateSupportConversation(dbTimed, ensuredId, admin.id);
    const selfRow = await findUserRow(dbTimed, ensuredId);
    const selfProfile = buildUserProfile(selfRow, ensuredId);
    const conversations = await listUserConversations(dbTimed, ensuredId, admin.id, admin.profile, selfProfile);
    const totalUnread = conversations.reduce((sum, item) => sum + (Number(item.unreadCount) || 0), 0);
    setUnreadCount(ensuredId, totalUnread);
    const computedVersion = computeConversationVersion(conversations);
    setConversationVersion(ensuredId, computedVersion);
    const response = jsonResponse(
      {
        ok: true,
        adminId: admin.id,
        admin: admin.profile,
        userId: ensuredId,
        conversations,
        conversationsVersion: computedVersion,
        conversations_version: computedVersion,
      },
      200
    );
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
    response.headers.set("etag", buildConversationEtag(ensuredId, ["user"]));
    return await timing.finalize(response, db);
  } catch (error) {
    const schemaResponse = chatSchemaErrorResponse(error);
    if (schemaResponse) return await timing.finalize(schemaResponse, db);
    return await timing.finalize(withNoStore(jsonResponse({ ok: false, error: "INTERNAL" }, 500)), db);
  }
}
