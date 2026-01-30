(function () {
  "use strict";

  const root =
    typeof getRootPath === "function"
      ? getRootPath()
      : typeof getProjectRoot === "function"
        ? getProjectRoot()
        : "/";
  const isFile = window.location.protocol === "file:";

  const hero = document.getElementById("shop-owner-hero");
  const ownerAvatar = document.getElementById("shop-owner-avatar");
  const ownerName = document.getElementById("shop-owner-name");
  const ownerBadge = document.getElementById("shop-owner-badge");
  const ownerTitle = document.getElementById("shop-owner-title");
  const ownerSub = document.getElementById("shop-owner-sub");
  const grid = document.getElementById("shop-list-grid");
  const emptyState = document.getElementById("shop-list-empty");

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
    if (normalized === "ADMIN") return "Admin";
    if (normalized === "COADMIN") return "Coadmin";
    if (normalized === "VERIFIED") return "Verified";
    if (normalized.startsWith("MERCHANT-")) {
      const tier = normalized.replace("MERCHANT-", "");
      return `Merchant ${tier}`;
    }
    return value;
  };

  const renderSellerBadge = (data) => {
    const badgeValue = resolveBadgeValue(data);
    if (!badgeValue) return "";
    const raw = String(badgeValue || "").trim().toUpperCase();
    if (!raw) return "";
    if (raw === "ADMIN") return `<span class="seller-badge admin">Admin</span>`;
    if (raw === "COADMIN") return `<span class="seller-badge coadmin">Coadmin</span>`;
    if (raw === "VERIFIED") return `<span class="seller-badge verified">Verified</span>`;
    if (raw.startsWith("MERCHANT-")) {
      const tier = raw.replace("MERCHANT-", "");
      const tierClass = tier.toLowerCase();
      return `<span class="seller-badge merchant merchant-${tierClass}">Merchant ${tier}</span>`;
    }
    return "";
  };

  const getOwnerRef = () => {
    const params = new URLSearchParams(window.location.search);
    let ref =
      params.get("u") ||
      params.get("user") ||
      params.get("username") ||
      params.get("id") ||
      params.get("userId") ||
      "";
    if (!ref) {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("nguoi-ban");
      if (idx >= 0 && parts[idx + 1]) {
        ref = parts[idx + 1];
      } else if (parts.length) {
        ref = parts[parts.length - 1];
      }
    }
    return ref ? String(ref).trim() : "";
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

  const setHeroLoading = (active) => {
    if (hero) hero.classList.toggle("is-loading", Boolean(active));
    [ownerName, ownerTitle, ownerSub].forEach((el) => {
      if (!el) return;
      el.classList.toggle("skeleton", Boolean(active));
      if (active) el.textContent = "";
    });
    if (ownerAvatar) {
      ownerAvatar.classList.toggle("skeleton", Boolean(active));
      if (active) ownerAvatar.innerHTML = "";
    }
    if (ownerBadge) {
      ownerBadge.classList.toggle("is-hidden", Boolean(active));
    }
  };

  const renderOwner = (owner, ownerRef) => {
    const data = owner || {};
    const displayName = data.displayName || data.display_name || data.username || ownerRef || "--";
    if (ownerName) ownerName.textContent = displayName || "--";
    if (ownerSub) ownerSub.textContent = `Gian hang cua ${displayName || "--"}`;

    if (ownerBadge) {
      const badgeHtml = renderSellerBadge(data);
      ownerBadge.innerHTML = badgeHtml;
      ownerBadge.style.display = badgeHtml ? "inline-flex" : "none";
    }
    if (ownerTitle) {
      const badgeLabel = resolveBadgeLabel(resolveBadgeValue(data));
      const normalizedBadge = normalizeLabel(badgeLabel);
      const titleParts = [];
      [data.title, data.rank].forEach((value) => {
        const cleaned = String(value || "").trim();
        if (!cleaned) return;
        const normalized = normalizeLabel(cleaned);
        if (normalizedBadge && normalized === normalizedBadge) return;
        if (titleParts.some((item) => normalizeLabel(item) === normalized)) return;
        titleParts.push(cleaned);
      });
      if (titleParts.length) {
        ownerTitle.textContent = titleParts.join(" - ");
        ownerTitle.style.display = "inline-flex";
      } else {
        ownerTitle.textContent = "";
        ownerTitle.style.display = "none";
      }
    }
    if (ownerAvatar) {
      if (data.avatar || data.avatar_url) {
        ownerAvatar.innerHTML = `<img src="${data.avatar || data.avatar_url}" alt="${displayName}" loading="lazy" />`;
      } else {
        ownerAvatar.innerHTML = `<span>${getInitials(displayName)}</span>`;
      }
    }
  };

  const renderSkeleton = () => {
    if (!grid) return;
    const card = `
      <div class="shop-card-skeleton glass">
        <div class="skeleton" style="height: 180px;"></div>
        <div class="skeleton skeleton-title" style="margin-top: 10px;"></div>
        <div class="skeleton skeleton-line" style="margin-top: 8px;"></div>
        <div class="skeleton skeleton-line" style="margin-top: 8px; width: 70%;"></div>
      </div>
    `;
    grid.innerHTML = Array.from({ length: 6 }, () => card).join("");
  };

  const buildShopUrl = (shop) => {
    const ref = shop.slug || shop.id || "";
    if (!ref) return "#";
    if (isFile) {
      return `${root}seller/[id]/index.html?id=${encodeURIComponent(ref)}`;
    }
    return `${root}gian-hang/${encodeURIComponent(ref)}`;
  };

  const renderStatusChip = (shop) => {
    if (!shop) return "";
    const status = String(shop.status || "").trim().toLowerCase();
    if (!status || status === "approved" || status === "active" || status === "published") return "";
    const label = status === "pending" ? "Dang duyet" : status === "pending_update" ? "Cho cap nhat" : status === "rejected" ? "Bi tu choi" : status;
    const cls = status === "pending" || status === "pending_update" ? "pending" : status === "disabled" ? "disabled" : "";
    return `<span class="shop-status-chip ${cls}">${label}</span>`;
  };

  const renderShopCard = (shop) => {
    const title = shop.name || "--";
    const media = shop.avatarUrl
      ? `<img src="${shop.avatarUrl}" alt="${title}" loading="lazy" />`
      : `<div class="shop-avatar-fallback">${getInitials(title)}</div>`;
    const typeLabel = shop.storeType === "service" ? "Dich vu" : "San pham";
    const meta = [
      `${typeLabel}`,
      `Danh gia: ${Number(shop.rating || 0).toFixed(1)}`,
      `Don hang: ${Number(shop.totalOrders || 0).toLocaleString("vi-VN")}`,
      `Kho: ${Number(shop.stockCount || 0).toLocaleString("vi-VN")}`,
    ];
    return `
      <a class="shop-card glass" href="${buildShopUrl(shop)}">
        <div class="shop-card-media">${media}</div>
        <div>
          <h3>${title}</h3>
          <p class="hero-sub">${shop.descriptionShort || ""}</p>
        </div>
        <div class="shop-card-meta">
          <span>${meta.join(" | ")}</span>
          ${renderStatusChip(shop)}
        </div>
      </a>
    `;
  };

  const renderShops = (items) => {
    if (!grid) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      grid.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }
    if (emptyState) emptyState.style.display = "none";
    grid.innerHTML = list.map(renderShopCard).join("");
  };

  const fetchProfile = async (ownerRef) => {
    if (!ownerRef || isFile) return null;
    const isNumeric = /^\d+$/.test(ownerRef);
    const isEmail = ownerRef.includes("@");
    const key = isEmail || isNumeric ? "id" : "u";
    const params = new URLSearchParams();
    params.set(key, ownerRef);
    params.set("view", "public");
    const response = await fetch(`/api/profile?${params.toString()}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) return null;
    return data.user || null;
  };

  const fetchShops = async (ownerRef) => {
    if (!ownerRef || isFile) return null;
    const response = await fetch(`/api/shops?owner=${encodeURIComponent(ownerRef)}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) return null;
    return data;
  };

  const init = async () => {
    const ownerRef = getOwnerRef();
    if (!ownerRef) {
      if (ownerSub) ownerSub.textContent = "Khong tim thay nguoi ban.";
      renderShops([]);
      return;
    }
    setHeroLoading(true);
    renderSkeleton();
    try {
      const [profileResult, shopsResult] = await Promise.allSettled([fetchProfile(ownerRef), fetchShops(ownerRef)]);
      const owner = profileResult.status === "fulfilled" ? profileResult.value : null;
      const shopPayload = shopsResult.status === "fulfilled" ? shopsResult.value : null;
      const fallbackOwner = shopPayload && shopPayload.owner ? shopPayload.owner : null;
      renderOwner(owner || fallbackOwner || null, ownerRef);
      renderShops(shopPayload && Array.isArray(shopPayload.items) ? shopPayload.items : []);
    } finally {
      setHeroLoading(false);
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
