(function () {
  "use strict";

  const PAGE_SIZE = 40;

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

  const renderSellerBadge = (data) => {
    if (!data) return "";
    let badgeValue = String(data.badge || "").trim();
    if (!badgeValue) {
      const role = String(data.role || "").trim().toLowerCase();
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

  const normalizeLabel = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const getInitials = (value) => {
    const text = String(value || "").trim();
    if (!text) return "BK";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const formatShortId = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    if (raw.length <= 12) return raw;
    return `${raw.slice(0, 6)}...${raw.slice(-4)}`;
  };

  const looksLikeIdSuffix = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^\d+$/.test(raw)) return true;
    return /^[0-9a-f]{8,}$/i.test(raw);
  };

  const formatShopId = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "--";
    const parts = raw.split("-").filter(Boolean);
    if (parts.length >= 2) {
      const suffix = parts[parts.length - 1];
      if (looksLikeIdSuffix(suffix)) return formatShortId(suffix);
    }
    return formatShortId(raw);
  };

  const renderShopMedia = (shop) => {
    const detailImage = document.getElementById("detail-image");
    if (!detailImage) return;
    const images = shop && Array.isArray(shop.images) ? shop.images : [];
    const heroUrl = (images.length && images[0] && images[0].url) || (shop && shop.avatarUrl) || "";
    const name = (shop && shop.name) || "Shop";
    detailImage.innerHTML = heroUrl
      ? `<img src="${heroUrl}" alt="${escapeHtml(name)}" loading="lazy" />`
      : `<div class="product-fallback">${escapeHtml(getInitials(name))}</div>`;
    detailImage.dataset.shopMedia = "1";
  };

  const resolveFallbackThumbnail = (item) => {
    if (!item) return "";
    const title = normalizeLabel(item.title || item.name || "");
    const sub = normalizeLabel(item.subcategory || "");
    const cat = normalizeLabel(item.category || "");
    const text = `${title} ${sub} ${cat}`.trim();
    if (!text) return "";
    if (text.includes("edu")) return "/picture/mailedu.png";
    if (text.includes("random")) return "/picture/gmailrandomnam.png";
    if (text.includes("usa")) return "/picture/GMAILUSA.png";
    if (text.includes("regio") || text.includes("region")) return "/picture/Gmailregiosnew.png";
    if (cat === "email" || text.includes("gmail") || text.includes("mail")) return "/picture/mail-1.webp";
    return "";
  };

  const resolveThumbnailUrl = (item) => {
    if (!item) return "";
    if (item.thumbnailUrl) return item.thumbnailUrl;
    const mediaId = item.thumbnailId || item.thumbnail_id || item.thumbnail_media_id;
    if (!mediaId) return resolveFallbackThumbnail(item);
    return `/api/media?id=${encodeURIComponent(mediaId)}`;
  };

  const getBaseSegment = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] || "sanpham";
  };

  const getShopRef = () => {
    const params = new URLSearchParams(window.location.search);
    const queryRef = params.get("shop") || params.get("id") || params.get("slug");
    if (queryRef) return String(queryRef).trim();
    const parts = window.location.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last || last === "[slug]" || last === "[id]") return "";
    return String(last).trim();
  };

  const getProductRefFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("p") || params.get("product");
    return ref ? String(ref).trim() : "";
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "--" : value;
  };

  const setHTML = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value == null ? "--" : value;
  };

  const bindTabs = () => {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const panels = Array.from(document.querySelectorAll(".tab-panel"));
    if (!tabs.length || !panels.length) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.getAttribute("data-tab");
        tabs.forEach((t) => t.classList.toggle("active", t === tab));
        panels.forEach((panel) => panel.classList.toggle("active", panel.getAttribute("data-tab") === key));
      });
    });
  };

  const openModal = () => {
    const modal = document.getElementById("order-modal");
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    const modal = document.getElementById("order-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
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
    return headers;
  };

  const API_CACHE_MAX = 35;
  const apiCache = new Map();
  const apiCacheOrder = [];
  const apiInFlight = new Map();

  const rememberApiPayload = (key, payload) => {
    if (!key || !payload) return;
    const normalizedKey = String(key).trim();
    if (!normalizedKey) return;
    if (!apiCache.has(normalizedKey)) {
      apiCacheOrder.push(normalizedKey);
    }
    apiCache.set(normalizedKey, payload);
    while (apiCacheOrder.length > API_CACHE_MAX) {
      const evict = apiCacheOrder.shift();
      if (evict) apiCache.delete(evict);
    }
  };

  const rememberProductPayload = (ref, payload) => {
    if (!payload) return;
    rememberApiPayload(ref, payload);
    const product = payload.product || null;
    if (!product) return;
    if (product.id) rememberApiPayload(String(product.id), payload);
    if (product.slug) rememberApiPayload(String(product.slug), payload);
  };

  const fetchProductPayload = (ref) => {
    const key = String(ref || "").trim();
    if (!key) return Promise.reject(new Error("INVALID_REF"));
    if (apiCache.has(key)) return Promise.resolve(apiCache.get(key));
    if (apiInFlight.has(key)) return apiInFlight.get(key);
    const promise = fetch(`/api/products/${encodeURIComponent(key)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok === false) {
          const error = new Error("NOT_FOUND");
          error.status = response.status;
          throw error;
        }
        rememberProductPayload(key, data);
        return data;
      })
      .finally(() => {
        apiInFlight.delete(key);
      });
    apiInFlight.set(key, promise);
    return promise;
  };

  const fetchShopPayload = async (shopRef) => {
    const response = await fetch(`/api/shops/${encodeURIComponent(shopRef)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false || !data.shop) {
      const error = new Error("SHOP_NOT_FOUND");
      error.status = response.status;
      throw error;
    }
    return data.shop;
  };

  const fetchShopProducts = async (shopId) => {
    const params = new URLSearchParams();
    params.set("shopId", String(shopId || ""));
    params.set("sort", "custom");
    params.set("page", "1");
    params.set("perPage", String(PAGE_SIZE));
    const response = await fetch(`/api/products?${params.toString()}`);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) return [];
    return Array.isArray(data.items) ? data.items : [];
  };

  const normalizeItem = (item) => {
    if (!item) return null;
    const id = item.id != null ? String(item.id) : "";
    if (!id) return null;
    return {
      id,
      slug: item.slug || "",
      title: item.title || item.name || "",
      price: Number(item.price || 0),
      priceMax: item.priceMax != null ? Number(item.priceMax || 0) : null,
      stockCount: item.stockCount != null ? Number(item.stockCount || 0) : 0,
    };
  };

  const state = {
    baseSegment: getBaseSegment(),
    shopRef: "",
    shop: null,
    shopProducts: [],
    defaultProductRef: "",
    productRef: "",
    productId: "",
    product: null,
    payload: null,
  };

  const dom = {
    otherList: null,
    orderBtn: null,
    preorderBtn: null,
    modalName: null,
    modalPrice: null,
    modalTotal: null,
    modalError: null,
    qtyInput: null,
    qtyMinus: null,
    qtyPlus: null,
    modalConfirm: null,
  };

  let renderSeq = 0;

  const applyShopCrumb = () => {
    const shop = state.shop;
    const crumbTitle = document.getElementById("crumb-title");
    if (crumbTitle && shop && shop.name) crumbTitle.textContent = shop.name;
    if (shop && shop.name) document.title = `${shop.name} | polyflux.xyz`;
  };

  const buildShopPathname = () => {
    const shop = state.shop;
    const slug = shop && shop.slug ? shop.slug : state.shopRef;
    if (!slug) return `/${state.baseSegment}/`;
    return `/${state.baseSegment}/${encodeURIComponent(slug)}/`;
  };

  const buildShopProductHref = (productRef) => {
    const url = new URL(window.location.href);
    url.pathname = buildShopPathname();
    if (productRef) url.searchParams.set("p", String(productRef));
    else url.searchParams.delete("p");
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const renderOtherItems = (productId) => {
    if (!dom.otherList) return;
    const currentId = String(productId || "");
    const items = state.shopProducts
      .map((item) => normalizeItem(item))
      .filter(Boolean)
      // De-dup while preserving order (first occurrence wins).
      .filter((item, idx, arr) => arr.findIndex((candidate) => candidate.id === item.id) === idx);

    const current = normalizeItem(state.product);
    if (current && currentId && !items.some((item) => String(item.id) === currentId)) {
      // Ensure the current item still shows up (for the checkmark), but don't reorder the list.
      items.push(current);
    }

    if (!items.length) {
      dom.otherList.innerHTML = `<div class="empty-state">${translate("product.detail.other.empty", "No other items.")}</div>`;
      return;
    }

    dom.otherList.innerHTML = items
      .map((item) => {
        const isCurrent = String(item.id) === currentId;
        const ref = item.slug || item.id;
        const href = buildShopProductHref(ref);
        const label = formatPriceRange(item);
        const stockCount = Number(item.stockCount || 0);
        const stockLabel =
          stockCount > 0
            ? `${stockCount.toLocaleString("vi-VN")} ${translate("label.available", "available")}`
            : translate("label.outOfStock", "H\u1ebft h\u00e0ng");
        const stockClass = stockCount > 0 ? "ok" : "out";
        return `
          <a class="detail-other-item ${isCurrent ? "current" : ""}" href="${href}" data-product-ref="${escapeHtml(ref)}" ${isCurrent ? 'aria-current="true"' : ""}>
            <span class="detail-other-name">
              ${isCurrent ? `<span class="detail-other-check" aria-hidden="true">\u2713</span>` : ""}
              <span>${escapeHtml(item.title)}</span>
            </span>
            <span class="detail-other-meta">
              <span class="price">${label}</span>
              <span class="detail-other-stock ${stockClass}">${escapeHtml(stockLabel)}</span>
            </span>
          </a>
        `;
      })
      .join("");

    items
      .filter((item) => String(item.id) !== currentId)
      .slice(0, 12)
      .forEach((item) => {
        const ref = item.slug || item.id;
        if (!ref) return;
        if (apiCache.has(ref) || apiInFlight.has(ref)) return;
        fetchProductPayload(ref).catch(() => {});
      });
  };

  const markOtherSelection = (link) => {
    if (!dom.otherList || !link) return;
    dom.otherList.querySelectorAll("a.detail-other-item").forEach((el) => {
      el.classList.remove("current");
      el.removeAttribute("aria-current");
      const check = el.querySelector(".detail-other-check");
      if (check) check.remove();
    });
    link.classList.add("current");
    link.setAttribute("aria-current", "true");
    const name = link.querySelector(".detail-other-name");
    if (name && !name.querySelector(".detail-other-check")) {
      name.insertAdjacentHTML("afterbegin", '<span class="detail-other-check" aria-hidden="true">\u2713</span>');
    }
  };

  const renderProduct = (payload, productRef) => {
    const product = payload && payload.product ? payload.product : null;
    if (!product) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    if (state.shop && state.shop.id && product.shopId && String(product.shopId) !== String(state.shop.id)) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    const productId = product && product.id ? String(product.id) : String(productRef || "");
    state.productRef = String(productRef || "");
    state.productId = productId;
    state.product = product;
    state.payload = payload;

    applyShopCrumb();

    setText("detail-title", product.title);
    setText("detail-short", product.descriptionShort || "");
    setText("detail-stock", product.stockCount ?? "--");
    setText("detail-sold", product.soldCount ?? "--");
    setText("detail-rating", product.rating ?? "--");
    setText("detail-type", product.subcategory || product.category || "--");
    setText("detail-price", formatPriceRange(product));

    const seller = product.seller || {};
    const shop = state.shop || product.shop || {};
    const owner = state.shop && state.shop.owner ? state.shop.owner : null;

    const sellerLink = document.getElementById("detail-seller-link");
    if (sellerLink) {
      const sellerName =
        (owner && (owner.displayName || owner.username)) ||
        seller.displayName ||
        seller.username ||
        shop.name ||
        seller.name ||
        "Shop";
      sellerLink.textContent = sellerName;
      sellerLink.href = buildShopPathname();
    }
    setHTML("detail-seller-badge", renderSellerBadge(seller));
    const rawShopId = (shop && (shop.storeSlug || shop.store_slug)) || (state.shop && state.shop.id) || shop.slug || shop.id || "";
    const shopIdDisplay =
      shop && (shop.storeSlug || shop.store_slug) ? String(shop.storeSlug || shop.store_slug) : formatShopId(rawShopId);
    const shopIdEl = document.getElementById("detail-shop-id");
    if (shopIdEl) {
      shopIdEl.textContent = shopIdDisplay || "--";
      shopIdEl.title = rawShopId ? String(rawShopId) : "";
    }

    setText("detail-rating-note", product.rating != null ? product.rating : "--");
    const ratingNote = document.getElementById("detail-rating-note");
    if (ratingNote) {
      const rating = Number(product.rating || 0);
      if (Number.isFinite(rating)) {
        ratingNote.className = `rating-note ${rating >= 4.5 ? "positive" : rating >= 4 ? "neutral" : "negative"}`;
        ratingNote.textContent =
          rating >= 4.5
            ? translate("product.detail.rating.positive", "Positive")
            : rating >= 4
              ? translate("product.detail.rating.neutral", "Neutral")
              : translate("product.detail.rating.negative", "Needs improvement");
      } else {
        ratingNote.className = "rating-note";
        ratingNote.textContent = translate("product.detail.rating.none", "No rating yet");
      }
    }

    // Prefer sanitized shop description from product payload when available.
    const shopDescHtml =
      product.shop && product.shop.descriptionHtml
        ? product.shop.descriptionHtml
        : state.shop && state.shop.descriptionLong
          ? `<div style="white-space:pre-wrap;">${escapeHtml(state.shop.descriptionLong)}</div>`
          : "";
    setHTML("detail-shop-desc", shopDescHtml);
    setHTML("detail-reviews", `<div class="empty-state">${translate("product.detail.review.empty", "No reviews yet.")}</div>`);
    setHTML("detail-api", `<div class="empty-state">${translate("product.detail.api.empty", "API is coming soon.")}</div>`);

    renderOtherItems(productId);

    // Reset order modal content for the new product.
    const deliveredBox = document.querySelector(".order-modal-delivered");
    if (deliveredBox) deliveredBox.remove();
    if (dom.modalName) dom.modalName.textContent = product.title || "--";
    if (dom.modalPrice) dom.modalPrice.textContent = formatPriceRange(product);
    if (dom.modalTotal) dom.modalTotal.textContent = formatPriceRange(product);
    if (dom.qtyInput) dom.qtyInput.value = "1";
    if (dom.qtyMinus) dom.qtyMinus.disabled = true;
    if (dom.qtyPlus) dom.qtyPlus.disabled = true;
    if (dom.modalError) dom.modalError.textContent = "";
  };

  const loadProduct = async (productRef) => {
    const ref = String(productRef || "").trim();
    if (!ref) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }
    const seq = (renderSeq += 1);
    try {
      const payload = await fetchProductPayload(ref);
      if (seq !== renderSeq) return;
      const product = payload && payload.product ? payload.product : null;
      if (state.shop && state.shop.id && product && product.shopId && String(product.shopId) !== String(state.shop.id)) {
        if (state.defaultProductRef && state.defaultProductRef !== ref) {
          window.history.replaceState({}, "", buildShopProductHref(state.defaultProductRef));
          loadProduct(state.defaultProductRef);
          return;
        }
        setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
        return;
      }
      renderProduct(payload, ref);
    } catch (error) {
      if (seq !== renderSeq) return;
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
    }
  };

  const ensureShopReady = async () => {
    state.shopRef = getShopRef();
    if (!state.shopRef) {
      setHTML("detail-title", translate("shops.detail.invalid", "Invalid shop"));
      return;
    }

    const crumbTitle = document.getElementById("crumb-title");
    if (crumbTitle) crumbTitle.textContent = translate("shops.detail.loading", "Loading...");

    try {
      state.shop = await fetchShopPayload(state.shopRef);
      applyShopCrumb();
      renderShopMedia(state.shop);
      state.shopProducts = await fetchShopProducts(state.shop.id);
    } catch (error) {
      setHTML("detail-title", translate("shops.detail.notFound", "Shop not found"));
      return;
    }

    const picked = getProductRefFromUrl();
    const first = state.shopProducts.length ? state.shopProducts[0].slug || state.shopProducts[0].id : "";
    state.defaultProductRef = first;
    const initialRef = picked || first;
    if (!initialRef) {
      setText("detail-title", state.shop && state.shop.name ? state.shop.name : "--");
      setHTML("detail-short", translate("shops.detail.empty", "Shop has no products yet."));
      setText("detail-stock", "--");
      setText("detail-sold", "--");
      setText("detail-rating", state.shop ? state.shop.rating : "--");
      setText("detail-type", "--");
      setText("detail-price", "--");
      setHTML("detail-shop-desc", state.shop && state.shop.descriptionLong ? `<div style="white-space:pre-wrap;">${escapeHtml(state.shop.descriptionLong)}</div>` : "");
      if (dom.otherList) dom.otherList.innerHTML = `<div class="empty-state">${translate("shops.detail.noProducts", "No products.")}</div>`;
      return;
    }

    loadProduct(initialRef);
  };

  const init = () => {
    dom.otherList = document.getElementById("detail-other-list");
    dom.orderBtn = document.getElementById("detail-order");
    dom.preorderBtn = document.getElementById("detail-preorder");
    dom.modalName = document.getElementById("order-modal-name");
    dom.modalPrice = document.getElementById("order-modal-price");
    dom.modalTotal = document.getElementById("order-modal-total");
    dom.modalError = document.getElementById("order-modal-error");
    dom.qtyInput = document.getElementById("order-qty-input");
    dom.qtyMinus = document.getElementById("order-qty-minus");
    dom.qtyPlus = document.getElementById("order-qty-plus");
    dom.modalConfirm = document.getElementById("order-modal-confirm");

    bindTabs();

    if (dom.otherList) {
      dom.otherList.addEventListener("click", (event) => {
        const link = event.target.closest("a.detail-other-item");
        if (!link) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const nextRef = String(link.dataset.productRef || "").trim();
        if (!nextRef) return;
        const href = link.getAttribute("href") || "";
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        markOtherSelection(link);
        if (href) window.history.pushState({}, "", href);
        loadProduct(nextRef);
      });
    }

    window.addEventListener("popstate", () => {
      const ref = getProductRefFromUrl();
      const desired = ref || state.defaultProductRef;
      if (desired && desired !== state.productRef) loadProduct(desired);
    });

    const modalClose = document.getElementById("order-modal-close");
    const modalCancel = document.getElementById("order-modal-cancel");
    [modalClose, modalCancel].forEach((btn) => {
      if (btn) btn.addEventListener("click", closeModal);
    });

    if (dom.orderBtn) {
      dom.orderBtn.addEventListener("click", () => {
        const product = state.product || {};
        if (Number(product.stockCount || 0) <= 0) {
          if (dom.modalError) dom.modalError.textContent = translate("product.detail.outOfStock", "Out of stock.");
          return;
        }
        if (dom.modalError) dom.modalError.textContent = "";
        openModal();
      });
    }

    if (dom.preorderBtn) {
      dom.preorderBtn.addEventListener("click", () => {
        if (dom.modalError) dom.modalError.textContent = translate("product.detail.preorderSoon", "Preorder is not available yet.");
      });
    }

    if (dom.modalConfirm) {
      dom.modalConfirm.addEventListener("click", async () => {
        const headers = buildAuthHeaders();
        if (!headers["x-user-id"]) {
          if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
            window.BKAuth.showToast(translate("product.detail.toast.loginRequired", "Please log in to place an order."));
          }
          return;
        }

        const productId = state.productId || "";
        if (!productId) return;

        dom.modalConfirm.disabled = true;
        dom.modalConfirm.setAttribute("aria-busy", "true");
        if (dom.modalError) dom.modalError.textContent = "";
        try {
          const response = await fetch(`/api/orders/product/${encodeURIComponent(productId)}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ quantity: 1 }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result || result.ok === false) {
            if (dom.modalError) dom.modalError.textContent = translate("product.detail.orderFailed", "Order failed. Please try again.");
          } else {
            let deliveredText = result.delivered || "";
            if (!deliveredText && result.downloadUrl) {
              try {
                const deliveredResponse = await fetch(result.downloadUrl, { headers });
                if (deliveredResponse.ok) {
                  deliveredText = await deliveredResponse.text();
                }
              } catch (error) {
                deliveredText = "";
              }
            }
            const deliveredBox = document.querySelector(".order-modal-delivered");
            const container = deliveredBox || document.createElement("div");
            container.className = "order-modal-delivered";
            container.textContent = deliveredText || translate("product.detail.orderDelivered", "Delivered.");
            const body = document.querySelector(".order-modal-body");
            if (body && !deliveredBox) body.appendChild(container);
          }
        } catch (error) {
          if (dom.modalError) dom.modalError.textContent = translate("product.detail.orderFailed", "Order failed. Please try again.");
        } finally {
          dom.modalConfirm.disabled = false;
          dom.modalConfirm.removeAttribute("aria-busy");
        }
      });
    }

    ensureShopReady();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
