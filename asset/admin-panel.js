(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const services = window.BKPanelData ? window.BKPanelData.services : null;
    if (!services) return;

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
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
        return map[char] || char;
      });

    const normalizeText = (value) => String(value || "").toLowerCase();

    const formatVnd = (value) => {
      const amount = Number(value) || 0;
      if (typeof formatPrice === "function") return formatPrice(amount);
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(amount);
    };

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

    const modal = document.getElementById("admin-modal");
    const modalTitle = document.getElementById("admin-modal-title");
    const modalMessage = document.getElementById("admin-modal-message");
    const modalField = document.getElementById("admin-modal-field");
    const modalLabel = document.getElementById("admin-modal-label");
    const modalInput = document.getElementById("admin-modal-input");
    const modalCancel = document.getElementById("admin-modal-cancel");
    const modalConfirm = document.getElementById("admin-modal-confirm");
    let modalConfirmHandler = null;

    const closeModal = () => {
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      modalConfirmHandler = null;
    };

    const openModal = ({ title, message, inputLabel, inputPlaceholder, confirmText, onConfirm }) => {
      if (!modal) return;
      if (modalTitle) modalTitle.textContent = title || "";
      if (modalMessage) modalMessage.textContent = message || "";
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
      modal.setAttribute("aria-hidden", "false");
    };

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

    const LEGACY_ADMIN_KEY = "bk_admin_auth";
    const ADMIN_SESSION_KEY = "bk_admin_session";
    const ADMIN_CRED_KEY = "bk_admin_creds";
    const ADMIN_USER_ID = "admin-web";
    const ADMIN_DISPLAY_NAME = "B\u1ea1ch Kim";
    const getAdminKeys = () => {
      const env = window.BK_ENV && typeof window.BK_ENV === "object" ? window.BK_ENV : {};
      const authKeyRaw =
        typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER
          ? env.ADMIN_PANEL_USER
          : typeof env.ADMIN_AUTH_KEY === "string"
            ? env.ADMIN_AUTH_KEY
            : "";
      const panelKeyRaw =
        typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS
          ? env.ADMIN_PANEL_PASS
          : typeof env.ADMIN_PANEL_KEY === "string"
            ? env.ADMIN_PANEL_KEY
            : "";
      return { authKey: String(authKeyRaw || "").trim(), panelKey: String(panelKeyRaw || "").trim() };
    };
    const setAdminCreds = (keys) => {
      if (!keys || !keys.authKey || !keys.panelKey) return;
      const payload = JSON.stringify({ authKey: keys.authKey, panelKey: keys.panelKey });
      try {
        sessionStorage.setItem(ADMIN_CRED_KEY, payload);
      } catch (e) {
        try {
          localStorage.setItem(ADMIN_CRED_KEY, payload);
        } catch (err) {}
      }
    };
    const getAdminCreds = () => {
      try {
        const raw = sessionStorage.getItem(ADMIN_CRED_KEY) || localStorage.getItem(ADMIN_CRED_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.authKey || !parsed.panelKey) return null;
        return parsed;
      } catch (e) {
        return null;
      }
    };
    const clearAdminCreds = () => {
      try {
        sessionStorage.removeItem(ADMIN_CRED_KEY);
      } catch (e) {}
      try {
        localStorage.removeItem(ADMIN_CRED_KEY);
      } catch (e) {}
    };
    const getAdminHeaders = () => {
      const stored = getAdminCreds();
      const keys = stored && stored.authKey && stored.panelKey ? stored : getAdminKeys();
      if (!hasAdminKeys(keys)) return null;
      return {
        "x-admin-user": keys.authKey,
        "x-admin-pass": keys.panelKey,
      };
    };
    const getAdminSessionUrl = () => {
      const root = window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";
      return root + "api/admin/session";
    };
    const syncAdminSession = async () => {
      if (window.location.protocol === "file:") return;
      const headers = getAdminHeaders();
      if (!headers) return;
      try {
        const response = await fetch(getAdminSessionUrl(), { headers });
        const data = await response.json().catch(() => null);
        if (response.ok && data && data.user && window.BKAuth && typeof window.BKAuth.set === "function") {
          window.BKAuth.set(data.user);
        }
      } catch (error) {
        // ignore session sync errors
      }
    };
    const verifyAdminKeys = async (keys) => {
      if (!keys || !keys.authKey || !keys.panelKey) return false;
      if (window.location.protocol === "file:") return false;
      try {
        const response = await fetch(getAdminSessionUrl(), {
          headers: {
            "x-admin-user": keys.authKey,
            "x-admin-pass": keys.panelKey,
          },
        });
        return response.ok;
      } catch (error) {
        return false;
      }
    };
    const hasAdminKeys = (keys) => Boolean(keys && keys.authKey && keys.panelKey);
    const setAdminIdentity = () => {
      if (!window.BKAuth || typeof window.BKAuth.set !== "function") return;
      window.BKAuth.set({
        id: ADMIN_USER_ID,
        name: "Bạch Kim",
        display_name: "Bạch Kim",
        username: "admin",
        role: "admin",
        sellerApproved: true,
        canPostTasks: true,
        taskApproved: true,
        badge: "Admin",
      });
    };
    const clearAdminIdentity = () => {
      if (!window.BKAuth || typeof window.BKAuth.read !== "function" || typeof window.BKAuth.clear !== "function") return;
      const auth = window.BKAuth.read();
      if (auth && auth.user && auth.user.role === "admin") {
        window.BKAuth.clear();
      }
    };
    const pruneLegacyAdminUser = () => {
      if (!window.BKAuth || typeof window.BKAuth.read !== "function" || typeof window.BKAuth.clear !== "function") return;
      const auth = window.BKAuth.read();
      if (!auth || !auth.user || auth.user.role !== "admin") return;
      const keys = getAdminKeys();
      const stored = getAdminCreds();
      if (!hasAdminKeys(keys) && !stored) {
        window.BKAuth.clear();
      }
    };
    const resetLegacyAdmin = () => {
      try {
        localStorage.removeItem(LEGACY_ADMIN_KEY);
      } catch (e) {}
    };
    const setAdminSession = () => {
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      setAdminIdentity();
      syncAdminSession();
    };
    const clearAdminSession = () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      clearAdminCreds();
      clearAdminIdentity();
    };
    const readAdminInputs = () => {
      const user = document.getElementById("admin-user");
      const pass = document.getElementById("admin-pass");
      return {
        authKey: user ? user.value.trim() : "",
        panelKey: pass ? pass.value.trim() : "",
      };
    };

    const authCard = document.getElementById("admin-auth");
    const panel = document.getElementById("admin-panel");
    const loginBtn = document.getElementById("admin-login");
    const logoutBtn = document.getElementById("admin-logout");
    const errorBox = document.getElementById("admin-error");

    const showPanel = () => {
      if (authCard) authCard.style.display = "none";
      if (panel) panel.style.display = "grid";
    };

    const showAuth = () => {
      if (authCard) authCard.style.display = "block";
      if (panel) panel.style.display = "none";
    };

    resetLegacyAdmin();
    pruneLegacyAdminUser();
    const envKeys = getAdminKeys();
    const storedCreds = getAdminCreds();
    if (localStorage.getItem(ADMIN_SESSION_KEY) === "true" && (hasAdminKeys(storedCreds) || hasAdminKeys(envKeys))) {
      if (!hasAdminKeys(storedCreds)) setAdminCreds(envKeys);
      setAdminIdentity();
      syncAdminSession();
      showPanel();
    } else {
      clearAdminSession();
      showAuth();
    }

    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        const inputKeys = readAdminInputs();
        if (!inputKeys.authKey || !inputKeys.panelKey) {
          if (errorBox) {
            errorBox.textContent = "Both admin keys are required.";
            errorBox.style.display = "block";
          }
          return;
        }
        loginBtn.disabled = true;
        loginBtn.setAttribute("aria-busy", "true");
        verifyAdminKeys(inputKeys)
          .then((ok) => {
            if (ok) {
              setAdminCreds(inputKeys);
              setAdminSession();
              if (errorBox) errorBox.style.display = "none";
              showPanel();
              return;
            }
            if (errorBox) {
              errorBox.textContent = "Invalid admin keys.";
              errorBox.style.display = "block";
            }
          })
          .finally(() => {
            loginBtn.disabled = false;
            loginBtn.removeAttribute("aria-busy");
          });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearAdminSession();
        showAuth();
      });
    }

    const navButtons = document.querySelectorAll("#admin-nav button");
    const sections = document.querySelectorAll(".seller-section");
    const pageTitle = document.getElementById("admin-page-title");
    const pageSub = document.getElementById("admin-page-sub");

    const setView = (view) => {
      navButtons.forEach((item) => item.classList.toggle("active", item.getAttribute("data-view") === view));
      sections.forEach((section) => {
        section.classList.toggle("active", section.getAttribute("data-view") === view);
      });
      const activeBtn = Array.from(navButtons).find((btn) => btn.getAttribute("data-view") === view);
      if (activeBtn && pageTitle && activeBtn.dataset.title) pageTitle.innerHTML = activeBtn.dataset.title;
      if (activeBtn && pageSub && activeBtn.dataset.sub) pageSub.innerHTML = activeBtn.dataset.sub;
      if (view === "finance") {
        requestAnimationFrame(() => renderAdminChart(adminRange));
      }
    };

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        if (view) setView(view);
      });
    });

    document.body.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-jump]");
      if (!btn) return;
      const view = btn.getAttribute("data-jump");
      if (view) setView(view);
    });

    let adminRange = "1d";
    const chartRangeButtons = document.querySelectorAll("[data-admin-range]");
    const chartLine = document.getElementById("admin-chart-line");
    const chartArea = document.getElementById("admin-chart-area");
    const chartDot = document.getElementById("admin-chart-dot");
    const chartAxisX = document.getElementById("admin-chart-x");
    const chartAxisY = document.getElementById("admin-chart-y");
    const chartAxisNote = document.getElementById("admin-chart-axis-note");

    const totalUsersEl = document.getElementById("admin-total-users");
    const totalSellersEl = document.getElementById("admin-total-sellers");
    const revenueTodayEl = document.getElementById("admin-revenue-today");
    const revenueTotalEl = document.getElementById("admin-revenue-total");
    const maintenanceStatus = document.getElementById("admin-maintenance-status");

    const pendingFinanceEl = document.getElementById("admin-pending-finance");
    const pendingStoresEl = document.getElementById("admin-pending-stores");
    const pendingStoreUpdatesEl = document.getElementById("admin-pending-store-updates");
    const pendingSellersEl = document.getElementById("admin-pending-sellers");
    const pendingRefundsEl = document.getElementById("admin-pending-refunds");

    const miniRevenueValue = document.getElementById("admin-mini-revenue");
    const miniRevenueLine = document.getElementById("admin-mini-revenue-line");
    const miniUserValue = document.getElementById("admin-mini-active-users");
    const miniUserLine = document.getElementById("admin-mini-user-line");
    const approvalRateValue = document.getElementById("admin-approval-rate");
    const approvalDonut = document.getElementById("admin-approval-donut");

    const taskFinance = document.getElementById("admin-task-finance");
    const taskStores = document.getElementById("admin-task-stores");
    const taskApprovals = document.getElementById("admin-task-approvals");
    const taskRefunds = document.getElementById("admin-task-refunds");

    const revenueSearch = document.getElementById("admin-revenue-search");
    const revenueTypeFilter = document.getElementById("admin-revenue-type-filter");
    const revenueSort = document.getElementById("admin-revenue-sort");
    const revenuePeriodTotal = document.getElementById("admin-revenue-period-total");
    const revenueAdmin = document.getElementById("admin-revenue-admin");
    const revenueAdminStore = document.getElementById("admin-revenue-admin-store");
    const revenueFee = document.getElementById("admin-revenue-fee");
    const revenueJob = document.getElementById("admin-revenue-job");
    const revenueJobFee = document.getElementById("admin-revenue-job-fee");
    const revenueBody = document.getElementById("admin-revenue-source-body");
    const revenueEmpty = document.getElementById("admin-revenue-source-empty");
    const revenueError = document.getElementById("admin-revenue-source-error");
    const revenuePagination = document.getElementById("admin-revenue-source-pagination");

    const balanceAvailable = document.getElementById("admin-balance-available");
    const balanceHold = document.getElementById("admin-balance-hold");
    const balanceTotal = document.getElementById("admin-balance-total");
    const withdrawStatus = document.getElementById("admin-withdraw-status");
    const withdrawSearch = document.getElementById("admin-withdraw-search");
    const withdrawSort = document.getElementById("admin-withdraw-sort");
    const withdrawBody = document.getElementById("admin-withdrawal-body");
    const withdrawEmpty = document.getElementById("admin-withdrawal-empty");
    const withdrawError = document.getElementById("admin-withdrawal-error");
    const withdrawPagination = document.getElementById("admin-withdrawal-pagination");

    const balanceSourceSearch = document.getElementById("admin-balance-source-search");
    const balanceSourceSort = document.getElementById("admin-balance-source-sort");
    const balanceSourceBody = document.getElementById("admin-balance-source-body");
    const balanceSourceEmpty = document.getElementById("admin-balance-source-empty");
    const balanceSourceError = document.getElementById("admin-balance-source-error");
    const balanceSourcePagination = document.getElementById("admin-balance-source-pagination");

    const userTotalEl = document.getElementById("admin-users-total");
    const userOnlineEl = document.getElementById("admin-users-online");
    const userOfflineEl = document.getElementById("admin-users-offline");
    const usersExportBtn = document.getElementById("admin-users-export");
    const usersSearch = document.getElementById("admin-users-search");
    const usersStatusFilter = document.getElementById("admin-users-status-filter");
    const usersSort = document.getElementById("admin-users-sort");
    const usersBody = document.getElementById("admin-users-body");
    const usersEmpty = document.getElementById("admin-users-empty");
    const usersError = document.getElementById("admin-users-error");
    const usersPagination = document.getElementById("admin-users-pagination");

    const storeBulkApproveBtn = document.getElementById("admin-store-bulk-approve");
    const storeApproveSearch = document.getElementById("admin-store-approve-search");
    const storeApproveSort = document.getElementById("admin-store-approve-sort");
    const storeApproveBody = document.getElementById("admin-store-approve-body");
    const storeApproveEmpty = document.getElementById("admin-store-approve-empty");
    const storeApproveError = document.getElementById("admin-store-approve-error");
    const storeApprovePagination = document.getElementById("admin-store-approve-pagination");

    const storeUpdateSearch = document.getElementById("admin-store-update-search");
    const storeUpdateSort = document.getElementById("admin-store-update-sort");
    const storeUpdateBody = document.getElementById("admin-store-update-body");
    const storeUpdateEmpty = document.getElementById("admin-store-update-empty");
    const storeUpdateError = document.getElementById("admin-store-update-error");
    const storeUpdatePagination = document.getElementById("admin-store-update-pagination");

    const storeDiffCard = document.getElementById("admin-store-diff-card");
    const storeDiffTitle = document.getElementById("admin-store-diff-title");
    const storeDiffOld = document.getElementById("admin-store-diff-old");
    const storeDiffNew = document.getElementById("admin-store-diff-new");
    const storeDiffClose = document.getElementById("admin-store-diff-close");

    const inventoryUser = document.getElementById("admin-inventory-user");
    const inventoryStore = document.getElementById("admin-inventory-store");
    const inventoryProduct = document.getElementById("admin-inventory-product");
    const inventorySearchBtn = document.getElementById("admin-inventory-search-btn");
    const inventoryResetBtn = document.getElementById("admin-inventory-reset-btn");
    const inventoryExportExcel = document.getElementById("admin-inventory-export-excel");
    const inventoryExportTxt = document.getElementById("admin-inventory-export-txt");
    const inventoryBody = document.getElementById("admin-inventory-body");
    const inventoryEmpty = document.getElementById("admin-inventory-empty");
    const inventoryError = document.getElementById("admin-inventory-error");
    const inventoryPagination = document.getElementById("admin-inventory-pagination");

    const pendingTopup = document.getElementById("admin-pending-topup");
    const pendingWithdraw = document.getElementById("admin-pending-withdraw");
    const pendingService = document.getElementById("admin-pending-service");
    const viewTopupBtn = document.getElementById("admin-view-topup");
    const viewWithdrawBtn = document.getElementById("admin-view-withdraw");
    const viewServiceBtn = document.getElementById("admin-view-service");

    const orderIdInput = document.getElementById("admin-order-id");
    const orderCheckBtn = document.getElementById("admin-order-check");
    const orderResult = document.getElementById("admin-order-result");
    const ordersExportBtn = document.getElementById("admin-orders-export");
    const ordersSearch = document.getElementById("admin-orders-search");
    const ordersStatus = document.getElementById("admin-orders-status");
    const ordersSort = document.getElementById("admin-orders-sort");
    const ordersBody = document.getElementById("admin-orders-body");
    const ordersEmpty = document.getElementById("admin-orders-empty");
    const ordersError = document.getElementById("admin-orders-error");
    const ordersPagination = document.getElementById("admin-orders-pagination");

    const complaintsExportBtn = document.getElementById("admin-complaints-export");
    const complaintsSearch = document.getElementById("admin-complaints-search");
    const complaintsLevel = document.getElementById("admin-complaints-level");
    const complaintsStatus = document.getElementById("admin-complaints-status");
    const complaintsSort = document.getElementById("admin-complaints-sort");
    const complaintsBody = document.getElementById("admin-complaints-body");
    const complaintsEmpty = document.getElementById("admin-complaints-empty");
    const complaintsError = document.getElementById("admin-complaints-error");
    const complaintsPagination = document.getElementById("admin-complaints-pagination");

    const maintenancePill = document.getElementById("admin-maintenance-pill");
    const maintenanceEnable = document.getElementById("admin-maintenance-enable");
    const maintenanceDisable = document.getElementById("admin-maintenance-disable");
    const maintenanceUnlock = document.getElementById("admin-maintenance-unlock");
    const maintenanceApply = document.getElementById("admin-maintenance-apply");
    const maintenanceMessage = document.getElementById("admin-maintenance-message");
    const maintenanceDuration = document.getElementById("admin-maintenance-duration");
    const maintenanceEnd = document.getElementById("admin-maintenance-end");
    const maintenanceRemaining = document.getElementById("admin-maintenance-remaining");
    const maintenanceMode = document.getElementById("admin-maintenance-mode");
    const maintenanceSearch = document.getElementById("admin-maintenance-search");
    const maintenanceRouteGroups = Array.from(document.querySelectorAll("[data-maintenance-group]"));
    const maintenanceRouteInputs = Array.from(document.querySelectorAll("[data-maintenance-route]"));

    const feeDefault = document.getElementById("admin-fee-default");
    const feeThreshold = document.getElementById("admin-fee-threshold");
    const feeLowRate = document.getElementById("admin-fee-low-rate");
    const feeSaveBtn = document.getElementById("admin-fee-save");

    const approvalsResetBtn = document.getElementById("admin-approvals-reset");
    const approvalsSearch = document.getElementById("admin-approvals-search");
    const approvalsType = document.getElementById("admin-approvals-type");
    const approvalsStatus = document.getElementById("admin-approvals-status");
    const approvalsSort = document.getElementById("admin-approvals-sort");
    const approvalsBody = document.getElementById("admin-approvals-body");
    const approvalsEmpty = document.getElementById("admin-approvals-empty");
    const approvalsError = document.getElementById("admin-approvals-error");
    const approvalsPagination = document.getElementById("admin-approvals-pagination");

    const MAINTENANCE_DEFAULT = {
      globalEnabled: false,
      message: "Bao tri he thong, xin loi vi su bat tien nay.",
      startAt: null,
      endAt: null,
      routeLocks: {},
      version: 0,
      active: false,
      expired: false,
    };
    const MAINTENANCE_MIN_DURATION = 0.1;

    const revenueState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", type: "all", sort: "recent" };
    const balanceSourceState = { data: [], loading: true, error: false, page: 1, perPage: 4, search: "", sort: "recent" };
    const withdrawState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", sort: "recent" };
    const userState = { data: [], loading: true, error: false, page: 1, perPage: 8, search: "", status: "all", sort: "recent" };
    const storeApproveState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", sort: "recent" };
    const storeUpdateState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", sort: "recent" };
    const inventoryState = { data: [], loading: false, page: 1, perPage: 6, search: "", store: "all", product: "all" };
    const orderState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", status: "all", sort: "recent" };
    const complaintState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", level: "all", status: "all", sort: "recent" };
    const approvalState = { data: [], loading: true, error: false, page: 1, perPage: 6, search: "", type: "all", status: "all", sort: "recent" };

    let storesCache = [];
    let productsCache = [];
    let inventoriesCache = [];
    let financeRequestsCache = [];
    let refundsCache = [];

    const formatAxis = (value) => {
      const amount = Number(value) || 0;
      if (amount >= 1000000000) {
        const val = (amount / 1000000000).toFixed(1).replace(/\.0$/, "");
        return `${val}B`;
      }
      if (amount >= 1000000) {
        const val = (amount / 1000000).toFixed(1).replace(/\.0$/, "");
        return `${val}M`;
      }
      if (amount >= 1000) {
        const val = (amount / 1000).toFixed(1).replace(/\.0$/, "");
        return `${val}K`;
      }
      return String(amount);
    };

    const chartRanges = {
      "1d": {
        note: "Tr\u1ee5c X: Gi\u1edd",
        labels: ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"],
        points: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      "3d": {
        note: "Tr\u1ee5c X: Ng\u00e0y",
        labels: ["D1", "D1", "D1", "D2", "D2", "D2", "D3", "D3", "D3", "D3", "D3", "D3"],
        points: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      "7d": {
        note: "Tr\u1ee5c X: Ng\u00e0y",
        labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
        points: [0, 0, 0, 0, 0, 0, 0],
      },
      "28d": {
        note: "Tr\u1ee5c X: Tu\u1ea7n",
        labels: ["W1", "W2", "W3", "W4"],
        points: [0, 0, 0, 0],
      },
      "1y": {
        note: "Tr\u1ee5c X: Th\u00e1ng",
        labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
        points: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
      life: {
        note: "Tr\u1ee5c X: N\u0103m",
        labels: ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030"],
        points: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    };

    const buildChartPath = (points, width, height, padding) => {
      const max = Math.max(...points, 1);
      const min = Math.min(...points);
      const span = max - min || 1;
      const usableHeight = height - padding * 2;
      const coords = points.map((value, index) => {
        const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
        const y = padding + (1 - (value - min) / span) * usableHeight;
        return { x, y };
      });
      const line = coords.map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
      const area = `${line} L ${width},${height} L 0,${height} Z`;
      return { line, area, last: coords[coords.length - 1], max, min };
    };

    const renderMiniChart = (points, lineEl) => {
      if (!lineEl || !points.length) return;
      const { line } = buildChartPath(points, 120, 56, 6);
      lineEl.setAttribute("d", line);
    };

    const renderAdminChart = (rangeKey) => {
      const data = chartRanges[rangeKey] || chartRanges["1d"];
      if (!data || !data.points.length) return;
      const { line, area, last, max, min } = buildChartPath(data.points, 600, 200, 20);
      if (chartLine) chartLine.setAttribute("d", line);
      if (chartArea) chartArea.setAttribute("d", area);
      if (chartDot && last) {
        chartDot.setAttribute("cx", last.x);
        chartDot.setAttribute("cy", last.y);
      }
      if (chartAxisX) {
        chartAxisX.innerHTML = data.labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
      }
      if (chartAxisY) {
        const mid = (max + min) / 2;
        chartAxisY.innerHTML = [max, mid, min].map((val) => `<span>${formatAxis(val)}</span>`).join("");
      }
      if (chartAxisNote) chartAxisNote.textContent = data.note || "";
    };

    const formatDateLabel = (value) => {
      const date = parseDateValue(value);
      if (!date || Number.isNaN(date.getTime())) return "--";
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${date.getFullYear()}`;
    };

    const getRevenueLabel = (type) => {
      switch (type) {
        case "transaction_fee":
          return "Phi giao dich";
        case "admin_store":
          return "Doanh thu gian hang admin";
        case "reseller":
          return "Phi ban hang";
        case "service_fee":
          return "Phi nhiem vu";
        default:
          return type || "--";
      }
    };

    const setTableState = (state, tbody, emptyEl, errorEl, columns) => {
      if (!tbody) return;
      if (state.loading) {
        if (columns) renderTableSkeleton(tbody, columns);
        if (emptyEl) emptyEl.classList.add("is-hidden");
        if (errorEl) errorEl.classList.add("is-hidden");
        return;
      }
      if (state.error) {
        if (emptyEl) emptyEl.classList.add("is-hidden");
        if (errorEl) errorEl.classList.remove("is-hidden");
        return;
      }
      if (errorEl) errorEl.classList.add("is-hidden");
    };

    const loadList = (state, fetcher, onDone) => {
      state.loading = true;
      state.error = false;
      if (state === revenueState) setTableState(state, revenueBody, revenueEmpty, revenueError, 9);
      if (state === balanceSourceState) setTableState(state, balanceSourceBody, balanceSourceEmpty, balanceSourceError, 7);
      if (state === withdrawState) setTableState(state, withdrawBody, withdrawEmpty, withdrawError, 5);
      if (state === userState) setTableState(state, usersBody, usersEmpty, usersError, 6);
      if (state === orderState) setTableState(state, ordersBody, ordersEmpty, ordersError, 6);
      if (state === complaintState) setTableState(state, complaintsBody, complaintsEmpty, complaintsError, 6);
      if (state === approvalState) setTableState(state, approvalsBody, approvalsEmpty, approvalsError, 6);
      return Promise.resolve()
        .then(fetcher)
        .then((data) => {
          state.data = Array.isArray(data) ? data : [];
          state.loading = false;
          state.error = false;
          if (typeof onDone === "function") onDone();
        })
        .catch(() => {
          state.loading = false;
          state.error = true;
          if (typeof onDone === "function") onDone();
        });
    };

    const syncList = (state, fetcher, onDone) =>
      Promise.resolve()
        .then(fetcher)
        .then((data) => {
          state.data = Array.isArray(data) ? data : [];
          state.error = false;
          if (typeof onDone === "function") onDone();
        })
        .catch(() => {
          state.error = true;
          if (typeof onDone === "function") onDone();
        });

    const filterRevenueSources = (state) => {
      const list = Array.isArray(state.data) ? state.data : [];
      const search = normalizeText(state.search || "");
      return list
        .filter((item) => {
          if (!item) return false;
          if (state.type && state.type !== "all" && item.type !== state.type) return false;
          if (!search) return true;
          const haystack = [
            item.storeName,
            item.storeId,
            item.jobId,
            item.transactionId,
            item.type,
            item.sourceId,
          ]
            .map((val) => normalizeText(val))
            .join(" ");
          return haystack.includes(search);
        })
        .sort((a, b) => {
          if (state.sort === "total_high") return (Number(b.total) || 0) - (Number(a.total) || 0);
          if (state.sort === "fee_high") return (Number(b.fee) || 0) - (Number(a.fee) || 0);
          return parseDateValue(b.createdAt || b.created_at) - parseDateValue(a.createdAt || a.created_at);
        });
    };

    const renderRevenueTable = () => {
      if (!revenueBody) return;
      setTableState(revenueState, revenueBody, revenueEmpty, revenueError, 9);
      if (revenueState.loading || revenueState.error) return;
      const list = filterRevenueSources(revenueState);
      if (!list.length) {
        revenueBody.innerHTML = "";
        if (revenueEmpty) revenueEmpty.classList.remove("is-hidden");
        return;
      }
      if (revenueEmpty) revenueEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, revenueState.page, revenueState.perPage);
      revenueBody.innerHTML = pageItems
        .map((item) => {
          const percent = item.percent != null ? `${Number(item.percent).toFixed(1)}%` : "--";
          return `
            <tr>
              <td>${escapeHtml(getRevenueLabel(item.type))}</td>
              <td>${escapeHtml(item.storeName || item.storeId || "--")}</td>
              <td>${escapeHtml(item.jobId || "--")}</td>
              <td>${escapeHtml(item.transactionId || "--")}</td>
              <td>${formatVnd(item.fee)}</td>
              <td>${formatVnd(item.total)}</td>
              <td>${percent}</td>
              <td>${formatDateLabel(item.createdAt || item.created_at)}</td>
              <td>--</td>
            </tr>
          `;
        })
        .join("");
      if (revenuePagination) {
        renderPagination(revenuePagination, page, totalPages, (nextPage) => {
          revenueState.page = nextPage;
          renderRevenueTable();
        });
      }
    };

    const renderBalanceSourceTable = () => {
      if (!balanceSourceBody) return;
      setTableState(balanceSourceState, balanceSourceBody, balanceSourceEmpty, balanceSourceError, 7);
      if (balanceSourceState.loading || balanceSourceState.error) return;
      const list = filterRevenueSources(balanceSourceState);
      if (!list.length) {
        balanceSourceBody.innerHTML = "";
        if (balanceSourceEmpty) balanceSourceEmpty.classList.remove("is-hidden");
        return;
      }
      if (balanceSourceEmpty) balanceSourceEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, balanceSourceState.page, balanceSourceState.perPage);
      balanceSourceBody.innerHTML = pageItems
        .map((item) => {
          const percent = item.percent != null ? `${Number(item.percent).toFixed(1)}%` : "--";
          return `
            <tr>
              <td>${escapeHtml(getRevenueLabel(item.type))}</td>
              <td>${escapeHtml(item.storeName || item.storeId || "--")}</td>
              <td>${escapeHtml(item.transactionId || "--")}</td>
              <td>${formatVnd(item.fee)}</td>
              <td>${formatVnd(item.total)}</td>
              <td>${percent}</td>
              <td>${formatDateLabel(item.createdAt || item.created_at)}</td>
            </tr>
          `;
        })
        .join("");
      if (balanceSourcePagination) {
        renderPagination(balanceSourcePagination, page, totalPages, (nextPage) => {
          balanceSourceState.page = nextPage;
          renderBalanceSourceTable();
        });
      }
    };

    const renderRevenueMetrics = () => {
      const list = Array.isArray(revenueState.data) ? revenueState.data : [];
      const totals = list.reduce(
        (acc, item) => {
          if (!item) return acc;
          acc.total += Number(item.total) || 0;
          if (item.type === "admin_store") acc.adminStore += Number(item.total) || 0;
          if (item.type === "service_fee") acc.job += Number(item.total) || 0;
          if (item.type === "service_fee") acc.jobFee += Number(item.fee) || 0;
          if (["transaction_fee", "reseller", "service_fee"].includes(item.type)) acc.admin += Number(item.fee) || 0;
          acc.fee += Number(item.fee) || 0;
          return acc;
        },
        { total: 0, admin: 0, adminStore: 0, fee: 0, job: 0, jobFee: 0 }
      );
      if (revenuePeriodTotal) revenuePeriodTotal.textContent = formatVnd(totals.total);
      if (revenueAdmin) revenueAdmin.textContent = formatVnd(totals.admin);
      if (revenueAdminStore) revenueAdminStore.textContent = formatVnd(totals.adminStore);
      if (revenueFee) revenueFee.textContent = formatVnd(totals.fee);
      if (revenueJob) revenueJob.textContent = formatVnd(totals.job);
      if (revenueJobFee) revenueJobFee.textContent = formatVnd(totals.jobFee);
    };

    const renderAdminBalances = (balance) => {
      const data = balance || { available: 0, pending: 0, total: 0 };
      if (balanceAvailable) balanceAvailable.textContent = formatVnd(data.available);
      if (balanceHold) balanceHold.textContent = formatVnd(data.pending || data.hold || 0);
      if (balanceTotal) balanceTotal.textContent = formatVnd(data.total);
    };

    const renderWithdrawals = () => {
      if (!withdrawBody) return;
      setTableState(withdrawState, withdrawBody, withdrawEmpty, withdrawError, 5);
      if (withdrawState.loading || withdrawState.error) return;
      const list = (Array.isArray(withdrawState.data) ? withdrawState.data : [])
        .filter((item) => {
          if (!item) return false;
          if (withdrawState.status !== "all" && item.status !== withdrawState.status) return false;
          const search = normalizeText(withdrawState.search || "");
          if (!search) return true;
          return normalizeText(item.withdrawalId || item.reference || "").includes(search);
        })
        .sort((a, b) => parseDateValue(b.createdAt || b.created_at) - parseDateValue(a.createdAt || a.created_at));
      if (!list.length) {
        withdrawBody.innerHTML = "";
        if (withdrawEmpty) withdrawEmpty.classList.remove("is-hidden");
        return;
      }
      if (withdrawEmpty) withdrawEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, withdrawState.page, withdrawState.perPage);
      withdrawBody.innerHTML = pageItems
        .map((item) => {
          return `
            <tr>
              <td>${escapeHtml(item.withdrawalId || "--")}</td>
              <td>${formatVnd(item.amount)}</td>
              <td>${escapeHtml(item.method || "--")}</td>
              <td>${escapeHtml(item.status || "--")}</td>
              <td>${formatDateLabel(item.createdAt || item.created_at)}</td>
            </tr>
          `;
        })
        .join("");
      if (withdrawPagination) {
        renderPagination(withdrawPagination, page, totalPages, (nextPage) => {
          withdrawState.page = nextPage;
          renderWithdrawals();
        });
      }
    };

    const renderUsers = () => {
      if (!usersBody) return;
      setTableState(userState, usersBody, usersEmpty, usersError, 6);
      if (userState.loading || userState.error) return;
      const list = (Array.isArray(userState.data) ? userState.data : [])
        .filter((item) => {
          if (!item) return false;
          if (userState.status !== "all" && item.status !== userState.status) return false;
          const search = normalizeText(userState.search || "");
          if (!search) return true;
          return (
            normalizeText(item.username).includes(search) ||
            normalizeText(item.email).includes(search) ||
            normalizeText(item.userId).includes(search)
          );
        })
        .sort((a, b) => parseDateValue(b.createdAt || b.created_at) - parseDateValue(a.createdAt || a.created_at));
      if (!list.length) {
        usersBody.innerHTML = "";
        if (usersEmpty) usersEmpty.classList.remove("is-hidden");
        return;
      }
      if (usersEmpty) usersEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, userState.page, userState.perPage);
      usersBody.innerHTML = pageItems
        .map((item) => {
          const statusLabel = item.status || "active";
          const onlineLabel = item.online ? "Online" : "Offline";
          return `
            <tr>
              <td>${escapeHtml(item.userId || item.id || "--")}</td>
              <td>${escapeHtml(item.username || "--")}</td>
              <td>${escapeHtml(item.email || "--")}</td>
              <td>${escapeHtml(statusLabel)}</td>
              <td>${escapeHtml(onlineLabel)}</td>
              <td>${formatDateLabel(item.createdAt || item.created_at)}</td>
            </tr>
          `;
        })
        .join("");
      if (usersPagination) {
        renderPagination(usersPagination, page, totalPages, (nextPage) => {
          userState.page = nextPage;
          renderUsers();
        });
      }
    };

    const renderOrders = () => {
      if (!ordersBody) return;
      setTableState(orderState, ordersBody, ordersEmpty, ordersError, 6);
      if (orderState.loading || orderState.error) return;
      const list = (Array.isArray(orderState.data) ? orderState.data : [])
        .filter((item) => {
          if (!item) return false;
          if (orderState.status !== "all" && item.status !== orderState.status) return false;
          const search = normalizeText(orderState.search || "");
          if (!search) return true;
          return (
            normalizeText(item.orderId).includes(search) ||
            normalizeText(item.storeId).includes(search) ||
            normalizeText(item.buyer).includes(search)
          );
        })
        .sort((a, b) => parseDateValue(b.createdAt || b.created_at) - parseDateValue(a.createdAt || a.created_at));
      if (!list.length) {
        ordersBody.innerHTML = "";
        if (ordersEmpty) ordersEmpty.classList.remove("is-hidden");
        return;
      }
      if (ordersEmpty) ordersEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, orderState.page, orderState.perPage);
      ordersBody.innerHTML = pageItems
        .map((item) => {
          return `
            <tr>
              <td>${escapeHtml(item.orderId || "--")}</td>
              <td>${escapeHtml(item.storeId || "--")}</td>
              <td>${escapeHtml(item.productName || "--")}</td>
              <td>${escapeHtml(item.buyer || "--")}</td>
              <td>${formatVnd(item.total)}</td>
              <td>${escapeHtml(item.status || "--")}</td>
            </tr>
          `;
        })
        .join("");
      if (ordersPagination) {
        renderPagination(ordersPagination, page, totalPages, (nextPage) => {
          orderState.page = nextPage;
          renderOrders();
        });
      }
    };

    const renderComplaints = () => {
      if (!complaintsBody) return;
      setTableState(complaintState, complaintsBody, complaintsEmpty, complaintsError, 6);
      if (complaintState.loading || complaintState.error) return;
      const list = (Array.isArray(complaintState.data) ? complaintState.data : [])
        .filter((item) => {
          if (!item) return false;
          if (complaintState.level !== "all" && item.level !== complaintState.level) return false;
          if (complaintState.status !== "all" && item.status !== complaintState.status) return false;
          const search = normalizeText(complaintState.search || "");
          if (!search) return true;
          return normalizeText(item.ticketId || item.user || "").includes(search);
        })
        .sort((a, b) => parseDateValue(b.createdAt || b.created_at) - parseDateValue(a.createdAt || a.created_at));
      if (!list.length) {
        complaintsBody.innerHTML = "";
        if (complaintsEmpty) complaintsEmpty.classList.remove("is-hidden");
        return;
      }
      if (complaintsEmpty) complaintsEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, complaintState.page, complaintState.perPage);
      complaintsBody.innerHTML = pageItems
        .map((item) => {
          return `
            <tr>
              <td>${escapeHtml(item.ticketId || "--")}</td>
              <td>${escapeHtml(item.user || "--")}</td>
              <td>${escapeHtml(item.level || "--")}</td>
              <td>${escapeHtml(item.status || "--")}</td>
              <td>${escapeHtml(item.note || "--")}</td>
              <td>${formatDateLabel(item.createdAt || item.created_at)}</td>
            </tr>
          `;
        })
        .join("");
      if (complaintsPagination) {
        renderPagination(complaintsPagination, page, totalPages, (nextPage) => {
          complaintState.page = nextPage;
          renderComplaints();
        });
      }
    };

    const renderApprovals = () => {
      if (!approvalsBody) return;
      setTableState(approvalState, approvalsBody, approvalsEmpty, approvalsError, 6);
      if (approvalState.loading || approvalState.error) return;
      const list = (Array.isArray(approvalState.data) ? approvalState.data : [])
        .filter((item) => {
          if (!item) return false;
          if (approvalState.type !== "all" && item.type !== approvalState.type) return false;
          if (approvalState.status !== "all" && item.status !== approvalState.status) return false;
          const search = normalizeText(approvalState.search || "");
          if (!search) return true;
          const user = item.user || {};
          return normalizeText(user.email || user.username || user.id || "").includes(search);
        })
        .sort((a, b) => parseDateValue(b.submittedAt || b.createdAt) - parseDateValue(a.submittedAt || a.createdAt));
      if (!list.length) {
        approvalsBody.innerHTML = "";
        if (approvalsEmpty) approvalsEmpty.classList.remove("is-hidden");
        return;
      }
      if (approvalsEmpty) approvalsEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(list, approvalState.page, approvalState.perPage);
      approvalsBody.innerHTML = pageItems
        .map((item) => {
          const user = item.user || {};
          return `
            <tr>
              <td>${escapeHtml(item.approvalId || "--")}</td>
              <td>${escapeHtml(user.username || user.email || "--")}</td>
              <td>${escapeHtml(item.type || "--")}</td>
              <td>${escapeHtml(item.status || "--")}</td>
              <td>${formatDateLabel(item.submittedAt || item.createdAt)}</td>
              <td class="admin-action-row actions-inline">
                <button class="btn sm ghost" type="button" data-action="approve-approval" data-approval-id="${escapeHtml(
                  item.approvalId || ""
                )}">Duyet</button>
                <button class="btn sm ghost" type="button" data-action="reject-approval" data-approval-id="${escapeHtml(
                  item.approvalId || ""
                )}">Tu choi</button>
              </td>
            </tr>
          `;
        })
        .join("");
      if (approvalsPagination) {
        renderPagination(approvalsPagination, page, totalPages, (nextPage) => {
          approvalState.page = nextPage;
          renderApprovals();
        });
      }
    };

    const renderSettings = (settings) => {
      const data = settings || {};
      if (feeDefault) feeDefault.value = Number(data.defaultFeePercent || 0);
      if (feeThreshold) feeThreshold.value = Number(data.smallOrderThreshold || 0);
      if (feeLowRate) feeLowRate.value = Number(data.smallOrderFeePercent || 0);
    };

    const setDonutPercent = (element, percent) => {
      if (!element) return;
      const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
      element.style.background = `conic-gradient(#7b6cff ${safePercent}%, rgba(255,255,255,0.08) 0)`;
    };

    const updateOverview = () => {
      const users = Array.isArray(userState.data) ? userState.data : [];
      const stores = Array.isArray(storesCache) ? storesCache : [];
      const revenue = Array.isArray(revenueState.data) ? revenueState.data : [];
      const approvals = Array.isArray(approvalState.data) ? approvalState.data : [];

      if (totalUsersEl) totalUsersEl.textContent = users.length.toLocaleString("vi-VN");
      if (totalSellersEl) {
        const sellers = users.filter((user) => user && (user.role === "seller" || user.role === "admin" || user.sellerApproved));
        totalSellersEl.textContent = sellers.length.toLocaleString("vi-VN");
      }
      const totalRevenue = revenue.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      if (revenueTotalEl) revenueTotalEl.textContent = formatVnd(totalRevenue);
      if (revenueTodayEl) revenueTodayEl.textContent = formatVnd(totalRevenue);

      if (pendingFinanceEl) pendingFinanceEl.textContent = String(financeRequestsCache.length || 0);
      if (pendingStoresEl) {
        const pendingStores = stores.filter((store) => store && store.approvalStatus === "pending");
        pendingStoresEl.textContent = String(pendingStores.length);
      }
      if (pendingStoreUpdatesEl) {
        const pendingUpdates = stores.filter((store) => store && (store.pendingChange || store.approvalStatus === "pending_update"));
        pendingStoreUpdatesEl.textContent = String(pendingUpdates.length);
      }
      if (pendingSellersEl) {
        const pendingApprovals = approvals.filter((item) => item && item.type === "seller" && item.status === "pending");
        pendingSellersEl.textContent = String(pendingApprovals.length);
      }
      if (pendingRefundsEl) pendingRefundsEl.textContent = String(refundsCache.length || 0);

      if (miniRevenueValue) miniRevenueValue.textContent = formatVnd(totalRevenue);
      if (miniUserValue) miniUserValue.textContent = users.length.toLocaleString("vi-VN");
      renderMiniChart([0, totalRevenue, totalRevenue * 0.6, totalRevenue * 0.8], miniRevenueLine);
      renderMiniChart([0, users.length, Math.max(0, users.length - 2), users.length], miniUserLine);

      const approved = approvals.filter((item) => item && item.status === "approved").length;
      const approvalRate = approvals.length ? Math.round((approved / approvals.length) * 100) : 0;
      if (approvalRateValue) approvalRateValue.textContent = `${approvalRate}%`;
      setDonutPercent(approvalDonut, approvalRate);

      if (taskFinance) taskFinance.textContent = `${financeRequestsCache.length || 0} yeu cau`;
      if (taskStores) taskStores.textContent = `${stores.length || 0} gian hang`;
      if (taskApprovals) taskApprovals.textContent = `${approvals.length || 0} yeu cau`;
      if (taskRefunds) taskRefunds.textContent = `${refundsCache.length || 0} yeu cau`;

      if (pendingTopup) pendingTopup.textContent = `${financeRequestsCache.length || 0} yeu cau`;
      if (pendingWithdraw) pendingWithdraw.textContent = `${withdrawState.data.length || 0} yeu cau`;
      if (pendingService) pendingService.textContent = `${ordersState?.data?.length || 0} yeu cau`;
    };

    const refreshStoreStates = () => {
      const stores = Array.isArray(storesCache) ? storesCache : [];
      storeApproveState.data = stores.filter((store) => store && store.approvalStatus === "pending");
      storeUpdateState.data = stores.filter((store) => store && (store.pendingChange || store.approvalStatus === "pending_update"));
      storeApproveState.loading = false;
      storeUpdateState.loading = false;

      const renderStoreRows = (list, tbody, emptyEl, paginationEl, state, showDiff) => {
        if (!tbody) return;
        if (!list.length) {
          tbody.innerHTML = "";
          if (emptyEl) emptyEl.classList.remove("is-hidden");
          return;
        }
        if (emptyEl) emptyEl.classList.add("is-hidden");
        const { pageItems, totalPages, page } = paginate(list, state.page, state.perPage);
        tbody.innerHTML = pageItems
          .map((store) => {
            const actions = showDiff
              ? `<button class="btn sm ghost" type="button" data-store-diff="${escapeHtml(store.storeId || "")}">Xem</button>`
              : `<button class="btn sm ghost" type="button" data-store-approve="${escapeHtml(store.storeId || "")}">Duyet</button>`;
            return `
              <tr>
                <td>${escapeHtml(store.storeId || "--")}</td>
                <td>${escapeHtml(store.name || "--")}</td>
                <td>${escapeHtml(store.category || "--")}</td>
                <td>${escapeHtml(store.approvalStatus || "--")}</td>
                <td>${formatDateLabel(store.createdAt || store.updatedAt)}</td>
                <td>${actions}</td>
              </tr>
            `;
          })
          .join("");
        if (paginationEl) {
          renderPagination(paginationEl, page, totalPages, (nextPage) => {
            state.page = nextPage;
            refreshStoreStates();
          });
        }
      };

      renderStoreRows(storeApproveState.data, storeApproveBody, storeApproveEmpty, storeApprovePagination, storeApproveState, false);
      renderStoreRows(storeUpdateState.data, storeUpdateBody, storeUpdateEmpty, storeUpdatePagination, storeUpdateState, true);
    };

    const updateStoreOptions = () => {
      if (inventoryStore) {
        inventoryStore.innerHTML = `<option value="all">Tat ca</option>`;
        storesCache.forEach((store) => {
          const option = document.createElement("option");
          option.value = store.storeId;
          option.textContent = store.name || store.storeId;
          inventoryStore.appendChild(option);
        });
      }
      if (inventoryProduct) {
        inventoryProduct.innerHTML = `<option value="all">Tat ca</option>`;
        productsCache.forEach((product) => {
          const option = document.createElement("option");
          option.value = product.productId;
          option.textContent = product.name || product.productId;
          inventoryProduct.appendChild(option);
        });
      }
    };

    const buildInventoryResults = () => {
      if (!inventoryBody) return;
      const inventories = Array.isArray(inventoriesCache) ? inventoriesCache : [];
      const list = inventories.map((inv) => {
        const product = productsCache.find((item) => item.productId === inv.productId) || {};
        const store = storesCache.find((item) => item.storeId === product.storeId) || {};
        const items = Array.isArray(inv.items) ? inv.items : [];
        const history = Array.isArray(inv.history) ? inv.history : [];
        return {
          productId: inv.productId,
          productName: product.name || "--",
          storeName: store.name || "--",
          stock: items.length,
          updatedAt: (history[0] && history[0].createdAt) || product.updatedAt || "",
        };
      });
      const filtered = list.filter((row) => {
        if (inventoryState.store !== "all" && row.storeName && row.storeName !== inventoryState.store) return false;
        if (inventoryState.product !== "all" && row.productId !== inventoryState.product) return false;
        const search = normalizeText(inventoryState.search || "");
        if (!search) return true;
        return normalizeText(row.productName).includes(search) || normalizeText(row.storeName).includes(search);
      });
      if (!filtered.length) {
        inventoryBody.innerHTML = "";
        if (inventoryEmpty) inventoryEmpty.classList.remove("is-hidden");
        return;
      }
      if (inventoryEmpty) inventoryEmpty.classList.add("is-hidden");
      const { pageItems, totalPages, page } = paginate(filtered, inventoryState.page, inventoryState.perPage);
      inventoryBody.innerHTML = pageItems
        .map((row) => {
          return `
            <tr>
              <td>${escapeHtml(row.productId || "--")}</td>
              <td>${escapeHtml(row.storeName || "--")}</td>
              <td>${escapeHtml(row.productName || "--")}</td>
              <td>${row.stock}</td>
              <td>${formatDateLabel(row.updatedAt)}</td>
            </tr>
          `;
        })
        .join("");
      if (inventoryPagination) {
        renderPagination(inventoryPagination, page, totalPages, (nextPage) => {
          inventoryState.page = nextPage;
          buildInventoryResults();
        });
      }
    };

    const MAINTENANCE_LABELS = {
      home: "Trang ch\u1ee7",
      products: "S\u1ea3n ph\u1ea9m",
      services: "D\u1ecbch v\u1ee5",
      tasks_market: "Marketplace / Nhi\u1ec7m v\u1ee5",
      task_posting: "\u0110\u0103ng b\u00e0i nhi\u1ec7m v\u1ee5",
      seller_panel: "Panel seller",
      profile: "H\u1ed3 s\u01a1 / T\u00e0i kho\u1ea3n",
      checkout: "Thanh to\u00e1n",
    };

    let maintenanceState = { ...MAINTENANCE_DEFAULT };
    let maintenanceServerOffset = 0;
    let maintenanceTimer = null;

    const normalizeMaintenanceConfig = (value) => {
      const raw = value && typeof value === "object" ? value : {};
      const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : MAINTENANCE_DEFAULT.message;
      const globalEnabled =
        raw.globalEnabled === true || raw.enabled === true || String(raw.globalEnabled || raw.enabled || "") === "true";
      const routeLocks = {};
      const sourceLocks = raw.routeLocks || raw.routes || raw.scopes;
      if (Array.isArray(sourceLocks)) {
        sourceLocks.forEach((scope) => {
          const key = String(scope || "").trim();
          if (key) routeLocks[key] = true;
        });
      } else if (sourceLocks && typeof sourceLocks === "object") {
        Object.entries(sourceLocks).forEach(([key, val]) => {
          if (val === true || String(val || "") === "true") routeLocks[key] = true;
        });
      }
      const startAt = Number.isFinite(Number(raw.startAt)) ? Number(raw.startAt) : null;
      const endAt = Number.isFinite(Number(raw.endAt)) ? Number(raw.endAt) : null;
      const version = Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0;
      const active = raw.active === true;
      const expired = raw.expired === true;
      return { ...MAINTENANCE_DEFAULT, message, globalEnabled, routeLocks, startAt, endAt, version, active, expired };
    };

    const getMaintenanceApiUrl = () => {
      const root = window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";
      return root + "api/maintenance";
    };

    const isMaintenanceActive = (config) => {
      if (!config) return false;
      const hasLocks = config.routeLocks && Object.keys(config.routeLocks).length > 0;
      if (!config.globalEnabled && !hasLocks) return false;
      if (config.endAt && Date.now() + maintenanceServerOffset >= config.endAt) return false;
      return true;
    };

    const getDurationHours = (config) => {
      if (config && config.startAt && config.endAt && config.endAt > config.startAt) {
        return Math.max((config.endAt - config.startAt) / 3600000, MAINTENANCE_MIN_DURATION);
      }
      return 1;
    };

    const formatHours = (value) => {
      const rounded = Math.round(value * 10) / 10;
      return String(rounded);
    };

    const formatCountdown = (ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return "00:00";
      const total = Math.floor(ms / 1000);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      const pad = (num) => String(num).padStart(2, "0");
      return hours ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
    };

    const updateMaintenanceCountdown = () => {
      if (!maintenanceRemaining || !maintenanceEnd) return;
      if (!maintenanceState || !maintenanceState.endAt) {
        maintenanceEnd.value = "--";
        maintenanceRemaining.textContent = "--";
        return;
      }
      const now = Date.now() + maintenanceServerOffset;
      const remaining = maintenanceState.endAt - now;
      maintenanceEnd.value = new Date(maintenanceState.endAt).toLocaleString("vi-VN", {
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      maintenanceRemaining.textContent = `Con lai: ${formatCountdown(remaining)}`;
    };

    const renderMaintenanceMode = (config) => {
      if (!maintenanceMode) return;
      if (config && config.globalEnabled) {
        maintenanceMode.textContent = "Pham vi: Toan bo website";
        return;
      }
      const locks = config && config.routeLocks ? Object.keys(config.routeLocks).filter((key) => config.routeLocks[key]) : [];
      if (!locks.length) {
        maintenanceMode.textContent = "Pham vi: Khong khoa";
        return;
      }
      const labels = locks.map((key) => MAINTENANCE_LABELS[key] || key);
      maintenanceMode.textContent = `Pham vi: ${labels.join(", ")}`;
    };

    const renderMaintenanceStatus = (config) => {
      const active = isMaintenanceActive(config);
      const label = active ? "Dang bat" : "Dang tat";
      const className = active ? "warn" : "good";
      if (maintenanceStatus) {
        maintenanceStatus.textContent = label;
        maintenanceStatus.className = "admin-status-pill " + className;
      }
      if (maintenancePill) {
        maintenancePill.textContent = label;
        maintenancePill.className = "admin-status-pill " + className;
      }
    };

    const syncMaintenanceForm = (config) => {
      if (maintenanceMessage) maintenanceMessage.value = config.message || "";
      if (maintenanceDuration) maintenanceDuration.value = formatHours(getDurationHours(config));
      if (maintenanceRouteInputs.length) {
        maintenanceRouteInputs.forEach((input) => {
          const scope = input.getAttribute("data-maintenance-route");
          input.checked = scope ? Boolean(config.routeLocks && config.routeLocks[scope]) : false;
        });
      }
      renderMaintenanceMode(config);
      updateMaintenanceCountdown();
    };

    const applyRouteFilter = (value) => {
      const keyword = normalizeText(value || "");
      maintenanceRouteGroups.forEach((group) => {
        const groupLabel = normalizeText(group.getAttribute("data-route-label") || group.textContent);
        let visible = false;
        const items = Array.from(group.querySelectorAll(".maintenance-route-item"));
        items.forEach((item) => {
          const label = normalizeText(item.getAttribute("data-route-label") || item.textContent);
          const show = !keyword || label.includes(keyword) || groupLabel.includes(keyword);
          item.classList.toggle("is-hidden", !show);
          if (show) visible = true;
        });
        group.classList.toggle("is-hidden", !visible);
      });
    };

    const collectRouteLocks = () => {
      const locks = {};
      maintenanceRouteInputs.forEach((input) => {
        const key = input.getAttribute("data-maintenance-route");
        if (key && input.checked) locks[key] = true;
      });
      return locks;
    };

    const resolveDurationHours = () => {
      if (!maintenanceDuration) return 1;
      const raw = Number(maintenanceDuration.value);
      if (!Number.isFinite(raw) || raw < MAINTENANCE_MIN_DURATION) return 1;
      return raw;
    };

    const buildPayload = (overrides = {}) => {
      const message = maintenanceMessage ? maintenanceMessage.value.trim() : "";
      const routeLocks = overrides.routeLocks === undefined ? maintenanceState.routeLocks || {} : overrides.routeLocks;
      const globalEnabled = overrides.globalEnabled === undefined ? maintenanceState.globalEnabled : overrides.globalEnabled;
      const hasLocks = Object.keys(routeLocks).length > 0;
      const durationHours = resolveDurationHours();
      let startAt = maintenanceState.startAt;
      let endAt = maintenanceState.endAt;
      const shouldActivate = globalEnabled || hasLocks;
      if (overrides.refreshWindow || (shouldActivate && (!endAt || endAt <= Date.now()))) {
        const now = Date.now();
        startAt = now;
        endAt = now + durationHours * 3600000;
      }
      if (!shouldActivate) {
        startAt = null;
        endAt = null;
      }
      return {
        globalEnabled,
        message: message || MAINTENANCE_DEFAULT.message,
        startAt,
        endAt,
        routeLocks,
      };
    };

    const saveMaintenanceConfig = async (payload) => {
      try {
        const headers = getAdminHeaders() || {};
        const response = await fetch(getMaintenanceApiUrl(), {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ config: payload }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.config) {
          showToast("Cap nhat bao tri that bai.");
          return;
        }
        maintenanceServerOffset = (Number(data.serverTime) || Date.now()) - Date.now();
        maintenanceState = normalizeMaintenanceConfig(data.config);
        renderMaintenanceStatus(maintenanceState);
        syncMaintenanceForm(maintenanceState);
        showToast("Da cap nhat bao tri.");
      } catch (error) {
        showToast("Cap nhat bao tri that bai.");
      }
    };

    const fetchMaintenanceConfig = async () => {
      try {
        const response = await fetch(getMaintenanceApiUrl(), { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (response.ok && data && data.config) {
          maintenanceServerOffset = (Number(data.serverTime) || Date.now()) - Date.now();
          maintenanceState = normalizeMaintenanceConfig(data.config);
          renderMaintenanceStatus(maintenanceState);
          syncMaintenanceForm(maintenanceState);
          return;
        }
      } catch (error) {}
      renderMaintenanceStatus(maintenanceState);
      syncMaintenanceForm(maintenanceState);
    };

    if (!maintenanceTimer) {
      maintenanceTimer = setInterval(() => {
        updateMaintenanceCountdown();
        renderMaintenanceStatus(maintenanceState);
      }, 1000);
    }

    if (maintenanceSearch) {
      maintenanceSearch.addEventListener("input", () => {
        applyRouteFilter(maintenanceSearch.value);
      });
    }

    const updateDraftMode = () => {
      const draft = { ...maintenanceState, routeLocks: collectRouteLocks() };
      renderMaintenanceMode(draft);
    };

    maintenanceRouteInputs.forEach((input) => {
      input.addEventListener("change", updateDraftMode);
    });

    if (maintenanceEnable) {
      maintenanceEnable.addEventListener("click", () => {
        const duration = resolveDurationHours();
        if (duration < MAINTENANCE_MIN_DURATION) {
          showToast("Thoi luong toi thieu 0.1h.");
          return;
        }
        openModal({
          title: "Bat bao tri toan bo?",
          message: "Nguoi dung se duoc chuyen sang trang bao tri ngay lap tuc.",
          onConfirm: () => {
            const payload = buildPayload({ globalEnabled: true, refreshWindow: true, routeLocks: maintenanceState.routeLocks || {} });
            saveMaintenanceConfig(payload);
          },
        });
      });
    }

    if (maintenanceDisable) {
      maintenanceDisable.addEventListener("click", () => {
        openModal({
          title: "Tat bao tri?",
          message: "He thong se hoat dong binh thuong tro lai.",
          onConfirm: () => {
            const payload = buildPayload({ globalEnabled: false, routeLocks: maintenanceState.routeLocks || {} });
            saveMaintenanceConfig(payload);
          },
        });
      });
    }

    if (maintenanceApply) {
      maintenanceApply.addEventListener("click", () => {
        const locks = collectRouteLocks();
        const payload = buildPayload({ refreshWindow: Object.keys(locks).length > 0, routeLocks: locks });
        saveMaintenanceConfig(payload);
      });
    }

    if (maintenanceUnlock) {
      maintenanceUnlock.addEventListener("click", () => {
        openModal({
          title: "Mo tat ca route?",
          message: "Tat ca route se duoc mo. Neu dang bat bao tri toan bo, he thong van bi khoa.",
          onConfirm: () => {
            const payload = buildPayload({ routeLocks: {} });
            saveMaintenanceConfig(payload);
          },
        });
      });
    }

    fetchMaintenanceConfig();

    if (feeSaveBtn) {
      feeSaveBtn.addEventListener("click", () => {
        const payload = {
          defaultFeePercent: Number(feeDefault ? feeDefault.value : 0),
          smallOrderThreshold: Number(feeThreshold ? feeThreshold.value : 0),
          smallOrderFeePercent: Number(feeLowRate ? feeLowRate.value : 2),
        };
        openModal({
          title: "Luu cau hinh phi?",
          message: "Muc phi moi se duoc ap dung ngay.",
          onConfirm: () => {
            services.settings.update(payload);
            showToast("Da cap nhat cau hinh phi.");
          },
        });
      });
    }

    if (approvalsResetBtn) {
      approvalsResetBtn.addEventListener("click", () => {
        approvalState.search = "";
        approvalState.type = "all";
        approvalState.status = "all";
        approvalState.sort = "recent";
        approvalState.page = 1;
        if (approvalsSearch) approvalsSearch.value = "";
        if (approvalsType) approvalsType.value = "all";
        if (approvalsStatus) approvalsStatus.value = "all";
        if (approvalsSort) approvalsSort.value = "recent";
        renderApprovals();
      });
    }
    if (approvalsSearch) {
      approvalsSearch.addEventListener("input", () => {
        approvalState.search = approvalsSearch.value;
        approvalState.page = 1;
        renderApprovals();
      });
    }
    if (approvalsType) {
      approvalsType.addEventListener("change", () => {
        approvalState.type = approvalsType.value;
        approvalState.page = 1;
        renderApprovals();
      });
    }
    if (approvalsStatus) {
      approvalsStatus.addEventListener("change", () => {
        approvalState.status = approvalsStatus.value;
        approvalState.page = 1;
        renderApprovals();
      });
    }
    if (approvalsSort) {
      approvalsSort.addEventListener("change", () => {
        approvalState.sort = approvalsSort.value;
        approvalState.page = 1;
        renderApprovals();
      });
    }
    if (approvalsBody) {
      approvalsBody.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action]");
        if (!btn) return;
        const approvalId = btn.getAttribute("data-approval-id");
        const action = btn.getAttribute("data-action");
        if (!approvalId) return;
        if (action === "approve-approval") {
          openModal({
            title: "Duyet yeu cau?",
            message: "Yeu cau se duoc duyet ngay.",
            onConfirm: () => {
              services.approvals.updateStatus(approvalId, "approved", "");
              showToast("Da duyet yeu cau.");
            },
          });
        }
        if (action === "reject-approval") {
          openModal({
            title: "Tu choi yeu cau?",
            message: "Nhap ly do tu choi de gui cho user.",
            inputLabel: "Ly do tu choi",
            inputPlaceholder: "Nhap ly do",
            onConfirm: (note) => {
              if (!note) {
                showToast("Vui long nhap ly do tu choi.");
                return;
              }
              services.approvals.updateStatus(approvalId, "rejected", note);
              showToast("Da tu choi yeu cau.");
            },
          });
        }
      });
    }

    fetchMaintenanceConfig(true);

    loadList(revenueState, services.revenue.list, () => {
      renderRevenueTable();
      renderRevenueMetrics();
      updateOverview();
    });
    loadList(balanceSourceState, services.revenue.list, renderBalanceSourceTable);
    services.adminBalance.get().then(renderAdminBalances);
    loadList(withdrawState, services.adminWithdrawals.list, () => {
      renderWithdrawals();
      updateOverview();
    });
    loadList(userState, services.users.list, () => {
      renderUsers();
      updateOverview();
    });
    services.stores.list().then((data) => {
      storesCache = data || [];
      refreshStoreStates();
      updateStoreOptions();
    });
    services.products.list().then((data) => {
      productsCache = data || [];
      updateStoreOptions();
      buildInventoryResults();
    });
    services.inventories.list().then((data) => {
      inventoriesCache = data || [];
      buildInventoryResults();
    });
    loadList(orderState, services.orders.list, () => {
      renderOrders();
      updateOverview();
    });
    loadList(complaintState, services.complaints.list, renderComplaints);
    loadList(approvalState, services.approvals.list, () => {
      renderApprovals();
      updateOverview();
    });
    services.financeRequests.list().then((data) => {
      financeRequestsCache = data || [];
      updateOverview();
    });
    services.refunds.list().then((data) => {
      refundsCache = data || [];
      updateOverview();
    });
    services.settings.get().then(renderSettings);

    renderAdminChart(adminRange);

    if (window.BKPanelData && typeof window.BKPanelData.subscribe === "function") {
      window.BKPanelData.subscribe(() => {
        syncList(revenueState, services.revenue.list, () => {
          renderRevenueTable();
          renderRevenueMetrics();
          updateOverview();
        });
        syncList(balanceSourceState, services.revenue.list, renderBalanceSourceTable);
        services.adminBalance.get().then(renderAdminBalances);
        syncList(withdrawState, services.adminWithdrawals.list, () => {
          renderWithdrawals();
          updateOverview();
        });
        syncList(userState, services.users.list, () => {
          renderUsers();
          updateOverview();
        });
        services.stores.list().then((data) => {
          storesCache = data || [];
          refreshStoreStates();
          updateStoreOptions();
        });
        services.products.list().then((data) => {
          productsCache = data || [];
          updateStoreOptions();
          buildInventoryResults();
        });
        services.inventories.list().then((data) => {
          inventoriesCache = data || [];
          buildInventoryResults();
        });
        syncList(orderState, services.orders.list, () => {
          renderOrders();
          updateOverview();
        });
        syncList(complaintState, services.complaints.list, renderComplaints);
        syncList(approvalState, services.approvals.list, () => {
          renderApprovals();
          updateOverview();
        });
        services.financeRequests.list().then((data) => {
          financeRequestsCache = data || [];
          updateOverview();
        });
        services.refunds.list().then((data) => {
          refundsCache = data || [];
          updateOverview();
        });
        services.settings.get().then(renderSettings);
      });
    }
  });
})();











