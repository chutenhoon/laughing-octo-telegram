import { getSessionUser } from "./auth/session.js";

const TOKEN_TTL_SECONDS = 45;
const ROOM_PREFIX = "support:";
const SUPPORT_TYPE = "support";

const encoder = new TextEncoder();
let signingCache = { secret: "", key: null };

function normalizeId(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw;
}

function buildRoom(userId) {
  const normalized = normalizeId(userId);
  if (!normalized) return "";
  return `${ROOM_PREFIX}${normalized}`;
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value) {
  return base64UrlEncodeBytes(encoder.encode(String(value)));
}

async function getSigningKey(secret) {
  if (!secret) return null;
  if (signingCache.key && signingCache.secret === secret) return signingCache.key;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  signingCache = { secret, key };
  return key;
}

async function signPayload(payloadB64, secret) {
  const key = await getSigningKey(secret);
  if (!key) return "";
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function buildToken(payload, secret) {
  const payloadB64 = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await signPayload(payloadB64, secret);
  if (!signature) return "";
  return `${payloadB64}.${signature}`;
}

function isWebSocketUpgrade(request) {
  const upgrade = request.headers.get("upgrade") || "";
  return upgrade.toLowerCase() === "websocket";
}

function isAllowedOrigin(request) {
  const origin = request.headers.get("origin") || "";
  if (!origin) return false;
  try {
    const expected = new URL(request.url).origin;
    return origin === expected;
  } catch (error) {
    return false;
  }
}

async function resolveAdminRoom(db, adminId, conversationId) {
  if (!db) return { ok: false, status: 500, error: "DB_NOT_CONFIGURED" };
  const convoId = String(conversationId || "").trim();
  if (!convoId) return { ok: false, status: 400, error: "MISSING_CONVERSATION" };
  let convo;
  let participants = [];
  try {
    convo = await db.prepare("SELECT id, type FROM conversations WHERE id = ? LIMIT 1").bind(convoId).first();
    const rows = await db
      .prepare("SELECT user_id, role FROM conversation_participants WHERE conversation_id = ?")
      .bind(convoId)
      .all();
    participants = rows && Array.isArray(rows.results) ? rows.results : [];
  } catch (error) {
    return { ok: false, status: 500, error: "DB_READ_FAILED" };
  }
  if (!convo || !convo.id) return { ok: false, status: 404, error: "CONVERSATION_NOT_FOUND" };
  const type = String(convo.type || "").trim().toLowerCase();
  if (type && type !== SUPPORT_TYPE) return { ok: false, status: 403, error: "CONVERSATION_NOT_SUPPORTED" };
  const adminKey = normalizeId(adminId);
  let hasAdmin = false;
  let targetId = "";
  for (const row of participants) {
    const userId = normalizeId(row && row.user_id);
    const role = row && row.role ? String(row.role).toLowerCase() : "";
    if (userId && userId === adminKey) {
      hasAdmin = true;
      continue;
    }
    if (!targetId && userId) {
      if (role && role !== "admin") {
        targetId = userId;
      } else if (!targetId) {
        targetId = userId;
      }
    }
  }
  if (!hasAdmin) return { ok: false, status: 403, error: "FORBIDDEN" };
  if (!targetId) return { ok: false, status: 404, error: "TARGET_NOT_FOUND" };
  const room = buildRoom(targetId);
  if (!room) return { ok: false, status: 400, error: "INVALID_TARGET" };
  return { ok: true, room, userId: targetId };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!isWebSocketUpgrade(request)) {
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }
  if (!isAllowedOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }
  const sessionUser = await getSessionUser(request, env);
  if (!sessionUser || !sessionUser.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const secret = env && typeof env.WS_TOKEN_SECRET === "string" ? env.WS_TOKEN_SECRET.trim() : "";
  if (!secret) {
    return new Response("WS token not configured", { status: 500 });
  }
  if (!env || !env.CHAT_ROOM) {
    return new Response("Chat room binding missing", { status: 500 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId") || url.searchParams.get("conversation_id") || "";
  const role = String(sessionUser.role || "user").toLowerCase() === "admin" ? "admin" : "user";

  let room = "";
  if (role === "admin") {
    const resolved = await resolveAdminRoom(env.DB, sessionUser.id, conversationId);
    if (!resolved.ok) {
      return new Response(resolved.error || "Invalid conversation", { status: resolved.status || 400 });
    }
    room = resolved.room;
  } else {
    room = buildRoom(sessionUser.id);
    if (!room) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await buildToken({ uid: String(sessionUser.id), room, role, exp }, secret);
  if (!token) {
    return new Response("Token failed", { status: 500 });
  }

  const targetUrl = new URL(request.url);
  targetUrl.search = "";
  targetUrl.searchParams.set("token", token);

  const id = env.CHAT_ROOM.idFromName(room);
  const stub = env.CHAT_ROOM.get(id);
  const forwardRequest = new Request(targetUrl.toString(), request);
  return stub.fetch(forwardRequest);
}
