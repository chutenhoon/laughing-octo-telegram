(function () {
  "use strict";

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const formatCount = (value) => {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "0";
  };

  const INVALID_STORE_REFS = new Set(["gian-hang", "nguoi-ban", "seller", "shop", "[slug]", "[id]", "undefined", "null", "nan"]);

  const normalizeStoreRef = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lowered = raw.toLowerCase();
    if (INVALID_STORE_REFS.has(lowered)) return "";
    if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return "";
    return raw;
  };

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));

  const getSlug = () => {
    const params = new URLSearchParams(window.location.search);
    const direct = params.get("slug") || params.get("id") || params.get("shop") || "";
    const cleaned = normalizeStoreRef(direct);
    if (cleaned) return cleaned;
    const parts = window.location.pathname.split("/").filter(Boolean);
    let last = parts[parts.length - 1] || "";
    if (last === "index.html") last = parts[parts.length - 2] || "";
    return normalizeStoreRef(last);
  };

  const buildAuthHeaders = () => {
    if (!window.BKAuth || typeof window.BKAuth.read !== "function") return {};
    const auth = window.BKAuth.read();
    if (!auth || !auth.loggedIn) return {};
    const user = auth.user || {};
    const headers = { "content-type": "application/json" };
    if (user.id != null) headers["x-user-id"] = String(user.id);
    if (user.email) headers["x-user-email"] = String(user.email);
    if (user.username) headers["x-user-username"] = String(user.username);
    if (user.role) headers["x-user-role"] = String(user.role);
    return headers;
  };

  const buildPriceAttrs = (min, max) => {
    const safeMin = Number(min || 0);
    const safeMax = max != null ? Number(max) : null;
    if (safeMax != null && safeMax > safeMin) {
      return `data-base-min="${safeMin}" data-base-max="${safeMax}" data-base-currency="VND"`;
    }
    return `data-base-amount="${safeMin}" data-base-currency="VND"`;
  };

  const buildRedirectUrl = (ref) => {
    const cleaned = normalizeStoreRef(ref);
    if (!cleaned) return "";
    const params = new URLSearchParams(window.location.search);
    params.delete("slug");
    params.delete("shop");
    if (isUuid(cleaned)) {
      params.set("id", cleaned);
      const query = params.toString();
      return query ? `/gian-hang/?${query}` : "/gian-hang/";
    }
    params.delete("id");
    const query = params.toString();
    const base = `/gian-hang/${encodeURIComponent(cleaned)}`;
    return query ? `${base}?${query}` : base;
  };

  const renderProducts = (items) => {
    const grid = document.getElementById("shop-products");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<div class="card shop-empty">Chưa có sản phẩm trong gian hàng.</div>';
      return;
    }
    grid.innerHTML = items
      .map((item) => {
        const priceAttrs = buildPriceAttrs(item.priceMin, item.priceMax);
        const media = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
          : `<div class="product-fallback">${escapeHtml((item.title || "BK").slice(0, 2))}</div>`;
        return `
          <div class="product-card">
            <a class="product-card-link" href="/products/${encodeURIComponent(item.slug || item.id)}">
              <div class="product-media">${media}</div>
              <div class="product-body">
                <div class="product-price" ${priceAttrs}>${formatCount(item.priceMin)} VND</div>
                <h3 class="product-title">${escapeHtml(item.title)}${item.isHot ? ' <span class="product-tag">HOT</span>' : ""}</h3>
                <div class="product-meta">
                  <div class="meta-col">
                    <span>Kho: <strong>${formatCount(item.stock)}</strong></span>
                    <span>Đã bán: <strong>${formatCount(item.sold)}</strong></span>
                    <span>Đánh giá: <strong>${Number(item.rating || 0).toFixed(1)}</strong></span>
                  </div>
                </div>
                ${item.categoryLabel ? `<div class="product-type">Loại: <strong>${escapeHtml(item.categoryLabel)}</strong></div>` : ""}
              </div>
            </a>
          </div>
        `;
      })
      .join("");

    if (window.BKCurrency && typeof window.BKCurrency.applyToDom === "function") {
      window.BKCurrency.applyToDom(grid);
    }
  };

  const init = async () => {
    const slug = getSlug();
    const nameEl = document.getElementById("shop-name");
    const descEl = document.getElementById("shop-description");
    if (!slug) {
      if (nameEl) nameEl.textContent = "Gian hàng không tồn tại";
      if (descEl) descEl.textContent = "Đường dẫn gian hàng không hợp lệ.";
      return;
    }

    const redirectUrl = buildRedirectUrl(slug);
    if (redirectUrl) {
      window.location.replace(redirectUrl);
      return;
    }

    const headers = buildAuthHeaders();
    const response = await fetch(`/api/v2/shops/${encodeURIComponent(slug)}`, Object.keys(headers).length ? { headers } : undefined);
    const data = await response.json();
    if (!response.ok || !data || data.ok === false) {
      if (nameEl) nameEl.textContent = "Gian hàng không tồn tại";
      if (descEl) descEl.textContent = "Không tìm thấy gian hàng này.";
      return;
    }

    const shop = data.shop || {};
    if (nameEl) nameEl.textContent = shop.name || "--";
    if (descEl) descEl.textContent = shop.description || "";

    const meta = document.getElementById("shop-meta");
    if (meta) {
      meta.innerHTML = [
        `Đánh giá: <strong>${Number(shop.rating || 0).toFixed(1)}</strong>`,
        `Đơn hàng: <strong>${formatCount(shop.totalOrders)}</strong>`,
        `ID: <strong>${escapeHtml(shop.slug || shop.id || "")}</strong>`,
      ]
        .map((item) => `<span>${item}</span>`)
        .join("");
    }

    const owner = document.getElementById("shop-owner");
    if (owner) {
      const badge = shop.owner && shop.owner.role && String(shop.owner.role).toLowerCase() === "admin" ? '<span class="seller-badge admin">ADMIN</span>' : "";
      const name = shop.owner ? shop.owner.displayName || shop.owner.username || "" : "";
      owner.innerHTML = name ? `<span>Người bán: <strong>${escapeHtml(name)}</strong> ${badge}</span>` : "";
    }

    renderProducts(Array.isArray(data.products) ? data.products : []);
  };

  document.addEventListener("DOMContentLoaded", init);
})();
