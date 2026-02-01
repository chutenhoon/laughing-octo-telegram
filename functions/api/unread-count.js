import { jsonResponse } from "./auth/_utils.js";
import { buildConversationEtag, getUnreadCount, matchEtagHeader } from "./chat_state.js";

const CACHE_CONTROL = "private, max-age=0, must-revalidate";

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
    const url = new URL(context.request.url);
    const userId =
      url.searchParams.get("userId") || url.searchParams.get("user_id") || url.searchParams.get("id") || "";
    const unreadCount = getUnreadCount(userId || "");
    const etag = buildConversationEtag(userId || "guest", ["unread"]);
    const ifNoneMatch = context.request.headers.get("if-none-match") || "";
    if (userId && matchEtagHeader(ifNoneMatch, etag)) {
      return buildNotModified(etag);
    }
    const response = jsonResponse(
      {
        ok: true,
        unreadCount,
        unread_count: unreadCount,
      },
      200
    );
    response.headers.set("cache-control", CACHE_CONTROL);
    response.headers.set("etag", etag);
    return response;
  } catch (error) {
    return jsonResponse({ ok: true, unreadCount: 0, unread_count: 0 }, 200);
  }
}
