(function () {
  "use strict";

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const toSafeHtml = (value) => {
    if (!value) return "";
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  };

  const formatVnd = (value) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
      Number(value || 0)
    );

  const buildPriceLabel = (min, max) => {
    const priceMin = Number(min || 0);
    const priceMax = max != null ? Number(max) : null;
    if (priceMax != null && priceMax > priceMin) {
      return `${formatVnd(priceMin)} - ${formatVnd(priceMax)}`;
    }
    return formatVnd(priceMin);
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
    if (user.role) headers["x-user-role"] = String(user.role);
    return headers;
  };

  const getSlug = () => {
    const params = new URLSearchParams(window.location.search);
    let slug = params.get("slug") || params.get("id");
    if (!slug) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[slug]") slug = last;
    }
    return slug ? String(slug).trim() : "";
  };

  const renderSellerBadge = (seller) => {
    if (!seller) return "";
    const role = String(seller.role || "").trim().toLowerCase();
    if (role === "admin") return '<span class="seller-badge admin">ADMIN</span>';
    const badge = String(seller.badge || "").trim().toUpperCase();
    if (badge === "ADMIN") return '<span class="seller-badge admin">ADMIN</span>';
    return "";
  };

  const updateText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "--" : value;
  };

  const updateHtml = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value == null ? "" : value;
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
    const slug = getSlug();
    if (!slug) {
      updateText("detail-title", "Sản phẩm không tồn tại");
      return;
    }

    const headers = buildAuthHeaders();
    const response = await fetch(`/api/v2/products/${encodeURIComponent(slug)}`, Object.keys(headers).length ? { headers } : undefined);
    const data = await response.json();
    if (!response.ok || !data || data.ok === false) {
      updateText("detail-title", "Sản phẩm không tồn tại");
      return;
    }

    const product = data.product || {};
    const seller = product.seller || {};
    const shop = product.shop || {};
    const priceLabel = buildPriceLabel(product.priceMin, product.priceMax);

    updateText("detail-title", product.title || "--");
    updateText("detail-short", product.descriptionShort || "");
    updateText("detail-stock", product.stock ?? "--");
    updateText("detail-sold", product.sold ?? "--");
    updateText("detail-rating", product.rating != null ? Number(product.rating || 0).toFixed(1) : "--");
    updateText("detail-type", product.categoryLabel || "--");
    updateText("detail-price", priceLabel);

    if (window.BKCurrency && typeof window.BKCurrency.setPriceDataset === "function") {
      const priceEl = document.getElementById("detail-price");
      if (priceEl) {
        window.BKCurrency.setPriceDataset(priceEl, Number(product.priceMin || 0), product.priceMax != null ? Number(product.priceMax) : null, "VND");
        window.BKCurrency.applyToDom(priceEl);
      }
    }

    updateText("crumb-title", product.title || "Chi tiết");
    const crumbCategory = document.getElementById("crumb-category");
    if (crumbCategory) {
      crumbCategory.textContent = product.categoryGroup || product.categoryLabel || "Sản phẩm";
      if (product.categoryGroup) {
        crumbCategory.href = `/products/?category=${encodeURIComponent(product.categoryGroup.toLowerCase())}`;
      }
    }
    if (product.title) document.title = `${product.title} | polyflux.xyz`;

    const sellerLink = document.getElementById("detail-seller-link");
    if (sellerLink) {
      sellerLink.textContent = seller.displayName || seller.username || shop.name || "Seller";
      const shopSlug = shop.slug || "";
      if (shopSlug) sellerLink.href = `/shop/${encodeURIComponent(shopSlug)}`;
    }
    updateHtml("detail-seller-badge", renderSellerBadge(seller));
    updateText("detail-shop-id", shop.slug || shop.id || "--");

    const shopLink = document.getElementById("detail-shop-link");
    if (shopLink) {
      if (shop.slug) {
        shopLink.href = `/shop/${encodeURIComponent(shop.slug)}`;
        shopLink.style.display = "inline-flex";
      } else {
        shopLink.style.display = "none";
      }
    }

    const ratingNote = document.getElementById("detail-rating-note");
    if (ratingNote) {
      const rating = Number(product.rating || 0);
      ratingNote.className = "rating-note";
      ratingNote.textContent = rating >= 4.5 ? "Tích cực" : rating >= 4 ? "Khá" : "Chưa có";
      if (rating >= 4.5) ratingNote.classList.add("positive");
      else if (rating >= 4) ratingNote.classList.add("neutral");
      else ratingNote.classList.add("negative");
    }

    const detailImage = document.getElementById("detail-image");
    if (detailImage) {
      const image = product.thumbnailUrl || (product.images && product.images.length ? product.images[0].url : "");
      detailImage.innerHTML = image
        ? `<img src="${image}" alt="${escapeHtml(product.title || "")}" loading="lazy" />`
        : `<div class="product-fallback">${escapeHtml((product.categoryLabel || "BK").slice(0, 2))}</div>`;
    }

    updateHtml("detail-desc", product.descriptionHtml || toSafeHtml(product.description || ""));
    updateHtml("detail-reviews", '<div class="empty-state">Chưa có đánh giá.</div>');

    const otherList = document.getElementById("detail-other-list");
    if (otherList) {
      const items = Array.isArray(data.related) ? data.related : [];
      if (!items.length) {
        otherList.innerHTML = '<div class="empty-state">Chưa có mặt hàng khác.</div>';
      } else {
        otherList.innerHTML = items
          .map((item) => {
            const relatedPriceLabel = buildPriceLabel(item.priceMin, item.priceMax);
            const priceAttrs = item.priceMax != null && item.priceMax > item.priceMin
              ? `data-base-min="${item.priceMin}" data-base-max="${item.priceMax}" data-base-currency="VND"`
              : `data-base-amount="${item.priceMin}" data-base-currency="VND"`;
            const media = item.imageUrl
              ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy" />`
              : `<div class="product-fallback">${escapeHtml((item.categoryLabel || "BK").slice(0, 2))}</div>`;
            return `
              <div class="product-card">
                <a class="product-card-link" href="/products/${encodeURIComponent(item.slug || item.id)}">
                  <div class="product-media">${media}</div>
                  <div class="product-body">
                    <div class="product-price" ${priceAttrs}>${relatedPriceLabel}</div>
                    <h3 class="product-title">${escapeHtml(item.title)}</h3>
                    <div class="product-meta">
                      <div class="meta-col">
                        <span>Kho: <strong>${item.stock ?? "--"}</strong></span>
                        <span>Đã bán: <strong>${item.sold ?? "--"}</strong></span>
                        <span>Đánh giá: <strong>${Number(item.rating || 0).toFixed(1)}</strong></span>
                      </div>
                    </div>
                    ${item.categoryLabel ? `<div class="product-type">Loại: <strong>${escapeHtml(item.categoryLabel)}</strong></div>` : ""}
                  </div>
                </a>
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

    if (modalName) modalName.textContent = product.title || "--";
    if (modalPrice) modalPrice.textContent = priceLabel;
    if (modalTotal) modalTotal.textContent = priceLabel;
    if (qtyInput) qtyInput.value = "1";
    if (qtyMinus) qtyMinus.disabled = true;
    if (qtyPlus) qtyPlus.disabled = true;

    if (orderBtn) {
      orderBtn.addEventListener("click", () => {
        if (Number(product.stock || 0) <= 0) {
          if (modalError) modalError.textContent = "Hết hàng.";
          return;
        }
        if (modalError) modalError.textContent = "";
        openModal();
      });
    }
    if (preorderBtn) {
      preorderBtn.addEventListener("click", () => {
        if (modalError) modalError.textContent = "Đặt trước chưa hỗ trợ.";
      });
    }

    [modalClose, modalCancel].forEach((btn) => {
      if (btn) btn.addEventListener("click", closeModal);
    });

    if (modalConfirm) {
      modalConfirm.addEventListener("click", async () => {
        const authHeaders = buildAuthHeaders();
        if (!authHeaders["x-user-id"]) {
          if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
            window.BKAuth.showToast("Vui lòng đăng nhập để đặt hàng.");
          }
          return;
        }
        modalConfirm.disabled = true;
        modalConfirm.setAttribute("aria-busy", "true");
        if (modalError) modalError.textContent = "";
        try {
          const res = await fetch(`/api/orders/product/${encodeURIComponent(product.id)}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ quantity: 1 }),
          });
          const result = await res.json();
          if (!res.ok || !result || result.ok === false) {
            if (modalError) modalError.textContent = "Đặt hàng thất bại. Vui lòng thử lại.";
          } else {
            let deliveredText = result.delivered || "";
            if (!deliveredText && result.downloadUrl) {
              try {
                const deliveredResponse = await fetch(result.downloadUrl, { headers: authHeaders });
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
              <strong>Thông tin đã giao</strong>
              <textarea readonly>${deliveredText || ""}</textarea>
            `;
            const body = document.querySelector(".order-modal-body");
            if (body && !deliveredBox) body.appendChild(container);
            updateText("detail-stock", result.stockCount != null ? result.stockCount : product.stock);
          }
        } catch (error) {
          if (modalError) modalError.textContent = "Đặt hàng thất bại. Vui lòng thử lại.";
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
