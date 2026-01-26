import { getMaintenanceDefaultMessage, readMaintenanceConfig, isMaintenanceActive } from "./_lib/maintenance.js";

const MAINTENANCE_COOKIE_KEY = "bk_maint_key";
const BK_CURRENCY_COOKIE = "bk_currency_selected";
const BK_LANGUAGE_DEFAULT = "vi";
const BK_CURRENCY_LANGUAGE = {
  VND: "vi",
  USD: "en",
  KRW: "ko",
  JPY: "ja",
  CNY: "zh",
};
const BK_LANGUAGE_LOCALES = {
  vi: "vi-VN",
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  zh: "zh-CN",
};

const MAINTENANCE_I18N = {
  vi: {
    title: "Hệ thống đang bảo trì",
    subtitle: "Chúng tôi đang nâng cấp hệ thống. Vui lòng quay lại sau.",
    remaining: "Còn lại",
    reopen: "Mở lại lúc",
    area: "Khu vực đang bảo trì",
    backHome: "Quay lại trang chủ",
    global: "Toàn bộ hệ thống",
  },
  en: {
    title: "System maintenance",
    subtitle: "We are upgrading the system. Please come back later.",
    remaining: "Remaining",
    reopen: "Reopens at",
    area: "Area under maintenance",
    backHome: "Back to home",
    global: "Entire system",
  },
  ko: {
    title: "시스템 점검 중",
    subtitle: "시스템을 업그레이드하고 있습니다. 잠시 후 다시 방문해 주세요.",
    remaining: "남은 시간",
    reopen: "재개 시간",
    area: "점검 중인 영역",
    backHome: "홈으로 돌아가기",
    global: "전체 시스템",
  },
  ja: {
    title: "システムメンテナンス中",
    subtitle: "システムをアップグレードしています。しばらくしてから再度お試しください。",
    remaining: "残り時間",
    reopen: "再開予定",
    area: "メンテナンス中のエリア",
    backHome: "ホームに戻る",
    global: "システム全体",
  },
  zh: {
    title: "系统维护中",
    subtitle: "我们正在升级系统，请稍后再来。",
    remaining: "剩余时间",
    reopen: "恢复时间",
    area: "维护区域",
    backHome: "返回首页",
    global: "整个系统",
  },
};

const MAINTENANCE_ROUTE_LABELS = {
  vi: {
    global: "Toàn bộ hệ thống",
    home: "Trang chủ",
    products: "Sản phẩm",
    services: "Dịch vụ",
    tasks_market: "Nhiệm vụ",
    task_posting: "Nhiệm vụ marketplace",
    seller_panel: "Seller panel",
    seller_public: "Gian hàng công khai",
    payments: "Thanh toán",
    profile: "Hồ sơ / Tài khoản",
    "profile.overview": "Tổng quan hồ sơ",
    "profile.orders": "Đơn hàng",
    "profile.favorites": "Yêu thích",
    "profile.following": "Đang theo dõi",
    "profile.history": "Lịch sử tài khoản",
    "profile.withdraw": "Rút tiền",
    "profile.tasks": "Nhiệm vụ",
    "profile.notifications": "Thông báo",
    "profile.badges": "Danh hiệu",
    "profile.security": "Bảo mật 2FA",
    "profile.chat": "Tin nhắn",
  },
  en: {
    global: "Entire system",
    home: "Home",
    products: "Products",
    services: "Services",
    tasks_market: "Missions",
    task_posting: "Marketplace tasks",
    seller_panel: "Seller panel",
    seller_public: "Public store",
    payments: "Payments",
    profile: "Profile / Account",
    "profile.overview": "Profile overview",
    "profile.orders": "Orders",
    "profile.favorites": "Favorites",
    "profile.following": "Following",
    "profile.history": "Account history",
    "profile.withdraw": "Withdrawals",
    "profile.tasks": "Tasks",
    "profile.notifications": "Notifications",
    "profile.badges": "Badges",
    "profile.security": "2FA security",
    "profile.chat": "Messages",
  },
  ko: {
    global: "전체 시스템",
    home: "홈",
    products: "상품",
    services: "서비스",
    tasks_market: "미션",
    task_posting: "마켓플레이스 작업",
    seller_panel: "셀러 패널",
    seller_public: "공개 상점",
    payments: "결제",
    profile: "프로필 / 계정",
    "profile.overview": "프로필 개요",
    "profile.orders": "주문",
    "profile.favorites": "찜 목록",
    "profile.following": "팔로잉",
    "profile.history": "계정 내역",
    "profile.withdraw": "출금",
    "profile.tasks": "작업",
    "profile.notifications": "알림",
    "profile.badges": "배지",
    "profile.security": "2FA 보안",
    "profile.chat": "메시지",
  },
  ja: {
    global: "システム全体",
    home: "ホーム",
    products: "商品",
    services: "サービス",
    tasks_market: "ミッション",
    task_posting: "マーケットプレイスのタスク",
    seller_panel: "セラーパネル",
    seller_public: "公開ショップ",
    payments: "決済",
    profile: "プロフィール / アカウント",
    "profile.overview": "プロフィール概要",
    "profile.orders": "注文",
    "profile.favorites": "お気に入り",
    "profile.following": "フォロー中",
    "profile.history": "アカウント履歴",
    "profile.withdraw": "出金",
    "profile.tasks": "タスク",
    "profile.notifications": "通知",
    "profile.badges": "バッジ",
    "profile.security": "2FA セキュリティ",
    "profile.chat": "メッセージ",
  },
  zh: {
    global: "整个系统",
    home: "首页",
    products: "产品",
    services: "服务",
    tasks_market: "任务",
    task_posting: "市场任务",
    seller_panel: "卖家面板",
    seller_public: "公开店铺",
    payments: "支付",
    profile: "个人资料 / 账户",
    "profile.overview": "资料概览",
    "profile.orders": "订单",
    "profile.favorites": "收藏",
    "profile.following": "关注",
    "profile.history": "账户历史",
    "profile.withdraw": "提现",
    "profile.tasks": "任务",
    "profile.notifications": "通知",
    "profile.badges": "称号",
    "profile.security": "2FA 安全",
    "profile.chat": "消息",
  },
};

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
    return map[char] || char;
  });

