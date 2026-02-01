(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const PAGE_WINDOW = 5;

  const state = {
    group: "email",
    search: "",
    sort: "popular",
    filters: new Set(),
    page: 1,
    totalPages: 1,
    groups: [],
    categories: [],
  };

  const elements = {
    groupTabs: document.getElementById("group-tabs"),
    categoryTitle: document.getElementById("category-title"),
    filterList: document.getElementById("filter-list"),
    searchInput: document.getElementById("filter-search"),
    applyBtn: document.getElementById("filter-apply"),
    filterPanel: document.getElementById("filter-panel"),
    filterToggle: document.getElementById("filter-toggle"),
    pagination: document.getElementById("product-pagination"),
    grid: document.getElementById("product-list"),
  };

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const getInitials = (value) => {
    const text = String(value || "").trim();
    if (!text) return "BK";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    return text.slice(0, 2).toUpperCase();
  };

  const buildSellerBadge = (seller) => {
    if (!seller) return "";
    const role = String(seller.role || "").trim().toLowerCase();
    if (role === "admin") return '<span class="seller-badge admin">ADMIN</span>';
    const badge = String(seller.badge || "").trim().toUpperCase();
    if (badge === "ADMIN") return '<span class="seller-badge admin">ADMIN</span>';
    return "";
  };

  const formatCount = (value) => {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "0";
  };

  const buildPriceAttrs = (min, max) => {
    const safeMin = Number(min || 0);
    const safeMax = max != null ? Number(max) : null;
    if (safeMax != null && safeMax > safeMin) {
      return `data-base-min="${safeMin}" data-base-max="${safeMax}" data-base-currency="VND"`;
    }
    return `data-base-amount="${safeMin}" data-base-currency="VND"`;
  };

  const renderSkeleton = () => {
    if (!elements.grid) return;
    const card = `
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
    elements.grid.innerHTML = Array.from({ length: 6 }, () => card).join("");
  };

  const renderPagination = () => {
    if (!elements.pagination) return;
    elements.pagination.innerHTML = "";
    if (state.totalPages <= 1) return;
    const fragment = document.createDocumentFragment();
    const windowStart = Math.max(1, Math.min(state.page - Math.floor(PAGE_WINDOW / 2), state.totalPages - PAGE_WINDOW + 1));
    const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, state.totalPages);
    for (let page = windowStart; page <= windowEnd; page += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = page === state.page ? "btn primary" : "btn ghost";
      btn.textContent = String(page);
      btn.dataset.page = String(page);
      fragment.appendChild(btn);
    }
    elements.pagination.appendChild(fragment);
  };

  const renderProducts = (items) => {
    if (!elements.grid) return;
    if (!items.length) {
      elements.grid.innerHTML = `
        <div class="card empty-state product-empty" style="grid-column: 1 / -1;">
          <strong>Chưa có sản phẩm phù hợp</strong>
          <div style="margin-top:4px;">Hãy thử đổi bộ lọc hoặc tìm kiếm khác.</div>
        </div>
      `;
      if (elements.pagination) elements.pagination.innerHTML = "";
      return;
    }

    elements.grid.innerHTML = items
      .map((item) => {
        const priceAttrs = buildPriceAttrs(item.priceMin, item.priceMax);
        const sellerName = item.shop && (item.shop.displayName || item.shop.name || item.shop.username)
          ? item.shop.displayName || item.shop.name || item.shop.username
          : "Seller";
        const badge = buildSellerBadge(item.shop);
        const media = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
          : `<div class="product-fallback">${getInitials(item.title)}</div>`;
        const hot = item.isHot ? '<span class="product-tag">HOT</span>' : "";
        const typeLabel = item.categoryLabel ? `<div class="product-type">Loại: <strong>${escapeHtml(item.categoryLabel)}</strong></div>` : "";
        const href = `/products/${encodeURIComponent(item.slug || item.id)}`;
        return `
          <div class="product-card">
            <a class="product-card-link" href="${href}">
              <div class="product-media">${media}</div>
              <div class="product-body">
                <div class="product-price" ${priceAttrs}>${formatCount(item.priceMin)} VND</div>
                <h3 class="product-title">${escapeHtml(item.title)} ${hot}</h3>
                <div class="product-meta">
                  <div class="meta-col">
                    <span>Kho: <strong>${formatCount(item.stock)}</strong></span>
                    <span>Đã bán: <strong>${formatCount(item.sold)}</strong></span>
                    <span>Đánh giá: <strong>${Number(item.rating || 0).toFixed(1)}</strong></span>
                  </div>
                  <div class="meta-col meta-right">
                    <span class="seller-line">
                      <span class="seller-label">Người bán:</span>
                      <span class="seller-value"><strong class="seller-name">${escapeHtml(sellerName)}</strong>${badge}</span>
                    </span>
                  </div>
                </div>
                ${typeLabel}
                ${item.descriptionShort ? `<p class="product-desc">${escapeHtml(item.descriptionShort)}</p>` : ""}
              </div>
            </a>
          </div>
        `;
      })
      .join("");

    if (window.BKCurrency && typeof window.BKCurrency.applyToDom === "function") {
      window.BKCurrency.applyToDom(elements.grid);
    }

    renderPagination();
  };

  const setGroup = (group) => {
    state.group = group || "email";
    state.filters = new Set();
    state.page = 1;
    if (elements.groupTabs) {
      elements.groupTabs.querySelectorAll(".category-pill").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.group === state.group);
      });
    }
    if (elements.categoryTitle) {
      const match = state.groups.find((g) => g.slug === state.group);
      elements.categoryTitle.textContent = match ? match.name : state.group.toUpperCase();
    }
    renderFilters();
    loadProducts();
  };

  const renderFilters = () => {
    if (!elements.filterList) return;
    const list = state.categories.filter((cat) => cat.groupSlug === state.group);
    if (!list.length) {
      elements.filterList.innerHTML = '<div class="empty-state">Chưa có danh mục</div>';
      return;
    }
    elements.filterList.innerHTML = list
      .map((cat) => {
        const checked = state.filters.has(cat.slug) ? "checked" : "";
        return `
          <label class="filter-item">
            <input type="checkbox" value="${escapeHtml(cat.slug)}" ${checked} />
            <span>${escapeHtml(cat.label)}</span>
            <em>(${formatCount(cat.count)})</em>
          </label>
        `;
      })
      .join("");
  };

  const setFilterOpen = (open) => {
    if (!elements.filterPanel || !elements.filterToggle) return;
    elements.filterPanel.classList.toggle("open", open);
    elements.filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/v2/categories");
      const data = await res.json();
      if (!res.ok || !data || data.ok === false) return;
      state.groups = Array.isArray(data.groups)
        ? data.groups.map((g) => ({
            name: g.name,
            slug: String(g.slug || "").toLowerCase(),
            count: g.count || 0,
          }))
        : [];
      state.categories = Array.isArray(data.categories)
        ? data.categories.map((c) => ({
            slug: String(c.slug || "").toLowerCase(),
            label: c.label || c.slug,
            count: c.count || 0,
            group: c.group || "Other",
            groupSlug: String(c.group || "").toLowerCase(),
          }))
        : [];

      if (state.groups.length && elements.groupTabs) {
        elements.groupTabs.innerHTML = state.groups
          .map((group, idx) => {
            const active = idx === 0 ? "active" : "";
            return `<button class="category-pill ${active}" data-group="${escapeHtml(group.slug)}" type="button">${escapeHtml(group.name)}</button>`;
          })
          .join("");
        state.group = state.groups[0].slug || state.group;
      }
    } catch (error) {
      // ignore
    }
    renderFilters();
  };

  const loadProducts = async () => {
    renderSkeleton();
    const params = new URLSearchParams();
    params.set("category", state.group);
    if (state.filters.size) params.set("filters", Array.from(state.filters).join(","));
    if (state.search) params.set("q", state.search);
    params.set("sort", state.sort);
    params.set("page", String(state.page));
    params.set("limit", String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/v2/products?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data || data.ok === false) {
        renderProducts([]);
        return;
      }
      state.totalPages = data.totalPages || 1;
      renderProducts(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      renderProducts([]);
    }
  };

  const bindEvents = () => {
    if (elements.groupTabs) {
      elements.groupTabs.addEventListener("click", (event) => {
        const btn = event.target.closest("button");
        if (!btn || !btn.dataset.group) return;
        if (btn.dataset.group === state.group) return;
        setGroup(btn.dataset.group);
      });
    }

    document.querySelectorAll(".sort-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (!key || key === state.sort) return;
        state.sort = key;
        state.page = 1;
        document.querySelectorAll(".sort-pill").forEach((el) => el.classList.toggle("active", el === btn));
        loadProducts();
      });
    });

    if (elements.filterList) {
      elements.filterList.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.tagName !== "INPUT") return;
        const value = String(target.value || "").toLowerCase();
        if (!value) return;
        if (target.checked) state.filters.add(value);
        else state.filters.delete(value);
      });
    }

    if (elements.applyBtn) {
      elements.applyBtn.addEventListener("click", () => {
        state.page = 1;
        loadProducts();
        setFilterOpen(false);
      });
    }

    if (elements.searchInput) {
      let timer = null;
      elements.searchInput.addEventListener("input", () => {
        state.search = elements.searchInput.value.trim();
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          state.page = 1;
          loadProducts();
        }, 300);
      });
    }

    if (elements.filterPanel && elements.filterToggle) {
      const filterCard = elements.filterPanel.querySelector(".filter-card");
      elements.filterToggle.addEventListener("click", () => {
        setFilterOpen(!elements.filterPanel.classList.contains("open"));
      });
      elements.filterPanel.addEventListener("click", (event) => {
        if (event.target === elements.filterPanel) setFilterOpen(false);
      });
      if (filterCard) {
        filterCard.addEventListener("click", (event) => event.stopPropagation());
      }
    }

    if (elements.pagination) {
      elements.pagination.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || !button.dataset.page) return;
        const next = Number(button.dataset.page);
        if (!Number.isFinite(next) || next === state.page) return;
        state.page = next;
        loadProducts();
      });
    }
  };

  const init = async () => {
    if (!elements.grid) return;
    await loadCategories();
    renderFilters();
    bindEvents();
    loadProducts();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
