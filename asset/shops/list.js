(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const PAGE_WINDOW = 5;

  const getLanguage = () => (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi");
  const translate = (key, fallback, vars) =>
    typeof formatI18n === "function" ? formatI18n(getLanguage(), key, fallback, vars) : fallback || key;

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const getInitials = (value) => {
    const text = String(value || "").trim();
    if (!text) return "BK";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const renderSellerBadge = (owner) => {
    if (!owner) return "";
    let badgeValue = String(owner.badge || "").trim();
    if (!badgeValue) {
      const role = String(owner.role || "").trim().toLowerCase();
      if (role === "admin") badgeValue = "ADMIN";
      if (role === "coadmin") badgeValue = "COADMIN";
    }
    const raw = String(badgeValue || "").trim().toUpperCase();
    if (!raw) return "";
    if (raw === "ADMIN") {
      return `<span class="seller-badge admin">${translate("seller.badge.admin", "Admin")}</span>`;
    }
    if (raw === "COADMIN") {
      return `<span class="seller-badge coadmin">Coadmin</span>`;
    }
    if (raw === "VERIFIED") {
      return `<span class="seller-badge verified">${translate("seller.badge.verified", "Verified")}</span>`;
    }
    if (raw.startsWith("MERCHANT-")) {
      const tier = raw.replace("MERCHANT-", "");
      const tierClass = tier.toLowerCase();
      const label = translate("seller.badge.merchant", undefined, { tier });
      return `<span class="seller-badge merchant merchant-${tierClass}">${label}</span>`;
    }
    return "";
  };

  const state = {
    category: "",
    search: "",
    sort: "popular",
    page: 1,
    totalPages: 1,
  };
  const SORT_OPTIONS = new Set(["popular", "rating", "newest"]);
  const CATEGORY_OPTIONS = new Set(["", "email", "tool", "account", "other"]);

  const categoryKeys = {
    email: "product.category.email",
    tool: "product.category.tool",
    account: "product.category.account",
    other: "product.category.other",
  };

  const grid = document.getElementById("shop-list");
  const pagination = document.getElementById("shop-pagination");
  const searchInput = document.getElementById("shop-search");
  const categoryTabs = document.getElementById("shop-category-tabs");
  const pageTitle = document.getElementById("shop-page-title");
  const pageSubtitle = document.getElementById("shop-page-subtitle");

  let activeController = null;

  const applyStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const category = String(params.get("category") || "").trim().toLowerCase();
    state.category = CATEGORY_OPTIONS.has(category) ? category : "";
    state.search = String(params.get("search") || params.get("q") || "").trim();
    const sort = String(params.get("sort") || "").trim();
    state.sort = SORT_OPTIONS.has(sort) ? sort : "popular";
    const pageValue = Number(params.get("page") || 1);
    state.page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  };

  const syncUrl = () => {
    const params = new URLSearchParams(window.location.search);
    if (state.category) params.set("category", state.category);
    else params.delete("category");
    if (state.search) params.set("search", state.search);
    else params.delete("search");
    if (state.sort) params.set("sort", state.sort);
    if (state.page > 1) params.set("page", String(state.page));
    else params.delete("page");
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  };

  const applyHeading = () => {
    if (!pageTitle) return;
    if (!state.category) {
      pageTitle.textContent = translate("shops.title", "Gian hang");
      if (pageTitle.dataset) pageTitle.dataset.i18nKey = "shops.title";
    } else {
      const key = categoryKeys[state.category];
      pageTitle.textContent = key ? translate(key, state.category) : state.category;
      if (pageTitle.dataset) pageTitle.dataset.i18nKey = key || "";
    }
    if (pageSubtitle) {
      pageSubtitle.textContent = translate("shops.subtitle", "Tim kiem gian hang phu hop voi nhu cau cua ban.");
      if (pageSubtitle.dataset) pageSubtitle.dataset.i18nKey = "shops.subtitle";
    }
  };

  const renderSkeleton = () => {
    if (!grid) return;
    const skeleton = `
      <div class="product-card is-skeleton">
        <div class="product-media"></div>
        <div class="product-body">
          <div class="product-price"></div>
          <div class="product-title"></div>
          <div class="product-meta">
            <div class="meta-col">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <div class="product-desc"></div>
        </div>
      </div>
    `;
    grid.innerHTML = Array.from({ length: 6 }, () => skeleton).join("");
  };

  const renderPagination = (total) => {
    if (!pagination) return;
    pagination.innerHTML = "";
    if (total <= 1) return;
    const fragment = document.createDocumentFragment();
    const windowStart = Math.max(1, Math.min(state.page - Math.floor(PAGE_WINDOW / 2), total - PAGE_WINDOW + 1));
    const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, total);
    for (let page = windowStart; page <= windowEnd; page += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = page === state.page ? "btn primary" : "btn ghost";
      btn.textContent = String(page);
      btn.dataset.page = String(page);
      fragment.appendChild(btn);
    }
    pagination.appendChild(fragment);
  };

  const buildCard = (shop) => {
    const owner = shop.owner || {};
    const badge = renderSellerBadge(owner);
    const initials = getInitials(shop.name || owner.displayName || owner.username || "BK");
    const avatar = shop.avatarUrl
      ? `<img src="${shop.avatarUrl}" alt="${escapeHtml(shop.name || "Shop")}" loading="lazy" />`
      : `<span class="shop-avatar-fallback">${escapeHtml(initials)}</span>`;
    const detailUrl =
      window.BKRoutes && typeof window.BKRoutes.getShopDetailPath === "function"
        ? window.BKRoutes.getShopDetailPath(shop)
        : `/sanpham/${encodeURIComponent(shop.slug || shop.id || "")}/`;
    const metaParts = [];
    if (shop.category) metaParts.push(escapeHtml(shop.category));
    if (Array.isArray(shop.tags) && shop.tags.length) metaParts.push(escapeHtml(shop.tags.join(", ")));
    const stats = [
      `${translate("label.rating", "Đánh giá")}: <strong>${shop.rating != null ? shop.rating : "--"}</strong>`,
      `${translate("label.orders", "Đơn hàng")}: <strong>${Number(shop.totalOrders || 0).toLocaleString("vi-VN")}</strong>`,
      `${translate("label.stock", "Kho")}: <strong>${Number(shop.stockCount || 0).toLocaleString("vi-VN")}</strong>`,
    ];
    return `
      <a class="card seller-shop-card" href="${detailUrl}">
        <div class="seller-shop-media">${avatar}</div>
        <div>
          <h3>${escapeHtml(shop.name || "--")}${badge}</h3>
          <p class="hero-sub">${escapeHtml(shop.descriptionShort || "")}</p>
        </div>
        <div class="seller-meta">
          ${metaParts.length ? `<div class="form-hint">${metaParts.join(" • ")}</div>` : ""}
          <div class="form-hint">${stats.join(" • ")}</div>
        </div>
      </a>
    `;
  };

  const renderShops = (items) => {
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `
        <div class="card empty-state" style="grid-column: 1 / -1;">
          <strong>${translate("empty.noData", "Không có dữ liệu")}</strong>
          <div style="margin-top:4px;">${translate("empty.adjustFilters", "Hãy thử điều chỉnh tìm kiếm.")}</div>
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }
    grid.innerHTML = items.map(buildCard).join("");
    renderPagination(state.totalPages);
  };

  const loadShops = async () => {
    renderSkeleton();
    if (activeController) activeController.abort();
    activeController = new AbortController();
    syncUrl();
    const params = new URLSearchParams();
    if (state.category) params.set("category", state.category);
    if (state.search) params.set("search", state.search);
    if (state.sort) params.set("sort", state.sort);
    params.set("page", String(state.page));
    params.set("perPage", String(PAGE_SIZE));
    try {
      const response = await fetch(`/api/shops?${params.toString()}`, { signal: activeController.signal });
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) {
        renderShops([]);
        return;
      }
      state.totalPages = data.totalPages || 1;
      if (state.page > state.totalPages) {
        state.page = state.totalPages;
        syncUrl();
      }
      renderShops(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      if (error && error.name === "AbortError") return;
      renderShops([]);
    }
  };

  const init = () => {
    if (!grid) return;
    applyStateFromUrl();
    if (searchInput) searchInput.value = state.search || "";
    applyHeading();
    document.querySelectorAll(".sort-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.sort === state.sort);
    });
    if (categoryTabs) {
      categoryTabs.querySelectorAll(".category-pill").forEach((btn) => {
        const key = String(btn.dataset.category || "").trim().toLowerCase();
        btn.classList.toggle("active", key === state.category);
      });
      categoryTabs.addEventListener("click", (event) => {
        const btn = event.target.closest("button.category-pill[data-category]");
        if (!btn) return;
        const next = String(btn.dataset.category || "").trim().toLowerCase();
        const normalized = CATEGORY_OPTIONS.has(next) ? next : "";
        if (normalized === state.category) return;
        state.category = normalized;
        state.page = 1;
        categoryTabs.querySelectorAll(".category-pill").forEach((el) => el.classList.toggle("active", el === btn));
        applyHeading();
        loadShops();
      });
    }
    if (searchInput) {
      let timer = null;
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value.trim();
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          state.page = 1;
          loadShops();
        }, 300);
      });
    }
    document.querySelectorAll(".sort-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (!key || key === state.sort) return;
        state.sort = key;
        state.page = 1;
        document.querySelectorAll(".sort-pill").forEach((el) => el.classList.toggle("active", el === btn));
        loadShops();
      });
    });
    if (pagination) {
      pagination.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || !button.dataset.page) return;
        const next = Number(button.dataset.page);
        if (!Number.isFinite(next) || next === state.page) return;
        state.page = next;
        loadShops();
      });
    }
    window.addEventListener("popstate", () => {
      applyStateFromUrl();
      if (searchInput) searchInput.value = state.search || "";
      applyHeading();
      document.querySelectorAll(".sort-pill").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.sort === state.sort);
      });
      if (categoryTabs) {
        categoryTabs.querySelectorAll(".category-pill").forEach((btn) => {
          const key = String(btn.dataset.category || "").trim().toLowerCase();
          btn.classList.toggle("active", key === state.category);
        });
      }
      loadShops();
    });
    loadShops();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
