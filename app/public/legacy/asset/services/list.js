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

  const root =
    typeof getProjectRoot === "function"
      ? getProjectRoot()
      : typeof getRootPath === "function"
        ? getRootPath()
        : "/";
  const isFile = window.location.protocol === "file:";
  const isLegacy = !isFile && String(root || "").includes("/legacy/");

  const buildShopUrl = (ref) => {
    const value = String(ref || "").trim();
    if (!value) return "";
    if (isFile) return `${root}seller/[id]/index.html?id=${encodeURIComponent(value)}`;
    if (isLegacy) return `${root}gian-hang/[slug]/?id=${encodeURIComponent(value)}`;
    return `${root}gian-hang/${encodeURIComponent(value)}`;
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
    const base = isFile || isLegacy ? "dichvu/[id]/" : "dichvu/";
    if (!serviceId) return root + base;
    if (isFile || isLegacy) return root + base + `?id=${encodeURIComponent(serviceId)}`;
    return root + base + encodeURIComponent(serviceId);
  };

  const buildCard = (item) => {
    const seller = item.seller || {};
    const sellerName = seller.displayName || seller.username || seller.name || "Shop";
    const sellerBadge = renderSellerBadge(seller);
    const ratingLabel = item.rating != null ? item.rating : "--";
    const subLabel = item.subcategory || categoryFallback[item.category] || "DV";
    const media = item.thumbnailUrl
      ? `<img src="${item.thumbnailUrl}" alt="${item.title}" loading="lazy" />`
      : `<div class="product-fallback">${String(subLabel || "DV").slice(0, 2)}</div>`;
    const priceLabel = formatPriceRange(item);
    const priceAttrs =
      item.priceMax != null && item.priceMax > item.price
        ? `data-base-min="${item.price}" data-base-max="${item.priceMax}" data-base-currency="VND"`
        : `data-base-amount="${item.price}" data-base-currency="VND"`;
    const detailUrl = getServiceDetailPath(item.id);
    const shopRef = seller.slug || item.shopId || "";
    const shopUrl = buildShopUrl(shopRef);
    return `
      <div class="product-card" role="link" tabindex="0" data-detail-url="${detailUrl}">
        <div class="product-media">${media}</div>
        <div class="product-body">
          <div class="product-price" ${priceAttrs}>${priceLabel}</div>
          <h3 class="product-title">${item.title}</h3>
          <div class="product-meta">
            <div class="meta-col">
              <span>${translate("label.rating", "Rating")}: <strong>${ratingLabel}</strong></span>
              <span>${translate("label.sold", "Requests")}: <strong>${item.requestCount ?? "--"}</strong></span>
            </div>
            <div class="meta-col meta-right">
              <span class="seller-line">
                <span class="seller-label">${translate("label.seller", "Seller")}:</span>
                <span class="seller-value"><strong class="seller-name">${sellerName}</strong>${sellerBadge}</span>
              </span>
              ${shopUrl ? `<button class="btn ghost shop-link" type="button" data-shop-url="${shopUrl}">${translate("label.shop", "Gian hàng")}</button>` : ""}
            </div>
          </div>
          ${subLabel ? `<div class="product-type">${translate("label.type", "Type")}: <strong>${subLabel}</strong></div>` : ""}
          <p class="product-desc">${item.descriptionShort || ""}</p>
        </div>
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
        </div>
      `;
      if (pagination) pagination.innerHTML = "";
      return;
    }
    grid.innerHTML = items.map(buildCard).join("");
    bindCardNavigation();
    if (window.BKCurrency && typeof window.BKCurrency.applyToDom === "function") {
      window.BKCurrency.applyToDom(grid);
    }
    renderPagination(state.totalPages);
  };

  const bindCardNavigation = () => {
    if (!grid || grid.dataset.bound === "1") return;
    grid.dataset.bound = "1";
    grid.addEventListener("click", (event) => {
      const shopBtn = event.target.closest(".shop-link");
      if (shopBtn && shopBtn.dataset.shopUrl) {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = shopBtn.dataset.shopUrl;
        return;
      }
      const card = event.target.closest(".product-card");
      if (card && card.dataset.detailUrl) {
        window.location.href = card.dataset.detailUrl;
      }
    });
    grid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const card = event.target.closest(".product-card");
      if (card && card.dataset.detailUrl) {
        window.location.href = card.dataset.detailUrl;
      }
    });
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
    renderSubcategories();
    initFilters();
    loadServices();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
