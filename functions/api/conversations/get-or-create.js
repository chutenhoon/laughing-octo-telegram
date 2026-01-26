import { jsonResponse, normalizeEmail, normalizeUsername, readJsonBody } from "../auth/_utils.js";
import {
  buildUserProfile,
  ensureChatSchemaReady,
  ensureUser,
  getOrCreateDmConversation,
  getOrCreateSupportConversation,
  getSessionUser,
} from "../messages.js";
import { touchConversationVersions } from "../chat_state.js";

const CACHE_CONTROL = "no-store, no-cache, must-revalidate";

function normalizeId(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw;
}

function withNoStore(response) {
  if (response && response.headers && typeof response.headers.set === "function") {
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("pragma", "no-cache");
  }
  return response;
}

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

async function findUserRow(db, userId) {
  if (!db || !userId) return null;
  const cols = await getTableColumns(db, "users");
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

async function resolveUserId(db, raw) {
  const ref = String(raw || "").trim();
  if (!db || !ref) return "";
  const cols = await getTableColumns(db, "users");
  if (!cols.size) return "";
  const email = normalizeEmail(ref);
  const username = normalizeUsername(ref);
  const conditions = [];
  const binds = [];
  const isNumericRef = /^\d+$/.test(ref);
  if (cols.has("id")) {
    conditions.push("id = ?");
    binds.push(ref);
    if (isNumericRef) {
      conditions.push("rowid = ?");
      binds.push(Number(ref));
    }
  } else if (isNumericRef) {
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
  if (!conditions.length) return "";
  const select = cols.has("id") ? "id, rowid AS row_id" : "rowid AS row_id";
  const row = await db.prepare(`SELECT ${select} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`).bind(...binds).first();
  if (!row) return "";
  const idValue = row.id != null && String(row.id).trim() ? row.id : row.row_id;
  return idValue != null ? String(idValue) : "";
}

export async function onRequestPost(context) {
  const db = context?.env?.DB;
  if (!db) return withNoStore(jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500));
  try {
    await ensureChatSchemaReady(db, context.env);
    const sessionUser = await getSessionUser(context.request, context.env);
    if (!sessionUser) return withNoStore(jsonResponse({ ok: false, error: "NOT_LOGGED_IN" }, 401));
    const viewerId = await ensureUser(sessionUser, db);
    if (!viewerId) return withNoStore(jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404));

    const body = await readJsonBody(context.request);
    const rawTarget = body && (body.targetUserId || body.targetUser || body.userId || body.user_id);
    const rawTargetName = body && (body.targetUsername || body.username || body.user);
    const targetRef = String(rawTarget || rawTargetName || "").trim();
    if (!targetRef) {
      return withNoStore(jsonResponse({ ok: false, error: "INVALID_INPUT" }, 400));
    }

    let targetId = normalizeId(rawTarget);
    if (!targetId || String(targetId) === "0") {
      targetId = await resolveUserId(db, targetRef);
    }
    if (!targetId) {
      return withNoStore(jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404));
    }

    const viewerRow = await findUserRow(db, viewerId);
    const targetRow = String(targetId) === String(viewerId) ? viewerRow : await findUserRow(db, targetId);
    const viewerProfile = buildUserProfile(viewerRow, viewerId);
    const targetProfile = buildUserProfile(targetRow, targetId);
    const viewerIsAdmin = viewerProfile && viewerProfile.is_admin === true;
    const targetIsAdmin = targetProfile && targetProfile.is_admin === true;
    let conversationId = "";
    if (viewerIsAdmin || targetIsAdmin) {
      const adminId = viewerIsAdmin ? viewerId : targetId;
      const userId = viewerIsAdmin ? targetId : viewerId;
      conversationId = await getOrCreateSupportConversation(db, userId, adminId);
    } else {
      conversationId = await getOrCreateDmConversation(db, viewerId, targetId);
    }
    if (!conversationId) return withNoStore(jsonResponse({ ok: false, error: "CONVERSATION_FAILED" }, 500));
    const displayTitle =
      targetProfile &&
      (targetProfile.display_name || targetProfile.name || targetProfile.username || targetProfile.email || "");

    touchConversationVersions([viewerId, targetId]);
    return withNoStore(
      jsonResponse(
        {
          ok: true,
          conversationId,
          userId: viewerId,
          targetId,
          isSelf: String(targetId) === String(viewerId),
          displayTitle: displayTitle || "Chat",
          viewer: viewerProfile,
          target: targetProfile,
        },
        200
      )
    );
  } catch (error) {
    return withNoStore(jsonResponse({ ok: false, error: "INTERNAL" }, 500));
  }
}
