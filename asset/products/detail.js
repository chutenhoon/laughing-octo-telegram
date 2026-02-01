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

  const resolveCategoryLabel = (categoryId) => {
    const key = String(categoryId || "").trim().toLowerCase();
    if (!key) return "";
    if (key === "email") return translate("product.category.email", "Email");
    if (key === "tool") return translate("product.category.tool", "Ph\u1ea7n m\u1ec1m");
    if (key === "account") return translate("product.category.account", "T\u00e0i kho\u1ea3n");
    if (key === "other") return translate("product.category.other", "Kh\u00e1c");
    return categoryId;
  };

  const resolveShopRefs = (product) => {
    if (!product) return { slug: "", id: "" };
    const shop = product.shop || {};
    const seller = product.seller || {};
    const slug =
      (shop.slug && String(shop.slug).trim()) ||
      (product.shopSlug && String(product.shopSlug).trim()) ||
      (seller.slug && String(seller.slug).trim()) ||
      "";
    const id =
      (product.shopId != null && product.shopId !== "" ? String(product.shopId).trim() : "") ||
      (shop.id != null && shop.id !== "" ? String(shop.id).trim() : "") ||
      (seller.storeId != null && seller.storeId !== "" ? String(seller.storeId).trim() : "") ||
      (seller.id != null && seller.id !== "" ? String(seller.id).trim() : "");
    return { slug, id };
  };

  const resolveSellerName = (seller) => {
    if (!seller) return "";
    const display = String(seller.displayName || "").trim();
    if (display) return display;
    const username = String(seller.username || "").trim();
    if (username) return username;
    const fallback = String(seller.name || "").trim();
    return fallback;
  };

  const buildShopUrl = (slug, id) => {
    const safeSlug = String(slug || "").trim();
    if (safeSlug) return `/shop/${encodeURIComponent(safeSlug)}`;
    const safeId = String(id || "").trim();
    if (safeId) return `/shop/?id=${encodeURIComponent(safeId)}`;
    return "";
  };

  const getProductId = () => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");
    if (!id) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[id]") id = last;
    }
    return id ? String(id).trim() : "";
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
    const productId = getProductId();
    if (!productId) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    const authHeaders = buildAuthHeaders();
    const response = await fetch(
      `/api/products/${encodeURIComponent(productId)}`,
      Object.keys(authHeaders).length ? { headers: authHeaders } : undefined
    );
    const data = await response.json();
    if (!response.ok || !data || data.ok === false) {
      setHTML("detail-title", translate("product.detail.notFound", "Product not found"));
      return;
    }

    const product = data.product;
    const seller = product.seller || {};
    const shop = product.shop || {};
    const priceLabel = formatPriceRange(product);
    const shopRef = resolveShopRefs(product);
    const shopUrl = buildShopUrl(shopRef.slug, shopRef.id);

    setText("detail-title", product.title);
    setText("detail-short", product.descriptionShort || "");
    setText("detail-stock", product.stockCount ?? "--");
    setText("detail-sold", product.soldCount ?? "--");
    setText("detail-rating", product.rating ?? "--");
    setText("detail-type", product.subcategory || product.category || "--");
    setText("detail-price", priceLabel);
    setText("crumb-title", product.title || "");
    const crumbCategory = document.getElementById("crumb-category");
    if (crumbCategory) {
      const label = resolveCategoryLabel(product.category || "");
      if (label) {
        crumbCategory.textContent = label;
      }
    }
    if (product.title) document.title = `${product.title} | polyflux.xyz`;

    const sellerLink = document.getElementById("detail-seller-link");
    if (sellerLink) {
      sellerLink.textContent = resolveSellerName(seller) || "Seller";
      sellerLink.href = shopUrl || "#";
    }
    setHTML("detail-seller-badge", renderSellerBadge(seller));
    setText("detail-shop-id", shopRef.slug || shopRef.id || "--");
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
    const messageLink = document.getElementById("detail-message");
    if (messageLink) {
      messageLink.href = "/profile/messages/";
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
      detailImage.innerHTML = product.thumbnailUrl
        ? `<img src="${product.thumbnailUrl}" alt="${escapeHtml(product.title)}" loading="lazy" />`
        : `<div class="product-fallback">${fallbackLabel}</div>`;
    }

    setHTML("detail-shop-desc", product.shop && product.shop.descriptionHtml ? product.shop.descriptionHtml : "");
    setHTML("detail-reviews", `<div class="empty-state">${translate("product.detail.review.empty", "No reviews yet.")}</div>`);

    const otherList = document.getElementById("detail-other-list");
    if (otherList) {
      const others = Array.isArray(data.others) ? data.others : [];
      if (!others.length) {
        otherList.innerHTML = `<div class="empty-state">${translate("product.detail.other.empty", "No other items.")}</div>`;
      } else {
        const sellerName = resolveSellerName(seller) || "Seller";
        const sellerBadge = renderSellerBadge(seller);
        const actions = [];
        if (shopUrl) actions.push(`<a class="shop-link" href="${shopUrl}">Gian h\u00e0ng</a>`);
        otherList.innerHTML = others
          .map((item) => {
            const detailUrl =
              typeof getProductDetailPath === "function" ? getProductDetailPath(item.id) : `/products/[id]/?id=${encodeURIComponent(item.id)}`;
            const subLabel = item.subcategory || item.category || product.subcategory || product.category || "BK";
            const media = item.thumbnailUrl
              ? `<img src="${item.thumbnailUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
              : `<div class="product-fallback">${String(subLabel || "BK").slice(0, 2)}</div>`;
            const priceText = formatPriceRange(item);
            const priceAttrs =
              item.priceMax != null && item.priceMax > item.price
                ? `data-base-min="${item.price}" data-base-max="${item.priceMax}" data-base-currency="VND"`
                : `data-base-amount="${item.price}" data-base-currency="VND"`;
            return `
              <div class="product-card">
                <a class="product-card-link" href="${detailUrl}">
                  <div class="product-media">${media}</div>
                  <div class="product-body">
                    <div class="product-price" ${priceAttrs}>${priceText}</div>
                    <h3 class="product-title">${escapeHtml(item.title)}</h3>
                    <div class="product-meta">
                      <div class="meta-col">
                        <span>${translate("label.stock", "Stock")}: <strong>${item.stockCount ?? "--"}</strong></span>
                        <span>${translate("label.sold", "Sold")}: <strong>${item.soldCount ?? "--"}</strong></span>
                        <span>${translate("label.rating", "Rating")}: <strong>${item.rating ?? "--"}</strong></span>
                      </div>
                      <div class="meta-col meta-right">
                        <span class="seller-line">
                          <span class="seller-label">${translate("label.seller", "Seller")}:</span>
                          <span class="seller-value"><strong class="seller-name">${escapeHtml(sellerName)}</strong>${sellerBadge}</span>
                        </span>
                      </div>
                    </div>
                    ${subLabel ? `<div class="product-type">${translate("label.type", "Type")}: <strong>${escapeHtml(subLabel)}</strong></div>` : ""}
                    <p class="product-desc">${escapeHtml(item.descriptionShort || "")}</p>
                  </div>
                </a>
                ${actions.length ? `<div class="product-card-actions">${actions.join("")}</div>` : ""}
              </div>
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