const toMs = (value) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const parseCookies = (header) => {
  const jar = {};
  if (!header) return jar;
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return;
    jar[key] = rest.join("=");
  });
  return jar;
};

const resolveLanguage = (cookies) => {
  const rawLang = String(cookies.bk_lang || "").trim().toLowerCase();
  if (BK_LANGUAGE_LOCALES[rawLang]) return rawLang;
  const currency = String(cookies[BK_CURRENCY_COOKIE] || "").toUpperCase();
  if (currency && BK_CURRENCY_LANGUAGE[currency]) return BK_CURRENCY_LANGUAGE[currency];
  return BK_LANGUAGE_DEFAULT;
};

const getText = (lang, key, fallback) => {
  const table = MAINTENANCE_I18N[lang] || MAINTENANCE_I18N[BK_LANGUAGE_DEFAULT];
  return table[key] || fallback || "";
};

const getRouteLabel = (lang, routeKey) => {
  if (!routeKey) return "";
  const table = MAINTENANCE_ROUTE_LABELS[lang] || MAINTENANCE_ROUTE_LABELS[BK_LANGUAGE_DEFAULT];
  return table[routeKey] || "";
};

export async function onRequest(context) {
  const db = context?.env?.DB;
  const config = await readMaintenanceConfig(db);
  const nowMs = Date.now();
  const active = isMaintenanceActive(config, nowMs);
  if (!active) {
    return new Response(null, {
      status: 302,
      headers: { location: "/", "cache-control": "no-store" },
    });
  }

  const cookies = parseCookies(context.request.headers.get("cookie") || "");
  const language = resolveLanguage(cookies);
  const locale = BK_LANGUAGE_LOCALES[language] || BK_LANGUAGE_LOCALES[BK_LANGUAGE_DEFAULT];
  const message = config?.message || getMaintenanceDefaultMessage();
  const endAtMs = toMs(config?.endAt);
  const startAtMs = toMs(config?.startAt);
  let routeKeyRaw = cookies[MAINTENANCE_COOKIE_KEY] || "";
  if (!config?.globalEnabled) {
    try {
      routeKeyRaw = decodeURIComponent(routeKeyRaw);
    } catch (error) {
      routeKeyRaw = "";
    }
  } else {
    routeKeyRaw = "global";
  }
  const routeKey = routeKeyRaw && typeof routeKeyRaw === "string" ? routeKeyRaw : "";
  const routeLabel = getRouteLabel(language, routeKey);

  const html = `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Maintenance | polyflux.xyz</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: dark;
        --bg: #08080c;
        --panel: rgba(12, 12, 18, 0.7);
        --panel-strong: rgba(10, 10, 16, 0.82);
        --stroke: rgba(255, 255, 255, 0.08);
        --text: #f5f6ff;
        --muted: rgba(255, 255, 255, 0.65);
        --shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        --glass-blur: blur(20px) saturate(140%);
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        min-height: 100vh;
        font-family: "Manrope", system-ui, -apple-system, Segoe UI, sans-serif;
        color: var(--text);
        background: var(--bg);
        text-rendering: optimizeLegibility;
      }
      .video-bg {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: -3;
      }
      .video-overlay {
        position: fixed;
        inset: 0;
        background: radial-gradient(circle at 20% 20%, rgba(123, 90, 255, 0.22), transparent 55%),
          radial-gradient(circle at 85% 40%, rgba(94, 190, 255, 0.2), transparent 60%),
          linear-gradient(180deg, rgba(6, 6, 10, 0.7), rgba(6, 6, 10, 0.92));
        z-index: -2;
      }
      .page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 40px 16px;
      }
      .maintenance-card {
        width: min(720px, 92vw);
        background: var(--panel);
        border: 1px solid var(--stroke);
        border-radius: 20px;
        padding: 28px;
        box-shadow: var(--shadow);
        backdrop-filter: var(--glass-blur);
        display: grid;
        gap: 16px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .brand img {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .brand b {
        color: #8b7cff;
      }
      h1 {
        font-family: "Outfit", "Manrope", system-ui, -apple-system, Segoe UI, sans-serif;
        font-size: clamp(22px, 3vw, 32px);
      }
      p {
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }
      .message {
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: var(--panel-strong);
        white-space: pre-line;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .meta {
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: var(--panel-strong);
        display: grid;
        gap: 4px;
      }
      .meta span {
        font-size: 12px;
        color: var(--muted);
      }
      .meta strong {
        font-size: 15px;
      }
      .section {
        font-size: 13px;
        color: var(--muted);
      }
      .maintenance-btn {
        padding: 10px 18px;
        border-radius: 999px;
        border: 1px solid var(--stroke);
        background: rgba(255, 255, 255, 0.06);
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease, background 0.2s ease;
      }
      .maintenance-btn:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.1);
      }
      @media (max-width: 640px) {
        .maintenance-card {
          padding: 22px;
        }
      }
    </style>
  </head>
  <body data-server-now="${nowMs}" data-start-at="${startAtMs}" data-end-at="${endAtMs}" data-lang="${escapeHtml(language)}" data-locale="${escapeHtml(
    locale
  )}" data-route-key="${escapeHtml(routeKey)}">
    <video class="video-bg" autoplay muted loop playsinline preload="metadata">
      <source src="/asset/bg-donut.mp4" type="video/mp4" />
    </video>
    <div class="video-overlay"></div>
    <main class="page">
      <section class="maintenance-card">
        <div class="brand">
          <img src="/asset/logo.png" alt="polyflux.xyz" />
          <span>polyflux<b>.xyz</b></span>
        </div>
        <div>
          <h1 id="maintenance-title">${escapeHtml(getText(language, "title"))}</h1>
          <p id="maintenance-subtitle">${escapeHtml(getText(language, "subtitle"))}</p>
        </div>
        <div class="message" id="maintenance-message">${escapeHtml(message)}</div>
        <div class="meta-grid">
          <div class="meta">
            <span id="maintenance-remaining-label">${escapeHtml(getText(language, "remaining"))}</span>
            <strong id="maintenance-countdown">--</strong>
          </div>
          <div class="meta">
            <span id="maintenance-until-label">${escapeHtml(getText(language, "reopen"))}</span>
            <strong id="maintenance-until">--</strong>
          </div>
        </div>
        <div class="section" id="maintenance-section" ${routeLabel ? "" : "hidden"}>
          <span id="maintenance-area-label">${escapeHtml(getText(language, "area"))}</span>:
          <strong id="maintenance-area">${escapeHtml(routeLabel)}</strong>
        </div>
        <button class="maintenance-btn" id="maintenance-home" type="button">${escapeHtml(getText(language, "backHome"))}</button>
      </section>
    </main>
    <script>
      (function () {
        const body = document.body;
        const serverNow = Number(body.dataset.serverNow || 0) || Date.now();
        const endAt = Number(body.dataset.endAt || 0) || 0;
        const startAt = Number(body.dataset.startAt || 0) || 0;
        const routeKey = body.dataset.routeKey || "";
        const countdownEl = document.getElementById("maintenance-countdown");
        const untilEl = document.getElementById("maintenance-until");
        const homeBtn = document.getElementById("maintenance-home");
        const sectionEl = document.getElementById("maintenance-section");
        const areaLabelEl = document.getElementById("maintenance-area");
        const skew = serverNow - Date.now();

        const I18N = ${JSON.stringify(MAINTENANCE_I18N)};
        const ROUTE_LABELS = ${JSON.stringify(MAINTENANCE_ROUTE_LABELS)};
        const CURRENCY_LANGUAGE = ${JSON.stringify(BK_CURRENCY_LANGUAGE)};
        const LOCALES = ${JSON.stringify(BK_LANGUAGE_LOCALES)};
        const DEFAULT_LANG = "${BK_LANGUAGE_DEFAULT}";
        let activeLang = body.dataset.lang || DEFAULT_LANG;
        let activeLocale = body.dataset.locale || LOCALES[DEFAULT_LANG] || "vi-VN";

        const applyLanguage = (lang) => {
          const next = I18N[lang] ? lang : DEFAULT_LANG;
          const table = I18N[next] || I18N[DEFAULT_LANG];
          const labels = ROUTE_LABELS[next] || ROUTE_LABELS[DEFAULT_LANG] || {};
          activeLang = next;
          activeLocale = LOCALES[next] || LOCALES[DEFAULT_LANG] || "vi-VN";
          document.documentElement.setAttribute("lang", next);
          const titleEl = document.getElementById("maintenance-title");
          const subtitleEl = document.getElementById("maintenance-subtitle");
          const remainingLabel = document.getElementById("maintenance-remaining-label");
          const untilLabel = document.getElementById("maintenance-until-label");
          const areaLabel = document.getElementById("maintenance-area-label");
          if (titleEl) titleEl.textContent = table.title || "";
          if (subtitleEl) subtitleEl.textContent = table.subtitle || "";
          if (remainingLabel) remainingLabel.textContent = table.remaining || "";
          if (untilLabel) untilLabel.textContent = table.reopen || "";
          if (areaLabel) areaLabel.textContent = table.area || "";
          if (homeBtn) homeBtn.textContent = table.backHome || "";
          if (sectionEl && areaLabelEl) {
            const label = routeKey ? labels[routeKey] || "" : "";
            if (label) {
              areaLabelEl.textContent = label;
              sectionEl.removeAttribute("hidden");
            } else {
              sectionEl.setAttribute("hidden", "true");
            }
          }
        };

        const resolveLangFromStorage = () => {
          try {
            const raw = localStorage.getItem("bk_currency_selected");
            const currency = String(raw || "").toUpperCase();
            return CURRENCY_LANGUAGE[currency] || "";
          } catch (err) {
            return "";
          }
        };

        const formatDuration = (ms) => {
          if (!ms || ms <= 0) return "00:00";
          const total = Math.floor(ms / 1000);
          const hours = Math.floor(total / 3600);
          const minutes = Math.floor((total % 3600) / 60);
          const seconds = total % 60;
          if (hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
          return minutes + "m " + seconds + "s";
        };

        const formatDate = (ms) => {
          if (!ms) return "--";
          try {
            return new Intl.DateTimeFormat(activeLocale, {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(new Date(ms));
          } catch (err) {
            return new Date(ms).toLocaleString();
          }
        };

        const update = () => {
          if (!endAt) return;
          const remaining = endAt - (Date.now() + skew);
          if (countdownEl) countdownEl.textContent = formatDuration(remaining);
          if (untilEl) untilEl.textContent = formatDate(endAt);
          if (remaining <= 0) {
            window.location.href = "/";
          }
        };

        applyLanguage(activeLang);
        const storageLang = resolveLangFromStorage();
        if (storageLang && storageLang !== activeLang) {
          applyLanguage(storageLang);
        }

        if (homeBtn) {
          homeBtn.addEventListener("click", () => {
            window.location.href = "/";
          });
        }

        if (untilEl && endAt) {
          untilEl.textContent = formatDate(endAt);
        }
        update();
        if (endAt) {
          setInterval(update, 1000);
        }
        if (startAt && endAt && endAt <= serverNow) {
          setTimeout(() => {
            window.location.href = "/";
          }, 1200);
        }
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
