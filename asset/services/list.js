(function () {
  "use strict";

  const PAGE_SIZE = 10;
  const PAGE_WINDOW = 5;

  const getLanguage = () => (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi");
  const translate = (key, fallback, vars) =>
    typeof formatI18n === "function" ? formatI18n(getLanguage(), key, fallback, vars) : fallback || key;

  const formatVnd = (value) => {
    if (typeof formatPrice === "function") return formatPrice(value);
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
  };

  const formatPriceRange = (item) => {
    const price = Number(item.price || 0);
    const priceMax = item.priceMax != null ? Number(item.priceMax || 0) : null;
    if (priceMax && priceMax > price) {
      return `${formatVnd(price)} - ${formatVnd(priceMax)}`;
    }
    return formatVnd(price);
  };

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const resolveShopRef = (item) => {
    if (!item) return "";
    if (item.shopSlug != null && item.shopSlug !== "") return String(item.shopSlug).trim();
    const seller = item.seller || {};
    if (seller.slug != null && seller.slug !== "") return String(seller.slug).trim();
    if (item.shopId != null && item.shopId !== "") return String(item.shopId).trim();
    if (seller.storeId != null && seller.storeId !== "") return String(seller.storeId).trim();
    if (seller.id != null && seller.id !== "") return String(seller.id).trim();
    return "";
  };

  const buildShopUrl = (shopRef) => {
    if (!shopRef) return "";
    if (window.BKRoutes && typeof window.BKRoutes.getShopDetailPath === "function") {
      return window.BKRoutes.getShopDetailPath(shopRef);
    }
    return `/shops/${encodeURIComponent(shopRef)}`;
  };

  const resolveThumbnailUrl = (item) => {
    if (!item) return "";
    if (item.thumbnailUrl) return item.thumbnailUrl;
    const mediaId = item.thumbnailId || item.thumbnail_id || item.thumbnail_media_id;
    if (!mediaId) return "";
    return `/api/media?id=${encodeURIComponent(mediaId)}`;
  };

  const isPreviewMode = () => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview");
    return preview === "1" || preview === "true";
  };

  const renderSellerBadge = (seller) => {
    if (!seller) return "";
    let badgeValue = String(seller.badge || "").trim();
    if (!badgeValue) {
      const role = String(seller.role || "").trim().toLowerCase();
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

  const categoryKeys = {
    interaction: "service.category.interaction",
    software: "service.category.software",
    blockchain: "service.category.blockchain",
    other: "service.category.other",
  };

  const categoryFallback = {
    interaction: "TT",
    software: "PM",
    blockchain: "BC",
    other: "KH",
  };

  const filterOptions = {
    interaction: [
      { value: "Facebook", labelKey: "service.filter.facebook", label: "Facebook", match: ["facebook"] },
      { value: "TikTok", labelKey: "service.filter.tiktok", label: "TikTok", match: ["tiktok"] },
      { value: "Google", labelKey: "service.filter.google", label: "Google", match: ["google"] },
      { value: "Telegram", labelKey: "service.filter.telegram", label: "Telegram", match: ["telegram"] },
      { value: "Shopee", labelKey: "service.filter.shopee", label: "Shopee", match: ["shopee"] },
      { value: "Discord", labelKey: "service.filter.discord", label: "Discord", match: ["discord"] },
      { value: "Twitter", labelKey: "service.filter.twitter", label: "Twitter", match: ["twitter"] },
      { value: "YouTube", labelKey: "service.filter.youtube", label: "YouTube", match: ["youtube"] },
      { value: "Zalo", labelKey: "service.filter.zalo", label: "Zalo", match: ["zalo"] },
      { value: "Instagram", labelKey: "service.filter.instagram", label: "Instagram", match: ["instagram"] },
      { value: "OtherInteraction", labelKey: "service.filter.otherInteraction", label: "Other", match: ["engagement", "tuong tac"] },
    ],
    software: [
      { value: "CodingTool", labelKey: "service.filter.codingTool", label: "Coding tool", match: ["tool", "cong cu", "software"] },
      { value: "Design", labelKey: "service.filter.design", label: "Design", match: ["design", "do hoa"] },
      { value: "Video", labelKey: "service.filter.video", label: "Video", match: ["video"] },
      { value: "OtherTool", labelKey: "service.filter.otherTool", label: "Other tool", match: ["khac", "other", "checker"] },
    ],
    blockchain: [],
    other: [],
  };

  const state = {
    category: "interaction",
    sort: "popular",
    search: "",
    subcategories: new Set(),
    page: 1,
    totalPages: 1,
    preview: false,
  };

  const categoryTitle = document.getElementById("category-title");
  const filterList = document.getElementById("filter-list");
  const searchInput = document.getElementById("filter-search");
  const applyBtn = document.getElementById("filter-apply");
  const filterPanel = document.getElementById("filter-panel");
  const filterToggle = document.getElementById("filter-toggle");
  const pagination = document.getElementById("service-pagination");
  const grid = document.getElementById("service-list");

  const setFilterOpen = (open) => {
    if (!filterPanel || !filterToggle) return;
    filterPanel.classList.toggle("open", open);
    filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const renderSubcategories = () => {
    if (!filterList) return;
    const options = filterOptions[state.category] || [];
    if (!options.length) {
      filterList.innerHTML = `<div class="empty-state">${translate("service.empty.noneInCategory", "No filters")}</div>`;
      return;
    }
    filterList.innerHTML = options
      .map((option) => {
        const checked = state.subcategories.has(option.value) ? "checked" : "";
        const label = option.labelKey ? translate(option.labelKey, option.label) : option.label;
        return `
          <label class="filter-item">
            <input type="checkbox" value="${option.value}" ${checked} />
            <span>${label}</span>
          </label>
        `;
      })
      .join("");
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

  const buildPreviewBadges = (item) => {
    if (!state.preview) return "";
    const badges = [];
    if (item && item.isPublished === false) {
      badges.push({ label: translate("label.unpublished", "Ch\u01b0a publish"), className: "warn" });
    }
    if (item && item.isActive === false) {
      badges.push({ label: translate("label.inactive", "\u0110ang \u1ea9n"), className: "bad" });
    }
    if (!badges.length) return "";
    return badges.map((badge) => `<span class="status-badge ${badge.className}">${badge.label}</span>`).join("");
  };

  const buildEmptyHint = () => {
    const parts = [];
    if (state.search) parts.push(`${translate("label.search", "T\u1eeb kh\u00f3a")}: &quot;${escapeHtml(state.search)}&quot;`);
    if (state.subcategories.size) {
      const tags = Array.from(state.subcategories).join(", ");
      parts.push(`${translate("label.filters", "B\u1ed9 l\u1ecdc")}: ${escapeHtml(tags)}`);
    }
    if (state.category) {
      const labelKey = categoryKeys[state.category];
      const label = labelKey ? translate(labelKey, state.category) : state.category;
      parts.push(`${translate("label.category", "Danh m\u1ee5c")}: ${escapeHtml(label)}`);
    }
    return parts.length ? `<div class="empty-state-meta">${parts.join(" \u2022 ")}</div>` : "";
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

  const getServiceDetailPath = (serviceId) => {
    const root = getProjectRoot();
    const isFile = window.location.protocol === "file:";
    const base = isFile ? "dichvu/[id]/index.html" : "dichvu/[id]/";
    const suffix = serviceId ? `?id=${encodeURIComponent(serviceId)}` : "";
    return root + base + suffix;
  };

  const buildCard = (item) => {
    const seller = item.seller || {};
    const sellerBadge = renderSellerBadge(seller);
    const ratingLabel = item.rating != null ? item.rating : "--";
    const subLabel = item.subcategory || categoryFallback[item.category] || "DV";
    const safeTitle = escapeHtml(item.title || "");
    const safeDesc = escapeHtml(item.descriptionShort || "");
    const thumbUrl = resolveThumbnailUrl(item);
    const media = thumbUrl
      ? `<img src="${thumbUrl}" alt="${safeTitle}" loading="lazy" />`
      : `<div class="product-fallback">${String(subLabel || "DV").slice(0, 2)}</div>`;
    const priceLabel = formatPriceRange(item);
    const priceAttrs =
      item.priceMax != null && item.priceMax > item.price
        ? `data-base-min="${item.price}" data-base-max="${item.priceMax}" data-base-currency="VND"`
        : `data-base-amount="${item.price}" data-base-currency="VND"`;
    const shopRef = resolveShopRef(item);
    const shopUrl = buildShopUrl(shopRef);
    const previewBadges = buildPreviewBadges(item);
    const actions = [];
    if (previewBadges) actions.push(`<div class="card-badges">${previewBadges}</div>`);
    if (shopUrl) actions.push(`<a class="shop-link" href="${shopUrl}">Gian h\u00e0ng</a>`);
    return `
      <div class="product-card">
        <a class="product-card-link" href="${getServiceDetailPath(item.id)}">
          <div class="product-media">${media}</div>
          <div class="product-body">
            <div class="product-price" ${priceAttrs}>${priceLabel}</div>
            <h3 class="product-title">${safeTitle}</h3>
            <div class="product-meta">
              <div class="meta-col">
                <span>${translate("label.rating", "Rating")}: <strong>${ratingLabel}</strong></span>
                <span>${translate("label.sold", "Requests")}: <strong>${item.requestCount ?? "--"}</strong></span>
              </div>
              <div class="meta-col meta-right">
                <span class="seller-line">
                  <span class="seller-label">${translate("label.seller", "Seller")}:</span>
                  <span class="seller-value"><strong class="seller-name">${escapeHtml(seller.name || "Shop")}</strong>${sellerBadge}</span>
                </span>
              </div>
            </div>
            ${subLabel ? `<div class="product-type">${translate("label.type", "Type")}: <strong>${subLabel}</strong></div>` : ""}
            <p class="product-desc">${safeDesc}</p>
          </div>
        </a>
        ${actions.length ? `<div class="product-card-actions">${actions.join("")}</div>` : ""}
      </div>
    `;
  };

  const renderServices = (items) => {
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `
        <div class="card empty-state product-empty" style="grid-column: 1 / -1;">
          <strong>${translate("empty.noData", "No data")}</strong>
          <div style="margin-top:4px;">${translate("empty.adjustCategory", "Adjust filters and try again.")}</div>
          ${buildEmptyHint()}
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }
    grid.innerHTML = items.map(buildCard).join("");
    if (window.BKCurrency && typeof window.BKCurrency.applyToDom === "function") {
      window.BKCurrency.applyToDom(grid);
    }
    renderPagination(state.totalPages);
  };

  const loadServices = async () => {
    renderSkeleton();
    const params = new URLSearchParams();
    if (state.category) params.set("category", state.category);
    if (state.subcategories.size) params.set("subcategory", Array.from(state.subcategories).join(","));
    if (state.search) params.set("search", state.search);
    params.set("sort", state.sort);
    params.set("page", String(state.page));
    params.set("perPage", String(PAGE_SIZE));
    if (state.preview) params.set("preview", "1");
    try {
      const response = await fetch(`/api/services?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) {
        renderServices([]);
        return;
      }
      state.totalPages = data.totalPages || 1;
      renderServices(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      renderServices([]);
    }
  };

  const setCategory = (key) => {
    state.category = key;
    state.subcategories = new Set();
    state.page = 1;
    if (categoryTitle) {
      const labelKey = categoryKeys[key];
      categoryTitle.textContent = labelKey ? translate(labelKey, "Service") : "Service";
      if (labelKey) categoryTitle.dataset.i18nKey = labelKey;
    }
    document.querySelectorAll(".category-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === key);
    });
    renderSubcategories();
    loadServices();
  };

  const initFilters = () => {
    document.querySelectorAll(".category-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.category;
        if (!key || key === state.category) return;
        setCategory(key);
      });
    });

    document.querySelectorAll(".sort-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (!key || key === state.sort) return;
        state.sort = key;
        state.page = 1;
        document.querySelectorAll(".sort-pill").forEach((el) => el.classList.toggle("active", el === btn));
        loadServices();
      });
    });

    if (filterList) {
      filterList.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.tagName !== "INPUT") return;
        const value = target.value;
        if (target.checked) state.subcategories.add(value);
        else state.subcategories.delete(value);
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        state.page = 1;
        loadServices();
        setFilterOpen(false);
      });
    }

    if (searchInput) {
      let timer = null;
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value.trim();
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          state.page = 1;
          loadServices();
        }, 300);
      });
    }

    if (filterPanel && filterToggle) {
      const filterCard = filterPanel.querySelector(".filter-card");
      filterToggle.addEventListener("click", () => {
        setFilterOpen(!filterPanel.classList.contains("open"));
      });
      filterPanel.addEventListener("click", (event) => {
        if (event.target === filterPanel) setFilterOpen(false);
      });
      if (filterCard) {
        filterCard.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      }
    }

    if (pagination) {
      pagination.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || !button.dataset.page) return;
        const next = Number(button.dataset.page);
        if (!Number.isFinite(next) || next === state.page) return;
        state.page = next;
        loadServices();
      });
    }
  };

  const init = () => {
    if (!grid) return;
    state.preview = isPreviewMode();
    renderSubcategories();
    initFilters();
    loadServices();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
