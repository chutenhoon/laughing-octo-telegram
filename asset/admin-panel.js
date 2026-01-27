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
      } catch (e) {}
      try {
        localStorage.setItem(ADMIN_CRED_KEY, payload);
      } catch (err) {}
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
    const maintenanceGlobalToggle = document.getElementById("admin-maintenance-global");
    const maintenanceMessage = document.getElementById("admin-maintenance-message");
    const maintenanceDurationHours = document.getElementById("admin-maintenance-hours");
    const maintenanceDurationMinutes = document.getElementById("admin-maintenance-minutes");
    const maintenanceDurationPreview = document.getElementById("admin-maintenance-end-preview");
    const maintenanceDurationPresets = Array.from(document.querySelectorAll("[data-maintenance-duration]"));
    const maintenanceUntil = document.getElementById("admin-maintenance-until");
    const maintenanceRemaining = document.getElementById("admin-maintenance-remaining");
    const maintenanceEnableBtn = document.getElementById("admin-maintenance-enable");
    const maintenanceDisableBtn = document.getElementById("admin-maintenance-disable");
    const maintenanceApplyBtn = document.getElementById("admin-maintenance-apply");
    const maintenanceUnlockBtn = document.getElementById("admin-maintenance-unlock");
    const maintenanceMode = document.getElementById("admin-maintenance-mode");
    const maintenanceRouteFilter = document.getElementById("admin-maintenance-route-filter");
    const maintenanceRouteList = document.getElementById("admin-maintenance-routes");
    const maintenanceEndTime = document.getElementById("admin-maintenance-endtime");
    const maintenanceSummary = document.getElementById("admin-maintenance-summary");
    const maintenanceLockAllBtn = document.getElementById("admin-maintenance-lock-all");
    const maintenanceClearAllBtn = document.getElementById("admin-maintenance-clear-all");
    const legacyMaintenanceToggle = document.getElementById("admin-maintenance-toggle");
    const legacyMaintenanceSave = document.getElementById("admin-maintenance-save");
    const legacyMaintenanceScopes = Array.from(document.querySelectorAll("[data-maintenance-scope]"));

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
      message: "Bảo trì hệ thống, xin lỗi vì sự bất tiện này.",
      startAt: null,
      endAt: null,
      routeLocks: {},
      version: 0,
    };
    const MAINTENANCE_DURATION_DEFAULT_MINUTES = 60;
    const MAINTENANCE_DURATION_MINUTES = 1;
    const MAINTENANCE_DURATION_PRESETS = [15, 30, 60, 120];
    const MAINTENANCE_ROUTE_GROUPS = [
      {
        id: "core",
        label: "Khu vực chính",
        routes: [
          { key: "home", label: "Trang chủ", paths: "/" },
          { key: "products", label: "Sản phẩm", paths: "/sanpham" },
          { key: "services", label: "Dịch vụ", paths: "/dichvu" },
          { key: "tasks_market", label: "Nhiệm vụ", paths: "/nhiemvu" },
          { key: "task_posting", label: "Nhiệm vụ marketplace", paths: "/nhiemvu/tao" },
          { key: "payments", label: "Thanh toán", paths: "/checkout, /proof" },
        ],
      },
      {
        id: "seller",
        label: "Seller",
        routes: [
          { key: "seller_panel", label: "Seller panel", paths: "/seller/panel, /seller/tasks, /seller/join" },
          { key: "seller_public", label: "Gian hàng công khai", paths: "/seller/[id]" },
        ],
      },
      {
        id: "profile",
        label: "Hồ sơ / Tài khoản",
        routes: [
          { key: "profile", label: "Hồ sơ (toàn bộ)", paths: "/login, /register, /forgot", level: 0, tone: "parent" },
          { key: "profile.overview", label: "Tổng quan hồ sơ", paths: "/profile, /profile/public, /u", level: 1 },
          { key: "profile.orders", label: "Đơn hàng", paths: "/profile/orders", level: 1 },
          { key: "profile.favorites", label: "Yêu thích", paths: "/profile/favorites", level: 1 },
          { key: "profile.following", label: "Đang theo dõi", paths: "/profile/following", level: 1 },
          { key: "profile.history", label: "Lịch sử tài khoản", paths: "/profile/history, /profile/logins", level: 1 },
          { key: "profile.withdraw", label: "Rút tiền", paths: "/profile/topups", level: 1 },
          { key: "profile.tasks", label: "Nhiệm vụ", paths: "/profile/tasks", level: 1 },
          { key: "profile.notifications", label: "Thông báo", paths: "/profile/notifications", level: 1 },
          { key: "profile.shops", label: "Quản lý shop", paths: "/profile/shops", level: 1 },
          { key: "profile.badges", label: "Danh hiệu", paths: "/profile/badges", level: 1 },
          { key: "profile.security", label: "Bảo mật 2FA", paths: "/profile/security", level: 1 },
          { key: "profile.chat", label: "Tin nhắn / Chat", paths: "/profile/messages", level: 1 },
        ],
      },
    ];
    const MAINTENANCE_ROUTE_KEYS = MAINTENANCE_ROUTE_GROUPS.flatMap((group) => group.routes.map((route) => route.key));
    const MAINTENANCE_ROUTE_LABELS = MAINTENANCE_ROUTE_GROUPS.reduce((acc, group) => {
      group.routes.forEach((route) => {
        acc[route.key] = route.label;
      });
      return acc;
    }, {});
    const LEGACY_SCOPE_MAP = { checkout: "payments" };
    const LEGACY_SCOPE_REVERSE = { payments: "checkout" };
    const hasNewMaintenanceUi = Boolean(
      maintenanceGlobalToggle ||
        maintenanceEnableBtn ||
        maintenanceDisableBtn ||
        maintenanceApplyBtn ||
        maintenanceUnlockBtn ||
        maintenanceRouteList
    );
    const useLegacyMaintenanceUi = !hasNewMaintenanceUi && (legacyMaintenanceToggle || legacyMaintenanceSave || legacyMaintenanceScopes.length);

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

    let maintenanceState = { ...MAINTENANCE_DEFAULT };
    let maintenanceClockSkewMs = 0;
    let maintenanceCountdownTimer = null;
    let maintenanceRouteInputs = [];
    let maintenanceSaving = false;

    const getMaintenanceApiUrl = () => {
      const root = window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";
      return root + "api/maintenance";
    };

    const normalizeRouteLocks = (value) => {
      const locks = {};
      const keys = MAINTENANCE_ROUTE_KEYS;
      const raw = value && typeof value === "object" ? value : null;
      keys.forEach((key) => {
        locks[key] = raw ? raw[key] === true || String(raw[key] || "") === "true" : false;
      });
      return locks;
    };

    const mapLegacyScope = (scope) => {
      if (!scope) return "";
      return LEGACY_SCOPE_MAP[scope] || scope;
    };

    const mapRouteToLegacyScope = (routeKey) => {
      if (!routeKey) return "";
      return LEGACY_SCOPE_REVERSE[routeKey] || routeKey;
    };

    const normalizeMaintenanceConfig = (value) => {
      const raw = value && typeof value === "object" ? value : {};
      const globalEnabled = raw.globalEnabled === true || String(raw.globalEnabled || "") === "true";
      const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : MAINTENANCE_DEFAULT.message;
      const startAt = raw.startAt || null;
      const endAt = raw.endAt || null;
      const routeLocks = normalizeRouteLocks(raw.routeLocks);
      const version = Number.isFinite(Number(raw.version)) ? Number(raw.version) : 0;
      return { ...MAINTENANCE_DEFAULT, globalEnabled, message, startAt, endAt, routeLocks, version };
    };

    const hasActiveLocks = (config) => {
      if (!config) return false;
      return config.globalEnabled || Object.values(config.routeLocks || {}).some((value) => value === true);
    };

    const getLockedRouteCount = (locks) => Object.values(locks || {}).filter((value) => value === true).length;

    const getActiveRouteLabels = (config) => {
      if (!config) return [];
      if (config.globalEnabled) return ["Toàn bộ website"];
      const locks = config.routeLocks || {};
      const labels = [];
      const profileLocked = locks.profile === true;
      if (profileLocked && MAINTENANCE_ROUTE_LABELS.profile) {
        labels.push(MAINTENANCE_ROUTE_LABELS.profile);
      }
      MAINTENANCE_ROUTE_KEYS.forEach((key) => {
        if (!locks[key]) return;
        if (key === "profile") return;
        if (profileLocked && key.startsWith("profile.") && key !== "profile.chat") return;
        labels.push(MAINTENANCE_ROUTE_LABELS[key] || key);
      });
      return labels;
    };

    const formatDateTime = (value) => {
      if (!value) return "--";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "--";
      try {
        return new Intl.DateTimeFormat("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      } catch (error) {
        return date.toLocaleString();
      }
    };

    const toLocalDatetimeValue = (value) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };

    const setEndTimeInput = (value) => {
      if (!maintenanceEndTime) return;
      maintenanceEndTime.value = value ? toLocalDatetimeValue(value) : "";
    };

    const readEndTimeMs = () => {
      if (!maintenanceEndTime) return 0;
      const raw = maintenanceEndTime.value;
      if (!raw) return 0;
      const parsed = new Date(raw);
      const ms = parsed.getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    const formatRemaining = (ms) => {
      if (!ms || ms <= 0) return "00:00";
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
      return `${minutes}m ${seconds}s`;
    };

    const getDurationMinutesFromConfig = (config) => {
      const startAt = config.startAt ? new Date(config.startAt).getTime() : 0;
      const endAt = config.endAt ? new Date(config.endAt).getTime() : 0;
      if (startAt && endAt && endAt > startAt) {
        return Math.round((endAt - startAt) / 60000);
      }
      return MAINTENANCE_DURATION_DEFAULT_MINUTES;
    };

    const setPresetActive = (value) => {
      if (!maintenanceDurationPresets.length) return;
      maintenanceDurationPresets.forEach((btn) => {
        const key = btn.getAttribute("data-maintenance-duration");
        btn.classList.toggle("active", key === String(value));
      });
    };

    const updateDurationPreview = (minutes) => {
      if (!maintenanceDurationPreview) return;
      if (!minutes || minutes <= 0) {
        maintenanceDurationPreview.textContent = "Mở lại lúc: --";
        if (maintenanceEndTime) maintenanceEndTime.value = "";
        return;
      }
      const now = Date.now() + maintenanceClockSkewMs;
      const endMs = now + minutes * 60000;
      maintenanceDurationPreview.textContent = `Mở lại lúc: ${formatDateTime(endMs)}`;
      setEndTimeInput(endMs);
    };

    const setDurationInputs = (minutes) => {
      const safeMinutes = Math.max(Math.round(Number(minutes) || 0), MAINTENANCE_DURATION_MINUTES);
      const hours = Math.floor(safeMinutes / 60);
      const mins = safeMinutes % 60;
      if (maintenanceDurationHours) maintenanceDurationHours.value = String(hours);
      if (maintenanceDurationMinutes) maintenanceDurationMinutes.value = String(mins);
      const preset = MAINTENANCE_DURATION_PRESETS.find((value) => value === safeMinutes);
      setPresetActive(preset != null ? preset : "custom");
      updateDurationPreview(safeMinutes);
    };

    const readDurationMinutesFromInputs = () => {
      const rawHours = maintenanceDurationHours ? Number(maintenanceDurationHours.value) : 0;
      const rawMinutes = maintenanceDurationMinutes ? Number(maintenanceDurationMinutes.value) : 0;
      if (!Number.isFinite(rawHours) || rawHours < 0) return null;
      if (!Number.isFinite(rawMinutes) || rawMinutes < 0) return null;
      const clampedMinutes = Math.min(Math.max(Math.round(rawMinutes), 0), 59);
      if (maintenanceDurationMinutes && Number.isFinite(rawMinutes)) {
        maintenanceDurationMinutes.value = String(clampedMinutes);
      }
      const total = Math.round(rawHours * 60 + clampedMinutes);
      if (!Number.isFinite(total) || total < MAINTENANCE_DURATION_MINUTES) return null;
      return total;
    };

    const resolveDurationMinutes = () => {
      const endMs = readEndTimeMs();
      if (endMs) {
        const now = Date.now() + maintenanceClockSkewMs;
        const diffMs = endMs - now;
        if (!Number.isFinite(diffMs) || diffMs < MAINTENANCE_DURATION_MINUTES * 60000) return null;
        return Math.round(diffMs / 60000);
      }
      return readDurationMinutesFromInputs();
    };

    const syncPresetFromInputs = () => {
      const minutes = readDurationMinutesFromInputs();
      const preset = MAINTENANCE_DURATION_PRESETS.find((value) => value === minutes);
      setPresetActive(preset != null ? preset : "custom");
      if (minutes) updateDurationPreview(minutes);
    };

    const renderMaintenanceRoutes = () => {
      if (!maintenanceRouteList) return;
      const groupsMarkup = MAINTENANCE_ROUTE_GROUPS.map((group) => {
        const routesMarkup = group.routes
          .map((route) => {
            const filterText = normalizeText(`${route.label} ${route.paths} ${route.key}`);
            const levelClass = route.level ? " is-child" : "";
            const toneClass = route.tone === "parent" ? " is-parent" : "";
            return `
              <label class="admin-route-item${levelClass}${toneClass}" data-route-key="${route.key}" data-route-filter="${filterText}">
                <div class="admin-route-meta">
                  <strong>${escapeHtml(route.label)}</strong>
                  <span>${escapeHtml(route.paths)}</span>
                </div>
                <input type="checkbox" data-route-key="${route.key}" />
              </label>
            `;
          })
          .join("");
        return `
          <div class="admin-route-group" data-route-group="${group.id}">
            <div class="admin-route-group-title">${escapeHtml(group.label)}</div>
            ${routesMarkup}
          </div>
        `;
      }).join("");
      maintenanceRouteList.innerHTML = groupsMarkup;
      maintenanceRouteInputs = Array.from(maintenanceRouteList.querySelectorAll("input[data-route-key]"));
    };

    const filterMaintenanceRoutes = (query) => {
      if (!maintenanceRouteList) return;
      const term = normalizeText(query || "");
      const items = Array.from(maintenanceRouteList.querySelectorAll(".admin-route-item"));
      const groups = Array.from(maintenanceRouteList.querySelectorAll(".admin-route-group"));
      items.forEach((item) => {
        if (!term) {
          item.classList.remove("is-hidden");
          return;
        }
        const filter = item.getAttribute("data-route-filter") || "";
        item.classList.toggle("is-hidden", !filter.includes(term));
      });
      groups.forEach((group) => {
        const visible = group.querySelector(".admin-route-item:not(.is-hidden)");
        group.classList.toggle("is-empty", !visible);
      });
    };

    const syncMaintenanceForm = (config) => {
      if (maintenanceMessage) maintenanceMessage.value = config.message || "";
      if (maintenanceGlobalToggle) maintenanceGlobalToggle.checked = config.globalEnabled === true;
      const durationMinutes = getDurationMinutesFromConfig(config);
      setDurationInputs(durationMinutes);
      const endMs = config.endAt ? new Date(config.endAt).getTime() : 0;
      if (endMs && maintenanceDurationPreview) {
        maintenanceDurationPreview.textContent = `Mở lại lúc: ${formatDateTime(endMs)}`;
      }
      setEndTimeInput(endMs);
      if (maintenanceRouteInputs.length) {
        maintenanceRouteInputs.forEach((input) => {
          const key = input.getAttribute("data-route-key");
          input.checked = key ? config.routeLocks[key] === true : false;
        });
      }
    };

    const syncLegacyMaintenanceForm = (config) => {
      if (!useLegacyMaintenanceUi) return;
      if (maintenanceMessage) maintenanceMessage.value = config.message || "";
      if (legacyMaintenanceScopes.length) {
        legacyMaintenanceScopes.forEach((input) => {
          const scope = input.getAttribute("data-maintenance-scope");
          const routeKey = mapLegacyScope(scope);
          if (!scope) return;
          if (config.globalEnabled) {
            input.checked = false;
            return;
          }
          input.checked = routeKey ? config.routeLocks[routeKey] === true : false;
        });
      }
      if (legacyMaintenanceToggle) {
        legacyMaintenanceToggle.textContent = hasActiveLocks(config) ? "Tat bao tri" : "Bat bao tri";
      }
    };

    const updateMaintenanceMeta = () => {
      if (!maintenanceState) return;
      const endAt = maintenanceState.endAt ? new Date(maintenanceState.endAt).getTime() : 0;
      if (maintenanceUntil) maintenanceUntil.textContent = formatDateTime(maintenanceState.endAt);
      if (maintenanceRemaining) {
        const remaining = endAt ? endAt - (Date.now() + maintenanceClockSkewMs) : 0;
        maintenanceRemaining.textContent = hasActiveLocks(maintenanceState) ? formatRemaining(remaining) : "00:00";
      }
    };

    const renderMaintenanceStatus = (config) => {
      const active = hasActiveLocks(config);
      const label = active ? "Đang bật" : "Đang tắt";
      const className = active ? "warn" : "good";
      const activeLabels = getActiveRouteLabels(config);
      if (maintenanceStatus) {
        maintenanceStatus.textContent = label;
        maintenanceStatus.className = "admin-status-pill " + className;
      }
      if (maintenancePill) {
        maintenancePill.textContent = label;
        maintenancePill.className = "admin-status-pill " + className;
      }
      if (maintenanceMode) {
        if (config.globalEnabled) {
          maintenanceMode.textContent = "Phạm vi: Toàn bộ website";
        } else if (getLockedRouteCount(config.routeLocks) > 0) {
          maintenanceMode.textContent = `Phạm vi: ${getLockedRouteCount(config.routeLocks)} khu vực đang khóa`;
        } else {
          maintenanceMode.textContent = "Phạm vi: Không khóa";
        }
      }
      if (maintenanceSummary) {
        if (config.globalEnabled) {
          maintenanceSummary.textContent = "Đang khóa: Toàn bộ website";
        } else if (activeLabels.length) {
          maintenanceSummary.textContent = `Đang khóa: ${activeLabels.join(", ")}`;
        } else {
          maintenanceSummary.textContent = "Không có route bị khóa";
        }
      }
    };

    const startMaintenanceCountdown = () => {
      if (maintenanceCountdownTimer) {
        clearInterval(maintenanceCountdownTimer);
      }
      maintenanceCountdownTimer = setInterval(updateMaintenanceMeta, 1000);
    };

    const applyMaintenanceConfig = (config, serverNow) => {
      maintenanceState = normalizeMaintenanceConfig(config);
      if (serverNow) {
        maintenanceClockSkewMs = Number(serverNow) - Date.now();
      }
      renderMaintenanceStatus(maintenanceState);
      syncMaintenanceForm(maintenanceState);
      syncLegacyMaintenanceForm(maintenanceState);
      updateMaintenanceMeta();
      startMaintenanceCountdown();
    };

    const setMaintenanceBusy = (busy) => {
      maintenanceSaving = busy;
      const elements = [
        maintenanceGlobalToggle,
        maintenanceEnableBtn,
        maintenanceDisableBtn,
        maintenanceApplyBtn,
        maintenanceUnlockBtn,
        maintenanceLockAllBtn,
        maintenanceClearAllBtn,
        maintenanceMessage,
        maintenanceDurationHours,
        maintenanceDurationMinutes,
        maintenanceEndTime,
        maintenanceRouteFilter,
        legacyMaintenanceToggle,
        legacyMaintenanceSave,
      ];
      if (maintenanceDurationPresets.length) elements.push(...maintenanceDurationPresets);
      if (maintenanceRouteInputs.length) elements.push(...maintenanceRouteInputs);
      if (legacyMaintenanceScopes.length) elements.push(...legacyMaintenanceScopes);
      elements.forEach((el) => {
        if (!el) return;
        el.disabled = Boolean(busy);
        if (busy) {
          el.setAttribute("aria-busy", "true");
        } else {
          el.removeAttribute("aria-busy");
        }
      });
    };

    const getMaintenanceErrorMessage = (response, data) => {
      if (data && typeof data.error === "string") {
        if (data.error === "UNAUTHORIZED") return "Sai khoa admin.";
        if (data.error === "DB_NOT_CONFIGURED") return "Chua ket noi CSDL.";
        if (data.error === "INVALID_BODY") return "Du lieu gui len khong hop le.";
        return `Khong the cap nhat bao tri (${data.error}).`;
      }
      if (response && response.status) {
        if (response.status === 401) return "Sai khoa admin.";
        return `Khong the cap nhat bao tri (HTTP ${response.status}).`;
      }
      return "Khong the cap nhat bao tri.";
    };

    const fetchMaintenanceConfig = async () => {
      try {
        const response = await fetch(getMaintenanceApiUrl(), { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (response.ok && data && data.config) {
          applyMaintenanceConfig(data.config, data.serverNow);
          return maintenanceState;
        }
      } catch (error) {}
      applyMaintenanceConfig(maintenanceState);
      return maintenanceState;
    };

    const saveMaintenanceConfig = async (payload, successMessage) => {
      if (maintenanceSaving) return;
      const headers = getAdminHeaders() || {};
      if (!headers || !headers["x-admin-user"] || !headers["x-admin-pass"]) {
        showToast("Can khoa admin de cap nhat bao tri.");
        return;
      }
      setMaintenanceBusy(true);
      try {
        const response = await fetch(getMaintenanceApiUrl(), {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({ config: payload }),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data && data.config) {
          applyMaintenanceConfig(data.config, data.serverNow);
          showToast(successMessage || "Da cap nhat bao tri.");
          return;
        }
        showToast(getMaintenanceErrorMessage(response, data));
      } catch (error) {
        showToast("Khong the cap nhat bao tri.");
      } finally {
        setMaintenanceBusy(false);
      }
    };

    const collectRouteLocks = () => {
      const locks = normalizeRouteLocks({});
      maintenanceRouteInputs.forEach((input) => {
        const key = input.getAttribute("data-route-key");
        if (key) locks[key] = input.checked;
      });
      return locks;
    };

    const buildAllRouteLocks = (value) => {
      const locks = normalizeRouteLocks({});
      MAINTENANCE_ROUTE_KEYS.forEach((key) => {
        locks[key] = Boolean(value);
      });
      return locks;
    };

    const readDurationHours = () => {
      const minutes = resolveDurationMinutes();
      if (minutes == null) return null;
      return minutes / 60;
    };

    const collectLegacyScopes = () => {
      if (!legacyMaintenanceScopes.length) return [];
      return legacyMaintenanceScopes
        .filter((input) => input.checked)
        .map((input) => mapLegacyScope(input.getAttribute("data-maintenance-scope")))
        .filter(Boolean);
    };

    const buildLegacyPayload = (enable, scopes) => {
      if (!enable) {
        return {
          globalEnabled: false,
          message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
          routeLocks: normalizeRouteLocks({}),
        };
      }
      if (!scopes.length) {
        return {
          globalEnabled: true,
          message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
          routeLocks: normalizeRouteLocks({}),
        };
      }
      const routeLocks = normalizeRouteLocks({});
      scopes.forEach((scope) => {
        if (scope) routeLocks[scope] = true;
      });
      return {
        globalEnabled: false,
        message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
        routeLocks,
      };
    };

    renderMaintenanceRoutes();

    if (maintenanceDurationPresets.length) {
      maintenanceDurationPresets.forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = btn.getAttribute("data-maintenance-duration") || "";
          if (value === "custom") {
            setPresetActive("custom");
            if (maintenanceDurationHours) maintenanceDurationHours.focus();
            syncPresetFromInputs();
            return;
          }
          const minutes = Number(value);
          if (Number.isFinite(minutes) && minutes > 0) {
            setDurationInputs(minutes);
          }
        });
      });
    }

    if (maintenanceDurationHours) {
      maintenanceDurationHours.addEventListener("input", () => {
        syncPresetFromInputs();
      });
    }

    if (maintenanceDurationMinutes) {
      maintenanceDurationMinutes.addEventListener("input", () => {
        syncPresetFromInputs();
      });
    }

    if (maintenanceEndTime) {
      maintenanceEndTime.addEventListener("input", () => {
        const endMs = readEndTimeMs();
        if (!endMs) {
          syncPresetFromInputs();
          return;
        }
        const now = Date.now() + maintenanceClockSkewMs;
        const diffMs = endMs - now;
        if (!Number.isFinite(diffMs) || diffMs < MAINTENANCE_DURATION_MINUTES * 60000) {
          updateDurationPreview(null);
          return;
        }
        const minutes = Math.round(diffMs / 60000);
        setDurationInputs(minutes);
      });
    }

    if (maintenanceRouteFilter) {
      maintenanceRouteFilter.addEventListener("input", () => {
        filterMaintenanceRoutes(maintenanceRouteFilter.value);
      });
    }

    if (maintenanceGlobalToggle) {
      maintenanceGlobalToggle.addEventListener("click", (event) => {
        event.preventDefault();
        const enable = !maintenanceState.globalEnabled;
        maintenanceGlobalToggle.checked = maintenanceState.globalEnabled === true;
        const label = enable ? "Bat bao tri toan site" : "Tat bao tri toan site";
        openModal({
          title: `${label}?`,
          message: enable
            ? "Nguoi dung se bi chuyen sang trang bao tri o request ke tiep."
            : "He thong se hoat dong binh thuong tro lai.",
          onConfirm: () => {
            const durationHours = readDurationHours();
            if (enable && durationHours == null) {
              showToast("Thời lượng bảo trì tối thiểu 1 phút.");
              return;
            }
            const payload = {
              globalEnabled: enable,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              durationHours: durationHours != null ? durationHours : MAINTENANCE_DURATION_DEFAULT_MINUTES / 60,
              routeLocks: enable ? collectRouteLocks() : normalizeRouteLocks({}),
            };
            saveMaintenanceConfig(payload, enable ? "Da bat bao tri toan site." : "Da tat bao tri toan site.");
          },
        });
      });
    }

    if (maintenanceEnableBtn) {
      maintenanceEnableBtn.addEventListener("click", () => {
        openModal({
          title: "Bat bao tri toan site?",
          message: "Nguoi dung se bi chuyen sang trang bao tri o request ke tiep.",
          onConfirm: () => {
            const durationHours = readDurationHours();
            if (durationHours == null) {
              showToast("Thời lượng bảo trì tối thiểu 1 phút.");
              return;
            }
            const payload = {
              globalEnabled: true,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              durationHours: durationHours != null ? durationHours : MAINTENANCE_DURATION_DEFAULT_MINUTES / 60,
              routeLocks: collectRouteLocks(),
            };
            saveMaintenanceConfig(payload, "Da bat bao tri toan site.");
          },
        });
      });
    }

    if (maintenanceDisableBtn) {
      maintenanceDisableBtn.addEventListener("click", () => {
        openModal({
          title: "Tat bao tri toan site?",
          message: "Trang web se hoat dong binh thuong tro lai.",
          onConfirm: () => {
            const payload = {
              globalEnabled: false,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              routeLocks: normalizeRouteLocks({}),
            };
            saveMaintenanceConfig(payload, "Da tat bao tri toan site.");
          },
        });
      });
    }

    if (maintenanceApplyBtn) {
      maintenanceApplyBtn.addEventListener("click", () => {
        const durationHours = readDurationHours();
        if (durationHours == null && (maintenanceState.globalEnabled || getLockedRouteCount(collectRouteLocks()) > 0)) {
          showToast("Thời lượng bảo trì tối thiểu 1 phút.");
          return;
        }
        const payload = {
          globalEnabled: maintenanceState.globalEnabled,
          message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
          durationHours: durationHours != null ? durationHours : MAINTENANCE_DURATION_DEFAULT_MINUTES / 60,
          routeLocks: collectRouteLocks(),
        };
        saveMaintenanceConfig(payload, "Da ap dung cau hinh bao tri.");
      });
    }

    if (maintenanceUnlockBtn) {
      maintenanceUnlockBtn.addEventListener("click", () => {
        openModal({
          title: "Mo khoa tat ca?",
          message: "Tat ca route se duoc mo khoa ngay.",
          onConfirm: () => {
            const payload = {
              globalEnabled: maintenanceState.globalEnabled,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              routeLocks: normalizeRouteLocks({}),
            };
            saveMaintenanceConfig(payload, "Da mo khoa tat ca route.");
          },
        });
      });
    }

    if (maintenanceLockAllBtn) {
      maintenanceLockAllBtn.addEventListener("click", () => {
        openModal({
          title: "Khóa tất cả route?",
          message: "Tất cả route sẽ được khóa ngay theo danh sách hiện tại.",
          onConfirm: () => {
            const durationHours = readDurationHours();
            if (durationHours == null) {
              showToast("Thời lượng bảo trì tối thiểu 1 phút.");
              return;
            }
            const payload = {
              globalEnabled: maintenanceState.globalEnabled,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              durationHours: durationHours != null ? durationHours : MAINTENANCE_DURATION_DEFAULT_MINUTES / 60,
              routeLocks: buildAllRouteLocks(true),
            };
            saveMaintenanceConfig(payload, "Đã khóa tất cả route.");
          },
        });
      });
    }

    if (maintenanceClearAllBtn) {
      maintenanceClearAllBtn.addEventListener("click", () => {
        openModal({
          title: "Mở khóa tất cả route?",
          message: "Tất cả route sẽ được bỏ khóa ngay.",
          onConfirm: () => {
            const payload = {
              globalEnabled: maintenanceState.globalEnabled,
              message: maintenanceMessage ? maintenanceMessage.value.trim() : maintenanceState.message,
              routeLocks: buildAllRouteLocks(false),
            };
            saveMaintenanceConfig(payload, "Đã mở khóa tất cả route.");
          },
        });
      });
    }

    if (useLegacyMaintenanceUi && legacyMaintenanceToggle) {
      legacyMaintenanceToggle.addEventListener("click", () => {
        const enable = !hasActiveLocks(maintenanceState);
        const label = enable ? "Bat bao tri" : "Tat bao tri";
        openModal({
          title: `${label}?`,
          message: enable
            ? "Nguoi dung se thay trang bao tri theo pham vi da chon."
            : "He thong se hoat dong binh thuong tro lai.",
          onConfirm: () => {
            const scopes = collectLegacyScopes();
            const payload = buildLegacyPayload(enable, scopes);
            saveMaintenanceConfig(payload, enable ? "Da bat bao tri." : "Da tat bao tri.");
          },
        });
      });
    }

    if (useLegacyMaintenanceUi && legacyMaintenanceSave) {
      legacyMaintenanceSave.addEventListener("click", () => {
        const enable = hasActiveLocks(maintenanceState);
        const scopes = collectLegacyScopes();
        const payload = buildLegacyPayload(enable, scopes);
        saveMaintenanceConfig(payload, "Da cap nhat bao tri.");
      });
    }

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

    fetchMaintenanceConfig();

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











