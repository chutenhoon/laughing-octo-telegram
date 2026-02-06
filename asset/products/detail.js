(function () {
  "use strict";

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

  const resolveShopRef = (product) => {
    if (!product) return "";
    if (product.shop && product.shop.slug != null && product.shop.slug !== "") return String(product.shop.slug).trim();
    const seller = product.seller || {};
    if (seller.slug != null && seller.slug !== "") return String(seller.slug).trim();
    if (product.shopSlug != null && product.shopSlug !== "") return String(product.shopSlug).trim();
    if (product.shopId != null && product.shopId !== "") return String(product.shopId).trim();
    if (product.shop && product.shop.id != null && product.shop.id !== "") return String(product.shop.id).trim();
    if (seller.storeId != null && seller.storeId !== "") return String(seller.storeId).trim();
    if (seller.id != null && seller.id !== "") return String(seller.id).trim();
    return "";
  };

  const resolveThumbnailUrl = (item) => {
    if (!item) return "";
    if (item.thumbnailUrl) return item.thumbnailUrl;
    const mediaId = item.thumbnailId || item.thumbnail_id || item.thumbnail_media_id;
    if (!mediaId) return "";
    return `/api/media?id=${encodeURIComponent(mediaId)}`;
  };

  const getProductRef = () => {
    const params = new URLSearchParams(window.location.search);
    let ref = params.get("id") || params.get("slug");
    if (!ref) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[id]" && last !== "[slug]") ref = last;
    }
    return ref ? String(ref).trim() : "";
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

  const init = async () => {
    const productRef = getProductRef();
    if (!productRef) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    const response = await fetch(`/api/products/${encodeURIComponent(productRef)}`);
    const data = await response.json();
    if (!response.ok || !data || data.ok === false) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    const product = data.product;
    const productId = product && product.id ? String(product.id) : productRef;
    const seller = product.seller || {};
    const shop = product.shop || {};
    const priceLabel = formatPriceRange(product);
    const shopRef = resolveShopRef(product);
    const shopUrl =
      shopRef && window.BKRoutes && typeof window.BKRoutes.getShopDetailPath === "function"
        ? window.BKRoutes.getShopDetailPath({
            id: product.shopId || (shop && shop.id) || "",
            name: (shop && shop.name) || seller.name || "",
            slug: shopRef,
          })
        : shopRef
          ? `/shops/${encodeURIComponent(shopRef)}`
          : "";

    setText("detail-title", product.title);
    setText("detail-short", product.descriptionShort || "");
    setText("detail-stock", product.stockCount ?? "--");
    setText("detail-sold", product.soldCount ?? "--");
    setText("detail-rating", product.rating ?? "--");
    setText("detail-type", product.subcategory || product.category || "--");
    setText("detail-price", priceLabel);

    const sellerLink = document.getElementById("detail-seller-link");
    if (sellerLink) {
      sellerLink.textContent = seller.name || shop.name || "Shop";
      sellerLink.href = shopUrl || "#";
    }
    setHTML("detail-seller-badge", renderSellerBadge(seller));
    setText("detail-shop-id", shopRef || "--");
    const shopLink = document.getElementById("detail-shop-link");
    if (shopLink) {
      if (shopUrl) {
        shopLink.href = shopUrl;
        shopLink.style.display = "inline-flex";
      } else {
        shopLink.href = "#";
        shopLink.style.display = "none";
      }
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

    const detailImage = document.getElementById("detail-image");
    if (detailImage) {
      const fallbackLabel = String(product.subcategory || product.category || "BK").slice(0, 2);
      const thumbUrl = resolveThumbnailUrl(product);
      detailImage.innerHTML = thumbUrl
        ? `<img src="${thumbUrl}" alt="${escapeHtml(product.title)}" loading="lazy" />`
        : `<div class="product-fallback">${fallbackLabel}</div>`;
    }

    setHTML("detail-shop-desc", product.shop && product.shop.descriptionHtml ? product.shop.descriptionHtml : "");
    setHTML("detail-reviews", `<div class="empty-state">${translate("product.detail.review.empty", "No reviews yet.")}</div>`);
    setHTML("detail-api", `<div class="empty-state">${translate("product.detail.api.empty", "API is coming soon.")}</div>`);

    const otherList = document.getElementById("detail-other-list");
    if (otherList) {
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

      const rawShopItems = Array.isArray(data.shopItems) ? data.shopItems : [];
      const fallbackOthers = Array.isArray(data.others) ? data.others : [];
      const merged = [];
      if (product) merged.push(normalizeItem(product));
      rawShopItems.forEach((item) => merged.push(normalizeItem(item)));
      fallbackOthers.forEach((item) => merged.push(normalizeItem(item)));
      const shopItems = merged
        .filter(Boolean)
        .filter((item, idx, arr) => arr.findIndex((candidate) => candidate.id === item.id) === idx);

      if (!shopItems.length) {
        otherList.innerHTML = `<div class="empty-state">${translate("product.detail.other.empty", "No other items.")}</div>`;
      } else {
        otherList.innerHTML = shopItems
          .map((item) => {
            const isCurrent = String(item.id) === String(productId);
            const detailUrl =
              typeof getProductDetailPath === "function"
                ? getProductDetailPath(item)
                : `/products/${encodeURIComponent(item.slug || item.id || "")}/`;
            const label = formatPriceRange(item);
            const stockCount = Number(item.stockCount || 0);
            const stockLabel =
              stockCount > 0
                ? `${stockCount.toLocaleString("en-US")} ${translate("label.available", "available")}`
                : translate("label.outOfStock", "H\u1ebft h\u00e0ng");
            const stockClass = stockCount > 0 ? "ok" : "out";
            return `
              <a class="detail-other-item ${isCurrent ? "current" : ""}" href="${detailUrl}">
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
      }
    }

    const orderBtn = document.getElementById("detail-order");
    const preorderBtn = document.getElementById("detail-preorder");
    const modalName = document.getElementById("order-modal-name");
    const modalPrice = document.getElementById("order-modal-price");
    const modalTotal = document.getElementById("order-modal-total");
    const modalError = document.getElementById("order-modal-error");
    const qtyInput = document.getElementById("order-qty-input");
    const qtyMinus = document.getElementById("order-qty-minus");
    const qtyPlus = document.getElementById("order-qty-plus");
    const modalConfirm = document.getElementById("order-modal-confirm");
    const modalClose = document.getElementById("order-modal-close");
    const modalCancel = document.getElementById("order-modal-cancel");

    if (modalName) modalName.textContent = product.title;
    if (modalPrice) modalPrice.textContent = priceLabel;
    if (modalTotal) modalTotal.textContent = priceLabel;
    if (qtyInput) qtyInput.value = "1";
    if (qtyMinus) qtyMinus.disabled = true;
    if (qtyPlus) qtyPlus.disabled = true;

    if (orderBtn) {
      orderBtn.addEventListener("click", () => {
        if (Number(product.stockCount || 0) <= 0) {
          if (modalError) modalError.textContent = translate("product.detail.outOfStock", "Out of stock.");
          return;
        }
        if (modalError) modalError.textContent = "";
        openModal();
      });
    }
    if (preorderBtn) {
      preorderBtn.addEventListener("click", () => {
        if (modalError) modalError.textContent = translate("product.detail.preorderSoon", "Preorder is not available yet.");
      });
    }

    const closeButtons = [modalClose, modalCancel];
    closeButtons.forEach((btn) => {
      if (btn) btn.addEventListener("click", closeModal);
    });

    if (modalConfirm) {
      modalConfirm.addEventListener("click", async () => {
        const headers = buildAuthHeaders();
        if (!headers["x-user-id"]) {
          if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
            window.BKAuth.showToast(translate("product.detail.toast.loginRequired", "Please log in to place an order."));
          }
          return;
        }
        modalConfirm.disabled = true;
        modalConfirm.setAttribute("aria-busy", "true");
        if (modalError) modalError.textContent = "";
        try {
          const response = await fetch(`/api/orders/product/${encodeURIComponent(productId)}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ quantity: 1 }),
          });
          const result = await response.json();
          if (!response.ok || !result || result.ok === false) {
            if (modalError) modalError.textContent = translate("product.detail.orderFailed", "Order failed. Please try again.");
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
            container.innerHTML = `
              <strong>${translate("product.detail.delivered", "Delivered item")}</strong>
              <textarea readonly>${deliveredText || ""}</textarea>
            `;
            const body = document.querySelector(".order-modal-body");
            if (body && !deliveredBox) body.appendChild(container);
            setText("detail-stock", result.stockCount != null ? result.stockCount : product.stockCount);
          }
        } catch (error) {
          if (modalError) modalError.textContent = translate("product.detail.orderFailed", "Order failed. Please try again.");
        } finally {
          modalConfirm.disabled = false;
          modalConfirm.removeAttribute("aria-busy");
        }
      });
    }

    bindTabs();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
