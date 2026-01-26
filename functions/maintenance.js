import { getMaintenanceDefaultMessage, readMaintenanceConfig, isMaintenanceActive } from "./_lib/maintenance.js";

const SECTION_LABELS = {
  home: "Trang chu / Index",
  products: "San pham",
  services: "Dich vu",
  tasks_market: "Nhiem vu marketplace",
  task_posting: "Dang bai nhiem vu",
  seller_panel: "Seller panel",
  seller_public: "Gian hang cong khai",
  profile: "Ho so / Tai khoan",
  payments: "Thanh toan",
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

export async function onRequest(context) {
  const db = context?.env?.DB;
  const config = await readMaintenanceConfig(db);
  const nowMs = Date.now();
  const active = isMaintenanceActive(config, nowMs);
  const message = config?.message || getMaintenanceDefaultMessage();
  const endAtMs = toMs(config?.endAt);
  const startAtMs = toMs(config?.startAt);
  const url = new URL(context.request.url);
  const sectionKey = url.searchParams.get("section") || "";
  const sectionLabel = SECTION_LABELS[sectionKey] || "";

  const titleText = active ? "He thong dang bao tri" : "Bao tri da ket thuc";
  const subtitleText = active
    ? "Chung toi dang nang cap he thong. Vui long quay lai sau."
    : "He thong dang hoat dong binh thuong.";
  const actionText = active ? "Thu lai" : "Quay lai trang chu";

  const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Maintenance | polyflux.xyz</title>
    <meta name="robots" content="noindex, nofollow" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #050509;
        --panel: rgba(14, 14, 20, 0.92);
        --stroke: rgba(255, 255, 255, 0.08);
        --accent: #7b6bff;
        --accent-2: #3dd7ff;
        --text: #f5f6ff;
        --muted: rgba(255, 255, 255, 0.62);
        --shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        font-family: "Manrope", "Outfit", system-ui, -apple-system, Segoe UI, sans-serif;
        color: var(--text);
        background: radial-gradient(circle at top, rgba(123, 107, 255, 0.2), transparent 50%),
          radial-gradient(circle at 20% 20%, rgba(61, 215, 255, 0.18), transparent 45%),
          #050509;
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(680px, 92vw);
        padding: 28px;
        border-radius: 20px;
        border: 1px solid var(--stroke);
        background: var(--panel);
        box-shadow: var(--shadow);
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
        width: 32px;
        height: 32px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .brand b {
        color: var(--accent);
      }
      h1 {
        font-family: "Outfit", "Manrope", system-ui, -apple-system, Segoe UI, sans-serif;
        font-size: clamp(22px, 3vw, 30px);
      }
      p {
        color: var(--muted);
        line-height: 1.6;
        font-size: 14px;
      }
      .message {
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(8, 8, 12, 0.7);
        white-space: pre-line;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .meta {
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(8, 8, 12, 0.7);
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
        font-size: 12px;
        color: var(--muted);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .btn {
        padding: 10px 18px;
        border-radius: 999px;
        border: 1px solid var(--stroke);
        background: rgba(255, 255, 255, 0.04);
        color: var(--text);
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      .btn.primary {
        background: linear-gradient(120deg, var(--accent), var(--accent-2));
        color: #111119;
        border: none;
      }
      .btn:hover {
        transform: translateY(-1px);
      }
      @media (max-width: 640px) {
        .card { padding: 20px; }
        .actions { flex-direction: column; }
        .btn { width: 100%; }
      }
    </style>
  </head>
  <body data-server-now="${nowMs}" data-start-at="${startAtMs}" data-end-at="${endAtMs}" data-active="${active ? "1" : "0"}">
    <main class="card">
      <div class="brand">
        <img src="/asset/logo.png" alt="polyflux.xyz" />
        <span>polyflux<b>.xyz</b></span>
      </div>
      <div>
        <h1>${escapeHtml(titleText)}</h1>
        <p>${escapeHtml(subtitleText)}</p>
      </div>
      <div class="message">${escapeHtml(message)}</div>
      <div class="grid">
        <div class="meta">
          <span>Con lai</span>
          <strong id="maintenance-countdown">--</strong>
        </div>
        <div class="meta">
          <span>Mo lai luc</span>
          <strong id="maintenance-until">--</strong>
        </div>
      </div>
      ${sectionLabel ? `<div class="section">Khu vuc dang khoa: <strong>${escapeHtml(sectionLabel)}</strong></div>` : ""}
      <div class="actions">
        <button class="btn primary" id="maintenance-refresh" type="button">${escapeHtml(actionText)}</button>
      </div>
    </main>
    <script>
      (function () {
        const body = document.body;
        const active = body.dataset.active === "1";
        const serverNow = Number(body.dataset.serverNow || 0) || Date.now();
        const endAt = Number(body.dataset.endAt || 0) || 0;
        const startAt = Number(body.dataset.startAt || 0) || 0;
        const countdownEl = document.getElementById("maintenance-countdown");
        const untilEl = document.getElementById("maintenance-until");
        const refreshBtn = document.getElementById("maintenance-refresh");
        const skew = serverNow - Date.now();

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
            return new Intl.DateTimeFormat("vi-VN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(ms));
          } catch (err) {
            return new Date(ms).toLocaleString();
          }
        };

        const update = () => {
          if (!active || !endAt) {
            if (countdownEl) countdownEl.textContent = active ? "--" : "00:00";
            if (untilEl) untilEl.textContent = formatDate(endAt);
            return;
          }
          const remaining = endAt - (Date.now() + skew);
          if (countdownEl) countdownEl.textContent = formatDuration(remaining);
          if (untilEl) untilEl.textContent = formatDate(endAt);
          if (remaining <= 0) {
            window.location.href = "/";
          }
        };

        if (refreshBtn) {
          refreshBtn.addEventListener("click", () => {
            window.location.href = "/";
          });
        }

        if (untilEl && endAt) {
          untilEl.textContent = formatDate(endAt);
        }
        update();
        if (active && endAt) {
          setInterval(update, 1000);
        }
        if (!active && startAt && endAt && endAt <= serverNow) {
          setTimeout(() => {
            window.location.href = "/";
          }, 1200);
        }
      })();
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: active ? 503 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
