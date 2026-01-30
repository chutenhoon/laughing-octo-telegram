(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const services = window.BKPanelData ? window.BKPanelData.services : null;
    if (!services) return;

    const modal = document.getElementById("seller-modal");
    const modalTitle = document.getElementById("seller-modal-title");
    const modalDesc = document.getElementById("seller-modal-desc");
    const modalField = document.getElementById("seller-modal-field");
    const modalLabel = document.getElementById("seller-modal-label");
    const modalInput = document.getElementById("seller-modal-input");
    const modalCancel = document.getElementById("seller-modal-cancel");
    const modalConfirm = document.getElementById("seller-modal-confirm");
    let modalConfirmHandler = null;

    const closeModal = () => {
      if (!modal) return;
      modal.classList.remove("open");
      if (document.body) document.body.classList.remove("modal-open");
      modalConfirmHandler = null;
    };

    const openModal = ({ title, message, inputLabel, inputPlaceholder, confirmText, onConfirm }) => {
      if (!modal) return;
      if (modalTitle) modalTitle.textContent = title || "";
      if (modalDesc) modalDesc.textContent = message || "";
      if (modalField) {
        const hasInput = Boolean(inputLabel);
        modalField.classList.toggle("is-hidden", !hasInput);
        if (hasInput && modalLabel) modalLabel.textContent = inputLabel;
      }
      if (modalInput) {
        modalInput.value = "";
        if (inputPlaceholder) modalInput.placeholder = inputPlaceholder;
      }
      if (modalConfirm) modalConfirm.textContent = confirmText || "X\u00e1c nh\u1eadn";
      modalConfirmHandler = typeof onConfirm === "function" ? onConfirm : null;
      modal.classList.add("open");
      if (document.body) document.body.classList.add("modal-open");
    };
    window.BKSellerModal = { open: openModal };

    if (modalCancel) modalCancel.addEventListener("click", closeModal);
    if (modalConfirm) {
      modalConfirm.addEventListener("click", () => {
        const note = modalInput ? modalInput.value.trim() : "";
        if (modalConfirmHandler) modalConfirmHandler(note);
        closeModal();
      });
    }
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const toast = document.getElementById("seller-toast");
    const toastText = document.getElementById("seller-toast-text");
    let toastTimer = null;
    const showToast = (message) => {
      if (!toast || !toastText) return;
      toastText.textContent = message;
      toast.classList.add("show");
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
    };
    window.BKSellerToast = { show: showToast };
    const handleAuthError = (error) => {
      const status = error && typeof error.status === "number" ? error.status : 0;
      const code = error && error.message ? error.message : "";
      if (status === 401 || code === "AUTH_REQUIRED") {
        showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        if (window.BKAuth && typeof window.BKAuth.redirectToLogin === "function") {
          window.setTimeout(() => window.BKAuth.redirectToLogin(), 600);
        }
        return true;
      }
      return false;
    };
    const resolveLoadError = (error, fallback) => {
      const code = error && error.message ? error.message : "";
      if (code === "AUTH_REQUIRED") return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      if (code === "SELLER_REQUIRED") return "Tài khoản chưa được duyệt seller.";
      if (code === "ACCOUNT_DISABLED") return "Tài khoản đang bị khóa.";
      return fallback || "Không thể tải dữ liệu. Vui lòng thử lại.";
    };
    const getLanguage = () => (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi");
    const t = (key, fallback) =>
      typeof formatI18n === "function" ? formatI18n(getLanguage(), key, fallback) : fallback || key;
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

    const formatVnd = (value) => {
      const amount = Number(value) || 0;
      if (typeof formatPrice === "function") return formatPrice(amount);
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const escapeHtml = (value) =>
      String(value || "").replace(/[&<>"']/g, (char) => {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
        return map[char] || char;
      });

    const normalizeText = (value) => String(value || "").toLowerCase();

    const parseDateValue = (value) => {
      if (!value) return null;
      if (typeof value !== "string") return new Date(value);
      if (value.includes("/")) {
        const parts = value.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return new Date(`${year}-${month}-${day}`);
        }
      }
      return new Date(value);
    };

    const paginate = (items, page, perPage) => {
      const totalPages = Math.max(1, Math.ceil(items.length / perPage));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const start = (safePage - 1) * perPage;
      return { pageItems: items.slice(start, start + perPage), totalPages, page: safePage };
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

    const renderTableSkeleton = (tbody, columns, rows = 3) => {
      if (!tbody) return;
      const lines = Array.from({ length: rows }, () => `<div class="skeleton skeleton-line"></div>`).join("");
      tbody.innerHTML = `<tr><td colspan="${columns}"><div class="table-skeleton">${lines}</div></td></tr>`;
    };

    const renderCardSkeleton = (container, count = 4) => {
      if (!container) return;
      const card = `
        <div class="seller-card seller-shop-card">
          <div class="skeleton" style="height: 120px; border-radius: 12px;"></div>
          <div class="skeleton skeleton-title" style="margin-top: 12px;"></div>
          <div class="skeleton skeleton-line" style="margin-top: 10px;"></div>
          <div class="skeleton skeleton-line" style="margin-top: 8px; width: 70%;"></div>
        </div>
      `;
      container.innerHTML = Array.from({ length: count }, () => card).join("");
    };

    const loadList = (state, loader, render, options = {}) => {
      state.loading = true;
      render();
      loader()
        .then((data) => {
          state.data = data || [];
          state.loading = false;
          state.error = false;
          render();
        })
        .catch((error) => {
          state.loading = false;
          state.error = true;
          render();
          const handled = handleAuthError(error);
          if (!handled && options && typeof options.onError === "function") {
            options.onError(error);
          }
        });
    };

    const storeState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", sort: "recent" };
    const productState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", store: "all", sort: "recent" };
    const orderState = {
      data: [],
      loading: true,
      error: false,
      page: 1,
      perPage: 6,
      search: "",
      status: "all",
      store: "all",
      sort: "recent",
      startDate: "",
      endDate: "",
    };
    const refundState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", type: "all", sort: "recent" };
    const preorderState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", sort: "recent" };
    const couponState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", sort: "recent", store: "all" };
    const complaintState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", level: "all", sort: "recent" };
    const reviewState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", store: "all", sort: "recent" };
    const withdrawState = { data: [], loading: true, error: false, page: 1, perPage: 15, search: "", status: "all", sort: "recent" };

    const inventoryState = {
      productId: null,
      loading: false,
      items: [],
      history: [],
      tab: "list",
      page: 1,
      perPage: 6,
      historyPage: 1,
      search: "",
      sort: "newest",
    };
    const variantState = { productId: null, storeId: null, loading: false, data: [], page: 1, perPage: 6, search: "", sort: "recent" };

    let inventorySnapshot = [];
    let storeMap = new Map();

    const ratingValue = document.getElementById("seller-latest-rating");
    const ratingNote = document.getElementById("seller-latest-rating-note");
    const totalReviews = document.getElementById("seller-total-reviews");

    const storeGrid = document.getElementById("seller-shop-grid");
    const storeEmpty = document.getElementById("store-empty");
    const storeError = document.getElementById("store-error");
    const storeRetryBtn = document.getElementById("store-retry");
    const storePagination = document.getElementById("store-pagination");
    const storeSearch = document.getElementById("store-search");
    const storeStatusFilter = document.getElementById("store-filter-status");
    const storeSort = document.getElementById("store-sort");
    const storeCreateBtn = document.getElementById("store-create-btn");
    const storeEditorCard = document.getElementById("store-editor-card");
    const storeEditorId = document.getElementById("store-editor-id");
    const storeEditorTitle = document.getElementById("store-editor-title");
    const storeNameInput = document.getElementById("store-name");
    const storeCategorySelect = document.getElementById("store-category");
    const storeShortDesc = document.getElementById("store-short-desc");
    const storeLongDesc = document.getElementById("store-long-desc");
    const storeApprovalNote = document.getElementById("store-approval-note");
    const storeSaveBtn = document.getElementById("store-save-btn");
    const storeCancelBtn = document.getElementById("store-cancel-btn");
    const storeAvatar = document.getElementById("store-avatar");
    const storeAvatarPreview = document.getElementById("store-avatar-preview");
    const storeAvatarPreviewWrap = document.getElementById("store-avatar-preview-wrap");

    const productCreateBtn = document.getElementById("product-create-btn");
    const productSearch = document.getElementById("product-search");
    const productStoreFilter = document.getElementById("product-store-filter");
    const productSort = document.getElementById("product-sort");
    const productTableBody = document.getElementById("product-table-body");
    const productEmpty = document.getElementById("product-empty");
    const productError = document.getElementById("product-error");
    const productPagination = document.getElementById("product-pagination");
    const productEditorCard = document.getElementById("product-editor-card");
    const productEditorId = document.getElementById("product-editor-id");
    const productEditorTitle = document.getElementById("product-editor-title");
    const productStoreSelect = document.getElementById("product-store");
    const productNameInput = document.getElementById("product-name");
    const productPriceInput = document.getElementById("product-price");
    const productTypeSelect = document.getElementById("product-type");
    const productStockFormat = document.getElementById("product-stock-format");
    const productActiveCheckbox = document.getElementById("product-active");
    const productPublishedCheckbox = document.getElementById("product-published");
    const productApprovalNote = document.getElementById("product-approval-note");

    const useProductV2 = Boolean(document.getElementById("seller-product-groups"));
    let renderProducts = null;
    const productSaveBtn = document.getElementById("product-save-btn");
    const productCancelBtn = document.getElementById("product-cancel-btn");

    const inventoryCard = document.getElementById("inventory-card");
    const inventorySub = document.getElementById("inventory-sub");
    const inventoryClose = document.getElementById("inventory-close");
    const inventoryTabs = inventoryCard ? inventoryCard.querySelectorAll(".sort-pill[data-tab]") : [];
    const inventoryPanels = inventoryCard ? inventoryCard.querySelectorAll(".stock-tab") : [];
    const inventorySearch = document.getElementById("inventory-search");
    const inventorySort = document.getElementById("inventory-sort");
    const inventoryTableBody = document.getElementById("inventory-table-body");
    const inventoryEmpty = document.getElementById("inventory-empty");
    const inventoryPagination = document.getElementById("inventory-pagination");
    const inventoryInput = document.getElementById("inventory-input");
    const inventoryUploadBtn = document.getElementById("inventory-upload-btn");
    const inventoryUploadClose = document.getElementById("inventory-upload-close");
    const inventoryDownloadBtn = document.getElementById("inventory-download-btn");
    const inventoryExportBtn = document.getElementById("inventory-export-btn");
    const inventoryDeleteBtn = document.getElementById("inventory-delete-btn");
    const inventoryDeleteCount = document.getElementById("inventory-delete-count");
    const inventoryHistoryBody = document.getElementById("inventory-history-body");
    const inventoryHistoryEmpty = document.getElementById("inventory-history-empty");
    const inventoryHistoryPagination = document.getElementById("inventory-history-pagination");

    const variantCard = document.getElementById("variant-card");
    const variantSub = document.getElementById("variant-sub");
    const variantClose = document.getElementById("variant-close");
    const variantSearch = document.getElementById("variant-search");
    const variantSort = document.getElementById("variant-sort");
    const variantTableBody = document.getElementById("variant-table-body");
    const variantEmpty = document.getElementById("variant-empty");
    const variantPagination = document.getElementById("variant-pagination");
    const variantStoreSelect = document.getElementById("variant-store");
    const variantProductSelect = document.getElementById("variant-product");
    const variantNameInput = document.getElementById("variant-name");
    const variantPriceInput = document.getElementById("variant-price");
    const variantStockInput = document.getElementById("variant-stock");
    const variantStatusSelect = document.getElementById("variant-status");
    const variantShortDesc = document.getElementById("variant-short-desc");
    const variantSaveBtn = document.getElementById("variant-save-btn");
    const variantResetBtn = document.getElementById("variant-reset-btn");

    const orderExportBtn = document.getElementById("order-export-btn");
    const orderSearch = document.getElementById("order-search");
    const orderStatusFilter = document.getElementById("order-status-filter");
    const orderStoreFilter = document.getElementById("order-store-filter");
    const orderStartDate = document.getElementById("order-start-date");
    const orderEndDate = document.getElementById("order-end-date");
    const orderSort = document.getElementById("order-sort");
    const orderTableBody = document.getElementById("order-table-body");
    const orderEmpty = document.getElementById("order-empty");
    const orderError = document.getElementById("order-error");
    const orderPagination = document.getElementById("order-pagination");

    const refundExportBtn = document.getElementById("refund-export-btn");
    const refundSearch = document.getElementById("refund-search");
    const refundStatusFilter = document.getElementById("refund-status-filter");
    const refundTypeFilter = document.getElementById("refund-type-filter");
    const refundSort = document.getElementById("refund-sort");
    const refundTableBody = document.getElementById("refund-table-body");
    const refundEmpty = document.getElementById("refund-empty");
    const refundError = document.getElementById("refund-error");
    const refundPagination = document.getElementById("refund-pagination");

    const preorderResetBtn = document.getElementById("preorder-reset-btn");
    const preorderSearch = document.getElementById("preorder-search");
    const preorderStatusFilter = document.getElementById("preorder-status-filter");
    const preorderSort = document.getElementById("preorder-sort");
    const preorderTableBody = document.getElementById("preorder-table-body");
    const preorderEmpty = document.getElementById("preorder-empty");
    const preorderError = document.getElementById("preorder-error");
    const preorderPagination = document.getElementById("preorder-pagination");

    const couponCreateBtn = document.getElementById("coupon-create-btn");
    const couponStoreFilter = document.getElementById("coupon-store-filter");
    const couponStatusFilter = document.getElementById("coupon-status-filter");
    const couponSearch = document.getElementById("coupon-search");
    const couponSort = document.getElementById("coupon-sort");
    const couponTableBody = document.getElementById("coupon-table-body");
    const couponEmpty = document.getElementById("coupon-empty");
    const couponError = document.getElementById("coupon-error");
    const couponPagination = document.getElementById("coupon-pagination");

    const complaintFilterBtn = document.getElementById("complaint-filter-btn");
    const complaintSearch = document.getElementById("complaint-search");
    const complaintLevelFilter = document.getElementById("complaint-level-filter");
    const complaintSort = document.getElementById("complaint-sort");
    const complaintTableBody = document.getElementById("complaint-table-body");
    const complaintEmpty = document.getElementById("complaint-empty");
    const complaintError = document.getElementById("complaint-error");
    const complaintPagination = document.getElementById("complaint-pagination");

    const reviewExportBtn = document.getElementById("review-export-btn");
    const reviewStoreFilter = document.getElementById("review-store-filter");
    const reviewStatusFilter = document.getElementById("review-status-filter");
    const reviewSearch = document.getElementById("review-search");
    const reviewSort = document.getElementById("review-sort");
    const reviewTableBody = document.getElementById("review-table-body");
    const reviewEmpty = document.getElementById("review-empty");
    const reviewError = document.getElementById("review-error");
    const reviewPagination = document.getElementById("review-pagination");

    const balanceAvailable = document.getElementById("seller-balance-available");
    const balanceHold = document.getElementById("seller-balance-hold");
    const balanceTotal = document.getElementById("seller-balance-total");
    const paymentBank = document.getElementById("payment-bank");
    const paymentAccount = document.getElementById("payment-account");
    const paymentHolder = document.getElementById("payment-holder");
    const paymentSaveBtn = document.getElementById("payment-save-btn");
    const withdrawStatusFilter = document.getElementById("withdraw-status-filter");
    const withdrawSearch = document.getElementById("withdraw-search");
    const withdrawSort = document.getElementById("withdraw-sort");
    const withdrawTableBody = document.getElementById("withdraw-table-body");
    const withdrawEmpty = document.getElementById("withdraw-empty");
    const withdrawError = document.getElementById("withdraw-error");
    const withdrawPagination = document.getElementById("withdraw-pagination");

    const updateStoreOptions = () => {
      const stores = storeState.data || [];
      storeMap = new Map(stores.map((store) => [store.storeId, store]));
      const options = stores.map((store) => ({
        value: store.storeId,
        label: store.name,
      }));

      const fillSelect = (select, includeAll) => {
        if (!select) return;
        const current = select.value;
        select.innerHTML = "";
        if (includeAll) {
          const option = document.createElement("option");
          option.value = "all";
          option.textContent = "Tất cả";
          select.appendChild(option);
        }
        if (!options.length) {
          const empty = document.createElement("option");
          empty.value = "";
          empty.disabled = true;
          empty.textContent = "Chưa có dữ liệu";
          select.appendChild(empty);
        }
        options.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.value;
          option.textContent = item.label;
          select.appendChild(option);
        });
        if (current && Array.from(select.options).some((opt) => opt.value === current)) {
          select.value = current;
        }
      };

      fillSelect(productStoreFilter, true);
      fillSelect(orderStoreFilter, true);
      fillSelect(couponStoreFilter, true);
      fillSelect(reviewStoreFilter, true);
      fillSelect(productStoreSelect, false);
    };

    const renderStoreStatus = () => {
      if (!ratingValue || !ratingNote || !totalReviews) return;
      if (storeState.loading) {
        ratingValue.textContent = "--";
        ratingNote.textContent = "Đang tải dữ liệu...";
        totalReviews.textContent = "Tổng số đánh giá: --";
        return;
      }
      if (!storeState.data.length) {
        ratingValue.textContent = "--";
        ratingNote.textContent = "Chưa có dữ liệu";
        totalReviews.textContent = "Tổng số đánh giá: 0";
        return;
      }
      const latest = [...storeState.data].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      ratingValue.textContent = `${Number(latest.rating || 0).toFixed(1)}/5`;
      ratingNote.textContent = "Cập nhật gần đây";
      const total = storeState.data.reduce((sum, store) => sum + (Number(store.totalReviews) || 0), 0);
      totalReviews.textContent = `Tổng số đánh giá: ${total.toLocaleString("vi-VN")}`;
    };

    const renderStores = () => {
      if (!storeGrid) return;
      if (storeState.loading) {
        renderCardSkeleton(storeGrid, storeState.perPage);
        if (storeEmpty) storeEmpty.classList.add("is-hidden");
        if (storeError) storeError.classList.add("is-hidden");
        if (storePagination) storePagination.innerHTML = "";
        renderStoreStatus();
        return;
      }
      if (storeState.error) {
        storeGrid.innerHTML = "";
        if (storeEmpty) storeEmpty.classList.add("is-hidden");
        if (storeError) storeError.classList.remove("is-hidden");
        if (storePagination) storePagination.innerHTML = "";
        renderStoreStatus();
        return;
      }
      let items = [...storeState.data];
      const term = normalizeText(storeState.search);
      if (term) items = items.filter((store) => normalizeText(store.name).includes(term));
      if (storeState.status !== "all") items = items.filter((store) => store.approvalStatus === storeState.status);
      if (storeState.sort === "rating") items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      else if (storeState.sort === "orders") items.sort((a, b) => (b.orders || 0) - (a.orders || 0));
      else items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      const { pageItems, totalPages, page } = paginate(items, storeState.page, storeState.perPage);
      storeState.page = page;

      const statusMap = {
        approved: { label: "Đã duyệt", className: "good" },
        pending: { label: "Chờ duyệt", className: "warn" },
        pending_update: { label: "Chờ duyệt sửa", className: "warn" },
        rejected: { label: "Từ chối", className: "bad" },
        withdrawn: { label: "Đã rút", className: "warn" },
      };
      storeGrid.innerHTML = pageItems
        .map((store) => {
          const status = statusMap[store.approvalStatus] || statusMap.approved;
          const activeTag = store.active ? "good" : "warn";
          const activeLabel = store.active ? "Đang mở" : "Tạm đóng";
          const initials = getStoreInitials(store.name);
          const avatar = store.avatarUrl
            ? `<img src="${escapeHtml(store.avatarUrl)}" alt="Shop" loading="lazy" />`
            : `<div class="shop-avatar-fallback">${escapeHtml(initials)}</div>`;
          const cover = `<div class="seller-shop-media">${avatar}</div>`;
          const actionButton = `<button class="btn ghost" type="button" data-action="delete-store" data-store-id="${store.storeId}">Đóng</button>`;
          return `
            <div class="seller-card seller-shop-card">
              ${cover}
              <h3>${escapeHtml(store.name)}</h3>
              <p class="hero-sub">Kho: ${Number(store.stock || 0).toLocaleString("vi-VN")} &bull; Đơn hàng: ${Number(
                store.orders || 0
              ).toLocaleString("vi-VN")} &bull; Đánh giá: ${Number(store.rating || 0).toFixed(1)}</p>
              <div class="seller-inline-meta">
                <span>Trạng thái: <span class="seller-tag ${status.className}">${status.label}</span></span>
                <span>Hoạt động: <span class="seller-tag ${activeTag}">${activeLabel}</span></span>
              </div>
              <div class="seller-shop-actions">
                <button class="btn" type="button" data-action="edit-store" data-store-id="${store.storeId}">Chỉnh sửa</button>
                <button class="btn" type="button" data-action="view-products" data-store-id="${store.storeId}">Sản phẩm</button>
                ${actionButton}
              </div>
            </div>
          `;
        })
        .join("");

      if (storeEmpty) storeEmpty.classList.toggle("is-hidden", items.length > 0);
      if (storeError) storeError.classList.add("is-hidden");
      renderPagination(storePagination, page, totalPages, (nextPage) => {
        storeState.page = nextPage;
        renderStores();
      });
      renderStoreStatus();
    };

    const STORE_REFRESH_INTERVAL = 30000;
    let lastStoreRefresh = 0;
    let storeRefreshInFlight = false;
    const isShopsActive = () => Boolean(document.querySelector('.seller-section[data-view="shops"].active'));
    const refreshStores = (force = false) => {
      if (!storeGrid || !services || !services.stores || typeof services.stores.list !== "function") return;
      if (!isShopsActive()) return;
      const now = Date.now();
      if (!force && now - lastStoreRefresh < STORE_REFRESH_INTERVAL) return;
      if (storeRefreshInFlight) return;
      storeRefreshInFlight = true;
      services.stores
        .list()
        .then((data) => {
          storeState.data = data || [];
          storeState.loading = false;
          storeState.error = false;
          lastStoreRefresh = Date.now();
          renderStores();
          updateStoreOptions();
        })
        .catch(() => {
          storeState.loading = false;
          storeState.error = true;
          renderStores();
          showToast("Không thể tải danh sách gian hàng.");
        })
        .finally(() => {
          storeRefreshInFlight = false;
        });
    };

    const shopNavButtons = document.querySelectorAll('.seller-nav button[data-view="shops"]');
    shopNavButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        window.setTimeout(() => refreshStores(true), 0);
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshStores(false);
    });
    window.addEventListener("focus", () => refreshStores(false));

    const closeStoreEditor = () => {
      if (storeEditorCard) storeEditorCard.classList.add("is-hidden");
      if (storeApprovalNote) storeApprovalNote.style.display = "none";
      if (storeEditorId) storeEditorId.value = "";
      if (storeNameInput) storeNameInput.value = "";
      if (storeShortDesc) storeShortDesc.value = "";
      if (storeLongDesc) storeLongDesc.value = "";
      if (storeCategorySelect) storeCategorySelect.value = "";
      setStoreAvatarPreview("");
      if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
        window.BKStoreEditor.open(null);
        if (typeof window.BKStoreEditor.setDisabled === "function") {
          window.BKStoreEditor.setDisabled(false);
        }
      }
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

    const setStoreAvatarPreview = (url) => {
      if (!storeAvatarPreview) return;
      if (url) {
        storeAvatarPreview.src = url;
        if (storeAvatarPreviewWrap) storeAvatarPreviewWrap.classList.remove("is-empty");
      } else {
        storeAvatarPreview.removeAttribute("src");
        if (storeAvatarPreviewWrap) storeAvatarPreviewWrap.classList.add("is-empty");
      }
    };

    const openStoreEditor = (store) => {
      if (!storeEditorCard) return;
      const isEdit = Boolean(store);
      storeEditorCard.classList.remove("is-hidden");
      if (storeEditorTitle) {
        storeEditorTitle.textContent = isEdit ? "Chỉnh sửa gian hàng" : "Tạo gian hàng";
      }
      if (storeEditorId) storeEditorId.value = store ? store.storeId : "";
      if (storeNameInput) storeNameInput.value = store ? store.name : "";
      if (storeCategorySelect) {
        storeCategorySelect.value = store ? store.category : storeCategorySelect.value;
        storeCategorySelect.disabled = isEdit;
      }
      if (storeShortDesc) storeShortDesc.value = store ? store.shortDesc : "";
      if (storeLongDesc) storeLongDesc.value = store ? store.longDesc : "";
      setStoreAvatarPreview(store ? store.avatarUrl : "");
      try {
        document.dispatchEvent(
          new CustomEvent("store-images:open", {
            detail: { shopId: store ? store.storeId : "", isAdmin: false },
          })
        );
      } catch (error) {}
      if (storeAvatar) {
        storeAvatar.value = "";
      }
      if (storeApprovalNote) {
        if (store && store.approvalStatus !== "approved") {
          const statusMap = {
            pending: "Ch\u1edd duy\u1ec7t",
            pending_update: "Ch\u1edd duy\u1ec7t s\u1eeda",
            rejected: "T\u1eeb ch\u1ed1i",
            withdrawn: "\u0110\u00e3 r\u00fat",
          };
          const reason = store.reviewNote || store.lastReviewNote || "";
          const label = statusMap[store.approvalStatus] || "Ch\u1edd duy\u1ec7t";
          storeApprovalNote.style.display = "flex";
          storeApprovalNote.innerHTML = `<span>Tr\u1ea1ng th\u00e1i duy\u1ec7t:</span><span class="seller-tag warn">${label}</span>${
            reason ? `<span class="form-hint">${escapeHtml(reason)}</span>` : ""
          }`;
        } else {
          storeApprovalNote.style.display = "none";
        }
      }
      if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
        window.BKStoreEditor.open(store);
        if (typeof window.BKStoreEditor.setDisabled === "function") {
          window.BKStoreEditor.setDisabled(isEdit);
        }
      }
    };

    const getCreateUrl = () => {
      const root = window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";
      const suffix = window.location.protocol === "file:" ? "index.html" : "";
      return `${root}seller/panel/create/${suffix}`;
    };
    const getEditUrl = (storeId) => {
      const base = getCreateUrl();
      return storeId ? `${base}?id=${encodeURIComponent(storeId)}` : base;
    };
    if (storeCreateBtn) {
      storeCreateBtn.addEventListener("click", () => {
        window.location.href = getCreateUrl();
      });
    }
    if (storeCancelBtn) {
      storeCancelBtn.addEventListener("click", closeStoreEditor);
    }
    if (storeSaveBtn) {
      storeSaveBtn.addEventListener("click", () => {
        const name = storeNameInput ? storeNameInput.value.trim() : "";
        if (!name) {
          showToast("Vui lòng nhập tên gian hàng.");
          return;
        }
        const storeId = storeEditorId ? storeEditorId.value : "";
        if (!storeId) {
          showToast("Vui lòng tạo gian hàng tại trang Tạo gian hàng.");
          window.location.href = getCreateUrl();
          return;
        }
        const selection =
          window.BKStoreEditor && typeof window.BKStoreEditor.getSelection === "function"
            ? window.BKStoreEditor.getSelection()
            : { storeType: "", category: "", tags: [], subcategory: "" };
        if (!selection.storeType) {
          showToast("Vui lòng chọn loại gian hàng.");
          return;
        }
        if (!selection.category) {
          showToast("Vui lòng chọn danh mục.");
          return;
        }
        const payload = {
          name,
          storeType: selection.storeType,
          category: selection.category,
          subcategory: selection.subcategory || "",
          tags: selection.tags || [],
          shortDesc: storeShortDesc ? storeShortDesc.value.trim() : "",
          longDesc: storeLongDesc ? storeLongDesc.value.trim() : "",
        };
        openModal({
          title: "Lưu thay đổi?",
          message: "Yêu cầu cập nhật sẽ được gửi đi để duyệt.",
          confirmText: "Xác nhận",
          onConfirm: async () => {
            if (storeSaveBtn) {
              storeSaveBtn.disabled = true;
              storeSaveBtn.setAttribute("aria-busy", "true");
            }
            try {
              const saved = await services.stores.requestUpdate(storeId, payload);
              showToast("Đã gửi yêu cầu cập nhật.");

              const finalStoreId = saved && saved.storeId ? saved.storeId : storeId;
              try {
                document.dispatchEvent(
                  new CustomEvent("store-images:open", {
                    detail: { shopId: finalStoreId || "", isAdmin: false },
                  })
                );
              } catch (error) {}
              const avatarFile = storeAvatar && storeAvatar.files ? storeAvatar.files[0] : null;
              if (finalStoreId && avatarFile) {
                try {
                  const avatar = await services.stores.uploadAvatar(finalStoreId, avatarFile);
                  if (avatar && avatar.url) setStoreAvatarPreview(avatar.url);
                } catch (error) {
                  showToast("Không thể tải ảnh đại diện. Vui lòng thử lại.");
                }
              }
              closeStoreEditor();
            } catch (error) {
              showToast("Không thể lưu gian hàng. Vui lòng thử lại.");
            } finally {
              if (storeSaveBtn) {
                storeSaveBtn.disabled = false;
                storeSaveBtn.removeAttribute("aria-busy");
              }
            }
          },
        });
      });
    }
    if (storeAvatar) {
      storeAvatar.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file || !storeAvatarPreview) return;
        if (!file.type || !file.type.startsWith("image/")) {
          showToast(t("media.imageOnly", "Only images are supported."));
          storeAvatar.value = "";
          return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          showToast(t("media.imageTooLarge", "Image exceeds 2MB."));
          storeAvatar.value = "";
          return;
        }
        setStoreAvatarPreview(URL.createObjectURL(file));
      });
    }
    if (storeGrid) {
      storeGrid.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const storeId = btn.getAttribute("data-store-id");
        const store = storeState.data.find((item) => item.storeId === storeId);
        const action = btn.getAttribute("data-action");
        if (action === "edit-store") {
          window.location.href = getEditUrl(storeId);
          return;
        }
        if (action === "view-products") {
          const productNav = document.querySelector(".seller-nav button[data-view=\"products\"]");
          if (productNav) productNav.click();
          if (window.BKSellerProducts && typeof window.BKSellerProducts.openShop === "function" && storeId) {
            window.BKSellerProducts.openShop(storeId);
          }
          return;
        }
        if (action === "delete-store") {
          return;
        }
      });
    }
    if (storeSearch) {
      storeSearch.addEventListener("input", () => {
        storeState.search = storeSearch.value;
        storeState.page = 1;
        renderStores();
      });
    }
    if (storeStatusFilter) {
      storeStatusFilter.addEventListener("change", () => {
        storeState.status = storeStatusFilter.value;
        storeState.page = 1;
        renderStores();
      });
    }
    if (storeSort) {
      storeSort.addEventListener("change", () => {
        storeState.sort = storeSort.value;
        storeState.page = 1;
        renderStores();
      });
    }

    if (!useProductV2) {
    renderProducts = () => {
      if (!productTableBody) return;
      if (productState.loading) {
        renderTableSkeleton(productTableBody, 8, 4);
        if (productEmpty) productEmpty.classList.add("is-hidden");
        if (productError) productError.classList.add("is-hidden");
        if (productPagination) productPagination.innerHTML = "";
        return;
      }
      if (productState.error) {
        productTableBody.innerHTML = "";
        if (productEmpty) productEmpty.classList.add("is-hidden");
        if (productError) productError.classList.remove("is-hidden");
        if (productPagination) productPagination.innerHTML = "";
        return;
      }
      let items = [...productState.data];
      const term = normalizeText(productState.search);
      if (term) items = items.filter((product) => normalizeText(product.name).includes(term));
      if (productState.store !== "all") items = items.filter((product) => product.storeId === productState.store);
      if (productState.sort === "price_high") items.sort((a, b) => (b.price || 0) - (a.price || 0));
      else if (productState.sort === "price_low") items.sort((a, b) => (a.price || 0) - (b.price || 0));
      else if (productState.sort === "stock_high") {
        items.sort((a, b) => {
          const aStock = (inventorySnapshot.find((item) => item.productId === a.productId) || {}).items?.length || 0;
          const bStock = (inventorySnapshot.find((item) => item.productId === b.productId) || {}).items?.length || 0;
          return bStock - aStock;
        });
      } else items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      const { pageItems, totalPages, page } = paginate(items, productState.page, productState.perPage);
      productState.page = page;

      productTableBody.innerHTML = pageItems
        .map((product) => {
          const inventory = inventorySnapshot.find((item) => item.productId === product.productId);
          const stockCount = inventory ? inventory.items.length : Number(product.stock || 0);
          const store = storeMap.get(product.storeId);
          const typeLabel = product.type === "preorder" ? "Đặt trước" : "Có sẵn hàng";
          const typeClass = product.type === "preorder" ? "warn" : "good";
          const activeLabel = product.active ? "Có" : "Tạm ẩn";
          const activeClass = product.active ? "good" : "warn";
          const publishLabel = product.published ? "Published" : "Ẩn";
          const statusLabel = product.approvalStatus === "approved" ? "Đã duyệt" : "Chờ duyệt";
          const statusClass = product.approvalStatus === "approved" ? "good" : "warn";
          return `
            <tr>
              <td><strong>${escapeHtml(product.name)}</strong><div class="form-hint">${escapeHtml(store ? store.name : "")}</div></td>
              <td>${formatVnd(product.price)}</td>
              <td>${Number(stockCount).toLocaleString("vi-VN")}</td>
              <td><span class="seller-tag ${typeClass}">${typeLabel}</span></td>
              <td><span class="seller-tag ${activeClass}">${activeLabel}</span></td>
              <td><span class="seller-tag good">${publishLabel}</span></td>
              <td><span class="seller-tag ${statusClass}">${statusLabel}</span></td>
              <td>
                <div class="seller-table-actions">
                  <button class="btn sm ghost" type="button" data-action="edit-product" data-product-id="${product.productId}">Sửa</button>
                  <button class="btn sm" type="button" data-action="inventory" data-product-id="${product.productId}">Quản lý kho</button>
                  <button class="btn sm ghost" type="button" data-action="variant" data-product-id="${product.productId}">Sản phẩm con</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      if (productEmpty) productEmpty.classList.toggle("is-hidden", items.length > 0);
      if (productError) productError.classList.add("is-hidden");
      renderPagination(productPagination, page, totalPages, (nextPage) => {
        productState.page = nextPage;
        renderProducts();
      });
    };

    const closeProductEditor = () => {
      if (productEditorCard) productEditorCard.classList.add("is-hidden");
      if (productApprovalNote) productApprovalNote.style.display = "none";
    };

    const openProductEditor = (product) => {
      if (!productEditorCard) return;
      const isEdit = Boolean(product);
      productEditorCard.classList.remove("is-hidden");
      if (productEditorTitle) {
        productEditorTitle.textContent = isEdit ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm";
      }
      if (productEditorId) productEditorId.value = product ? product.productId : "";
      if (productStoreSelect) {
        productStoreSelect.value = product ? product.storeId : productStoreSelect.value;
        productStoreSelect.disabled = isEdit;
      }
      if (productNameInput) productNameInput.value = product ? product.name : "";
      if (productPriceInput) productPriceInput.value = product ? product.price : "";
      if (productTypeSelect) productTypeSelect.value = product ? product.type : "instant";
      if (productActiveCheckbox) productActiveCheckbox.checked = product ? Boolean(product.active) : true;
      if (productPublishedCheckbox) productPublishedCheckbox.checked = product ? Boolean(product.published) : true;
      if (productApprovalNote) {
        productApprovalNote.style.display = "flex";
        productApprovalNote.innerHTML = `<span>Trạng thái duyệt:</span><span class="seller-tag good">Đã duyệt</span>`;
      }
    };

    if (productCreateBtn && !useProductV2) {
      productCreateBtn.addEventListener("click", () => openProductEditor(null));
    }
    if (productCancelBtn) {
      productCancelBtn.addEventListener("click", closeProductEditor);
    }
    if (productSaveBtn) {
      productSaveBtn.addEventListener("click", () => {
        const name = productNameInput ? productNameInput.value.trim() : "";
        if (!name) {
          showToast("Vui lòng nhập tên sản phẩm.");
          return;
        }
        const storeId = productStoreSelect ? productStoreSelect.value : "";
        if (!storeId) {
          showToast("Vui lòng chọn gian hàng.");
          return;
        }
        const payload = {
          storeId,
          name,
          price: Number(productPriceInput ? productPriceInput.value : 0),
          type: productTypeSelect ? productTypeSelect.value : "instant",
          active: productActiveCheckbox ? productActiveCheckbox.checked : true,
          published: productPublishedCheckbox ? productPublishedCheckbox.checked : true,
          stockFormat: productStockFormat ? productStockFormat.value : "",
        };
        const productId = productEditorId ? productEditorId.value : "";
        openModal({
          title: productId ? "Lưu thay đổi?" : "Tạo sản phẩm?",
          message: productId ? "Cập nhật sản phẩm này ngay bây giờ?" : "Sản phẩm sẽ được tạo mới.",
          confirmText: "Xác nhận",
          onConfirm: () => {
            if (productId) {
              services.products.update(productId, payload);
              showToast("Đã cập nhật sản phẩm.");
            } else {
              services.products.create(payload);
              showToast("Đã tạo sản phẩm.");
            }
            closeProductEditor();
          },
        });
      });
    }
    if (productSearch) {
      productSearch.addEventListener("input", () => {
        productState.search = productSearch.value;
        productState.page = 1;
        renderProducts();
      });
    }
    if (productStoreFilter) {
      productStoreFilter.addEventListener("change", () => {
        productState.store = productStoreFilter.value;
        productState.page = 1;
        renderProducts();
      });
    }
    if (productSort) {
      productSort.addEventListener("change", () => {
        productState.sort = productSort.value;
        productState.page = 1;
        renderProducts();
      });
    }
    if (productTableBody) {
      productTableBody.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const productId = btn.getAttribute("data-product-id");
        const product = productState.data.find((item) => item.productId === productId);
        const action = btn.getAttribute("data-action");
        if (action === "edit-product") {
          openProductEditor(product);
          return;
        }
        if (action === "inventory" && product) {
          openInventoryPanel(product);
          return;
        }
        if (action === "variant" && product) {
          openVariantPanel(product);
        }
      });
    }

    const setInventoryTab = (tab) => {
      inventoryState.tab = tab;
      inventoryTabs.forEach((pill) => pill.classList.toggle("active", pill.getAttribute("data-tab") === tab));
      inventoryPanels.forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.getAttribute("data-tab") !== tab);
      });
    };

    const renderInventoryList = () => {
      if (!inventoryTableBody) return;
      if (inventoryState.loading) {
        renderTableSkeleton(inventoryTableBody, 3, 4);
        if (inventoryEmpty) inventoryEmpty.classList.add("is-hidden");
        if (inventoryPagination) inventoryPagination.innerHTML = "";
        return;
      }
      let items = [...(inventoryState.items || [])];
      const term = normalizeText(inventoryState.search);
      if (term) items = items.filter((item) => normalizeText(item).includes(term));
      if (inventoryState.sort === "oldest") items = items.slice().reverse();
      const { pageItems, totalPages, page } = paginate(items, inventoryState.page, inventoryState.perPage);
      inventoryState.page = page;
      inventoryTableBody.innerHTML = pageItems
        .map(
          (item) => `
        <tr>
          <td><code>${escapeHtml(item)}</code></td>
          <td><span class="seller-tag good">Sẵn sàng</span></td>
          <td>--</td>
        </tr>
      `
        )
        .join("");
      if (inventoryEmpty) inventoryEmpty.classList.toggle("is-hidden", items.length > 0);
      renderPagination(inventoryPagination, page, totalPages, (nextPage) => {
        inventoryState.page = nextPage;
        renderInventoryList();
      });
    };

    const renderInventoryHistory = () => {
      if (!inventoryHistoryBody) return;
      if (inventoryState.loading) {
        renderTableSkeleton(inventoryHistoryBody, 4, 3);
        if (inventoryHistoryEmpty) inventoryHistoryEmpty.classList.add("is-hidden");
        if (inventoryHistoryPagination) inventoryHistoryPagination.innerHTML = "";
        return;
      }
      const entries = [...(inventoryState.history || [])];
      const { pageItems, totalPages, page } = paginate(entries, inventoryState.historyPage, inventoryState.perPage);
      inventoryState.historyPage = page;
      const labelMap = {
        upload: "Nạp kho",
        download: "Tải xuống",
        delete: "Xóa kho",
        export: "Xuất danh sách",
      };
      inventoryHistoryBody.innerHTML = pageItems
        .map(
          (entry) => `
        <tr>
          <td>${labelMap[entry.action] || "Cập nhật"}</td>
          <td>${Number(entry.count || 0).toLocaleString("vi-VN")}</td>
          <td>${escapeHtml(entry.note || "--")}</td>
          <td>${escapeHtml(entry.createdAt || "--")}</td>
        </tr>
      `
        )
        .join("");
      if (inventoryHistoryEmpty) inventoryHistoryEmpty.classList.toggle("is-hidden", entries.length > 0);
      renderPagination(inventoryHistoryPagination, page, totalPages, (nextPage) => {
        inventoryState.historyPage = nextPage;
        renderInventoryHistory();
      });
    };

    const openInventoryPanel = (product) => {
      if (!inventoryCard) return;
      inventoryCard.classList.remove("is-hidden");
      inventoryState.productId = product.productId;
      inventoryState.page = 1;
      inventoryState.historyPage = 1;
      inventoryState.search = "";
      inventoryState.sort = "newest";
      setInventoryTab("list");
      const store = storeMap.get(product.storeId);
      if (inventorySub) {
        inventorySub.textContent = `${store ? store.name : ""} • ${product.name}`;
      }
      inventoryState.loading = true;
      renderInventoryList();
      renderInventoryHistory();
      services.inventories.get(product.productId).then((data) => {
        inventoryState.items = data.items || [];
        inventoryState.history = data.history || [];
        inventoryState.loading = false;
        renderInventoryList();
        renderInventoryHistory();
      });
    };

    if (inventoryClose) {
      inventoryClose.addEventListener("click", () => {
        if (inventoryCard) inventoryCard.classList.add("is-hidden");
      });
    }
    inventoryTabs.forEach((pill) => {
      pill.addEventListener("click", () => {
        const tab = pill.getAttribute("data-tab");
        if (tab) setInventoryTab(tab);
      });
    });
    if (inventorySearch) {
      inventorySearch.addEventListener("input", () => {
        inventoryState.search = inventorySearch.value;
        inventoryState.page = 1;
        renderInventoryList();
      });
    }
    if (inventorySort) {
      inventorySort.addEventListener("change", () => {
        inventoryState.sort = inventorySort.value;
        inventoryState.page = 1;
        renderInventoryList();
      });
    }
    if (inventoryUploadBtn) {
      inventoryUploadBtn.addEventListener("click", () => {
        const raw = inventoryInput ? inventoryInput.value.split("\n").map((line) => line.trim()).filter(Boolean) : [];
        if (!raw.length) {
          showToast("Vui lòng nhập dữ liệu kho.");
          return;
        }
        openModal({
          title: "Nạp kho?",
          message: `Xác nhận thêm ${raw.length} item vào kho.`,
          onConfirm: () => {
            services.inventories.addItems(inventoryState.productId, raw, "Dán văn bản");
            if (inventoryInput) inventoryInput.value = "";
            showToast("Đã nạp kho.");
            openInventoryPanel(productState.data.find((item) => item.productId === inventoryState.productId) || {});
          },
        });
      });
    }
    if (inventoryUploadClose) {
      inventoryUploadClose.addEventListener("click", () => {
        if (inventoryCard) inventoryCard.classList.add("is-hidden");
      });
    }
    if (inventoryDownloadBtn) {
      inventoryDownloadBtn.addEventListener("click", () => {
        openModal({
          title: "Tải xuống kho?",
          message: "Danh sách sẽ được chuẩn bị tải xuống.",
          onConfirm: () => {
            services.inventories.log(inventoryState.productId, "download", inventoryState.items.length, "Tải xuống");
            showToast("Đã chuẩn bị file tải xuống.");
            renderInventoryHistory();
          },
        });
      });
    }
    if (inventoryExportBtn) {
      inventoryExportBtn.addEventListener("click", () => {
        openModal({
          title: "Xuất danh sách?",
          message: "Danh sách kho sẽ được xuất tại trang này.",
          onConfirm: () => {
            services.inventories.log(inventoryState.productId, "export", inventoryState.items.length, "Xuất danh sách");
            showToast("Đã xuất danh sách kho.");
            renderInventoryHistory();
          },
        });
      });
    }
    if (inventoryDeleteBtn) {
      inventoryDeleteBtn.addEventListener("click", () => {
        const count = Number(inventoryDeleteCount ? inventoryDeleteCount.value : 0);
        if (!count || count <= 0) {
          showToast("Vui lòng nhập số lượng cần xóa.");
          return;
        }
        openModal({
          title: "Xóa kho?",
          message: `Xác nhận xóa ${count} item khỏi kho.`,
          onConfirm: () => {
            services.inventories.removeItems(inventoryState.productId, count, "Xóa thủ công");
            showToast("Đã xóa khỏi kho.");
            openInventoryPanel(productState.data.find((item) => item.productId === inventoryState.productId) || {});
          },
        });
      });
    }

    const renderVariants = () => {
      if (!variantTableBody) return;
      if (variantState.loading) {
        renderTableSkeleton(variantTableBody, 4, 3);
        if (variantEmpty) variantEmpty.classList.add("is-hidden");
        if (variantPagination) variantPagination.innerHTML = "";
        return;
      }
      let items = [...variantState.data];
      const term = normalizeText(variantState.search);
      if (term) items = items.filter((variant) => normalizeText(variant.name).includes(term));
      if (variantState.sort === "price_high") items.sort((a, b) => (b.price || 0) - (a.price || 0));
      else if (variantState.sort === "stock_high") items.sort((a, b) => (b.stock || 0) - (a.stock || 0));
      else items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      const { pageItems, totalPages, page } = paginate(items, variantState.page, variantState.perPage);
      variantState.page = page;
      variantTableBody.innerHTML = pageItems
        .map((variant) => {
          const statusLabel = variant.status === "inactive" ? "Tạm ẩn" : "Đang bán";
          const statusClass = variant.status === "inactive" ? "warn" : "good";
          return `
          <tr>
            <td><strong>${escapeHtml(variant.name)}</strong></td>
            <td>${formatVnd(variant.price)}</td>
            <td>${Number(variant.stock || 0).toLocaleString("vi-VN")}</td>
            <td><span class="seller-tag ${statusClass}">${statusLabel}</span></td>
          </tr>
        `;
        })
        .join("");
      if (variantEmpty) variantEmpty.classList.toggle("is-hidden", items.length > 0);
      renderPagination(variantPagination, page, totalPages, (nextPage) => {
        variantState.page = nextPage;
        renderVariants();
      });
    };

    const openVariantPanel = (product) => {
      if (!variantCard) return;
      variantCard.classList.remove("is-hidden");
      variantState.productId = product.productId;
      variantState.storeId = product.storeId;
      variantState.search = "";
      variantState.page = 1;
      const store = storeMap.get(product.storeId);
      if (variantSub) variantSub.textContent = `${store ? store.name : ""} • ${product.name}`;
      if (variantStoreSelect) {
        variantStoreSelect.innerHTML = `<option value="${product.storeId}">${escapeHtml(store ? store.name : "")}</option>`;
      }
      if (variantProductSelect) {
        variantProductSelect.innerHTML = `<option value="${product.productId}">${escapeHtml(product.name)}</option>`;
      }
      variantState.loading = true;
      renderVariants();
      services.variants.list().then((data) => {
        variantState.data = (data || []).filter((variant) => variant.productId === product.productId);
        variantState.loading = false;
        renderVariants();
      });
    };

    if (variantClose) {
      variantClose.addEventListener("click", () => {
        if (variantCard) variantCard.classList.add("is-hidden");
      });
    }
    if (variantSearch) {
      variantSearch.addEventListener("input", () => {
        variantState.search = variantSearch.value;
        variantState.page = 1;
        renderVariants();
      });
    }
    if (variantSort) {
      variantSort.addEventListener("change", () => {
        variantState.sort = variantSort.value;
        variantState.page = 1;
        renderVariants();
      });
    }
    if (variantSaveBtn) {
      variantSaveBtn.addEventListener("click", () => {
        const name = variantNameInput ? variantNameInput.value.trim() : "";
        if (!name) {
          showToast("Vui lòng nhập tên sản phẩm con.");
          return;
        }
        const payload = {
          productId: variantState.productId,
          storeId: variantState.storeId,
          name,
          price: Number(variantPriceInput ? variantPriceInput.value : 0),
          stock: Number(variantStockInput ? variantStockInput.value : 0),
          status: variantStatusSelect ? variantStatusSelect.value : "active",
          shortDesc: variantShortDesc ? variantShortDesc.value.trim() : "",
        };
        openModal({
          title: "Thêm sản phẩm con?",
          message: "Biến thể mới sẽ được thêm vào danh sách.",
          onConfirm: () => {
            services.variants.create(payload);
            showToast("Đã thêm sản phẩm con.");
            if (variantNameInput) variantNameInput.value = "";
            if (variantPriceInput) variantPriceInput.value = "";
            if (variantStockInput) variantStockInput.value = "";
            if (variantShortDesc) variantShortDesc.value = "";
            openVariantPanel(productState.data.find((item) => item.productId === variantState.productId) || {});
          },
        });
      });
    }
    if (variantResetBtn) {
      variantResetBtn.addEventListener("click", () => {
        if (variantNameInput) variantNameInput.value = "";
        if (variantPriceInput) variantPriceInput.value = "";
        if (variantStockInput) variantStockInput.value = "";
        if (variantShortDesc) variantShortDesc.value = "";
      });
    }

    }

    const renderOrders = () => {
      if (!orderTableBody) return;
      if (orderState.loading) {
        renderTableSkeleton(orderTableBody, 9, 4);
        if (orderEmpty) orderEmpty.classList.add("is-hidden");
        if (orderError) orderError.classList.add("is-hidden");
        if (orderPagination) orderPagination.innerHTML = "";
        return;
      }
      if (orderState.error) {
        orderTableBody.innerHTML = "";
        if (orderEmpty) orderEmpty.classList.add("is-hidden");
        if (orderError) orderError.classList.remove("is-hidden");
        if (orderPagination) orderPagination.innerHTML = "";
        return;
      }
      let items = [...orderState.data];
      const term = normalizeText(orderState.search);
      if (term) {
        items = items.filter((order) => {
          const store = storeMap.get(order.storeId);
          return (
            normalizeText(order.orderId).includes(term) ||
            normalizeText(order.buyer).includes(term) ||
            normalizeText(order.productName).includes(term) ||
            normalizeText(store ? store.name : "").includes(term)
          );
        });
      }
      if (orderState.status !== "all") items = items.filter((order) => order.status === orderState.status);
      if (orderState.store !== "all") items = items.filter((order) => order.storeId === orderState.store);
      const start = parseDateValue(orderState.startDate);
      const end = parseDateValue(orderState.endDate);
      if (start) items = items.filter((order) => parseDateValue(order.createdAt) >= start);
      if (end) items = items.filter((order) => parseDateValue(order.createdAt) <= end);
      if (orderState.sort === "total_high") items.sort((a, b) => (b.total || 0) - (a.total || 0));
      else if (orderState.sort === "total_low") items.sort((a, b) => (a.total || 0) - (b.total || 0));
      else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { pageItems, totalPages, page } = paginate(items, orderState.page, orderState.perPage);
      orderState.page = page;

      const statusMap = {
        Paid: { label: "Paid", className: "good" },
        Pending: { label: "Pending", className: "warn" },
      };
      orderTableBody.innerHTML = pageItems
        .map((order) => {
          const store = storeMap.get(order.storeId);
          const status = statusMap[order.status] || { label: order.status || "---", className: "warn" };
          return `
            <tr>
              <td><strong>#${escapeHtml(order.orderId)}</strong></td>
              <td>${escapeHtml(store ? store.name : "")}</td>
              <td>${escapeHtml(order.buyer)}</td>
              <td>${escapeHtml(order.productName)}</td>
              <td>${formatVnd(order.total)}</td>
              <td>${formatVnd(order.fee)}</td>
              <td>${formatVnd(order.net)}</td>
              <td><span class="seller-tag ${status.className}">${status.label}</span></td>
              <td>${escapeHtml(order.createdAt)}</td>
            </tr>
          `;
        })
        .join("");

      if (orderEmpty) orderEmpty.classList.toggle("is-hidden", items.length > 0);
      if (orderError) orderError.classList.add("is-hidden");
      renderPagination(orderPagination, page, totalPages, (nextPage) => {
        orderState.page = nextPage;
        renderOrders();
      });
    };

    const renderRefunds = () => {
      if (!refundTableBody) return;
      if (refundState.loading) {
        renderTableSkeleton(refundTableBody, 7, 4);
        if (refundEmpty) refundEmpty.classList.add("is-hidden");
        if (refundError) refundError.classList.add("is-hidden");
        if (refundPagination) refundPagination.innerHTML = "";
        return;
      }
      if (refundState.error) {
        refundTableBody.innerHTML = "";
        if (refundEmpty) refundEmpty.classList.add("is-hidden");
        if (refundError) refundError.classList.remove("is-hidden");
        if (refundPagination) refundPagination.innerHTML = "";
        return;
      }
      let items = [...refundState.data];
      const term = normalizeText(refundState.search);
      if (term) {
        items = items.filter(
          (refund) =>
            normalizeText(refund.requestId).includes(term) ||
            normalizeText(refund.orderId).includes(term) ||
            normalizeText(refund.buyer).includes(term)
        );
      }
      if (refundState.status !== "all") items = items.filter((refund) => refund.status === refundState.status);
      if (refundState.type !== "all") items = items.filter((refund) => refund.type === refundState.type);
      if (refundState.sort === "value_high") items.sort((a, b) => (b.value || 0) - (a.value || 0));
      else if (refundState.sort === "value_low") items.sort((a, b) => (a.value || 0) - (b.value || 0));
      else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { pageItems, totalPages, page } = paginate(items, refundState.page, refundState.perPage);
      refundState.page = page;

      const statusMap = {
        pending: { label: "Chờ duyệt", className: "warn" },
        approved: { label: "Hoàn thành", className: "good" },
        rejected: { label: "Từ chối", className: "bad" },
      };
      const typeMap = { refund: "Hoàn tiền", warranty: "Bảo hành" };
      refundTableBody.innerHTML = pageItems
        .map((refund) => {
          const status = statusMap[refund.status] || statusMap.pending;
          const actionHtml =
            refund.status === "pending"
              ? `
                <div class="seller-table-actions">
                  <button class="btn sm" type="button" data-action="approve" data-request-id="${refund.requestId}">Duyệt</button>
                  <button class="btn sm ghost" type="button" data-action="reject" data-request-id="${refund.requestId}">Từ chối</button>
                </div>
              `
              : `<span class="form-hint">Đã xử lý</span>`;
          return `
            <tr>
              <td><strong>#${escapeHtml(refund.requestId)}</strong></td>
              <td>#${escapeHtml(refund.orderId)}</td>
              <td>${escapeHtml(refund.buyer)}</td>
              <td>${typeMap[refund.type] || "Bảo hành"}</td>
              <td>${formatVnd(refund.value)}</td>
              <td><span class="seller-tag ${status.className}">${status.label}</span></td>
              <td>${actionHtml}</td>
            </tr>
          `;
        })
        .join("");

      if (refundEmpty) refundEmpty.classList.toggle("is-hidden", items.length > 0);
      if (refundError) refundError.classList.add("is-hidden");
      renderPagination(refundPagination, page, totalPages, (nextPage) => {
        refundState.page = nextPage;
        renderRefunds();
      });
    };

    const renderPreorders = () => {
      if (!preorderTableBody) return;
      if (preorderState.loading) {
        renderTableSkeleton(preorderTableBody, 7, 4);
        if (preorderEmpty) preorderEmpty.classList.add("is-hidden");
        if (preorderError) preorderError.classList.add("is-hidden");
        if (preorderPagination) preorderPagination.innerHTML = "";
        return;
      }
      if (preorderState.error) {
        preorderTableBody.innerHTML = "";
        if (preorderEmpty) preorderEmpty.classList.add("is-hidden");
        if (preorderError) preorderError.classList.remove("is-hidden");
        if (preorderPagination) preorderPagination.innerHTML = "";
        return;
      }
      let items = [...preorderState.data];
      const term = normalizeText(preorderState.search);
      if (term) {
        items = items.filter(
          (preorder) =>
            normalizeText(preorder.preorderId).includes(term) ||
            normalizeText(preorder.buyer).includes(term) ||
            normalizeText(preorder.productName).includes(term)
        );
      }
      if (preorderState.status !== "all") items = items.filter((preorder) => preorder.status === preorderState.status);
      if (preorderState.sort === "total_high") items.sort((a, b) => (b.total || 0) - (a.total || 0));
      else items.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
      const { pageItems, totalPages, page } = paginate(items, preorderState.page, preorderState.perPage);
      preorderState.page = page;

      const statusMap = {
        pending: { label: "Chờ xử lý", className: "warn" },
        completed: { label: "Đã xử lý", className: "good" },
      };
      preorderTableBody.innerHTML = pageItems
        .map((preorder) => {
          const store = storeMap.get(preorder.storeId);
          const status = statusMap[preorder.status] || statusMap.pending;
          const actionHtml =
            preorder.status === "pending"
              ? `<button class="btn sm" type="button" data-action="complete" data-preorder-id="${preorder.preorderId}">Hoàn thành</button>`
              : `<span class="form-hint">Đã xử lý</span>`;
          return `
            <tr>
              <td><strong>#${escapeHtml(preorder.preorderId)}</strong></td>
              <td>${escapeHtml(store ? store.name : "")}</td>
              <td>${escapeHtml(preorder.buyer)}</td>
              <td>${escapeHtml(preorder.productName)}</td>
              <td>${formatVnd(preorder.total)}</td>
              <td>${escapeHtml(preorder.dueDate)}</td>
              <td><span class="seller-tag ${status.className}">${status.label}</span> ${actionHtml}</td>
            </tr>
          `;
        })
        .join("");

      if (preorderEmpty) preorderEmpty.classList.toggle("is-hidden", items.length > 0);
      if (preorderError) preorderError.classList.add("is-hidden");
      renderPagination(preorderPagination, page, totalPages, (nextPage) => {
        preorderState.page = nextPage;
        renderPreorders();
      });
    };

    const parseCouponValue = (value) => {
      const raw = Number(String(value || "").replace(/[^\d.]/g, ""));
      return Number.isNaN(raw) ? 0 : raw;
    };

    const renderCoupons = () => {
      if (!couponTableBody) return;
      if (couponState.loading) {
        renderTableSkeleton(couponTableBody, 5, 4);
        if (couponEmpty) couponEmpty.classList.add("is-hidden");
        if (couponError) couponError.classList.add("is-hidden");
        if (couponPagination) couponPagination.innerHTML = "";
        return;
      }
      if (couponState.error) {
        couponTableBody.innerHTML = "";
        if (couponEmpty) couponEmpty.classList.add("is-hidden");
        if (couponError) couponError.classList.remove("is-hidden");
        if (couponPagination) couponPagination.innerHTML = "";
        return;
      }
      let items = [...couponState.data];
      const term = normalizeText(couponState.search);
      if (term) items = items.filter((coupon) => normalizeText(coupon.code).includes(term));
      if (couponState.status !== "all") items = items.filter((coupon) => coupon.status === couponState.status);
      if (couponState.store !== "all") items = items.filter((coupon) => coupon.storeId === couponState.store);
      if (couponState.sort === "value_high") items.sort((a, b) => parseCouponValue(b.value) - parseCouponValue(a.value));
      else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { pageItems, totalPages, page } = paginate(items, couponState.page, couponState.perPage);
      couponState.page = page;

      couponTableBody.innerHTML = pageItems
        .map((coupon) => {
          const statusLabel = coupon.status === "active" ? "Active" : "Expired";
          const statusClass = coupon.status === "active" ? "good" : "warn";
          const store = storeMap.get(coupon.storeId);
          return `
            <tr>
              <td><strong>${escapeHtml(coupon.code)}</strong><div class="form-hint">${escapeHtml(store ? store.name : "")}</div></td>
              <td>${escapeHtml(coupon.value)}</td>
              <td><span class="seller-tag ${statusClass}">${statusLabel}</span></td>
              <td>${escapeHtml(coupon.expiresAt)}</td>
              <td>
                <button class="btn sm ghost" type="button" data-action="copy-coupon" data-code="${escapeHtml(coupon.code)}">Sao chép</button>
              </td>
            </tr>
          `;
        })
        .join("");

      if (couponEmpty) couponEmpty.classList.toggle("is-hidden", items.length > 0);
      if (couponError) couponError.classList.add("is-hidden");
      renderPagination(couponPagination, page, totalPages, (nextPage) => {
        couponState.page = nextPage;
        renderCoupons();
      });
    };

    const renderComplaints = () => {
      if (!complaintTableBody) return;
      if (complaintState.loading) {
        renderTableSkeleton(complaintTableBody, 5, 4);
        if (complaintEmpty) complaintEmpty.classList.add("is-hidden");
        if (complaintError) complaintError.classList.add("is-hidden");
        if (complaintPagination) complaintPagination.innerHTML = "";
        return;
      }
      if (complaintState.error) {
        complaintTableBody.innerHTML = "";
        if (complaintEmpty) complaintEmpty.classList.add("is-hidden");
        if (complaintError) complaintError.classList.remove("is-hidden");
        if (complaintPagination) complaintPagination.innerHTML = "";
        return;
      }
      let items = [...complaintState.data];
      const term = normalizeText(complaintState.search);
      if (term) {
        items = items.filter((item) => {
          const ticketId = item.ticketId || item.complaintId || item.id || "";
          const buyer = item.buyer || item.customer || item.user || "";
          return normalizeText(ticketId).includes(term) || normalizeText(buyer).includes(term);
        });
      }
      if (complaintState.level !== "all") items = items.filter((item) => item.level === complaintState.level);
      if (complaintState.sort === "priority") {
        const weight = { high: 3, medium: 2, low: 1 };
        items.sort((a, b) => (weight[b.level] || 0) - (weight[a.level] || 0));
      } else {
        items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      }
      const { pageItems, totalPages, page } = paginate(items, complaintState.page, complaintState.perPage);
      complaintState.page = page;

      const levelMap = {
        high: { label: "Khẩn", className: "bad" },
        medium: { label: "Trung bình", className: "warn" },
        low: { label: "Thấp", className: "good" },
      };
      const statusMap = {
        open: { label: "Đang xử lý", className: "warn" },
        pending: { label: "Chờ phản hồi", className: "warn" },
        resolved: { label: "Đã xử lý", className: "good" },
      };
      complaintTableBody.innerHTML = pageItems
        .map((item) => {
          const ticketId = item.ticketId || item.complaintId || item.id || "---";
          const buyer = item.buyer || item.customer || item.user || "---";
          const level = levelMap[item.level] || levelMap.medium;
          const status = statusMap[item.status] || statusMap.open;
          return `
            <tr>
              <td><strong>#${escapeHtml(ticketId)}</strong></td>
              <td>${escapeHtml(buyer)}</td>
              <td><span class="seller-tag ${level.className}">${level.label}</span></td>
              <td><span class="seller-tag ${status.className}">${status.label}</span></td>
              <td>${escapeHtml(item.createdAt || "--")}</td>
            </tr>
          `;
        })
        .join("");

      if (complaintEmpty) complaintEmpty.classList.toggle("is-hidden", items.length > 0);
      if (complaintError) complaintError.classList.add("is-hidden");
      renderPagination(complaintPagination, page, totalPages, (nextPage) => {
        complaintState.page = nextPage;
        renderComplaints();
      });
    };

    const renderReviews = () => {
      if (!reviewTableBody) return;
      if (reviewState.loading) {
        renderTableSkeleton(reviewTableBody, 5, 4);
        if (reviewEmpty) reviewEmpty.classList.add("is-hidden");
        if (reviewError) reviewError.classList.add("is-hidden");
        if (reviewPagination) reviewPagination.innerHTML = "";
        return;
      }
      if (reviewState.error) {
        reviewTableBody.innerHTML = "";
        if (reviewEmpty) reviewEmpty.classList.add("is-hidden");
        if (reviewError) reviewError.classList.remove("is-hidden");
        if (reviewPagination) reviewPagination.innerHTML = "";
        return;
      }
      let items = [...reviewState.data];
      const term = normalizeText(reviewState.search);
      if (term) items = items.filter((review) => normalizeText(review.customer || review.buyer || "").includes(term));
      if (reviewState.status !== "all") items = items.filter((review) => review.status === reviewState.status);
      if (reviewState.store !== "all") items = items.filter((review) => review.storeId === reviewState.store);
      if (reviewState.sort === "rating_high") items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      else items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const { pageItems, totalPages, page } = paginate(items, reviewState.page, reviewState.perPage);
      reviewState.page = page;

      const statusMap = {
        positive: { label: "Tích cực", className: "good" },
        neutral: { label: "Trung bình", className: "warn" },
        negative: { label: "Cần cải thiện", className: "bad" },
      };
      reviewTableBody.innerHTML = pageItems
        .map((review) => {
          const status = statusMap[review.status] || statusMap.neutral;
          const customer = review.customer || review.buyer || "---";
          return `
            <tr>
              <td>${escapeHtml(customer)}</td>
              <td>${Number(review.rating || 0).toFixed(1)}</td>
              <td>${escapeHtml(review.content || review.note || "")}</td>
              <td><span class="seller-tag ${status.className}">${status.label}</span></td>
              <td>${escapeHtml(review.createdAt || "--")}</td>
            </tr>
          `;
        })
        .join("");

      if (reviewEmpty) reviewEmpty.classList.toggle("is-hidden", items.length > 0);
      if (reviewError) reviewError.classList.add("is-hidden");
      renderPagination(reviewPagination, page, totalPages, (nextPage) => {
        reviewState.page = nextPage;
        renderReviews();
      });
    };

    const renderWithdrawals = () => {
      if (!withdrawTableBody) return;
      if (withdrawState.loading) {
        renderTableSkeleton(withdrawTableBody, 5, 4);
        if (withdrawEmpty) withdrawEmpty.classList.add("is-hidden");
        if (withdrawError) withdrawError.classList.add("is-hidden");
        if (withdrawPagination) withdrawPagination.innerHTML = "";
        return;
      }
      if (withdrawState.error) {
        withdrawTableBody.innerHTML = "";
        if (withdrawEmpty) withdrawEmpty.classList.add("is-hidden");
        if (withdrawError) withdrawError.classList.remove("is-hidden");
        if (withdrawPagination) withdrawPagination.innerHTML = "";
        return;
      }
      let items = [...withdrawState.data];
      const term = normalizeText(withdrawState.search);
      if (term) items = items.filter((withdraw) => normalizeText(withdraw.withdrawalId).includes(term));
      if (withdrawState.status !== "all") items = items.filter((withdraw) => withdraw.status === withdrawState.status);
      if (withdrawState.sort === "amount_high") items.sort((a, b) => (b.amount || 0) - (a.amount || 0));
      else items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const { pageItems, totalPages, page } = paginate(items, withdrawState.page, withdrawState.perPage);
      withdrawState.page = page;

      const statusMap = {
        success: { label: "Thành công", className: "good" },
        processing: { label: "Đang xử lý", className: "warn" },
        rejected: { label: "Bị từ chối", className: "bad" },
      };
      withdrawTableBody.innerHTML = pageItems
        .map((withdraw) => {
          const status = statusMap[withdraw.status] || statusMap.processing;
          return `
            <tr>
              <td><strong>${escapeHtml(withdraw.withdrawalId)}</strong></td>
              <td>${formatVnd(withdraw.amount)}</td>
              <td><span class="seller-tag ${status.className}">${status.label}</span></td>
              <td>${escapeHtml(withdraw.method || "--")}</td>
              <td>${escapeHtml(withdraw.createdAt || "--")}</td>
            </tr>
          `;
        })
        .join("");

      if (withdrawEmpty) withdrawEmpty.classList.toggle("is-hidden", items.length > 0);
      if (withdrawError) withdrawError.classList.add("is-hidden");
      renderPagination(withdrawPagination, page, totalPages, (nextPage) => {
        withdrawState.page = nextPage;
        renderWithdrawals();
      });
    };

    const renderBalances = (balance) => {
      if (!balance) return;
      if (balanceAvailable) balanceAvailable.textContent = formatVnd(balance.available || 0);
      if (balanceHold) balanceHold.textContent = formatVnd(balance.hold || 0);
      if (balanceTotal) balanceTotal.textContent = formatVnd(balance.total || 0);
    };

    const renderPayment = (payment) => {
      if (!payment) return;
      if (paymentBank) paymentBank.value = payment.bank || "";
      if (paymentAccount) paymentAccount.value = payment.account || "";
      if (paymentHolder) paymentHolder.value = payment.holder || "";
    };

    const syncList = (state, loader, render, after) => {
      loader()
        .then((data) => {
          state.data = data || [];
          state.loading = false;
          state.error = false;
          render();
          if (typeof after === "function") after(data || []);
        })
        .catch(() => {
          state.loading = false;
          state.error = true;
          render();
        });
    };

    const refreshInventorySnapshot = () => {
      if (useProductV2 || !services || !services.inventories || typeof services.inventories.list !== "function") return;
      services.inventories.list().then((data) => {
        inventorySnapshot = data || [];
        if (typeof renderProducts === "function") renderProducts();
      });
    };

    if (orderSearch) {
      orderSearch.addEventListener("input", () => {
        orderState.search = orderSearch.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderStatusFilter) {
      orderStatusFilter.addEventListener("change", () => {
        orderState.status = orderStatusFilter.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderStoreFilter) {
      orderStoreFilter.addEventListener("change", () => {
        orderState.store = orderStoreFilter.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderStartDate) {
      orderStartDate.addEventListener("change", () => {
        orderState.startDate = orderStartDate.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderEndDate) {
      orderEndDate.addEventListener("change", () => {
        orderState.endDate = orderEndDate.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderSort) {
      orderSort.addEventListener("change", () => {
        orderState.sort = orderSort.value;
        orderState.page = 1;
        renderOrders();
      });
    }
    if (orderExportBtn) {
      orderExportBtn.addEventListener("click", () => {
        openModal({
          title: "Xuất báo cáo đơn hàng?",
          message: "Báo cáo sẽ được chuẩn bị trong vài phút.",
          onConfirm: () => showToast("Đã bắt đầu xuất báo cáo."),
        });
      });
    }

    if (refundSearch) {
      refundSearch.addEventListener("input", () => {
        refundState.search = refundSearch.value;
        refundState.page = 1;
        renderRefunds();
      });
    }
    if (refundStatusFilter) {
      refundStatusFilter.addEventListener("change", () => {
        refundState.status = refundStatusFilter.value;
        refundState.page = 1;
        renderRefunds();
      });
    }
    if (refundTypeFilter) {
      refundTypeFilter.addEventListener("change", () => {
        refundState.type = refundTypeFilter.value;
        refundState.page = 1;
        renderRefunds();
      });
    }
    if (refundSort) {
      refundSort.addEventListener("change", () => {
        refundState.sort = refundSort.value;
        refundState.page = 1;
        renderRefunds();
      });
    }
    if (refundExportBtn) {
      refundExportBtn.addEventListener("click", () => {
        openModal({
          title: "Xuất danh sách yêu cầu?",
          message: "Danh sách sẽ được tổng hợp theo bộ lọc hiện tại.",
          onConfirm: () => showToast("Đã chuẩn bị danh sách yêu cầu."),
        });
      });
    }
    if (refundTableBody) {
      refundTableBody.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const requestId = btn.getAttribute("data-request-id");
        const action = btn.getAttribute("data-action");
        if (!requestId) return;
        if (action === "approve") {
          openModal({
            title: "Duyệt yêu cầu?",
            message: "Nhập nội dung xử lý để gửi cho người mua.",
            inputLabel: "Nội dung xử lý",
            inputPlaceholder: "Nhập nội dung xử lý",
            confirmText: "Xác nhận",
            onConfirm: (note) => {
              services.refunds.updateStatus(requestId, "approved", note);
              showToast("Đã duyệt yêu cầu.");
            },
          });
        }
        if (action === "reject") {
          openModal({
            title: "Từ chối yêu cầu?",
            message: "Nhập lý do từ chối để gửi cho người mua.",
            inputLabel: "Lý do từ chối",
            inputPlaceholder: "Nhập lý do từ chối",
            confirmText: "Xác nhận",
            onConfirm: (note) => {
              if (!note) {
                showToast("Vui lòng nhập lý do từ chối.");
                return;
              }
              services.refunds.updateStatus(requestId, "rejected", note);
              showToast("Đã từ chối yêu cầu.");
            },
          });
        }
      });
    }

    if (preorderSearch) {
      preorderSearch.addEventListener("input", () => {
        preorderState.search = preorderSearch.value;
        preorderState.page = 1;
        renderPreorders();
      });
    }
    if (preorderStatusFilter) {
      preorderStatusFilter.addEventListener("change", () => {
        preorderState.status = preorderStatusFilter.value;
        preorderState.page = 1;
        renderPreorders();
      });
    }
    if (preorderSort) {
      preorderSort.addEventListener("change", () => {
        preorderState.sort = preorderSort.value;
        preorderState.page = 1;
        renderPreorders();
      });
    }
    if (preorderResetBtn) {
      preorderResetBtn.addEventListener("click", () => {
        preorderState.search = "";
        preorderState.status = "all";
        preorderState.sort = "recent";
        preorderState.page = 1;
        if (preorderSearch) preorderSearch.value = "";
        if (preorderStatusFilter) preorderStatusFilter.value = "all";
        if (preorderSort) preorderSort.value = "recent";
        renderPreorders();
      });
    }
    if (preorderTableBody) {
      preorderTableBody.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const preorderId = btn.getAttribute("data-preorder-id");
        if (!preorderId) return;
        openModal({
          title: "Hoàn thành đơn đặt trước?",
          message: "Đơn đặt trước sẽ được chuyển sang đã xử lý.",
          onConfirm: () => {
            services.preorders.updateStatus(preorderId, "completed");
            showToast("Đã cập nhật đơn đặt trước.");
          },
        });
      });
    }

    if (couponCreateBtn) {
      couponCreateBtn.addEventListener("click", () => {
        openModal({
          title: "Tạo mã giảm giá?",
          message: "Nhập mã giảm giá để tạo mới.",
          inputLabel: "Mã giảm giá",
          inputPlaceholder: "VD: POLYFLUX10",
          confirmText: "Tạo mới",
          onConfirm: (code) => {
            const storeId = couponStoreFilter && couponStoreFilter.value !== "all" ? couponStoreFilter.value : storeState.data[0]?.storeId;
            if (!storeId) {
              showToast("Chưa có gian hàng để tạo mã.");
              return;
            }
            if (!code) {
              showToast("Vui lòng nhập mã giảm giá.");
              return;
            }
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            const expiresAt = expires.toISOString().split("T")[0];
            services.coupons.create({ storeId, code, value: "10%", status: "active", expiresAt });
            showToast("Đã tạo mã giảm giá.");
          },
        });
      });
    }
    if (couponStoreFilter) {
      couponStoreFilter.addEventListener("change", () => {
        couponState.store = couponStoreFilter.value;
        couponState.page = 1;
        renderCoupons();
      });
    }
    if (couponStatusFilter) {
      couponStatusFilter.addEventListener("change", () => {
        couponState.status = couponStatusFilter.value;
        couponState.page = 1;
        renderCoupons();
      });
    }
    if (couponSearch) {
      couponSearch.addEventListener("input", () => {
        couponState.search = couponSearch.value;
        couponState.page = 1;
        renderCoupons();
      });
    }
    if (couponSort) {
      couponSort.addEventListener("change", () => {
        couponState.sort = couponSort.value;
        couponState.page = 1;
        renderCoupons();
      });
    }
    if (couponTableBody) {
      couponTableBody.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const code = btn.getAttribute("data-code");
        if (action === "copy-coupon" && code) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(code)
              .then(() => showToast("Đã sao chép mã."))
              .catch(() => showToast("Không thể sao chép mã."));
          } else {
            showToast("Không thể sao chép mã.");
          }
        }
      });
    }

    if (complaintFilterBtn) {
      complaintFilterBtn.addEventListener("click", () => {
        complaintState.search = "";
        complaintState.level = "all";
        complaintState.sort = "recent";
        complaintState.page = 1;
        if (complaintSearch) complaintSearch.value = "";
        if (complaintLevelFilter) complaintLevelFilter.value = "all";
        if (complaintSort) complaintSort.value = "recent";
        renderComplaints();
      });
    }
    if (complaintSearch) {
      complaintSearch.addEventListener("input", () => {
        complaintState.search = complaintSearch.value;
        complaintState.page = 1;
        renderComplaints();
      });
    }
    if (complaintLevelFilter) {
      complaintLevelFilter.addEventListener("change", () => {
        complaintState.level = complaintLevelFilter.value;
        complaintState.page = 1;
        renderComplaints();
      });
    }
    if (complaintSort) {
      complaintSort.addEventListener("change", () => {
        complaintState.sort = complaintSort.value;
        complaintState.page = 1;
        renderComplaints();
      });
    }

    if (reviewStoreFilter) {
      reviewStoreFilter.addEventListener("change", () => {
        reviewState.store = reviewStoreFilter.value;
        reviewState.page = 1;
        renderReviews();
      });
    }
    if (reviewStatusFilter) {
      reviewStatusFilter.addEventListener("change", () => {
        reviewState.status = reviewStatusFilter.value;
        reviewState.page = 1;
        renderReviews();
      });
    }
    if (reviewSearch) {
      reviewSearch.addEventListener("input", () => {
        reviewState.search = reviewSearch.value;
        reviewState.page = 1;
        renderReviews();
      });
    }
    if (reviewSort) {
      reviewSort.addEventListener("change", () => {
        reviewState.sort = reviewSort.value;
        reviewState.page = 1;
        renderReviews();
      });
    }
    if (reviewExportBtn) {
      reviewExportBtn.addEventListener("click", () => {
        openModal({
          title: "Xuất danh sách đánh giá?",
          message: "Danh sách đánh giá sẽ được tổng hợp theo bộ lọc hiện tại.",
          onConfirm: () => showToast("Đã chuẩn bị danh sách đánh giá."),
        });
      });
    }

    if (withdrawStatusFilter) {
      withdrawStatusFilter.addEventListener("change", () => {
        withdrawState.status = withdrawStatusFilter.value;
        withdrawState.page = 1;
        renderWithdrawals();
      });
    }
    if (withdrawSearch) {
      withdrawSearch.addEventListener("input", () => {
        withdrawState.search = withdrawSearch.value;
        withdrawState.page = 1;
        renderWithdrawals();
      });
    }
    if (withdrawSort) {
      withdrawSort.addEventListener("change", () => {
        withdrawState.sort = withdrawSort.value;
        withdrawState.page = 1;
        renderWithdrawals();
      });
    }

    if (paymentSaveBtn) {
      paymentSaveBtn.addEventListener("click", () => {
        const payload = {
          bank: paymentBank ? paymentBank.value.trim() : "",
          account: paymentAccount ? paymentAccount.value.trim() : "",
          holder: paymentHolder ? paymentHolder.value.trim() : "",
        };
        openModal({
          title: "Lưu thiết lập thanh toán?",
          message: "Thông tin thanh toán sẽ được cập nhật ngay.",
          onConfirm: () => {
            services.payment.update(payload);
            showToast("Đã lưu thiết lập thanh toán.");
          },
        });
      });
    }

    const loadStores = () =>
      loadList(
        storeState,
        () =>
          services.stores.list().then((data) => {
            lastStoreRefresh = Date.now();
            return data;
          }),
        () => {
          renderStores();
          updateStoreOptions();
        },
        { onError: (error) => showToast(resolveLoadError(error, "Không thể tải danh sách gian hàng.")) }
      );

    if (storeRetryBtn) storeRetryBtn.addEventListener("click", loadStores);

    loadStores();
    if (!useProductV2 && typeof renderProducts === "function") {
      loadList(productState, services.products.list, renderProducts, {
        onError: (error) => showToast(resolveLoadError(error, "Không thể tải danh sách sản phẩm.")),
      });
      services.inventories.list().then((data) => {
        inventorySnapshot = data || [];
        renderProducts();
      });
    }
    loadList(orderState, services.orders.list, renderOrders);
    loadList(refundState, services.refunds.list, renderRefunds);
    loadList(preorderState, services.preorders.list, renderPreorders);
    loadList(couponState, services.coupons.list, renderCoupons);
    loadList(complaintState, services.complaints.list, renderComplaints);
    loadList(reviewState, services.reviews.list, renderReviews);
    loadList(withdrawState, services.withdrawals.list, renderWithdrawals);
    services.balances.get().then(renderBalances);
    services.payment.get().then(renderPayment);

    if (window.BKPanelData && typeof window.BKPanelData.subscribe === "function") {
      window.BKPanelData.subscribe(() => {
        syncList(storeState, services.stores.list, renderStores, () => updateStoreOptions());
        if (!useProductV2 && typeof renderProducts === "function") {
          syncList(productState, services.products.list, renderProducts);
          refreshInventorySnapshot();
        }
        syncList(orderState, services.orders.list, renderOrders);
        syncList(refundState, services.refunds.list, renderRefunds);
        syncList(preorderState, services.preorders.list, renderPreorders);
        syncList(couponState, services.coupons.list, renderCoupons);
        syncList(complaintState, services.complaints.list, renderComplaints);
        syncList(reviewState, services.reviews.list, renderReviews);
        syncList(withdrawState, services.withdrawals.list, renderWithdrawals);
        services.balances.get().then(renderBalances);
        services.payment.get().then(renderPayment);
      });
    }
  });
})();
