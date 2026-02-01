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

  const getSlug = () => {
    const params = new URLSearchParams(window.location.search);
    let slug = params.get("slug") || params.get("id");
    if (!slug) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[slug]") slug = last;
    }
    return slug ? String(slug).trim() : "";
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

  const buildPriceLabel = (min, max) => {
    const safeMin = Number(min || 0);
    const safeMax = max != null ? Number(max) : null;
    if (safeMax != null && safeMax > safeMin) {
      return `${formatCount(safeMin)} VND - ${formatCount(safeMax)} VND`;
    }
    return `${formatCount(safeMin)} VND`;
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
        const priceLabel = buildPriceLabel(item.priceMin, item.priceMax);
        const media = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
          : `<div class="product-fallback">${escapeHtml((item.title || "BK").slice(0, 2))}</div>`;
        return `
          <div class="product-card">
            <a class="product-card-link" href="/products/${encodeURIComponent(item.slug || item.id)}">
              <div class="product-media">${media}</div>
              <div class="product-body">
                <div class="product-price" ${priceAttrs}>${priceLabel}</div>
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
