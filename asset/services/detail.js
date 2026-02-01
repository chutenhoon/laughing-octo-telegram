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

  const resolveShopRefs = (service) => {
    if (!service) return { slug: "", id: "" };
    const shop = service.shop || {};
    const seller = service.seller || {};
    const slug =
      (shop.slug && String(shop.slug).trim()) ||
      (service.shopSlug && String(service.shopSlug).trim()) ||
      (seller.slug && String(seller.slug).trim()) ||
      "";
    const id =
      (service.shopId != null && service.shopId !== "" ? String(service.shopId).trim() : "") ||
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

  const getServiceId = () => {
    const params = new URLSearchParams(window.location.search);
    let id = params.get("id");
    if (!id) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && last !== "[id]") id = last;
    }
    return id ? String(id).trim() : "";
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? "--" : value;
  };

  const init = async () => {
    const serviceId = getServiceId();
    if (!serviceId) return;

    const response = await fetch(`/api/services/${encodeURIComponent(serviceId)}`);
    const data = await response.json();
    if (!response.ok || !data || data.ok === false) {
      setText("service-title", translate("service.detail.notFound", "Offer not found"));
      return;
    }

    const service = data.service;
    setText("service-title", service.title);
    setText("service-sub", service.descriptionShort || "");
    setText("service-description", service.descriptionHtml ? "" : service.descriptionShort || "");
    const descEl = document.getElementById("service-description");
    if (descEl && service.descriptionHtml) descEl.innerHTML = service.descriptionHtml;
    setText("service-price", formatPriceRange(service));
    setText("service-eta", service.subcategory || service.category || "");
    const seller = service.seller || {};
    const shop = service.shop || {};
    const shopRef = resolveShopRefs(service);
    const shopUrl = shopRef.slug
      ? `/shop/${encodeURIComponent(shopRef.slug)}`
      : shopRef.id
        ? `/shop/?id=${encodeURIComponent(shopRef.id)}`
        : "";
    setText("service-seller-name", resolveSellerName(seller) || "Seller");
    const badgeEl = document.getElementById("service-seller-badge");
    if (badgeEl) badgeEl.innerHTML = renderSellerBadge(seller);
    const shopLink = document.getElementById("service-shop-link");
    if (shopLink) {
      if (shopUrl) {
        shopLink.href = shopUrl;
        shopLink.style.display = "inline-flex";
      } else {
        shopLink.href = "#";
        shopLink.style.display = "none";
      }
    }

    const saveBtn = document.querySelector(".form-grid .btn.primary");
    const statusEl = document.querySelector(".service-request-status");
    const emailInput = document.getElementById("contact-mail");
    const linkInput = document.getElementById("contact-link");
    const noteInput = document.getElementById("contact-note");

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const headers = buildAuthHeaders();
        if (!headers["x-user-id"]) {
          if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
            window.BKAuth.showToast(translate("service.detail.toast.loginRequired", "Please log in to submit a request."));
          }
          return;
        }
        const email = emailInput ? emailInput.value.trim() : "";
        const link = linkInput ? linkInput.value.trim() : "";
        const note = noteInput ? noteInput.value.trim() : "";
        const payload = {
          note: `Email: ${email}\nLink: ${link}\nNote: ${note}`.trim(),
        };
        saveBtn.disabled = true;
        saveBtn.setAttribute("aria-busy", "true");
        try {
          const res = await fetch(`/api/orders/service/${encodeURIComponent(serviceId)}`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          const message = res.ok && result && result.ok !== false
            ? translate("service.detail.form.saved", "Request submitted successfully.")
            : translate("service.detail.form.failed", "Request failed. Please try again.");
          if (statusEl) statusEl.textContent = message;
          else {
            const hint = document.createElement("div");
            hint.className = "service-request-status";
            hint.textContent = message;
            const grid = document.querySelector(".form-grid");
            if (grid) grid.appendChild(hint);
          }
        } catch (error) {
          if (statusEl) statusEl.textContent = translate("service.detail.form.failed", "Request failed. Please try again.");
        } finally {
          saveBtn.disabled = false;
          saveBtn.removeAttribute("aria-busy");
        }
      });
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();

