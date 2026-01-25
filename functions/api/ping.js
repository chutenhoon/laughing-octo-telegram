import { normalizeEmail, normalizeUsername, readJsonBody } from "./auth/_utils.js";
import { recordOnlinePing, shouldPersistLastSeen } from "./chat_state.js";

async function readPingPayload(request) {
  if (!request) return null;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await readJsonBody(request);
  }
  try {
    const text = await request.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      const params = new URLSearchParams(text);
      if (!params.size) return null;
      return Object.fromEntries(params.entries());
    }
  } catch (error) {
    return null;
  }
}

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

async function ensureLastSeenColumn(db) {
  if (!db) return;
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const hasLastSeen = rows.some((row) => row && row.name === "last_seen_at");
    if (hasLastSeen) return;
    await db.prepare("ALTER TABLE users ADD COLUMN last_seen_at INTEGER").run();
  } catch (error) {}
}

function buildNoContent() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function handlePing(context) {
  try {
    const db = context?.env?.DB;
    const request = context?.request;
    const payload = await readPingPayload(request);
    const userRef =
      (payload && (payload.userId || payload.user_id || payload.username || payload.id || payload.email)) ||
      (payload && payload.user) ||
      "";
    if (!userRef) return buildNoContent();
    const aliases = [];
    if (payload && payload.username) aliases.push(payload.username);
    if (payload && payload.email) aliases.push(payload.email);
    recordOnlinePing(userRef, { aliases });

    if (!db) return buildNoContent();
    await ensureLastSeenColumn(db);
    const nowMs = Date.now();
    if (!shouldPersistLastSeen(userRef, nowMs)) return buildNoContent();
    const now = Math.floor(nowMs / 1000);
    const columns = await getUserColumns(db);
    const idRef = /^\d+$/.test(String(userRef || "").trim()) ? String(Number(userRef)) : "";
    const username = payload && payload.username ? normalizeUsername(payload.username) : idRef ? "" : normalizeUsername(userRef);
    let email = payload && payload.email ? normalizeEmail(payload.email) : idRef ? "" : normalizeEmail(userRef);
    if (email && !email.includes("@")) email = "";
    const conditions = [];
    const binds = [now];
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
    if (!conditions.length) return buildNoContent();
    await db.prepare(`UPDATE users SET last_seen_at = ? WHERE ${conditions.join(" OR ")}`).bind(...binds).run();
    return buildNoContent();
  } catch (error) {
    return buildNoContent();
  }
}

export async function onRequestGet(context) {
  return handlePing(context);
}

export async function onRequestPost(context) {
  return handlePing(context);
}
