(function () {
  "use strict";

  const ADMIN_CRED_KEY = "bk_admin_creds";

  const approveBody = document.getElementById("admin-store-approve-body");
  const approveEmpty = document.getElementById("admin-store-approve-empty");
  const approveError = document.getElementById("admin-store-approve-error");
  const approvePagination = document.getElementById("admin-store-approve-pagination");
  const approveSearch = document.getElementById("admin-store-approve-search");
  const approveSort = document.getElementById("admin-store-approve-sort");
  const bulkApproveBtn = document.getElementById("admin-store-bulk-approve");

  const updateBody = document.getElementById("admin-store-update-body");
  const updateEmpty = document.getElementById("admin-store-update-empty");
  const updateError = document.getElementById("admin-store-update-error");
  const updatePagination = document.getElementById("admin-store-update-pagination");
  const updateSearch = document.getElementById("admin-store-update-search");
  const updateSort = document.getElementById("admin-store-update-sort");

  const diffCard = document.getElementById("admin-store-diff-card");
  const diffTitle = document.getElementById("admin-store-diff-title");
  const diffOld = document.getElementById("admin-store-diff-old");
  const diffNew = document.getElementById("admin-store-diff-new");
  const diffClose = document.getElementById("admin-store-diff-close");
  const previewCard = document.getElementById("admin-store-preview-card");
  const previewClose = document.getElementById("admin-store-preview-close");
  const previewMedia = document.getElementById("admin-store-preview-media");
  const previewName = document.getElementById("admin-store-preview-name");
  const previewMeta = document.getElementById("admin-store-preview-meta");
  const previewOwner = document.getElementById("admin-store-preview-owner");
  const previewTags = document.getElementById("admin-store-preview-tags");
  const previewShort = document.getElementById("admin-store-preview-short");
  const previewLong = document.getElementById("admin-store-preview-long");

  if (!approveBody || !updateBody) return;

  const state = {
    approve: { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", sort: "recent" },
    update: { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", sort: "recent" },
    categories: null,
    metricsEtag: "",
    metricsCache: null,
  };

  const showToast = (message) => {
    if (!message) return;
    if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
      window.BKAuth.showToast(message);
      return;
    }
    window.alert(message);
  };

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const normalizeText = (value) => String(value || "").toLowerCase();

  const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

  const formatVnd = (value) => {
    const amount = Number(value) || 0;
    if (typeof formatPrice === "function") return formatPrice(amount);
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const formatDateLabel = (value) => {
    const date = parseDateValue(value);
    if (!date) return "--";
    return date.toLocaleDateString("vi-VN");
  };

  const getStoreInitials = (value) => {
    const text = String(value || "").trim();
    if (!text) return "BK";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const statusTag = (status) => {
    const map = {
      approved: { label: "Đã duyệt", className: "good" },
      active: { label: "Đã duyệt", className: "good" },
      published: { label: "Đã duyệt", className: "good" },
      pending: { label: "Chờ duyệt", className: "warn" },
      pending_update: { label: "Chờ duyệt sửa", className: "warn" },
      rejected: { label: "Từ chối", className: "bad" },
    };
    const value = String(status || "").toLowerCase();
    const item = map[value] || { label: value || "--", className: "warn" };
    return `<span class="seller-tag ${item.className}">${escapeHtml(item.label)}</span>`;
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
    if (!window.BKAuth || typeof window.BKAuth.read !== "function") return {};
    const auth = window.BKAuth.read();
    if (!auth || !auth.loggedIn) return {};
    const user = auth.user || {};
    const headers = {};
    if (user.id != null) headers["x-user-id"] = String(user.id);
    if (user.email) headers["x-user-email"] = String(user.email);
    if (user.username) headers["x-user-username"] = String(user.username);
    return headers;
  };

  const buildHeaders = (json = false) => {
    const headers = { ...getUserHeaders() };
    const admin = getAdminHeaders();
    if (admin) Object.assign(headers, admin);
    if (json) headers["content-type"] = "application/json";
    return headers;
  };

  const fetchJson = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = (data && data.error) || "REQUEST_FAILED";
      const err = new Error(error);
      err.status = response.status;
      throw err;
    }
    return { data, response };
  };

  const loadCategories = async () => {
    if (state.categories) return state.categories;
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload || payload.ok === false) throw new Error("FETCH_FAILED");
      state.categories = payload.categories || { products: [], services: [] };
    } catch (error) {
      state.categories = { products: [], services: [] };
    }
    return state.categories;
  };

  const translate = (key, fallback) =>
    typeof formatI18n === "function" ? formatI18n(typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi", key, fallback) : fallback || key;

  const formatCategoryLabel = (type, categoryId, categories) => {
    const list = type === "service" ? categories.services || [] : categories.products || [];
    const category = list.find((item) => String(item.id) === String(categoryId)) || null;
    if (!category) return categoryId || "--";
    return category.labelKey ? translate(category.labelKey, category.label || category.id) : category.label || category.id;
  };

  const formatTagLabels = (type, categoryId, tags, categories) => {
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

  const renderTableSkeleton = (tbody, columns, rows = 3) => {
    if (!tbody) return;
    const lines = Array.from({ length: rows }, () => `<div class="skeleton skeleton-line"></div>`).join("");
    tbody.innerHTML = `<tr><td colspan="${columns}"><div class="table-skeleton">${lines}</div></td></tr>`;
  };

  const renderPagination = (container, page, totalPages, onChange) => {
    if (!container) return;
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const pages = [];
    const pushPage = (value) => {
      if (!pages.includes(value)) pages.push(value);
    };
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i += 1) pushPage(i);
    } else {
      pushPage(1);
      if (page > 3) pages.push("...");
      for (let i = page - 1; i <= page + 1; i += 1) {
        if (i > 1 && i < totalPages) pushPage(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pushPage(totalPages);
    }
    pages.forEach((value) => {
      if (value === "...") {
        const span = document.createElement("span");
        span.className = "page-info";
        span.textContent = "...";
        container.appendChild(span);
        return;
      }
      const btn = document.createElement("button");
      btn.className = `btn sm ${value === page ? "primary" : "ghost"}`;
      btn.type = "button";
      btn.textContent = String(value);
      btn.addEventListener("click", () => onChange(value));
      container.appendChild(btn);
    });
  };

  const applyMetrics = (metrics) => {
    if (!metrics) return;
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText("admin-total-users", formatNumber(metrics.totalUsers));
    setText("admin-total-sellers", formatNumber(metrics.approvedSellers));
    setText("admin-pending-stores", formatNumber(metrics.pendingStores));
    setText("admin-pending-store-updates", formatNumber(metrics.pendingStoreUpdates));
    setText("admin-pending-finance", formatNumber(metrics.pendingTopups));
    setText("admin-pending-refunds", formatNumber(metrics.pendingRefunds || 0));
    setText("admin-pending-sellers", formatNumber(metrics.pendingSellers || 0));

    const pendingTopupLabel = `${formatNumber(metrics.pendingTopups)} y\u00eau c\u1ea7u`;
    const pendingWithdrawLabel = `${formatNumber(metrics.pendingWithdrawals || 0)} y\u00eau c\u1ea7u`;
    const pendingServiceLabel = `${formatNumber(metrics.pendingServiceRequests || 0)} y\u00eau c\u1ea7u`;

    setText("admin-pending-topup", pendingTopupLabel);
    setText("admin-pending-withdraw", pendingWithdrawLabel);
    setText("admin-pending-service", pendingServiceLabel);

    setText("admin-task-finance", pendingTopupLabel);
    setText("admin-task-stores", `${formatNumber(metrics.pendingStores)} y\u00eau c\u1ea7u`);
    setText("admin-task-approvals", `${formatNumber(metrics.pendingSellers || 0)} y\u00eau c\u1ea7u`);
    setText("admin-task-refunds", `${formatNumber(metrics.pendingRefunds || 0)} y\u00eau c\u1ea7u`);

    if (metrics.revenueToday != null) {
      setText("admin-revenue-today", formatVnd(metrics.revenueToday));
      setText("admin-mini-revenue", formatVnd(metrics.revenueToday));
    }
    if (metrics.revenueTotal != null) {
      setText("admin-revenue-total", formatVnd(metrics.revenueTotal));
    }

    setText("admin-mini-active-users", formatNumber(metrics.totalUsers));
  };

  const loadMetrics = async () => {
    const headers = buildHeaders();
    const fetchOptions = { headers, cache: "no-store" };
    if (state.metricsEtag) fetchOptions.headers["If-None-Match"] = state.metricsEtag;
    try {
      const response = await fetch("/api/admin/metrics", fetchOptions);
      if (response.status === 304 && state.metricsCache) {
        applyMetrics(state.metricsCache);
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok === false) return;
      state.metricsCache = data.metrics || null;
      const etag = response.headers.get("etag") || response.headers.get("ETag") || "";
      if (etag) state.metricsEtag = etag;
      applyMetrics(state.metricsCache);
    } catch (error) {
      // ignore metrics errors
    }
  };

  const filterStores = (items, query) => {
    const term = normalizeText(query);
    if (!term) return items;
    return items.filter((store) => {
      const owner = store.owner || {};
      return (
        normalizeText(store.name).includes(term) ||
        normalizeText(store.slug).includes(term) ||
        normalizeText(owner.displayName).includes(term) ||
        normalizeText(owner.username).includes(term)
      );
    });
  };

  const sortStores = (items, sortKey) => {
    const list = items.slice();
    if (sortKey === "rating") {
      return list.sort((a, b) => (Number(b.rating || 0) || 0) - (Number(a.rating || 0) || 0));
    }
    return list.sort((a, b) => {
      const aDate = parseDateValue(a.createdAt || a.updatedAt) || new Date(0);
      const bDate = parseDateValue(b.createdAt || b.updatedAt) || new Date(0);
      return bDate - aDate;
    });
  };

  const renderApproveList = async () => {
    if (state.approve.loading) {
      renderTableSkeleton(approveBody, 5, 3);
      if (approveEmpty) approveEmpty.classList.add("is-hidden");
      if (approveError) approveError.classList.add("is-hidden");
      if (approvePagination) approvePagination.innerHTML = "";
      return;
    }
    if (state.approve.error) {
      approveBody.innerHTML = "";
      if (approveEmpty) approveEmpty.classList.add("is-hidden");
      if (approveError) approveError.classList.remove("is-hidden");
      if (approvePagination) approvePagination.innerHTML = "";
      return;
    }

    let items = filterStores(state.approve.data, state.approve.search);
    items = sortStores(items, state.approve.sort);

    const totalPages = Math.max(1, Math.ceil(items.length / state.approve.perPage));
    state.approve.page = Math.min(state.approve.page, totalPages);
    const start = (state.approve.page - 1) * state.approve.perPage;
    const pageItems = items.slice(start, start + state.approve.perPage);

    if (!pageItems.length) {
      approveBody.innerHTML = "";
      if (approveEmpty) approveEmpty.classList.remove("is-hidden");
      if (approveError) approveError.classList.add("is-hidden");
      if (approvePagination) approvePagination.innerHTML = "";
      return;
    }
    if (approveEmpty) approveEmpty.classList.add("is-hidden");
    if (approveError) approveError.classList.add("is-hidden");

    const categories = await loadCategories();

    approveBody.innerHTML = pageItems
      .map((store) => {
        const owner = store.owner || {};
        const type = store.storeType || "product";
        const categoryLabel = formatCategoryLabel(type, store.category, categories);
        const tagLabels = formatTagLabels(type, store.category, store.tags || (store.subcategory ? [store.subcategory] : []), categories);
        const categoryText = [type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m", categoryLabel]
          .filter(Boolean)
          .join(" \u2022 ");
        const tagsText = tagLabels.length ? ` <div class="form-hint">${escapeHtml(tagLabels.join(", "))}</div>` : "";
        return `
          <tr data-store-id="${escapeHtml(store.id)}">
            <td><strong>${escapeHtml(store.name || "--")}</strong><div class="form-hint">${escapeHtml(store.slug || store.id)}</div></td>
            <td>${escapeHtml(owner.displayName || owner.username || "--")}</td>
            <td>${escapeHtml(categoryText)}${tagsText}</td>
            <td><span class="seller-tag warn">pending</span></td>
            <td class="admin-store-actions">
              <button class="btn sm ghost" type="button" data-action="preview">Xem</button>
              <button class="btn sm" type="button" data-action="approve">Duy\u1ec7t</button>
              <button class="btn sm ghost" type="button" data-action="reject">T\u1eeb ch\u1ed1i</button>
            </td>
          </tr>
        `;
      })
      .join("");

    renderPagination(approvePagination, state.approve.page, totalPages, (nextPage) => {
      state.approve.page = nextPage;
      renderApproveList();
    });
  };

  const renderUpdateList = async () => {
    if (state.update.loading) {
      renderTableSkeleton(updateBody, 5, 3);
      if (updateEmpty) updateEmpty.classList.add("is-hidden");
      if (updateError) updateError.classList.add("is-hidden");
      if (updatePagination) updatePagination.innerHTML = "";
      return;
    }
    if (state.update.error) {
      updateBody.innerHTML = "";
      if (updateEmpty) updateEmpty.classList.add("is-hidden");
      if (updateError) updateError.classList.remove("is-hidden");
      if (updatePagination) updatePagination.innerHTML = "";
      return;
    }

    let items = filterStores(state.update.data, state.update.search);
    items = sortStores(items, state.update.sort);

    const totalPages = Math.max(1, Math.ceil(items.length / state.update.perPage));
    state.update.page = Math.min(state.update.page, totalPages);
    const start = (state.update.page - 1) * state.update.perPage;
    const pageItems = items.slice(start, start + state.update.perPage);

    if (!pageItems.length) {
      updateBody.innerHTML = "";
      if (updateEmpty) updateEmpty.classList.remove("is-hidden");
      if (updateError) updateError.classList.add("is-hidden");
      if (updatePagination) updatePagination.innerHTML = "";
      return;
    }
    if (updateEmpty) updateEmpty.classList.add("is-hidden");
    if (updateError) updateError.classList.add("is-hidden");

    const categories = await loadCategories();

    updateBody.innerHTML = pageItems
      .map((store) => {
        const owner = store.owner || {};
        const type = store.storeType || "product";
        const categoryLabel = formatCategoryLabel(type, store.category, categories);
        const tagLabels = formatTagLabels(type, store.category, store.tags || (store.subcategory ? [store.subcategory] : []), categories);
        const categoryText = [type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m", categoryLabel]
          .filter(Boolean)
          .join(" \u2022 ");
        const tagsText = tagLabels.length ? ` <div class="form-hint">${escapeHtml(tagLabels.join(", "))}</div>` : "";
        const submittedAt = store.pendingChange && store.pendingChange.submittedAt ? store.pendingChange.submittedAt : store.updatedAt;
        return `
          <tr data-store-id="${escapeHtml(store.id)}">
            <td><strong>${escapeHtml(store.name || "--")}</strong><div class="form-hint">${escapeHtml(store.slug || store.id)}</div></td>
            <td>${escapeHtml(owner.displayName || owner.username || "--")}</td>
            <td>${escapeHtml(categoryText)}${tagsText}</td>
            <td>${escapeHtml(formatDateLabel(submittedAt))}</td>
            <td class="admin-store-actions">
              <button class="btn sm ghost" type="button" data-action="preview">Xem</button>
              <button class="btn sm ghost" type="button" data-action="diff">So sánh</button>
              <button class="btn sm" type="button" data-action="approve">Duy\u1ec7t</button>
              <button class="btn sm ghost" type="button" data-action="reject">T\u1eeb ch\u1ed1i</button>
            </td>
          </tr>
        `;
      })
      .join("");

    renderPagination(updatePagination, state.update.page, totalPages, (nextPage) => {
      state.update.page = nextPage;
      renderUpdateList();
    });
  };

  const setDiffCard = async (store) => {
    if (!diffCard || !diffOld || !diffNew) return;
    const categories = await loadCategories();
    const type = store.storeType || "product";
    const pending = store.pendingChange || {};
    const pendingTags = (() => {
      if (Array.isArray(pending.tags)) return pending.tags;
      if (pending.tags_json) {
        try {
          return JSON.parse(pending.tags_json) || [];
        } catch (error) {
          return [];
        }
      }
      return [];
    })();

    const buildBlock = (data, tagList) => {
      const categoryLabel = formatCategoryLabel(type, data.category || store.category, categories);
      const tagLabels = formatTagLabels(type, data.category || store.category, tagList || store.tags || [], categories);
      const rows = [
        { label: "T\u00ean", value: data.store_name || data.name || store.name },
        {
          label: "Danh m\u1ee5c",
          value: [type === "service" ? "D\u1ecbch v\u1ee5" : "S\u1ea3n ph\u1ea9m", categoryLabel].filter(Boolean).join(" \u2022 "),
        },
        { label: "Th\u1ebb", value: tagLabels.length ? tagLabels.join(", ") : "--" },
        { label: "M\u00f4 t\u1ea3 ng\u1eafn", value: data.short_desc || data.descriptionShort || store.descriptionShort || "" },
        { label: "M\u00f4 t\u1ea3 chi ti\u1ebft", value: data.long_desc || data.descriptionLong || store.descriptionLong || "" },
      ];
      return rows
        .map((row) => `<div class="diff-row"><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value || "--")}</div>`)
        .join("");
    };

    diffOld.innerHTML = buildBlock(store, store.tags || (store.subcategory ? [store.subcategory] : []));
    diffNew.innerHTML = buildBlock(pending, pendingTags.length ? pendingTags : store.tags || []);
    if (diffTitle) diffTitle.textContent = `So s\u00e1nh thay \u0111\u1ed5i: ${store.name || store.id}`;
    diffCard.classList.remove("is-hidden");
  };

  const hideDiff = () => {
    if (diffCard) diffCard.classList.add("is-hidden");
  };

  const hidePreview = () => {
    if (previewCard) previewCard.classList.add("is-hidden");
  };

  const setPreviewCard = async (store) => {
    if (!previewCard || !store) return;
    const categories = await loadCategories();
    const type = store.storeType || "product";
    const typeLabel = type === "service" ? "Dịch vụ" : "Sản phẩm";
    const categoryLabel = formatCategoryLabel(type, store.category, categories);
    const tagLabels = formatTagLabels(type, store.category, store.tags || (store.subcategory ? [store.subcategory] : []), categories);
    const owner = store.owner || {};
    const ownerName = owner.displayName || owner.username || "--";
    const titleParts = [];
    if (owner.title) titleParts.push(owner.title);
    if (owner.rank) titleParts.push(owner.rank);
    const titleLabel = titleParts.length ? ` • ${titleParts.join(" • ")}` : "";

    if (previewMedia) {
      if (store.avatarUrl) {
        previewMedia.innerHTML = `<img src="${escapeHtml(store.avatarUrl)}" alt="${escapeHtml(store.name || "Shop")}" loading="lazy" />`;
      } else {
        const initials = getStoreInitials(store.name || ownerName);
        previewMedia.innerHTML = `<div class="preview-fallback">${escapeHtml(initials)}</div>`;
      }
    }
    if (previewName) previewName.textContent = store.name || "--";
    if (previewMeta) {
      const categoryText = [typeLabel, categoryLabel].filter(Boolean).join(" • ");
      previewMeta.innerHTML = `<span>${escapeHtml(categoryText)}</span>${statusTag(store.status)}`;
    }
    if (previewOwner) {
      previewOwner.innerHTML = `<span>Seller: <strong>${escapeHtml(ownerName)}</strong>${escapeHtml(titleLabel)}</span>`;
    }
    if (previewTags) {
      previewTags.textContent = tagLabels.length ? `Thẻ: ${tagLabels.join(", ")}` : "Thẻ: --";
    }
    if (previewShort) previewShort.textContent = store.descriptionShort || "";
    if (previewLong) previewLong.textContent = store.descriptionLong || "";
    if (diffCard) diffCard.classList.add("is-hidden");
    previewCard.classList.remove("is-hidden");
    try {
      document.dispatchEvent(
        new CustomEvent("store-images:open", {
          detail: { shopId: store.id, isAdmin: true },
        })
      );
    } catch (error) {}
  };

  const removeFromState = (storeId, targetState) => {
    const index = targetState.data.findIndex((item) => String(item.id) === String(storeId));
    if (index < 0) return null;
    const removed = targetState.data.splice(index, 1)[0];
    return removed;
  };

  const restoreToState = (store, targetState) => {
    if (!store) return;
    targetState.data.unshift(store);
  };

  const approveStore = async (storeId, listType) => {
    const targetState = listType === "update" ? state.update : state.approve;
    const backup = removeFromState(storeId, targetState);
    await renderApproveList();
    await renderUpdateList();
    try {
      await fetchJson(`/api/admin/stores/${encodeURIComponent(storeId)}/approve`, {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify({}),
      });
      showToast("\u0110\u00e3 duy\u1ec7t gian h\u00e0ng.");
      await loadMetrics();
      return;
    } catch (error) {
      restoreToState(backup, targetState);
      await renderApproveList();
      await renderUpdateList();
      showToast("Kh\u00f4ng th\u1ec3 duy\u1ec7t gian h\u00e0ng.");
    }
  };

  const rejectStore = async (storeId, listType) => {
    const reason = window.prompt("L\u00fd do t\u1eeb ch\u1ed1i", "Gian h\u00e0ng ch\u01b0a \u0111\u1ea1t y\u00eau c\u1ea7u");
    if (reason == null) return;
    const targetState = listType === "update" ? state.update : state.approve;
    const backup = removeFromState(storeId, targetState);
    await renderApproveList();
    await renderUpdateList();
    try {
      await fetchJson(`/api/admin/stores/${encodeURIComponent(storeId)}/reject`, {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify({ reason: reason || "Gian h\u00e0ng ch\u01b0a \u0111\u1ea1t y\u00eau c\u1ea7u" }),
      });
      showToast("\u0110\u00e3 t\u1eeb ch\u1ed1i gian h\u00e0ng.");
      await loadMetrics();
      return;
    } catch (error) {
      restoreToState(backup, targetState);
      await renderApproveList();
      await renderUpdateList();
      showToast("Kh\u00f4ng th\u1ec3 t\u1eeb ch\u1ed1i gian h\u00e0ng.");
    }
  };

  const loadStores = async () => {
    state.approve.loading = true;
    state.update.loading = true;
    state.approve.error = false;
    state.update.error = false;
    renderApproveList();
    renderUpdateList();
    const headers = buildHeaders();
    try {
      const [pending, updates] = await Promise.all([
        fetchJson("/api/admin/shops?status=pending&perPage=100", { headers, cache: "no-store" }),
        fetchJson("/api/admin/shops?status=pending_update&perPage=100", { headers, cache: "no-store" }),
      ]);
      state.approve.data = pending.data.items || [];
      state.update.data = updates.data.items || [];
      state.approve.loading = false;
      state.update.loading = false;
      state.approve.error = false;
      state.update.error = false;
      renderApproveList();
      renderUpdateList();
      await loadMetrics();
    } catch (error) {
      state.approve.loading = false;
      state.update.loading = false;
      state.approve.error = true;
      state.update.error = true;
      renderApproveList();
      renderUpdateList();
      showToast("Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch gian h\u00e0ng.");
    }
  };

  if (approveSearch) {
    approveSearch.addEventListener("input", () => {
      state.approve.search = approveSearch.value || "";
      state.approve.page = 1;
      renderApproveList();
    });
  }
  if (approveSort) {
    approveSort.addEventListener("change", () => {
      state.approve.sort = approveSort.value || "recent";
      state.approve.page = 1;
      renderApproveList();
    });
  }
  if (updateSearch) {
    updateSearch.addEventListener("input", () => {
      state.update.search = updateSearch.value || "";
      state.update.page = 1;
      renderUpdateList();
    });
  }
  if (updateSort) {
    updateSort.addEventListener("change", () => {
      state.update.sort = updateSort.value || "recent";
      state.update.page = 1;
      renderUpdateList();
    });
  }

  approveBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("tr[data-store-id]");
    if (!row) return;
    const storeId = row.getAttribute("data-store-id");
    if (!storeId) return;
    const action = button.getAttribute("data-action");
    const store = state.approve.data.find((item) => String(item.id) === String(storeId));
    if (action === "approve") approveStore(storeId, "approve");
    if (action === "preview" && store) setPreviewCard(store);
    if (action === "reject") rejectStore(storeId, "approve");
  });

  updateBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("tr[data-store-id]");
    if (!row) return;
    const storeId = row.getAttribute("data-store-id");
    if (!storeId) return;
    const action = button.getAttribute("data-action");
    const store = state.update.data.find((item) => String(item.id) === String(storeId));
    if (!store) return;
    if (action === "preview") setPreviewCard(store);
    if (action === "diff") {
      hidePreview();
      setDiffCard(store);
    }
    if (action === "approve") approveStore(storeId, "update");
    if (action === "reject") rejectStore(storeId, "update");
  });

  if (diffClose) {
    diffClose.addEventListener("click", hideDiff);
  }

  if (previewClose) {
    previewClose.addEventListener("click", hidePreview);
  }

  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener("click", async () => {
      if (!state.approve.data.length) return;
      const confirmed = window.confirm("Duy\u1ec7t t\u1ea5t c\u1ea3 gian h\u00e0ng ch\u1edd duy\u1ec7t?");
      if (!confirmed) return;
      for (const store of [...state.approve.data]) {
        await approveStore(store.id, "approve");
      }
    });
  }

  loadStores();
})();
