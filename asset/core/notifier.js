(() => {
  "use strict";

  const SUMMARY_URL = "/api/notifications/summary";
  const AUDIO_SRC = "/audio/new-notification-09-352705.mp3";
  const POLL_INTERVAL_MS = 15000;
  const CACHE_TTL_MS = 20000;
  const AUDIO_UNLOCK_KEY = "bk_audio_enabled";
  const CACHE_KEY = "bk_notify_summary_cache_v1";
  const BROADCAST_KEY = "bk_notify_broadcast_v1";
  const POLL_LOCK_KEY = "bk_notify_poll_lock_v1";
  const LEADER_KEY = "bk_notify_leader_v1";
  const SEEN_KEY = "bk_notify_seen_v1";
  const PERMISSION_PROMPT_KEY = "bk_notify_permission_prompted_v1";
  const LEADER_TTL_MS = 12000;
  const LEADER_PING_MS = 4000;
  const PRESENCE_TTL_MS = 15000;

  let pollTimer = null;
  let leaderTimer = null;
  let presenceTimer = null;
  let etag = "";
  let lastSummary = null;
  let lastSoundAt = 0;
  let audioEnabled = false;
  let audio = null;
  let started = false;
  let inflight = null;
  let channel = null;
  let channelName = "";
  let activeUserKey = "";
  let cacheKey = CACHE_KEY;
  let broadcastKey = BROADCAST_KEY;
  let pollLockKey = POLL_LOCK_KEY;
  let leaderKey = LEADER_KEY;
  let seenKey = SEEN_KEY;
  let permissionKey = PERMISSION_PROMPT_KEY;
  let storageBound = false;
  let tabId = "";
  let isLeader = false;
  let swRegistration = null;
  const presenceMap = new Map();

  const now = () => Date.now();
  const getTabId = () => {
    if (tabId) return tabId;
    try {
      const stored = sessionStorage.getItem("bk_notify_tab_id");
      if (stored) {
        tabId = stored;
        return tabId;
      }
    } catch (error) {}
    const seed = `${Math.random().toString(36).slice(2)}${now().toString(36)}`;
    tabId = seed;
    try {
      sessionStorage.setItem("bk_notify_tab_id", tabId);
    } catch (error) {}
    return tabId;
  };

  const readAuth = () => {
    if (window.BKAuth && typeof window.BKAuth.read === "function") {
      return window.BKAuth.read();
    }
    return { loggedIn: false, user: null };
  };

  const getUserRef = (auth) => {
    const user = auth && auth.user ? auth.user : null;
    if (!user) return "";
    if (user.id != null && String(user.id).trim()) return String(user.id).trim();
    if (user.username && String(user.username).trim()) return String(user.username).trim();
    if (user.email && String(user.email).trim()) return String(user.email).trim();
    return "";
  };

  const normalizeKey = (value) => String(value || "").trim();

  const getUserKey = (auth) => {
    const ref = getUserRef(auth);
    return normalizeKey(ref);
  };

  const hashKey = (value) => {
    const input = String(value || "");
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(36);
  };

  const buildScopedKey = (base, userKey) => (userKey ? `${base}:${userKey}` : base);

  const readLeaderState = () => {
    try {
      const raw = localStorage.getItem(leaderKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.id || !data.ts) return null;
      return data;
    } catch (error) {
      return null;
    }
  };

  const writeLeaderState = () => {
    const payload = { id: getTabId(), ts: now() };
    try {
      localStorage.setItem(leaderKey, JSON.stringify(payload));
    } catch (error) {}
    return payload;
  };

  const refreshLeaderState = () => {
    if (!activeUserKey) {
      isLeader = false;
      return;
    }
    const current = readLeaderState();
    const isFresh = current && now() - Number(current.ts || 0) < LEADER_TTL_MS;
    if (!current || !isFresh || current.id === getTabId()) {
      const next = writeLeaderState();
      isLeader = next.id === getTabId();
      return;
    }
    isLeader = current.id === getTabId();
  };

  const startLeaderHeartbeat = () => {
    if (leaderTimer) return;
    refreshLeaderState();
    leaderTimer = setInterval(() => {
      refreshLeaderState();
    }, LEADER_PING_MS);
  };

  const stopLeaderHeartbeat = () => {
    if (!leaderTimer) return;
    clearInterval(leaderTimer);
    leaderTimer = null;
    isLeader = false;
  };

  const prunePresence = () => {
    const cutoff = now() - PRESENCE_TTL_MS;
    presenceMap.forEach((value, key) => {
      if (!value || value.ts < cutoff) presenceMap.delete(key);
    });
  };

  const trackPresence = (payload) => {
    if (!payload || !payload.id) return;
    presenceMap.set(payload.id, payload);
  };

  const sendPresence = () => {
    if (!activeUserKey) return;
    const payload = {
      type: "presence",
      presence: {
        id: getTabId(),
        visible: document.visibilityState === "visible",
        isChat: isChatRoute(),
        ts: now(),
      },
    };
    trackPresence(payload.presence);
    if (channel) {
      try {
        channel.postMessage(payload);
      } catch (error) {}
    }
  };

  const startPresenceHeartbeat = () => {
    if (presenceTimer) return;
    sendPresence();
    presenceTimer = setInterval(() => {
      sendPresence();
      prunePresence();
    }, Math.min(LEADER_PING_MS, 6000));
  };

  const stopPresenceHeartbeat = () => {
    if (!presenceTimer) return;
    clearInterval(presenceTimer);
    presenceTimer = null;
    presenceMap.clear();
  };

  const syncUserContext = (userKey) => {
    if (userKey === activeUserKey) return;
    activeUserKey = userKey;
    etag = "";
    lastSummary = null;
    lastSoundAt = 0;
    cacheKey = buildScopedKey(CACHE_KEY, userKey);
    broadcastKey = buildScopedKey(BROADCAST_KEY, userKey);
    pollLockKey = buildScopedKey(POLL_LOCK_KEY, userKey);
    leaderKey = buildScopedKey(LEADER_KEY, userKey);
    seenKey = buildScopedKey(SEEN_KEY, userKey);
    permissionKey = buildScopedKey(PERMISSION_PROMPT_KEY, userKey);
    if (inflight) {
      try {
        inflight.abort();
      } catch (error) {}
      inflight = null;
    }
    if (channel) {
      try {
        channel.close();
      } catch (error) {}
      channel = null;
      channelName = "";
    }
    stopLeaderHeartbeat();
    stopPresenceHeartbeat();
    initChannels(userKey);
    if (userKey) {
      startLeaderHeartbeat();
      startPresenceHeartbeat();
    }
  };

  const isChatRoute = () => {
    const path = (window.location && window.location.pathname) || "";
    return path.toLowerCase().startsWith("/profile/messages");
  };

  const isChatVisible = () => document.visibilityState === "visible" && isChatRoute();

  const hasVisibleChatTab = () => {
    prunePresence();
    let active = false;
    presenceMap.forEach((value) => {
      if (!value) return;
      if (value.visible && value.isChat) active = true;
    });
    return active;
  };

  const canPlaySound = () => audioEnabled && isLeader && !isChatVisible() && !hasVisibleChatTab();

  const formatBadge = (count) => {
    const value = Number(count) || 0;
    if (value <= 0) return "";
    if (value > 99) return "99+";
    return String(value);
  };

  const applyAvatarDot = (active) => {
    document.querySelectorAll("[data-notify-avatar]").forEach((el) => {
      el.classList.toggle("has-unread", Boolean(active));
    });
  };

  const applyMessageBadge = (count) => {
    const label = formatBadge(count);
    document.querySelectorAll("[data-notify-messages]").forEach((link) => {
      let badge = link.querySelector("[data-notify-badge=\"messages\"]");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "menu-badge";
        badge.setAttribute("data-notify-badge", "messages");
        badge.setAttribute("aria-hidden", "true");
        link.appendChild(badge);
      }
      if (!label) {
        badge.textContent = "";
        badge.classList.add("is-hidden");
      } else {
        badge.textContent = label;
        badge.classList.remove("is-hidden");
      }
    });
  };

  const applySummary = (summary, options = {}) => {
    if (!summary) return;
    const unreadMessages = Number(summary.unreadMessages || summary.unread_messages || 0) || 0;
    const hasNewNotifications = summary.hasNewNotifications === true;
    applyAvatarDot(hasNewNotifications || unreadMessages > 0);
    applyMessageBadge(unreadMessages);
    if (!options.skipSound) {
      handleAlerts(summary);
    }
    lastSummary = summary;
    cacheSummary(summary, activeUserKey);
    broadcastSummary(summary, options);
  };

  const readSeenState = () => {
    try {
      const raw = localStorage.getItem(seenKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.userKey !== activeUserKey) return null;
      return data;
    } catch (error) {
      return null;
    }
  };

  const writeSeenState = (state) => {
    if (!activeUserKey || !state) return;
    try {
      localStorage.setItem(
        seenKey,
        JSON.stringify({
          userKey: activeUserKey,
          lastMessageAt: Number(state.lastMessageAt || 0) || 0,
          lastNotificationAt: Number(state.lastNotificationAt || 0) || 0,
          unreadMessages: Number(state.unreadMessages || 0) || 0,
          savedAt: now(),
        })
      );
    } catch (error) {}
  };

  const getSummaryMetrics = (summary) => ({
    lastMessageAt: Number(summary.lastMessageAt || 0) || 0,
    lastNotificationAt: Number(summary.lastNotificationAt || 0) || 0,
    unreadMessages: Number(summary.unreadMessages || summary.unread_messages || 0) || 0,
  });

  const shouldShowSystemNotification = () =>
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    document.visibilityState === "hidden";

  const showSystemNotification = async (title, options) => {
    if (!shouldShowSystemNotification()) return;
    try {
      if (swRegistration && swRegistration.showNotification) {
        await swRegistration.showNotification(title, options);
        return;
      }
      new Notification(title, options);
    } catch (error) {}
  };

  const handleAlerts = (summary) => {
    if (!summary || !activeUserKey || !isLeader) return;
    const metrics = getSummaryMetrics(summary);
    const seen = readSeenState();
    let baseline = seen && typeof seen === "object" ? seen : null;
    if (!baseline) {
      if (lastSummary) {
        baseline = getSummaryMetrics(lastSummary);
      } else {
        writeSeenState(metrics);
        return;
      }
    }
    const prevMessageAt = Number(baseline.lastMessageAt || 0) || 0;
    const prevNotificationAt = Number(baseline.lastNotificationAt || 0) || 0;
    const prevUnreadMessages = Number(baseline.unreadMessages || 0) || 0;

    const messageChanged = metrics.unreadMessages > prevUnreadMessages || metrics.lastMessageAt > prevMessageAt;
    const notificationChanged =
      summary.hasNewNotifications === true && metrics.lastNotificationAt > prevNotificationAt;
    if (!messageChanged && !notificationChanged) {
      if (!seen) writeSeenState(metrics);
      return;
    }

    const marker = Math.max(metrics.lastMessageAt, metrics.lastNotificationAt);
    if (marker && marker <= lastSoundAt) return;
    lastSoundAt = marker || now();

    if (canPlaySound()) {
      playSound();
    }

    if (shouldShowSystemNotification()) {
      const title = messageChanged ? "Tin nhắn mới" : "Thông báo mới";
      const body = messageChanged
        ? `Bạn có ${metrics.unreadMessages} tin nhắn chưa đọc.`
        : "Bạn có thông báo mới.";
      showSystemNotification(title, {
        body,
        tag: "bk-notify",
        renotify: false,
        data: { url: "/profile/messages/" },
        icon: "/favicon-32x32.png",
      });
    }

    writeSeenState(metrics);
  };

  const playSound = () => {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
    } catch (error) {}
  };

  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) return;
    if (swRegistration) return;
    const swUrl =
      window.BKAssets && typeof window.BKAssets.getAssetUrl === "function" ? window.BKAssets.getAssetUrl("/sw.js") : "/sw.js";
    try {
      swRegistration = await navigator.serviceWorker.register(swUrl);
    } catch (error) {}
  };

  const requestNotificationPermission = () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(permissionKey) === "1") return;
      localStorage.setItem(permissionKey, "1");
    } catch (error) {}
    try {
      Notification.requestPermission().catch(() => {});
    } catch (error) {}
  };

  const unlockAudio = () => {
    if (audioEnabled) return;
    try {
      audio = new Audio(AUDIO_SRC);
      audio.volume = 0.8;
      audioEnabled = true;
      sessionStorage.setItem(AUDIO_UNLOCK_KEY, "1");
    } catch (error) {
      audioEnabled = false;
    }
  };

  const initAudio = () => {
    try {
      if (sessionStorage.getItem(AUDIO_UNLOCK_KEY) === "1") {
        unlockAudio();
      }
    } catch (error) {}
    const handler = () => {
      if (!activeUserKey) return;
      unlockAudio();
      requestNotificationPermission();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("click", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("click", handler, { once: true });
  };

  const cacheSummary = (summary, userKey) => {
    try {
      const payload = { summary, savedAt: now(), userKey: userKey || "" };
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (error) {}
  };

  const readCachedSummary = (userKey) => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.summary || !data.savedAt) return null;
      if (userKey && data.userKey && data.userKey !== userKey) return null;
      if (now() - data.savedAt > CACHE_TTL_MS) return null;
      return data.summary;
    } catch (error) {
      return null;
    }
  };

  const broadcastSummary = (summary, options = {}) => {
    if (options.fromBroadcast) return;
    const payload = { type: "summary", summary, sentAt: now(), userKey: activeUserKey };
    if (channel) {
      try {
        channel.postMessage(payload);
      } catch (error) {}
    }
    try {
      localStorage.setItem(broadcastKey, JSON.stringify(payload));
    } catch (error) {}
  };

  const onBroadcast = (payload) => {
    if (!payload) return;
    if (activeUserKey && payload.userKey && payload.userKey !== activeUserKey) return;
    if (payload.type === "presence" && payload.presence) {
      trackPresence(payload.presence);
      return;
    }
    const summary = payload.summary;
    if (!summary) return;
    applySummary(summary, { fromBroadcast: true });
  };

  const canPoll = () => {
    try {
      const last = Number(localStorage.getItem(pollLockKey) || 0);
      if (last && now() - last < POLL_INTERVAL_MS * 0.7) return false;
      localStorage.setItem(pollLockKey, String(now()));
    } catch (error) {}
    return true;
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);
  };

  const refresh = async (options = {}) => {
    const auth = readAuth();
    if (!auth || !auth.loggedIn) {
      syncUserContext("");
      applyAvatarDot(false);
      applyMessageBadge(0);
      return;
    }
    const userRef = getUserRef(auth);
    const userKey = normalizeKey(userRef);
    syncUserContext(userKey);
    if (!userRef) return;
    if (document.visibilityState === "hidden" && !options.force && !isLeader) return;
    if (!options.force && !canPoll()) return;
    if (inflight) {
      try {
        inflight.abort();
      } catch (error) {}
      inflight = null;
    }
    const controller = new AbortController();
    inflight = controller;
    const params = new URLSearchParams();
    params.set("userId", userRef);
    const headers = {};
    if (etag) headers["if-none-match"] = etag;
    headers["x-user-id"] = userRef;
    try {
      const response = await fetch(`${SUMMARY_URL}?${params.toString()}`, {
        headers,
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      if (response.status === 304) return;
      const nextEtag = response.headers.get("etag");
      if (nextEtag) etag = nextEtag;
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data || !data.ok) return;
      applySummary(data);
    } catch (error) {
      if (error && error.name === "AbortError") return;
    } finally {
      if (inflight === controller) inflight = null;
    }
  };

  const initChannels = () => {
    const userKey = activeUserKey;
    if (userKey && typeof BroadcastChannel === "function") {
      const nextName = `bk_notify_summary_${hashKey(userKey)}`;
      if (channelName !== nextName) {
        if (channel) {
          try {
            channel.close();
          } catch (error) {}
          channel = null;
        }
        channelName = nextName;
        channel = new BroadcastChannel(channelName);
        channel.addEventListener("message", (event) => {
          onBroadcast(event && event.data);
        });
      }
    }
    if (!storageBound) {
      storageBound = true;
      window.addEventListener("storage", (event) => {
        if (event.key !== broadcastKey || !event.newValue) return;
        try {
          const payload = JSON.parse(event.newValue);
          onBroadcast(payload);
        } catch (error) {}
      });
    }
  };

  const init = () => {
    if (started) return;
    started = true;
    initAudio();
    registerServiceWorker();
    const auth = readAuth();
    const userKey = getUserKey(auth);
    syncUserContext(userKey);
    if (userKey) {
      const cached = readCachedSummary(userKey);
      if (cached) {
        applySummary(cached, { skipSound: true });
      }
    }
    refresh({ force: true });
    startPolling();
    document.addEventListener("visibilitychange", () => {
      sendPresence();
      if (document.visibilityState === "visible") {
        refresh({ force: true });
      }
    });
  };

  window.BKNotifier = {
    init,
    refresh,
    stop: stopPolling,
    getLastSummary: () => lastSummary,
  };
})();
