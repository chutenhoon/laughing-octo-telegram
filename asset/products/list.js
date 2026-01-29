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

  const renderSellerBadge = (seller) => {
    if (!seller || !seller.badge) return "";
    const raw = String(seller.badge || "").trim().toUpperCase();
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

  const categoryKeys = {
    email: "product.category.email",
    tool: "product.category.tool",
    account: "product.category.account",
    other: "product.category.other",
  };

  const categoryFallback = {
    email: "EM",
    tool: "PM",
    account: "TK",
    other: "KH",
  };

  const filterOptions = {
    email: [
      { value: "Gmail", label: "Gmail", match: ["Gmail", "Gmail EDU"] },
      { value: "HotMail", label: "HotMail" },
      { value: "OutlookMail", label: "OutlookMail" },
      { value: "RuMail", label: "RuMail" },
      { value: "DomainEmail", labelKey: "product.subcategory.domainEmail", label: "Domain Email" },
      { value: "YahooMail", label: "YahooMail" },
      { value: "ProtonMail", label: "ProtonMail" },
      { value: "EmailKhac", labelKey: "product.subcategory.otherEmail", label: "Other email", match: ["Khac"] },
    ],
    tool: [
      { value: "ToolFacebook", labelKey: "product.subcategory.toolFacebook", label: "Facebook tool" },
      { value: "ToolGoogle", labelKey: "product.subcategory.toolGoogle", label: "Google tool" },
      { value: "ToolYouTube", labelKey: "product.subcategory.toolYouTube", label: "YouTube tool" },
      { value: "ToolCrypto", labelKey: "product.subcategory.toolCrypto", label: "Crypto tool" },
      { value: "ToolPTC", labelKey: "product.subcategory.toolPTC", label: "PTC tool" },
      { value: "ToolCaptcha", labelKey: "product.subcategory.toolCaptcha", label: "Captcha tool" },
      { value: "ToolOffer", labelKey: "product.subcategory.toolOffer", label: "Offer tool" },
      { value: "ToolPTU", labelKey: "product.subcategory.toolPTU", label: "PTU tool" },
      { value: "ToolKhac", labelKey: "product.subcategory.toolOther", label: "Other tools", match: ["Checker"] },
    ],
    account: [
      { value: "AccFacebook", labelKey: "product.subcategory.accFacebook", label: "Facebook account" },
      { value: "AccBM", labelKey: "product.subcategory.accBM", label: "Business Manager" },
      { value: "AccZalo", labelKey: "product.subcategory.accZalo", label: "Zalo account" },
      { value: "AccTwitter", labelKey: "product.subcategory.accTwitter", label: "Twitter account" },
      { value: "AccTelegram", labelKey: "product.subcategory.accTelegram", label: "Telegram account" },
      { value: "AccInstagram", labelKey: "product.subcategory.accInstagram", label: "Instagram account" },
      { value: "AccShopee", labelKey: "product.subcategory.accShopee", label: "Shopee account" },
      { value: "AccDiscord", labelKey: "product.subcategory.accDiscord", label: "Discord account" },
      { value: "AccTikTok", labelKey: "product.subcategory.accTikTok", label: "TikTok account" },
      { value: "KeyAntivirus", labelKey: "product.subcategory.keyAntivirus", label: "Antivirus key" },
      { value: "AccCapCut", labelKey: "product.subcategory.accCapCut", label: "CapCut account" },
      { value: "KeyWindows", labelKey: "product.subcategory.keyWindows", label: "Windows key" },
      { value: "AccKhac", labelKey: "product.subcategory.accOther", label: "Other accounts", match: ["US Account"] },
    ],
    other: [
      { value: "GiftCard", labelKey: "product.subcategory.giftCard", label: "Gift card" },
      { value: "VPS", labelKey: "product.subcategory.vps", label: "VPS" },
      { value: "Khac", labelKey: "product.subcategory.other", label: "Other" },
    ],
  };

  const filterMatchers = new Map();
  Object.keys(filterOptions).forEach((key) => {
    filterOptions[key].forEach((option) => {
      filterMatchers.set(option.value, option.match || [option.value]);
    });
  });

  const state = {
    category: "email",
    sort: "popular",
    search: "",
    subcategories: new Set(),
    page: 1,
    totalPages: 1,
  };

  const categoryTitle = document.getElementById("category-title");
  const filterList = document.getElementById("filter-list");
  const searchInput = document.getElementById("filter-search");
  const applyBtn = document.getElementById("filter-apply");
  const filterPanel = document.getElementById("filter-panel");
  const filterToggle = document.getElementById("filter-toggle");
  const pagination = document.getElementById("product-pagination");
  const grid = document.getElementById("product-list");

  const setFilterOpen = (open) => {
    if (!filterPanel || !filterToggle) return;
    filterPanel.classList.toggle("open", open);
    filterToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const renderSubcategories = () => {
    if (!filterList) return;
    const options = filterOptions[state.category] || [];
    if (!options.length) {
      filterList.innerHTML = `<div class="empty-state">${translate("product.empty.noneInCategory", "No subcategories")}</div>`;
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

  const buildCard = (item) => {
    const seller = item.seller || {};
    const sellerBadge = renderSellerBadge(seller);
    const ratingLabel = item.rating != null ? item.rating : "--";
    const subLabel = item.subcategory || categoryFallback[item.category] || "BK";
    const media = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="${item.title}" loading="lazy" />`
      : `<div class="product-fallback">${String(subLabel || "BK").slice(0, 2)}</div>`;
    const priceLabel = formatPriceRange(item);
    const priceAttrs =
      item.priceMax != null && item.priceMax > item.price
        ? `data-base-min="${item.price}" data-base-max="${item.priceMax}" data-base-currency="VND"`
        : `data-base-amount="${item.price}" data-base-currency="VND"`;
    const detailUrl = typeof getProductDetailPath === "function" ? getProductDetailPath(item.id) : `/sanpham/[id]/?id=${encodeURIComponent(item.id)}`;
    return `
      <a class="product-card" href="${detailUrl}">
        <div class="product-media">${media}</div>
        <div class="product-body">
          <div class="product-price" ${priceAttrs}>${priceLabel}</div>
          <h3 class="product-title">
            ${item.title}
          </h3>
          <div class="product-meta">
            <div class="meta-col">
              <span>${translate("label.stock", "Stock")}: <strong>${item.stockCount ?? "--"}</strong></span>
              <span>${translate("label.sold", "Sold")}: <strong>${item.soldCount ?? "--"}</strong></span>
              <span>${translate("label.rating", "Rating")}: <strong>${ratingLabel}</strong></span>
            </div>
            <div class="meta-col meta-right">
              <span class="seller-line">
                <span class="seller-label">${translate("label.seller", "Seller")}:</span>
                <span class="seller-value"><strong class="seller-name">${seller.name || "Shop"}</strong>${sellerBadge}</span>
              </span>
            </div>
          </div>
          ${subLabel ? `<div class="product-type">${translate("label.type", "Type")}: <strong>${subLabel}</strong></div>` : ""}
          <p class="product-desc">${item.descriptionShort || ""}</p>
        </div>
      </a>
    `;
  };

  const renderProducts = (items) => {
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `
        <div class="card empty-state product-empty" style="grid-column: 1 / -1;">
          <strong>${translate("empty.noData", "No data")}</strong>
          <div style="margin-top:4px;">${translate("empty.adjustCategory", "Adjust filters and try again.")}</div>
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

  const loadProducts = async () => {
    renderSkeleton();
    const params = new URLSearchParams();
    if (state.category) params.set("category", state.category);
    if (state.subcategories.size) params.set("subcategory", Array.from(state.subcategories).join(","));
    if (state.search) params.set("search", state.search);
    params.set("sort", state.sort);
    params.set("page", String(state.page));
    params.set("perPage", String(PAGE_SIZE));
    try {
      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) {
        renderProducts([]);
        return;
      }
      state.totalPages = data.totalPages || 1;
      renderProducts(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      renderProducts([]);
    }
  };

  const setCategory = (key) => {
    state.category = key;
    state.subcategories = new Set();
    state.page = 1;
    if (categoryTitle) {
      const labelKey = categoryKeys[key];
      categoryTitle.textContent = labelKey ? translate(labelKey, "Product") : "Product";
      if (labelKey) categoryTitle.dataset.i18nKey = labelKey;
    }
    document.querySelectorAll(".category-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === key);
    });
    renderSubcategories();
    loadProducts();
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
        loadProducts();
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
        loadProducts();
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
          loadProducts();
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
        loadProducts();
      });
    }
  };

  const init = () => {
    if (!grid) return;
    renderSubcategories();
    initFilters();
    loadProducts();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
