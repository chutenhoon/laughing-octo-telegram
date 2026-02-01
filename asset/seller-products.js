(function () {
  "use strict";

  const groupRoot = document.getElementById("seller-product-groups");
  if (!groupRoot) return;

  const services = window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null;
  if (!services || !services.products || !services.stores) return;

  const productSearch = document.getElementById("product-search");
  const productCreateBtn = document.getElementById("product-create-btn");
  const productEmpty = document.getElementById("product-empty");
  const productError = document.getElementById("product-error");
  const productRetryBtn = document.getElementById("product-retry");

  const inventoryCard = document.getElementById("inventory-card");
  const inventorySub = document.getElementById("inventory-sub");
  const inventoryClose = document.getElementById("inventory-close");
  const inventoryTabs = Array.from(document.querySelectorAll(".stock-tabs .sort-pill"));
  const inventoryTableBody = document.getElementById("inventory-table-body");
  const inventoryEmpty = document.getElementById("inventory-empty");
  const inventoryPagination = document.getElementById("inventory-pagination");
  const inventorySearch = document.getElementById("inventory-search");
  const inventorySort = document.getElementById("inventory-sort");

  const inventoryInput = document.getElementById("inventory-input");
  const inventoryInputWrap = document.getElementById("inventory-input-wrap");
  const inventoryFile = document.getElementById("inventory-file");
  const inventoryFileWrap = document.getElementById("inventory-file-wrap");
  const inventoryUploadBtn = document.getElementById("inventory-upload-btn");
  const inventoryUploadClose = document.getElementById("inventory-upload-close");

  const inventoryDownloadFormat = document.getElementById("inventory-download-format");
  const inventoryDownloadAvailable = document.getElementById("inventory-download-available");
  const inventoryDownloadBtn = document.getElementById("inventory-download-btn");
  const inventoryExportBtn = document.getElementById("inventory-export-btn");

  const inventoryDeleteInput = document.getElementById("inventory-delete-input");
  const inventoryDeleteCount = document.getElementById("inventory-delete-count");
  const inventoryDeleteBtn = document.getElementById("inventory-delete-btn");

  const inventoryHistoryBody = document.getElementById("inventory-history-body");
  const inventoryHistoryEmpty = document.getElementById("inventory-history-empty");
  const inventoryHistoryPagination = document.getElementById("inventory-history-pagination");

  const MAX_PRODUCTS_PER_SHOP = 6;
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  const state = {
    stores: [],
    products: [],
    loading: true,
    error: false,
    search: "",
    openGroups: new Set(),
  };

  const inventoryState = {
    productId: "",
    shopId: "",
    productName: "",
    shopName: "",
    items: [],
    loading: false,
    error: false,
    page: 1,
    perPage: 50,
    totalPages: 1,
    totalAvailable: 0,
    search: "",
    sort: "newest",
    scope: "available",
    history: [],
    historyPage: 1,
    historyTotalPages: 1,
    historyLoading: false,
  };

  let listController = null;
  let historyController = null;
  let dragState = { shopId: "", order: [] };

  const getRootPath = () =>
    window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";

  const buildCreateUrl = (shopId) => {
    const root = getRootPath();
    const base = `seller/panel/products/create/${window.location.protocol === "file:" ? "index.html" : ""}`;
    const url = `${root}${base}`.replace(/\/\.\//g, "/");
    if (!shopId) return url;
    return `${url}?shopId=${encodeURIComponent(shopId)}`;
  };

  const buildEditUrl = (productId) => {
    const root = getRootPath();
    const base = `seller/panel/products/create/${window.location.protocol === "file:" ? "index.html" : ""}`;
    const url = `${root}${base}`.replace(/\/\.\//g, "/");
    return productId ? `${url}?id=${encodeURIComponent(productId)}` : url;
  };

  const showToast = (message) => {
    if (!message) return;
    if (window.BKSellerToast && typeof window.BKSellerToast.show === "function") {
      window.BKSellerToast.show(message);
      return;
    }
    if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
      window.BKAuth.showToast(message);
      return;
    }
    window.alert(message);
  };

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

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const normalizeText = (value) => String(value || "").toLowerCase();

  const debounce = (fn, wait = 250) => {
    let timer = null;
    return (...args) => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  };

  const formatVnd = (value) => {
    const amount = Number(value) || 0;
    if (typeof formatPrice === "function") return formatPrice(amount);
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  const formatPriceRange = (item) => {
    const price = Number(item.price || 0);
    const priceMax = item.priceMax != null ? Number(item.priceMax || 0) : null;
    if (priceMax && priceMax > price) {
      return `${formatVnd(price)} - ${formatVnd(priceMax)}`;
    }
    return formatVnd(price);
  };

  const renderSkeleton = () => {
    const card = `
      <div class="seller-product-group">
        <div class="skeleton" style="height: 18px; width: 50%;"></div>
        <div class="skeleton" style="height: 12px; width: 40%;"></div>
        <div class="skeleton" style="height: 48px; margin-top: 8px;"></div>
      </div>
    `;
    groupRoot.innerHTML = Array.from({ length: 3 }, () => card).join("");
  };

  const statusTag = (status) => {
    const map = {
      approved: { label: "Đã duyệt", className: "good" },
      pending: { label: "Chờ duyệt", className: "warn" },
      pending_update: { label: "Chờ duyệt sửa", className: "warn" },
      rejected: { label: "Từ chối", className: "bad" },
    };
    const key = String(status || "").toLowerCase();
    const item = map[key] || { label: status || "--", className: "warn" };
    return `<span class="seller-tag ${item.className}">${escapeHtml(item.label)}</span>`;
  };

  const activeTag = (active) => {
    const label = active ? "Đang mở" : "Tạm đóng";
    const className = active ? "good" : "warn";
    return `<span class="seller-tag ${className}">${label}</span>`;
  };

  const buildProductRow = (product) => {
    const priceLabel = formatPriceRange(product);
    const stockLabel = Number(product.stock || 0).toLocaleString("vi-VN");
    const tags = [];
    if (product.category) tags.push(product.category);
    if (product.subcategory) tags.push(product.subcategory);
    const tagLine = tags.length ? `Danh mục: ${escapeHtml(tags.join(" • "))}` : "";
    const activeLabel = product.active ? "Hiển thị" : "Ẩn";
    const publishLabel = product.published ? "Đã publish" : "Chưa publish";
    return `
      <div class="seller-product-row" draggable="true" data-product-id="${product.productId}">
        <div class="seller-product-handle" data-drag-handle="true">&#x2630;</div>
        <div class="seller-product-info">
          <div class="seller-product-name">${escapeHtml(product.name)}</div>
          <div class="seller-product-meta">
            ${tagLine ? `<span>${tagLine}</span>` : ""}
            <span>${activeLabel}</span>
            <span>${publishLabel}</span>
          </div>
          ${product.descriptionShort ? `<div class="seller-product-sub">${escapeHtml(product.descriptionShort)}</div>` : ""}
        </div>
        <div class="seller-product-price">${priceLabel}</div>
        <div class="seller-product-stock">Kho: ${stockLabel}</div>
        <div class="seller-product-actions">
          <button class="btn ghost" type="button" data-action="edit-product" data-product-id="${product.productId}">Sửa</button>
          <button class="btn ghost" type="button" data-action="delete-product" data-product-id="${product.productId}">Xóa</button>
          <button class="btn" type="button" data-action="inventory" data-product-id="${product.productId}">Quản lý kho</button>
        </div>
      </div>
    `;
  };

  const sortProducts = (list) => {
    return list
      .slice()
      .sort((a, b) => {
        const aOrder = Number(a.sortOrder || 0);
        const bOrder = Number(b.sortOrder || 0);
        if (aOrder && bOrder && aOrder !== bOrder) return aOrder - bOrder;
        if (aOrder && !bOrder) return -1;
        if (!aOrder && bOrder) return 1;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
  };

  const renderGroups = () => {
    if (state.loading) {
      renderSkeleton();
      if (productEmpty) productEmpty.classList.add("is-hidden");
      if (productError) productError.classList.add("is-hidden");
      return;
    }
    if (state.error) {
      groupRoot.innerHTML = "";
      if (productEmpty) productEmpty.classList.add("is-hidden");
      if (productError) productError.classList.remove("is-hidden");
      return;
    }

    const searchTerm = normalizeText(state.search);
    const storeMap = new Map(state.stores.map((store) => [store.storeId, store]));
    const grouped = new Map();
    state.products.forEach((product) => {
      if (!storeMap.has(product.storeId)) return;
      const list = grouped.get(product.storeId) || [];
      list.push(product);
      grouped.set(product.storeId, list);
    });

    const cards = [];
    let hasAny = false;
    state.stores.forEach((store) => {
      const list = grouped.get(store.storeId) || [];
      const filtered = searchTerm
        ? list.filter((product) => normalizeText(product.name).includes(searchTerm))
        : list;
      if (searchTerm && !filtered.length) return;
      hasAny = true;
      const products = sortProducts(filtered);
      const isOpen = state.openGroups.has(store.storeId);
      const countLabel = `${products.length}/${MAX_PRODUCTS_PER_SHOP} sản phẩm`;
      const statusLabel = `${statusTag(store.approvalStatus)} ${activeTag(store.active)}`;
      cards.push(`
        <div class="seller-product-group" data-shop-id="${store.storeId}">
          <div class="seller-product-group-head" data-action="toggle-group">
            <div>
              <div class="seller-product-group-title">Sản phẩm của ${escapeHtml(store.name)}</div>
              <div class="seller-product-group-meta">${countLabel} • ${statusLabel}</div>
            </div>
            <div class="seller-product-group-actions">
              <button class="btn ghost" type="button" data-action="toggle-group">${isOpen ? "Thu gọn" : "Xem"}</button>
              <button class="btn" type="button" data-action="create-product" data-shop-id="${store.storeId}">+ Tạo sản phẩm</button>
            </div>
          </div>
          <div class="seller-product-group-body ${isOpen ? "is-open" : ""}">
            ${products.length ? `<div class="seller-product-list">${products.map(buildProductRow).join("")}</div>` : `<div class="seller-product-empty">Chưa có sản phẩm</div>`}
          </div>
        </div>
      `);
    });

    groupRoot.innerHTML = cards.join("");
    if (productEmpty) productEmpty.classList.toggle("is-hidden", hasAny);
    if (productError) productError.classList.add("is-hidden");
  };

  const loadData = async () => {
    state.loading = true;
    state.error = false;
    renderGroups();
    try {
      const [stores, products] = await Promise.all([services.stores.list(), services.products.list()]);
      state.stores = stores || [];
      state.products = products || [];
      state.loading = false;
      state.error = false;
      renderGroups();
    } catch (error) {
      state.loading = false;
      state.error = true;
      renderGroups();
      const handled = handleAuthError(error);
      if (!handled) {
        showToast(resolveLoadError(error, "Không thể tải danh sách sản phẩm."));
      }
    }
  };

  const refreshData = debounce(loadData, 200);

  const openShop = (shopId) => {
    if (!shopId) return;
    state.openGroups.add(String(shopId));
    renderGroups();
    const safeId =
      window.CSS && typeof window.CSS.escape === "function"
        ? window.CSS.escape(String(shopId))
        : String(shopId).replace(/"/g, "\\\"");
    const group = groupRoot.querySelector(`.seller-product-group[data-shop-id="${safeId}"]`);
    if (group) group.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateProductStock = (productId, stockCount) => {
    if (!productId) return;
    const next = state.products.map((product) =>
      product.productId === productId ? { ...product, stock: Number(stockCount || 0) } : product
    );
    state.products = next;
    renderGroups();
  };

  const setInventoryTab = (tab) => {
    inventoryTabs.forEach((pill) => {
      const key = pill.getAttribute("data-tab");
      pill.classList.toggle("active", key === tab);
    });
    document.querySelectorAll(".stock-tab").forEach((panel) => {
      panel.classList.toggle("is-hidden", panel.getAttribute("data-tab") !== tab);
    });
  };

  const renderInventoryList = () => {
    if (!inventoryTableBody) return;
    if (inventoryState.loading) {
      inventoryTableBody.innerHTML = `<tr><td colspan="3"><div class="table-skeleton"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div></td></tr>`;
      if (inventoryEmpty) inventoryEmpty.classList.add("is-hidden");
      if (inventoryPagination) inventoryPagination.innerHTML = "";
      return;
    }
    if (inventoryState.error) {
      inventoryTableBody.innerHTML = "";
      if (inventoryEmpty) inventoryEmpty.classList.remove("is-hidden");
      if (inventoryPagination) inventoryPagination.innerHTML = "";
      return;
    }

    let items = inventoryState.items || [];
    const term = normalizeText(inventoryState.search);
    if (term) items = items.filter((item) => normalizeText(item.line || "").includes(term));

    if (!items.length) {
      inventoryTableBody.innerHTML = "";
      if (inventoryEmpty) inventoryEmpty.classList.remove("is-hidden");
      if (inventoryPagination) inventoryPagination.innerHTML = "";
      return;
    }

    inventoryTableBody.innerHTML = items
      .map((item) => {
        const statusLabel = item.status === "consumed" ? "Đã dùng" : "Còn";
        const statusClass = item.status === "consumed" ? "warn" : "good";
        return `
          <tr>
            <td>${escapeHtml(item.line || "")}</td>
            <td><span class="seller-tag ${statusClass}">${statusLabel}</span></td>
            <td>${escapeHtml(item.createdAt || "--")}</td>
          </tr>
        `;
      })
      .join("");

    if (inventoryEmpty) inventoryEmpty.classList.add("is-hidden");
    renderPagination(inventoryPagination, inventoryState.page, inventoryState.totalPages, (nextPage) => {
      inventoryState.page = nextPage;
      loadInventoryList();
    });
  };

  const renderInventoryHistory = () => {
    if (!inventoryHistoryBody) return;
    if (inventoryState.historyLoading) {
      inventoryHistoryBody.innerHTML = `<tr><td colspan="4"><div class="table-skeleton"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div></td></tr>`;
      if (inventoryHistoryEmpty) inventoryHistoryEmpty.classList.add("is-hidden");
      if (inventoryHistoryPagination) inventoryHistoryPagination.innerHTML = "";
      return;
    }

    const items = inventoryState.history || [];
    if (!items.length) {
      inventoryHistoryBody.innerHTML = "";
      if (inventoryHistoryEmpty) inventoryHistoryEmpty.classList.remove("is-hidden");
      if (inventoryHistoryPagination) inventoryHistoryPagination.innerHTML = "";
      return;
    }

    inventoryHistoryBody.innerHTML = items
      .map((entry) => {
        const actionLabel = entry.action || "";
        return `
          <tr>
            <td>${escapeHtml(actionLabel)}</td>
            <td>${Number(entry.count || 0).toLocaleString("vi-VN")}</td>
            <td>${escapeHtml(entry.note || "")}</td>
            <td>${escapeHtml(entry.createdAt || "--")}</td>
          </tr>
        `;
      })
      .join("");

    if (inventoryHistoryEmpty) inventoryHistoryEmpty.classList.add("is-hidden");
    renderPagination(inventoryHistoryPagination, inventoryState.historyPage, inventoryState.historyTotalPages, (nextPage) => {
      inventoryState.historyPage = nextPage;
      loadInventoryHistory();
    });
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

  const loadInventoryList = async () => {
    if (!inventoryState.productId) return;
    if (listController) listController.abort();
    listController = new AbortController();
    inventoryState.loading = true;
    inventoryState.error = false;
    renderInventoryList();
    try {
      const data = await services.inventories.list(inventoryState.productId, {
        page: inventoryState.page,
        perPage: inventoryState.perPage,
        sort: inventoryState.sort,
        scope: inventoryState.scope,
        signal: listController.signal,
      });
      if (listController.signal.aborted) return;
      inventoryState.items = data.items || [];
      inventoryState.page = data.page || 1;
      inventoryState.totalPages = data.totalPages || 1;
      inventoryState.totalAvailable = data.totalAvailable || 0;
      inventoryState.loading = false;
      renderInventoryList();
    } catch (error) {
      if (error && error.name === "AbortError") return;
      inventoryState.loading = false;
      inventoryState.error = true;
      renderInventoryList();
      showToast("Không thể tải kho.");
    }
  };

  const loadInventoryHistory = async () => {
    if (!inventoryState.productId) return;
    if (historyController) historyController.abort();
    historyController = new AbortController();
    inventoryState.historyLoading = true;
    renderInventoryHistory();
    try {
      const data = await services.inventories.history(inventoryState.productId, {
        page: inventoryState.historyPage,
        perPage: 20,
        signal: historyController.signal,
      });
      if (historyController.signal.aborted) return;
      inventoryState.history = data.items || [];
      inventoryState.historyPage = data.page || 1;
      inventoryState.historyTotalPages = data.totalPages || 1;
      inventoryState.historyLoading = false;
      renderInventoryHistory();
    } catch (error) {
      if (error && error.name === "AbortError") return;
      inventoryState.historyLoading = false;
      renderInventoryHistory();
    }
  };

  const openInventoryPanel = (product) => {
    if (!inventoryCard || !product) return;
    inventoryCard.classList.remove("is-hidden");
    inventoryState.productId = product.productId;
    inventoryState.shopId = product.storeId;
    inventoryState.productName = product.name || "";
    const store = state.stores.find((item) => item.storeId === product.storeId);
    inventoryState.shopName = store ? store.name : "";
    if (inventorySub) {
      inventorySub.textContent = `${inventoryState.shopName} • ${inventoryState.productName}`;
    }
    inventoryState.page = 1;
    inventoryState.search = "";
    inventoryState.sort = "newest";
    inventoryState.scope = "available";
    inventoryState.historyPage = 1;
    if (inventorySearch) inventorySearch.value = "";
    if (inventorySort) inventorySort.value = "newest";
    setInventoryTab("list");
    loadInventoryList();
    loadInventoryHistory();
  };

  const closeInventoryPanel = () => {
    if (inventoryCard) inventoryCard.classList.add("is-hidden");
    inventoryState.productId = "";
  };

  const handleUpload = async () => {
    if (!inventoryState.productId) return;
    const mode = document.querySelector("input[name=\"stock-mode\"]:checked");
    const isFile = mode && mode.value === "file";
    let file = null;
    if (isFile) {
      file = inventoryFile && inventoryFile.files ? inventoryFile.files[0] : null;
      if (!file) {
        showToast("Vui lòng chọn file.");
        return;
      }
    } else {
      const text = inventoryInput ? inventoryInput.value.trim() : "";
      if (!text) {
        showToast("Vui lòng nhập dữ liệu kho.");
        return;
      }
      const blob = new Blob([text], { type: "text/plain" });
      file = new File([blob], "inventory.txt", { type: "text/plain" });
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast("File vượt quá 2MB.");
      return;
    }
    if (inventoryUploadBtn) {
      inventoryUploadBtn.disabled = true;
      inventoryUploadBtn.setAttribute("aria-busy", "true");
    }
    try {
      const data = await services.inventories.upload(inventoryState.productId, file, isFile ? file.name : "Paste");
      if (inventoryInput) inventoryInput.value = "";
      if (inventoryFile) inventoryFile.value = "";
      if (data && data.stockCount != null) updateProductStock(inventoryState.productId, data.stockCount);
      showToast("Đã nạp kho.");
      loadInventoryList();
      loadInventoryHistory();
    } catch (error) {
      const code = error && error.message ? error.message : "";
      if (code === "FILE_TOO_LARGE") showToast("File vượt quá 2MB.");
      else if (code === "INVALID_FILE_TYPE") showToast("Chỉ hỗ trợ TXT/CSV.");
      else if (code === "TOO_MANY_LINES") showToast("File quá nhiều dòng.");
      else showToast("Không thể nạp kho.");
    } finally {
      if (inventoryUploadBtn) {
        inventoryUploadBtn.disabled = false;
        inventoryUploadBtn.removeAttribute("aria-busy");
      }
    }
  };

  const handleDelete = async () => {
    if (!inventoryState.productId) return;
    const text = inventoryDeleteInput ? inventoryDeleteInput.value.trim() : "";
    const count = Number(inventoryDeleteCount ? inventoryDeleteCount.value : 0);
    if (!text && !count) {
      showToast("Vui lòng nhập key hoặc số lượng.");
      return;
    }
    if (inventoryDeleteBtn) {
      inventoryDeleteBtn.disabled = true;
      inventoryDeleteBtn.setAttribute("aria-busy", "true");
    }
    try {
      const payload = text ? { text } : { count };
      const data = await services.inventories.remove(inventoryState.productId, payload);
      if (inventoryDeleteInput) inventoryDeleteInput.value = "";
      if (inventoryDeleteCount) inventoryDeleteCount.value = "";
      if (data && data.stockCount != null) updateProductStock(inventoryState.productId, data.stockCount);
      showToast("Đã xóa khỏi kho.");
      loadInventoryList();
      loadInventoryHistory();
    } catch (error) {
      const code = error && error.message ? error.message : "";
      if (code === "NOT_FOUND") showToast("Không tìm thấy item cần xóa.");
      else showToast("Không thể xóa kho.");
    } finally {
      if (inventoryDeleteBtn) {
        inventoryDeleteBtn.disabled = false;
        inventoryDeleteBtn.removeAttribute("aria-busy");
      }
    }
  };

  const handleDownload = (mode) => {
    if (!inventoryState.productId) return;
    const format = inventoryDownloadFormat ? inventoryDownloadFormat.value : "txt";
    const scope = inventoryDownloadAvailable && inventoryDownloadAvailable.checked ? "available" : "all";
    const url = services.inventories.downloadUrl(inventoryState.productId, { format, scope, mode });
    if (!url) return;
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) window.location.href = url;
  };

  const toggleStockMode = () => {
    const mode = document.querySelector("input[name=\"stock-mode\"]:checked");
    const isFile = mode && mode.value === "file";
    if (inventoryInputWrap) inventoryInputWrap.classList.toggle("is-hidden", isFile);
    if (inventoryFileWrap) inventoryFileWrap.classList.toggle("is-hidden", !isFile);
  };

  const handleDragStart = (event) => {
    const row = event.target.closest(".seller-product-row");
    if (!row) return;
    if (!event.target.closest("[data-drag-handle]")) {
      event.preventDefault();
      return;
    }
    dragState.shopId = row.closest(".seller-product-group")?.getAttribute("data-shop-id") || "";
    dragState.order = Array.from(
      row.closest(".seller-product-list")?.querySelectorAll(".seller-product-row") || []
    ).map((item) => item.getAttribute("data-product-id"));
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", row.getAttribute("data-product-id") || "");
  };

  const handleDragEnd = async (event) => {
    const row = event.target.closest(".seller-product-row");
    if (row) row.classList.remove("dragging");
    const list = row ? row.closest(".seller-product-list") : null;
    if (!list || !dragState.shopId) return;
    const newOrder = Array.from(list.querySelectorAll(".seller-product-row")).map((item) =>
      item.getAttribute("data-product-id")
    );
    const prevOrder = dragState.order;
    const shopId = dragState.shopId || row.closest(".seller-product-group")?.getAttribute("data-shop-id") || "";
    dragState = { shopId: "", order: [] };
    if (!newOrder.length || newOrder.join(",") === prevOrder.join(",")) return;
    try {
      await services.products.reorder(shopId, newOrder);
      showToast("Đã cập nhật thứ tự sản phẩm.");
      state.products = state.products.map((product) => {
        const idx = newOrder.indexOf(product.productId);
        if (idx >= 0) return { ...product, sortOrder: idx + 1 };
        return product;
      });
    } catch (error) {
      showToast("Không thể sắp xếp sản phẩm.");
      renderGroups();
    }
  };

  const getDragAfterElement = (container, y) => {
    const items = [...container.querySelectorAll(".seller-product-row:not(.dragging)")];
    return items.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  };

  const handleDragOver = (event) => {
    const list = event.target.closest(".seller-product-list");
    const dragging = list ? list.querySelector(".seller-product-row.dragging") : null;
    const groupId = list ? list.closest(".seller-product-group")?.getAttribute("data-shop-id") : "";
    if (!list || !dragging || !groupId || groupId !== dragState.shopId) return;
    event.preventDefault();
    const after = getDragAfterElement(list, event.clientY);
    if (after == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, after);
    }
  };

  groupRoot.addEventListener("click", (event) => {
    const actionButton = event.target.closest("button[data-action]");
    const group = event.target.closest(".seller-product-group");
    const shopId = group ? group.getAttribute("data-shop-id") : "";

    if (actionButton) {
      const action = actionButton.getAttribute("data-action");
      if (action === "toggle-group") {
        if (shopId) {
          if (state.openGroups.has(shopId)) state.openGroups.delete(shopId);
          else state.openGroups.add(shopId);
          renderGroups();
        }
        return;
      }
      if (action === "create-product") {
        window.location.href = buildCreateUrl(shopId);
        return;
      }
      if (action === "edit-product") {
        const productId = actionButton.getAttribute("data-product-id");
        if (productId) window.location.href = buildEditUrl(productId);
        return;
      }
      if (action === "inventory") {
        const productId = actionButton.getAttribute("data-product-id");
        const product = state.products.find((item) => item.productId === productId);
        if (product) openInventoryPanel(product);
        return;
      }
      if (action === "delete-product") {
        const productId = actionButton.getAttribute("data-product-id");
        if (!productId) return;
        const product = state.products.find((item) => item.productId === productId);
        const label = product && product.name ? product.name : "sản phẩm này";
        const confirmed = window.confirm(`Xóa ${label}?`);
        if (!confirmed) return;
        services.products
          .delete(productId)
          .then(() => {
            state.products = state.products.filter((item) => item.productId !== productId);
            renderGroups();
            showToast("Đã xóa sản phẩm.");
          })
          .catch((error) => {
            const handled = handleAuthError(error);
            if (!handled) {
              showToast(resolveLoadError(error, "Không thể xóa sản phẩm."));
            }
          });
        return;
      }
      return;
    }

    const head = event.target.closest(".seller-product-group-head");
    if (head && shopId) {
      if (state.openGroups.has(shopId)) state.openGroups.delete(shopId);
      else state.openGroups.add(shopId);
      renderGroups();
    }
  });

  groupRoot.addEventListener("dragstart", handleDragStart);
  groupRoot.addEventListener("dragover", handleDragOver);
  groupRoot.addEventListener("dragend", handleDragEnd);

  if (productSearch) {
    productSearch.addEventListener(
      "input",
      debounce(() => {
        state.search = productSearch.value || "";
        renderGroups();
      }, 250)
    );
  }

  if (productCreateBtn) {
    productCreateBtn.addEventListener("click", () => {
      const preferred = state.openGroups.values().next().value;
      window.location.href = buildCreateUrl(preferred || "");
    });
  }
  if (productRetryBtn) {
    productRetryBtn.addEventListener("click", () => {
      loadData();
    });
  }

  if (inventoryClose) inventoryClose.addEventListener("click", closeInventoryPanel);
  if (inventoryUploadClose) inventoryUploadClose.addEventListener("click", closeInventoryPanel);

  inventoryTabs.forEach((pill) => {
    pill.addEventListener("click", () => {
      const tab = pill.getAttribute("data-tab");
      if (tab) setInventoryTab(tab);
    });
  });

  if (inventorySearch) {
    inventorySearch.addEventListener(
      "input",
      debounce(() => {
        inventoryState.search = inventorySearch.value || "";
        renderInventoryList();
      }, 250)
    );
  }

  if (inventorySort) {
    inventorySort.addEventListener("change", () => {
      inventoryState.sort = inventorySort.value || "newest";
      inventoryState.page = 1;
      loadInventoryList();
    });
  }

  if (inventoryUploadBtn) inventoryUploadBtn.addEventListener("click", handleUpload);
  if (inventoryDeleteBtn) inventoryDeleteBtn.addEventListener("click", handleDelete);

  if (inventoryDownloadBtn) inventoryDownloadBtn.addEventListener("click", () => handleDownload("full"));
  if (inventoryExportBtn) inventoryExportBtn.addEventListener("click", () => handleDownload("keys"));

  document.querySelectorAll("input[name=\"stock-mode\"]").forEach((radio) => {
    radio.addEventListener("change", toggleStockMode);
  });
  toggleStockMode();

  if (window.BKPanelData && typeof window.BKPanelData.subscribe === "function") {
    window.BKPanelData.subscribe(() => refreshData());
  }

  window.BKSellerProducts = { openShop };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
  } else {
    loadData();
  }
})();
