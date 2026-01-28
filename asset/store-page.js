(function () {
  "use strict";

  const PAGE_SIZE = 12;
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

  const toSafeHtml = (value) => {
    if (!value) return "";
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  };

  const renderSellerBadge = (data) => {
    if (!data || !data.badge) return "";
    const raw = String(data.badge || "").trim().toUpperCase();
    if (!raw) return "";
    if (raw === "ADMIN") {
      return `<span class="seller-badge admin">${translate("seller.badge.admin", "Admin")}</span>`;
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
  const itemsGrid = document.getElementById("store-items-grid");
  const pagination = document.getElementById("store-items-pagination");

  const state = {
    shop: null,
    categories: null,
    page: 1,
    totalPages: 1,
  };

  const getStoreRef = () => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");
    if (!id) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[id]") id = last;
    }
    return id ? String(id).trim() : "";
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

  const renderShop = async (shop) => {
    const categories = await loadCategories();
    const type = resolveType(shop, categories);
    const typeLabel = type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m";
    const categoryLabel = formatCategoryLabel(type, shop.category, categories);
    const tagLabels = formatTagLabels(shop.category, shop.tags && shop.tags.length ? shop.tags : shop.subcategory ? [shop.subcategory] : [], categories, type);

    if (storeName) storeName.textContent = shop.name || "--";
    if (storeOwnerName) storeOwnerName.textContent = (shop.owner && (shop.owner.displayName || shop.owner.username)) || "--";
    if (storeOwnerBadge) storeOwnerBadge.innerHTML = renderSellerBadge(shop.owner || {});
    if (storeOwnerTitle) {
      const titleParts = [];
      if (shop.owner && shop.owner.title) titleParts.push(shop.owner.title);
      if (shop.owner && shop.owner.rank) titleParts.push(shop.owner.rank);
      storeOwnerTitle.textContent = titleParts.join(" \u2022 ");
      storeOwnerTitle.style.display = titleParts.length ? "inline-flex" : "none";
    }

    if (storeAvatar) {
      if (shop.avatarUrl) {
        storeAvatar.innerHTML = `<img src="${shop.avatarUrl}" alt="${escapeHtml(shop.name || "Shop")}" loading="lazy" />`;
      } else {
        const fallback = String(shop.subcategory || shop.category || "BK").slice(0, 2);
        storeAvatar.textContent = fallback;
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

    if (itemsTitle) itemsTitle.textContent = type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m";
    if (itemsSub) {
      itemsSub.textContent =
        type === "service"
          ? "Danh s\u00e1ch d\u1ecbch v\u1ee5 t\u1eeb gian h\u00e0ng."
          : "Danh s\u00e1ch s\u1ea3n ph\u1ea9m t\u1eeb gian h\u00e0ng.";
    }

    state.shop = { ...shop, storeType: type };
    try {
      window.BKStoreShop = state.shop;
      document.dispatchEvent(new CustomEvent("store:loaded", { detail: state.shop }));
    } catch (error) {}
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
    const ratingLabel = item.rating != null ? item.rating : "--";
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
            ${escapeHtml(item.title)}
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
                <span class="seller-value"><strong class="seller-name">${escapeHtml(seller.name || "Shop")}</strong>${sellerBadge}</span>
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
      itemsGrid.innerHTML = `
        <div class="card empty-state product-empty" style="grid-column: 1 / -1;">
          <strong>${translate("empty.noData", "Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u")}</strong>
          <div style="margin-top:4px;">${translate("empty.adjustCategory", "H\u00e3y th\u1eed thay \u0111\u1ed5i b\u1ed9 l\u1ecdc ho\u1eb7c t\u00ecm ki\u1ebfm.")}</div>
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
    const endpoint = state.shop.storeType === "service" ? "/api/services" : "/api/products";
    try {
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) {
        renderItems([], state.shop.storeType);
        return;
      }
      state.totalPages = data.totalPages || 1;
      renderItems(Array.isArray(data.items) ? data.items : [], state.shop.storeType);
    } catch (error) {
      renderItems([], state.shop.storeType);
    }
  };

  const init = async () => {
    const storeId = getStoreRef();
    if (!storeId) {
      if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
      return;
    }
    try {
      const response = await fetch(`/api/shops/${encodeURIComponent(storeId)}`);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false || !data.shop) {
        if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
        return;
      }
      await renderShop(data.shop);
      await loadItems();
    } catch (error) {
      if (storeName) storeName.textContent = translate("store.notFound", "Gian h\u00e0ng kh\u00f4ng t\u1ed3n t\u1ea1i");
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

  document.addEventListener("DOMContentLoaded", init);
})();
