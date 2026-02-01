import { jsonResponse } from "./auth/_utils.js";
import { getOnlineStatuses } from "./chat_state.js";

const ONLINE_WINDOW_SEC = 60;

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const queryUsers = [
      ...parseList(url.searchParams.getAll("u")),
      ...parseList(url.searchParams.getAll("user")),
      ...parseList(url.searchParams.get("users")),
      ...parseList(url.searchParams.get("usernames")),
      ...parseList(url.searchParams.get("ids")),
    ];
    if (!queryUsers.length) return jsonResponse({ ok: true, users: {} }, 200);
    const users = getOnlineStatuses(queryUsers, ONLINE_WINDOW_SEC * 1000);
    return jsonResponse({ ok: true, users }, 200);
  } catch (error) {
    return jsonResponse({ ok: true, users: {} }, 200);
  }
}
