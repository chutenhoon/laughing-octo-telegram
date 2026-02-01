const ONLINE_WINDOW_MS = 90 * 1000;
const ONLINE_LIST_WINDOW_MS = 60 * 1000;
const PERSIST_WINDOW_MS = 60 * 1000;
const CLEANUP_WINDOW_MS = 5 * 60 * 1000;
const STALE_ONLINE_MS = 10 * 60 * 1000;

const onlineStore = new Map();
const aliasStore = new Map();
const conversationVersionStore = new Map();
const unreadCountStore = new Map();
const lastPersistedStore = new Map();
let versionCounter = 0;
let lastCleanupAt = 0;

function normalizeUserKey(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d+(\.0+)?$/.test(raw)) return String(Number(raw));
  return raw.toLowerCase();
}

function resolveUserKey(value) {
  const key = normalizeUserKey(value);
  if (!key) return "";
  return aliasStore.get(key) || key;
}

function rememberAlias(alias, canonical) {
  const aliasKey = normalizeUserKey(alias);
  const canonicalKey = normalizeUserKey(canonical);
  if (!aliasKey || !canonicalKey) return;
  aliasStore.set(aliasKey, canonicalKey);
  aliasStore.set(canonicalKey, canonicalKey);
}

function pruneOnlineStore(nowMs) {
  if (nowMs - lastCleanupAt < CLEANUP_WINDOW_MS) return;
  lastCleanupAt = nowMs;
  for (const [key, entry] of onlineStore.entries()) {
    if (!entry || !entry.lastSeenMs) {
      onlineStore.delete(key);
      continue;
    }
    if (nowMs - entry.lastSeenMs > STALE_ONLINE_MS) {
      onlineStore.delete(key);
    }
  }
}

function recordOnlinePing(ref, options = {}) {
  const key = normalizeUserKey(ref);
  if (!key) return "";
  aliasStore.set(key, key);
  const aliases = Array.isArray(options.aliases) ? options.aliases : [];
  aliases.forEach((alias) => rememberAlias(alias, key));
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  onlineStore.set(key, { lastSeenMs: nowMs, updatedAtMs: nowMs });
  pruneOnlineStore(nowMs);
  return key;
}

function getOnlineLastSeenMs(ref) {
  const key = resolveUserKey(ref);
  if (!key) return 0;
  const entry = onlineStore.get(key);
  return entry && entry.lastSeenMs ? entry.lastSeenMs : 0;
}

function isOnline(lastSeenMs, windowMs) {
  if (!lastSeenMs) return false;
  return Date.now() - lastSeenMs <= windowMs;
}

function getOnlineStatus(ref, windowMs = ONLINE_WINDOW_MS) {
  const lastSeenMs = getOnlineLastSeenMs(ref);
  return {
    key: resolveUserKey(ref),
    online: isOnline(lastSeenMs, windowMs),
    lastSeenMs,
  };
}

function getOnlineStatuses(refs, windowMs = ONLINE_LIST_WINDOW_MS) {
  const output = {};
  (Array.isArray(refs) ? refs : []).forEach((ref) => {
    const key = normalizeUserKey(ref);
    if (!key) return;
    const lastSeenMs = getOnlineLastSeenMs(key);
    output[key] = {
      id: /^\d+$/.test(key) ? key : "",
      username: /^\d+$/.test(key) ? "" : key,
      last_seen_at: lastSeenMs ? Math.floor(lastSeenMs / 1000) : null,
      is_online: isOnline(lastSeenMs, windowMs),
    };
  });
  return output;
}

function buildVersionToken() {
  versionCounter = (versionCounter + 1) % 1000000000;
  return `${Date.now().toString(36)}${versionCounter.toString(36)}`;
}

function setConversationVersion(userId, version) {
  const key = normalizeUserKey(userId);
  if (!key) return "";
  const value = String(version || "").trim();
  if (!value) return "";
  conversationVersionStore.set(key, value);
  return value;
}

function touchConversationVersion(userId) {
  const key = normalizeUserKey(userId);
  if (!key) return "";
  const value = buildVersionToken();
  conversationVersionStore.set(key, value);
  return value;
}

function touchConversationVersions(userIds) {
  const list = Array.isArray(userIds) ? userIds : [];
  list.forEach((userId) => touchConversationVersion(userId));
}

function getConversationVersion(userId) {
  const key = normalizeUserKey(userId);
  if (!key) return "";
  return conversationVersionStore.get(key) || "";
}

function getUnreadCount(userId) {
  const key = normalizeUserKey(userId);
  if (!key) return 0;
  return unreadCountStore.get(key) || 0;
}

function setUnreadCount(userId, count) {
  const key = normalizeUserKey(userId);
  if (!key) return 0;
  const value = Number(count);
  if (!Number.isFinite(value)) return getUnreadCount(key);
  unreadCountStore.set(key, Math.max(0, Math.floor(value)));
  return unreadCountStore.get(key) || 0;
}

function shouldPersistLastSeen(userId, nowMs, minIntervalMs = PERSIST_WINDOW_MS) {
  const key = normalizeUserKey(userId);
  if (!key) return false;
  const last = lastPersistedStore.get(key) || 0;
  if (nowMs - last < minIntervalMs) return false;
  lastPersistedStore.set(key, nowMs);
  return true;
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

function matchEtagHeader(ifNoneMatch, etag) {
  if (!ifNoneMatch || !etag) return false;
  const clean = (value) => String(value || "").trim().replace(/^W\//, "");
  const target = clean(etag);
  return ifNoneMatch
    .split(",")
    .map((token) => clean(token))
    .some((token) => token && token === target);
}

function buildStatusEtag(ref, windowMs = ONLINE_WINDOW_MS) {
  const status = getOnlineStatus(ref, windowMs);
  const bucket = status.lastSeenMs ? Math.floor(status.lastSeenMs / 60000) : 0;
  return buildEtag([status.key, status.online ? "1" : "0", bucket]);
}

function buildConversationEtag(userId, extraParts = []) {
  const version = getConversationVersion(userId);
  const unread = getUnreadCount(userId);
  return buildEtag([normalizeUserKey(userId), version, unread, ...extraParts]);
}

function buildHeartbeatEtag(selfId, statusRef, windowMs = ONLINE_WINDOW_MS) {
  const status = getOnlineStatus(statusRef, windowMs);
  const bucket = status.lastSeenMs ? Math.floor(status.lastSeenMs / 60000) : 0;
  return buildEtag([
    normalizeUserKey(selfId),
    getConversationVersion(selfId),
    getUnreadCount(selfId),
    status.key,
    status.online ? "1" : "0",
    bucket,
  ]);
}

export {
  ONLINE_LIST_WINDOW_MS,
  ONLINE_WINDOW_MS,
  buildConversationEtag,
  buildHeartbeatEtag,
  buildStatusEtag,
  getConversationVersion,
  getOnlineStatus,
  getOnlineStatuses,
  getUnreadCount,
  matchEtagHeader,
  normalizeUserKey,
  recordOnlinePing,
  rememberAlias,
  setConversationVersion,
  setUnreadCount,
  shouldPersistLastSeen,
  touchConversationVersions,
};
