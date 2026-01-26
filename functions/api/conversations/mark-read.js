import { jsonResponse, readJsonBody } from "../auth/_utils.js";
import { ensureChatSchemaReady, ensureUser, getSessionUser } from "../messages.js";
import { setUnreadCount, touchConversationVersions } from "../chat_state.js";

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

async function refreshUnreadCount(db, userId) {
  if (!db || !userId) return 0;
  try {
    const row = await db
      .prepare("SELECT COALESCE(SUM(unread_count), 0) AS total FROM conversation_participants WHERE user_id = ?")
      .bind(userId)
      .first();
    const total = row && row.total != null ? Number(row.total) : 0;
    if (Number.isFinite(total)) setUnreadCount(userId, total);
    return Number.isFinite(total) ? total : 0;
  } catch (error) {
    return 0;
  }
}

export async function onRequestPost(context) {
  const db = context?.env?.DB;
  if (!db) return withNoStore(jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500));
  try {
    await ensureChatSchemaReady(db, context.env);
    const sessionUser = await getSessionUser(context.request, context.env);
    if (!sessionUser) return withNoStore(jsonResponse({ ok: false, error: "NOT_LOGGED_IN" }, 401));
    const ensuredId = await ensureUser(sessionUser, db);
    if (!ensuredId) return withNoStore(jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404));
    const body = await readJsonBody(context.request);
    const rawConversationId = body && (body.conversationId || body.conversation_id);
    const conversationId = normalizeId(rawConversationId);

    if (conversationId) {
      const membership = await db
        .prepare(
          "SELECT conversation_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ? LIMIT 1"
        )
        .bind(conversationId, ensuredId)
        .first();
      if (!membership) {
        return withNoStore(jsonResponse({ ok: false, error: "FORBIDDEN" }, 403));
      }
      const convoRow = await db
        .prepare("SELECT last_message_id FROM conversations WHERE id = ? LIMIT 1")
        .bind(conversationId)
        .first();
      const lastReadId = convoRow && convoRow.last_message_id != null ? Number(convoRow.last_message_id) : null;
      await db
        .prepare(
          "UPDATE conversation_participants SET last_read_message_id = ?, unread_count = 0 WHERE conversation_id = ? AND user_id = ?"
        )
        .bind(lastReadId, conversationId, ensuredId)
        .run();
    } else {
      await db
        .prepare(
          `
          UPDATE conversation_participants
             SET last_read_message_id = COALESCE(
                   (SELECT last_message_id FROM conversations WHERE id = conversation_participants.conversation_id),
                   last_read_message_id
                 ),
                 unread_count = 0
           WHERE user_id = ?
        `
        )
        .bind(ensuredId)
        .run();
    }

    const unreadMessages = await refreshUnreadCount(db, ensuredId);
    touchConversationVersions([ensuredId]);
    return withNoStore(
      jsonResponse(
        {
          ok: true,
          userId: ensuredId,
          unreadMessages,
          unread_messages: unreadMessages,
        },
        200
      )
    );
  } catch (error) {
    return withNoStore(jsonResponse({ ok: false, error: "INTERNAL" }, 500));
  }
}
