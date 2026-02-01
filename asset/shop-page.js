(function () {
  "use strict";

  const PAGE_SIZE = 12;
  const PAGE_WINDOW = 5;
  const ADMIN_CRED_KEY = "bk_admin_creds";

  const getLanguage = () => (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi");
  const translate = (key, fallback, vars) =>
    typeof formatI18n === "function" ? formatI18n(getLanguage(), key, fallback, vars) : fallback || key;

  const normalizeLabel = (value) => String(value || "").trim().toLowerCase();

  const resolveBadgeValue = (data) => {
    if (!data) return "";
    const badge = String(data.badge || "").trim();
    if (badge) return badge;
    const role = String(data.role || "").trim().toLowerCase();
    if (role === "admin") return "ADMIN";
    if (role === "coadmin") return "COADMIN";
    return "";
  };

  const resolveBadgeLabel = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return "";
    const normalized = value.toUpperCase();
    if (normalized === "ADMIN") return translate("seller.badge.admin", "Admin");
    if (normalized === "COADMIN") return "Coadmin";
    if (normalized === "VERIFIED") return translate("seller.badge.verified", "Verified");
    if (normalized.startsWith("MERCHANT-")) {
      const tier = normalized.replace("MERCHANT-", "");
      return translate("seller.badge.merchant", undefined, { tier });
    }
    return value;
  };

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

  const toSafeHtml = (value) => {
    if (!value) return "";
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  };

  const renderSellerBadge = (data) => {
    const badgeValue = resolveBadgeValue(data);
    if (!badgeValue) return "";
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

  const categoryFallbackProduct = {
    email: "EM",
    tool: "PM",
    account: "TK",
    other: "KH",
  };

  const categoryFallbackService = {
    interaction: "TT",
    software: "PM",
    blockchain: "BC",
    other: "KH",
  };

  const storeHero = document.getElementById("store-hero");
  const storeAvatar = document.getElementById("store-avatar");
  const storeName = document.getElementById("store-name");
  const storeOwnerName = document.getElementById("store-owner-name");
  const storeOwnerBadge = document.getElementById("store-owner-badge");
  const storeOwnerTitle = document.getElementById("store-owner-title");
  const storeMetaLine = document.getElementById("store-meta-line");
  const storeShortDesc = document.getElementById("store-short-desc");
  const storeLongDesc = document.getElementById("store-long-desc");
  const itemsTitle = document.getElementById("store-items-title");
  const itemsSub = document.getElementById("store-items-sub");
  const itemsTabs = document.getElementById("store-items-tabs");
  const itemTabButtons = itemsTabs ? Array.from(itemsTabs.querySelectorAll("button[data-type]")) : [];
  const itemsGrid = document.getElementById("store-items-grid");
  const pagination = document.getElementById("store-items-pagination");
  const filterList = document.getElementById("store-filter-list");
  const filterSearch = document.getElementById("store-filter-search");
  const filterApply = document.getElementById("store-filter-apply");
  const filterPanel = document.getElementById("store-filter-panel");
  const filterToggle = document.getElementById("store-filter-toggle");
  const sortTabs = document.getElementById("store-sort-tabs");
  const storeSection = document.querySelector(".store-page");
  const storeState = document.getElementById("store-state");

  const state = {
    shop: null,
    categories: null,
    page: 1,
    totalPages: 1,
    preview: false,
    activeType: "product",
    counts: { product: 0, service: 0 },
    filterCounts: { product: {}, service: {} },
    sort: "popular",
    search: "",
    subcategories: new Set(),
  };

  const getPathRef = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (!parts.length) return "";
    let last = parts[parts.length - 1];
    if (last === "index.html") last = parts[parts.length - 2] || "";
    if (!last) return "";
    const invalid = new Set(["gian-hang", "nguoi-ban", "seller", "shop", "[slug]", "[id]"]);
    if (invalid.has(last)) return "";
    return String(last).trim();
  };

  const getStoreRef = () => {
    const params = new URLSearchParams(window.location.search);
    const direct = params.get("id") || params.get("shop") || "";
    const cleaned = String(direct || "").trim();
    if (cleaned) return cleaned;
    return getPathRef();
  };

  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ""));

  const maybeRedirectToSlug = (shop) => {
    if (!shop || !shop.slug) return;
    const currentRef = getPathRef();
    if (!currentRef || currentRef === shop.slug) return;
    if (!isUuid(currentRef)) return;
    const next = `/gian-hang/${encodeURIComponent(shop.slug)}${window.location.search || ""}`;
    window.location.replace(next);
  };

  const isPreviewMode = () => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("preview");
    return preview === "1" || preview === "true";
  };

  const getAdminHeaders = () => {
    try {
      const raw = sessionStorage.getItem(ADMIN_CRED_KEY) || localStorage.getItem(ADMIN_CRED_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.authKey || !parsed.panelKey) return null;
      return { "x-admin-user": parsed.authKey, "x-admin-pass": parsed.panelKey };
    } catch (error) {
      return null;
    }
  };

  const getUserHeaders = () => {
    if (!window.BKAuth || typeof window.BKAuth.read !== "function") return null;
    const auth = window.BKAuth.read();
    if (!auth || !auth.loggedIn) return null;
    const user = auth.user || {};
    const headers = {};
    if (user.id != null) headers["x-user-id"] = String(user.id);
    if (user.email) headers["x-user-email"] = String(user.email);
    if (user.username) headers["x-user-username"] = String(user.username);
    return Object.keys(headers).length ? headers : null;
  };

  const mergeHeaders = (...sources) => {
    const merged = {};
    sources.forEach((source) => {
      if (!source) return;
      Object.entries(source).forEach(([key, value]) => {
        if (value != null && value !== "") merged[key] = value;
      });
    });
    return Object.keys(merged).length ? merged : null;
  };

  const buildFetchOptions = () => {
    const headers = mergeHeaders(getUserHeaders(), state.preview ? getAdminHeaders() : null);
    return headers ? { headers } : undefined;
  };

  const loadCategories = async () => {
    if (state.categories) return state.categories;
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
      state.categories = data.categories || { products: [], services: [] };
    } catch (error) {
      state.categories = { products: [], services: [] };
    }
    return state.categories;
  };

  const resolveType = (shop, categories) => {
    if (shop.storeType) return shop.storeType;
    const categoryId = shop.category || "";
    const inProducts = (categories.products || []).some((item) => String(item.id) === String(categoryId));
    if (inProducts) return "product";
    const inServices = (categories.services || []).some((item) => String(item.id) === String(categoryId));
    if (inServices) return "service";
    return "product";
  };

  const formatCategoryLabel = (type, categoryId, categories) => {
    const list = type === "service" ? categories.services || [] : categories.products || [];
    const category = list.find((item) => String(item.id) === String(categoryId)) || null;
    if (!category) return categoryId || "";
    return category.labelKey ? translate(category.labelKey, category.label || category.id) : category.label || category.id;
  };

  const formatTagLabels = (categoryId, tags, categories, type) => {
    const list = type === "service" ? categories.services || [] : categories.products || [];
    const category = list.find((item) => String(item.id) === String(categoryId)) || null;
    const options = category && Array.isArray(category.subcategories) ? category.subcategories : [];
    const labels = [];
    (tags || []).forEach((tagId) => {
      const match = options.find((item) => String(item.id) === String(tagId));
      if (match) {
        labels.push(match.labelKey ? translate(match.labelKey, match.label || match.id) : match.label || match.id);
      } else if (tagId) {
        labels.push(tagId);
      }
    });
    return labels;
  };

  const getInitials = (value) => {
    const text = String(value || "").trim();
    if (!text) return "BK";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const getCoverImage = (shop) => {
    const list = Array.isArray(shop && shop.images) ? shop.images : [];
    const sorted = list
      .map((item) => ({ url: item.url, position: Number(item.position || 0) }))
      .filter((item) => item.url)
      .sort((a, b) => a.position - b.position);
    return sorted.length ? sorted[0].url : "";
  };

  const applyCover = (coverUrl) => {
    if (!storeHero) return;
    if (coverUrl) {
      const safeUrl = String(coverUrl).replace(/"/g, "%22").replace(/'/g, "%27");
      storeHero.style.setProperty("--store-cover-image", `url(\"${safeUrl}\")`);
      storeHero.classList.add("has-cover");
    } else {
      storeHero.style.removeProperty("--store-cover-image");
      storeHero.classList.remove("has-cover");
    }
  };

  const setHeroLoading = (active) => {
    if (!storeHero) return;
    storeHero.classList.toggle("is-loading", Boolean(active));
    const targets = [storeName, storeOwnerName, storeOwnerTitle, storeMetaLine, storeShortDesc];
    targets.forEach((el) => {
      if (!el) return;
      el.classList.toggle("skeleton", Boolean(active));
      if (active) el.textContent = "";
    });
    if (storeAvatar) {
      storeAvatar.classList.toggle("skeleton", Boolean(active));
      if (active) storeAvatar.innerHTML = "";
    }
    if (storeOwnerBadge) {
      storeOwnerBadge.classList.toggle("is-hidden", Boolean(active));
    }
  };

  const setStoreState = (status, message) => {
    if (storeSection) {
      storeSection.classList.toggle("is-not-found", status === "not-found");
    }
    if (!storeState) return;
    if (status === "not-found") {
      storeState.classList.remove("is-hidden");
      const title = message || translate("store.notFound", "Gian hàng không tồn tại");
      storeState.innerHTML = `<strong>${escapeHtml(title)}</strong>`;
      return;
    }
    storeState.classList.add("is-hidden");
    storeState.innerHTML = "";
  };

  const renderShop = async (shop) => {
    const categories = await loadCategories();
    const type = resolveType(shop, categories);
    const typeLabel = type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m";
    const categoryLabel = formatCategoryLabel(type, shop.category, categories);
    const tagLabels = formatTagLabels(shop.category, shop.tags && shop.tags.length ? shop.tags : shop.subcategory ? [shop.subcategory] : [], categories, type);
    const owner = shop.owner || {};
    const badgeValue = resolveBadgeValue(owner);
    const badgeLabel = resolveBadgeLabel(badgeValue);
    const normalizedBadge = normalizeLabel(badgeLabel);

    applyCover(getCoverImage(shop));

    if (storeName) storeName.textContent = shop.name || "--";
    if (storeOwnerName) storeOwnerName.textContent = (owner && (owner.displayName || owner.username)) || "--";
    if (storeOwnerBadge) {
      const badgeHtml = renderSellerBadge(owner);
      storeOwnerBadge.innerHTML = badgeHtml;
      storeOwnerBadge.style.display = badgeHtml ? "inline-flex" : "none";
    }
    if (storeOwnerTitle) {
      const titleParts = [];
      [owner.title, owner.rank].forEach((value) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return;
        const normalized = normalizeLabel(cleaned);
        if (normalizedBadge && normalized === normalizedBadge) return;
        if (titleParts.some((item) => normalizeLabel(item) === normalized)) return;
        titleParts.push(cleaned);
      });
      if (titleParts.length) {
        storeOwnerTitle.textContent = titleParts.join(" \u2022 ");
        storeOwnerTitle.style.display = "inline-flex";
      } else {
        storeOwnerTitle.textContent = "";
        storeOwnerTitle.style.display = "none";
      }
    }

    if (storeAvatar) {
      if (shop.avatarUrl) {
        storeAvatar.innerHTML = `<img src="${shop.avatarUrl}" alt="${escapeHtml(shop.name || "Shop")}" loading="lazy" />`;
      } else {
        const fallback = getInitials(shop.name || (owner && owner.displayName) || "BK");
        storeAvatar.innerHTML = `<span class="store-avatar-fallback">${escapeHtml(fallback)}</span>`;
      }
    }

    if (storeMetaLine) {
      const stats = [
        `${translate("label.rating", "\u0110\u00e1nh gi\u00e1")}: <strong>${shop.rating != null ? shop.rating : "--"}</strong>`,
        `${translate("label.orders", "\u0110\u01a1n h\u00e0ng")}: <strong>${Number(shop.totalOrders || 0).toLocaleString("vi-VN")}</strong>`,
        `${translate("label.stock", "Kho")}: <strong>${Number(shop.stockCount || 0).toLocaleString("vi-VN")}</strong>`,
      ];
      const metaParts = [`<span>${typeLabel} \u2022 ${escapeHtml(categoryLabel || "")}</span>`];
      if (tagLabels.length) metaParts.push(`<span>${escapeHtml(tagLabels.join(", "))}</span>`);
      metaParts.push(`<span>${stats.join(" \u2022 ")}</span>`);
      storeMetaLine.innerHTML = metaParts.join(" ");
    }

    if (storeShortDesc) storeShortDesc.textContent = shop.descriptionShort || "";
    if (storeLongDesc) storeLongDesc.innerHTML = toSafeHtml(shop.descriptionLong || "");

    state.shop = { ...shop, storeType: type };
    try {
      window.BKStoreShop = state.shop;
      document.dispatchEvent(new CustomEvent("store:loaded", { detail: state.shop }));
    } catch (error) {}
    setHeroLoading(false);
  };

  const updateItemsHeading = () => {
    if (!itemsTitle || !itemsSub) return;
    const categories = state.categories || { products: [], services: [] };
    const type = state.activeType === "service" ? "service" : "product";
    let label = "";
    if (state.shop && state.shop.category) {
      label = formatCategoryLabel(type, state.shop.category, categories);
    }
    if (!label) {
      label = type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m";
    }
    itemsTitle.textContent = label;
    itemsSub.textContent =
      type === "service"
        ? "S\u1eafp x\u1ebfp theo nhu c\u1ea7u v\u00e0 ch\u1ecdn nhanh d\u1ecbch v\u1ee5 ph\u00f9 h\u1ee3p."
        : "S\u1eafp x\u1ebfp theo nhu c\u1ea7u v\u00e0 ch\u1ecdn nhanh s\u1ea3n ph\u1ea9m ph\u00f9 h\u1ee3p.";
  };

  const updateTabs = () => {
    if (!itemsTabs) return;
    const hasProduct = Number(state.counts.product || 0) > 0;
    const hasService = Number(state.counts.service || 0) > 0;
    const showTabs = hasProduct && hasService;
    itemsTabs.style.display = showTabs ? "flex" : "none";
    itemTabButtons.forEach((btn) => {
      const type = btn.getAttribute("data-type");
      btn.classList.toggle("active", type === state.activeType);
      btn.disabled = !showTabs;
    });
  };

  const updateSortTabs = () => {
    if (!sortTabs) return;
    sortTabs.querySelectorAll("button[data-sort]").forEach((btn) => {
      const key = btn.getAttribute("data-sort");
      btn.classList.toggle("active", key === state.sort);
    });
  };

  const setFilterOpen = (open) => {
    if (!filterPanel || !filterToggle) return;
    filterPanel.classList.toggle("open", open);
    filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const buildFilterHint = () => {
    const parts = [];
    if (state.search) {
      parts.push(`${translate("label.search", "T\u1eeb kh\u00f3a")}: &quot;${escapeHtml(state.search)}&quot;`);
    }
    if (state.subcategories.size) {
      const tags = Array.from(state.subcategories).join(", ");
      parts.push(`${translate("label.filters", "B\u1ed9 l\u1ecdc")}: ${escapeHtml(tags)}`);
    }
    return parts.length ? `<div class="empty-state-meta">${parts.join(" \u2022 ")}</div>` : "";
  };

  const renderFilters = async () => {
    if (!filterList) return;
    const categories = await loadCategories();
    const type = state.activeType === "service" ? "service" : "product";
    const list = type === "service" ? categories.services || [] : categories.products || [];
    const shopCategory = state.shop && state.shop.category ? String(state.shop.category) : "";
    let category = list.find((item) => String(item.id) === shopCategory);
    if (!category) {
      category = list.find((item) => Array.isArray(item.subcategories) && item.subcategories.length) || list[0];
    }
    const options = category && Array.isArray(category.subcategories) ? category.subcategories : [];
    const counts = (state.filterCounts && state.filterCounts[type]) || {};
    const usedIds = new Set();
    const rows = [];

    options.forEach((option) => {
      const id = String(option.id || "").trim();
      if (!id) return;
      usedIds.add(id);
      const label = option.labelKey ? translate(option.labelKey, option.label || id) : option.label || id;
      const count = Number(counts[id] || 0);
      const checked = state.subcategories.has(id) ? "checked" : "";
      rows.push(`
        <label class="filter-item">
          <input type="checkbox" value="${escapeHtml(id)}" ${checked} />
          <span>${escapeHtml(label)}</span>
          <em>(${count})</em>
        </label>
      `);
    });

    Object.keys(counts)
      .filter((key) => key && !usedIds.has(String(key)))
      .sort()
      .forEach((key) => {
        const label = String(key);
        const count = Number(counts[key] || 0);
        const checked = state.subcategories.has(key) ? "checked" : "";
        rows.push(`
          <label class="filter-item">
            <input type="checkbox" value="${escapeHtml(key)}" ${checked} />
            <span>${escapeHtml(label)}</span>
            <em>(${count})</em>
          </label>
        `);
      });

    if (!rows.length) {
      filterList.innerHTML = `<div class="empty-state">${translate("empty.noData", "Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u")}</div>`;
      return;
    }
    filterList.innerHTML = rows.join("");
  };

  const resetFilters = () => {
    state.subcategories = new Set();
    state.search = "";
    if (filterSearch) filterSearch.value = "";
    if (filterList) {
      filterList.querySelectorAll("input[type=checkbox]").forEach((input) => {
        input.checked = false;
      });
    }
  };

  const applyCounts = (counts) => {
    if (!counts || typeof counts !== "object") return false;
    const product = counts.product || {};
    const service = counts.service || {};
    state.counts = { product: Number(product.total || 0), service: Number(service.total || 0) };
    state.filterCounts = { product: product.filters || {}, service: service.filters || {} };
    if (state.counts.product && state.counts.service) {
      if (state.activeType !== "product" && state.activeType !== "service") {
        state.activeType = state.shop && state.shop.storeType === "service" ? "service" : "product";
      }
    } else if (state.counts.service) {
      state.activeType = "service";
    } else {
      state.activeType = "product";
    }
    updateTabs();
    updateItemsHeading();
    renderFilters();
    return true;
  };

  const renderSkeleton = () => {
    if (!itemsGrid) return;
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
    itemsGrid.innerHTML = Array.from({ length: 6 }, () => skeleton).join("");
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

  const buildCard = (item, type) => {
    const seller = item.seller || {};
    const sellerBadge = renderSellerBadge(seller);
    const sellerName = String(seller.displayName || seller.username || seller.name || "").trim() || "Seller";
    const ratingLabel = item.rating != null ? item.rating : "--";
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const isHot = tags.some((tag) => normalizeLabel(tag) === "hot");
    const fallbackMap = type === "service" ? categoryFallbackService : categoryFallbackProduct;
    const subLabel = item.subcategory || fallbackMap[item.category] || (type === "service" ? "DV" : "BK");
    const media = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<div class="product-fallback">${String(subLabel || "BK").slice(0, 2)}</div>`;
    const priceLabel = formatPriceRange(item);
    const priceAttrs =
      item.priceMax != null && item.priceMax > item.price
        ? `data-base-min="${item.price}" data-base-max="${item.priceMax}" data-base-currency="VND"`
        : `data-base-amount="${item.price}" data-base-currency="VND"`;
    const detailUrl =
      type === "service"
        ? `/dichvu/[id]/?id=${encodeURIComponent(item.id)}`
        : `/sanpham/[id]/?id=${encodeURIComponent(item.id)}`;
    return `
      <a class="product-card" href="${detailUrl}">
        <div class="product-media">${media}</div>
        <div class="product-body">
          <div class="product-price" ${priceAttrs}>${priceLabel}</div>
          <h3 class="product-title">
            ${escapeHtml(item.title)}${isHot ? ` <span class="product-tag">HOT</span>` : ""}
          </h3>
          <div class="product-meta">
            <div class="meta-col">
              <span>${translate("label.stock", "Kho")}: <strong>${item.stockCount ?? "--"}</strong></span>
              <span>${translate("label.sold", "\u0110\u00e3 b\u00e1n")}: <strong>${item.soldCount ?? "--"}</strong></span>
              <span>${translate("label.rating", "\u0110\u00e1nh gi\u00e1")}: <strong>${ratingLabel}</strong></span>
            </div>
            <div class="meta-col meta-right">
              <span class="seller-line">
                <span class="seller-label">${translate("label.seller", "Seller")}:</span>
                <span class="seller-value"><strong class="seller-name">${escapeHtml(sellerName)}</strong>${sellerBadge}</span>
              </span>
            </div>
          </div>
          ${subLabel ? `<div class="product-type">${translate("label.type", "Lo\u1ea1i")}: <strong>${escapeHtml(subLabel)}</strong></div>` : ""}
          <p class="product-desc">${escapeHtml(item.descriptionShort || "")}</p>
        </div>
      </a>
    `;
  };

  const renderItems = (items, type) => {
    if (!itemsGrid) return;
    if (!items.length) {
      const isFiltered = Boolean(state.search) || state.subcategories.size > 0;
      const totalAvailable = Number(state.counts[state.activeType] || 0);
      const emptyTitle =
        !isFiltered && totalAvailable === 0
          ? translate("store.empty.noProducts", "Gian h\u00e0ng ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m.")
          : translate("empty.noData", "Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u");
      const emptyHint =
        !isFiltered && totalAvailable === 0
          ? translate("store.empty.comeback", "H\u00e3y quay l\u1ea1i sau \u0111\u1ec3 xem c\u00e1c m\u1eb7t h\u00e0ng m\u1edbi.")
          : translate("empty.adjustCategory", "H\u00e3y th\u1eed thay \u0111\u1ed5i b\u1ed9 l\u1ecdc ho\u1eb7c t\u00ecm ki\u1ebfm.");
      itemsGrid.innerHTML = `
        <div class="card empty-state product-empty" style="grid-column: 1 / -1;">
          <strong>${emptyTitle}</strong>
          <div style="margin-top:4px;">${emptyHint}</div>
          ${isFiltered ? buildFilterHint() : ""}
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }
    itemsGrid.innerHTML = items.map((item) => buildCard(item, type)).join("");
    if (window.BKCurrency && typeof window.BKCurrency.applyToDom === "function") {
      window.BKCurrency.applyToDom(itemsGrid);
    }
    renderPagination(state.totalPages);
  };

  const loadItems = async () => {
    if (!state.shop) return;
    renderSkeleton();
    const params = new URLSearchParams();
    params.set("shopId", state.shop.id);
    params.set("page", String(state.page));
    params.set("perPage", String(PAGE_SIZE));
    params.set("sort", state.sort || "popular");
    if (state.search) params.set("search", state.search);
    if (state.subcategories.size) {
      params.set("subcategory", Array.from(state.subcategories).join(","));
    }
    if (state.preview) params.set("preview", "1");
    const endpoint = state.activeType === "service" ? "/api/services" : "/api/products";
    try {
      const fetchOptions = buildFetchOptions();
      const response = await fetch(`${endpoint}?${params.toString()}`, fetchOptions);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) {
        renderItems([], state.activeType);
        return;
      }
      state.totalPages = data.totalPages || 1;
      renderItems(Array.isArray(data.items) ? data.items : [], state.activeType);
    } catch (error) {
      renderItems([], state.activeType);
    }
  };

  const loadCounts = async () => {
    if (!state.shop) return;
    const fetchOptions = buildFetchOptions();
    const query = new URLSearchParams();
    query.set("shopId", state.shop.id);
    query.set("page", "1");
    query.set("perPage", "1");
    query.set("sort", "custom");
    if (state.preview) query.set("preview", "1");
    const productRequest = fetch(`/api/products?${query.toString()}`, fetchOptions)
      .then((res) => res.json().then((data) => (res.ok && data && data.ok !== false ? data.total || 0 : 0)))
      .catch(() => 0);
    const serviceRequest = fetch(`/api/services?${query.toString()}`, fetchOptions)
      .then((res) => res.json().then((data) => (res.ok && data && data.ok !== false ? data.total || 0 : 0)))
      .catch(() => 0);
    const [productCount, serviceCount] = await Promise.all([productRequest, serviceRequest]);
    state.counts = { product: Number(productCount || 0), service: Number(serviceCount || 0) };
    if (state.counts.product && state.counts.service) {
      if (state.activeType !== "product" && state.activeType !== "service") {
        state.activeType = state.shop && state.shop.storeType === "service" ? "service" : "product";
      }
    } else if (state.counts.service) {
      state.activeType = "service";
    } else {
      state.activeType = "product";
    }
    updateTabs();
    updateItemsHeading();
    renderFilters();
  };

  const init = async () => {
    const storeId = getStoreRef();
    if (!storeId) {
      if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
      setHeroLoading(false);
      setStoreState("not-found");
      return;
    }
    try {
      setHeroLoading(true);
      setStoreState("loading");
      state.preview = isPreviewMode();
      const fetchOptions = buildFetchOptions();
      const response = await fetch(`/api/shops/${encodeURIComponent(storeId)}`, fetchOptions);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false || !data.shop) {
        if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
        setHeroLoading(false);
        setStoreState("not-found");
        return;
      }
      state.shop = data.shop;
      maybeRedirectToSlug(data.shop);
      await renderShop(data.shop);
      const applied = applyCounts(data.counts);
      if (!applied) {
        await loadCounts();
      }
      updateSortTabs();
      await loadItems();
      setStoreState("ready");
    } catch (error) {
      if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
      setHeroLoading(false);
      setStoreState("not-found");
    }
  };

  if (pagination) {
    pagination.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !button.dataset.page) return;
      const next = Number(button.dataset.page);
      if (!Number.isFinite(next) || next === state.page) return;
      state.page = next;
      loadItems();
    });
  }

  if (sortTabs) {
    sortTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-sort]");
      if (!button) return;
      const nextSort = button.getAttribute("data-sort");
      if (!nextSort || nextSort === state.sort) return;
      state.sort = nextSort;
      state.page = 1;
      updateSortTabs();
      loadItems();
    });
  }

  if (filterList) {
    filterList.addEventListener("change", (event) => {
      const target = event.target;
      if (!target || target.tagName !== "INPUT") return;
      const value = target.value;
      if (target.checked) state.subcategories.add(value);
      else state.subcategories.delete(value);
    });
  }

  if (filterApply) {
    filterApply.addEventListener("click", () => {
      state.search = filterSearch ? filterSearch.value.trim() : "";
      state.page = 1;
      loadItems();
      setFilterOpen(false);
    });
  }

  if (filterSearch) {
    filterSearch.addEventListener("input", () => {
      state.search = filterSearch.value.trim();
    });
    filterSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      state.search = filterSearch.value.trim();
      state.page = 1;
      loadItems();
      setFilterOpen(false);
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

  if (itemsTabs) {
    itemsTabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-type]");
      if (!button) return;
      const nextType = button.getAttribute("data-type");
      if (!nextType || nextType === state.activeType) return;
      state.activeType = nextType;
      state.page = 1;
      updateTabs();
      updateItemsHeading();
      resetFilters();
      renderFilters();
      loadItems();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
