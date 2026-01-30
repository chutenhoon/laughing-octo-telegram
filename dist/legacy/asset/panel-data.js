(function () {
  "use strict";

  const STORAGE_KEY = "bk_panel_state_v1";

  const nowIso = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  /**
   * @typedef {Object} Store
   * @property {string} storeId
   * @property {string} name
   * @property {string} category
   * @property {string} avatarUrl
   * @property {string} shortDesc
   * @property {string} longDesc
   * @property {number} rating
   * @property {number} totalReviews
   * @property {number} orders
   * @property {number} stock
   * @property {string} approvalStatus
   * @property {boolean} active
   * @property {boolean} isAdmin
   * @property {Object|null} pendingChange
   * @property {string} createdAt
   * @property {string} updatedAt
   */

  /**
   * @typedef {Object} Product
   * @property {string} productId
   * @property {string} storeId
   * @property {string} name
   * @property {number} price
   * @property {number} stock
   * @property {string} type
   * @property {boolean} active
   * @property {boolean} published
   * @property {string} approvalStatus
   * @property {string} createdAt
   * @property {string} updatedAt
   */

  /**
   * @typedef {Object} Variant
   * @property {string} variantId
   * @property {string} productId
   * @property {string} storeId
   * @property {string} name
   * @property {number} price
   * @property {number} stock
   * @property {string} status
   * @property {string} shortDesc
   * @property {string} createdAt
   * @property {string} updatedAt
   */

  /**
   * @typedef {Object} Inventory
   * @property {string} productId
   * @property {Array<string>} items
   * @property {Array<Object>} history
   */

  /**
   * @typedef {Object} Order
   * @property {string} orderId
   * @property {string} storeId
   * @property {string} productName
   * @property {string} buyer
   * @property {number} total
   * @property {number} fee
   * @property {number} net
   * @property {string} status
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} Refund
   * @property {string} requestId
   * @property {string} orderId
   * @property {string} storeId
   * @property {string} buyer
   * @property {string} type
   * @property {number} value
   * @property {string} status
   * @property {string} createdAt
   * @property {string} note
   */

  /**
   * @typedef {Object} Withdrawal
   * @property {string} withdrawalId
   * @property {number} amount
   * @property {string} status
   * @property {string} method
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} User
   * @property {string} userId
   * @property {string} username
   * @property {string} email
   * @property {string} status
   * @property {boolean} online
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} RevenueSource
   * @property {string} sourceId
   * @property {string} type
   * @property {string} storeId
   * @property {string} storeName
   * @property {string} jobId
   * @property {string} transactionId
   * @property {number} fee
   * @property {number} total
   * @property {number} percent
   * @property {boolean} isAdminStore
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} SystemSettings
   * @property {boolean} maintenance
   * @property {number} defaultFeePercent
   * @property {number} smallOrderThreshold
   * @property {number} smallOrderFeePercent
   * @property {string} updatedAt
   */

  /**
   * @typedef {Object} Approval
   * @property {string} approvalId
   * @property {string} type
   * @property {string} status
   * @property {Object} user
   * @property {Object} detail
   * @property {string} submittedAt
   */

  const seedState = () => {
    const today = nowIso();
    return {
      stores: [],
      products: [],
      variants: [],
      inventories: [],
      orders: [],
      refunds: [],
      preorders: [],
      coupons: [],
      complaints: [],
      reviews: [],
      withdrawals: [],
      adminWithdrawals: [],
      users: [],
      revenueSources: [],
      financeRequests: [],
      approvals: [],
      sellerBalance: {
        available: 0,
        hold: 0,
        total: 0,
      },
      sellerPayment: {
        bankName: "",
        accountNumber: "",
        accountHolder: "",
        crypto: "",
      },
      adminBalance: {
        available: 0,
        pending: 0,
        total: 0,
      },
      systemSettings: {
        maintenance: false,
        defaultFeePercent: 5.5,
        smallOrderThreshold: 20000,
        smallOrderFeePercent: 2,
        updatedAt: today,
      },
    };
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      return { ...seedState(), ...parsed };
    } catch (error) {
      return seedState();
    }
  };

  let state = loadState();
  const listeners = new Set();

  const notify = () => {
    listeners.forEach((fn) => {
      try {
        fn(clone(state));
      } catch (err) {
        // noop
      }
    });
  };

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  };

  const updateState = (mutator) => {
    const draft = clone(state);
    const next = mutator(draft) || draft;
    state = next;
    saveState();
    return clone(state);
  };

  const ensureInventory = (productId) => {
    let inventory = state.inventories.find((item) => item.productId === productId);
    if (!inventory) {
      inventory = { productId, items: [], history: [] };
      state.inventories.push(inventory);
    }
    return inventory;
  };

  const createResource = (fetcher) => {
    const resource = {
      data: [],
      loading: false,
      error: null,
      load() {
        resource.loading = true;
        resource.error = null;
        return Promise.resolve()
          .then(fetcher)
          .then((data) => {
            resource.data = data;
            resource.loading = false;
            return resource;
          })
          .catch(() => {
            resource.error = true;
            resource.loading = false;
            return resource;
          });
      },
    };
    return resource;
  };

  const ADMIN_FEE_TYPES = new Set(["transaction_fee", "reseller", "service_fee"]);

  const isAdminStore = (store) => {
    if (!store) return false;
    return store.isAdmin === true || store.ownerRole === "admin" || store.role === "admin" || store.ownerType === "admin";
  };

  const isAdminStoreItem = (item, storeMap) => {
    if (!item || typeof item !== "object") return false;
    if (item.type === "admin_store") return true;
    if (item.isAdminStore === true) return true;
    if (item.storeRole === "admin" || item.storeOwnerRole === "admin") return true;
    const store = storeMap.get(item.storeId);
    return isAdminStore(store);
  };

  const normalizeRevenueSources = () => {
    const sources = Array.isArray(state.revenueSources) ? state.revenueSources : [];
    const storeMap = new Map(state.stores.map((store) => [store.storeId, store]));
    return sources.map((item) => {
      if (!item || typeof item !== "object") return item;
      if (!isAdminStoreItem(item, storeMap)) return { ...item };
      const totalValue = Number(item.total);
      const feeValue = Number(item.fee);
      const total = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : Number.isFinite(feeValue) ? feeValue : 0;
      const fee = total;
      const percent = item.percent != null ? item.percent : total ? 100 : 0;
      return { ...item, type: "admin_store", total, fee, percent };
    });
  };

  const computeAdminBalance = () => {
    const sources = normalizeRevenueSources();
    const hasSources = sources.some(
      (item) => item && (item.type === "admin_store" || ADMIN_FEE_TYPES.has(item.type) || item.isAdminRevenue === true)
    );
    const hasWithdrawals = Array.isArray(state.adminWithdrawals) && state.adminWithdrawals.length > 0;
    if (!hasSources && !hasWithdrawals) {
      return clone(state.adminBalance);
    }
    const inflow = sources.reduce((sum, item) => {
      if (!item || typeof item !== "object") return sum;
      if (item.type === "admin_store") return sum + (Number(item.total) || 0);
      if (ADMIN_FEE_TYPES.has(item.type)) return sum + (Number(item.fee) || 0);
      if (item.isAdminRevenue === true) return sum + (Number(item.fee) || Number(item.total) || 0);
      return sum;
    }, 0);
    const pending = (state.adminWithdrawals || [])
      .filter((item) => item.status === "processing")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const success = (state.adminWithdrawals || [])
      .filter((item) => item.status === "success")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const total = Math.max(inflow - success, 0);
    const available = Math.max(total - pending, 0);
    return { available, pending, total };
  };

  const services = {
    stores: {
      list: () => Promise.resolve(clone(state.stores)),
      create: (payload) =>
        updateState((draft) => {
          const store = {
            storeId: createId("store"),
            name: payload.name,
            category: payload.category || "General",
            avatarUrl: payload.avatarUrl || "../asset/logo-preview.png",
            shortDesc: payload.shortDesc || "",
            longDesc: payload.longDesc || "",
            rating: 0,
            totalReviews: 0,
            orders: 0,
            stock: 0,
            approvalStatus: "pending",
            active: true,
            isAdmin: payload.isAdmin === true || payload.ownerRole === "admin" || payload.role === "admin",
            pendingChange: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          draft.stores.unshift(store);
        }),
      requestUpdate: (storeId, updates) =>
        updateState((draft) => {
          const store = draft.stores.find((item) => item.storeId === storeId);
          if (!store) return;
          store.pendingChange = { ...updates, submittedAt: nowIso() };
          store.approvalStatus = "pending_update";
          store.updatedAt = nowIso();
        }),
      approve: (storeId) =>
        updateState((draft) => {
          const store = draft.stores.find((item) => item.storeId === storeId);
          if (!store) return;
          if (store.pendingChange) {
            const { submittedAt, ...changes } = store.pendingChange;
            Object.assign(store, changes);
            store.pendingChange = null;
          }
          store.approvalStatus = "approved";
          store.updatedAt = nowIso();
        }),
      reject: (storeId, reason) =>
        updateState((draft) => {
          const store = draft.stores.find((item) => item.storeId === storeId);
          if (!store) return;
          if (store.approvalStatus === "pending") {
            store.approvalStatus = "rejected";
          }
          store.pendingChange = null;
          store.updatedAt = nowIso();
          store.lastReviewNote = reason || "";
        }),
      toggleActive: (storeId) =>
        updateState((draft) => {
          const store = draft.stores.find((item) => item.storeId === storeId);
          if (!store) return;
          store.active = !store.active;
          store.updatedAt = nowIso();
        }),
    },
    products: {
      list: () => Promise.resolve(clone(state.products)),
      create: (payload) =>
        updateState((draft) => {
          const product = {
            productId: createId("prod"),
            storeId: payload.storeId,
            name: payload.name,
            price: payload.price || 0,
            stock: payload.stock || 0,
            type: payload.type || "instant",
            active: payload.active !== false,
            published: payload.published !== false,
            approvalStatus: "approved",
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          draft.products.unshift(product);
          ensureInventory(product.productId);
        }),
      update: (productId, updates) =>
        updateState((draft) => {
          const product = draft.products.find((item) => item.productId === productId);
          if (!product) return;
          Object.assign(product, updates);
          product.updatedAt = nowIso();
        }),
    },
    variants: {
      list: () => Promise.resolve(clone(state.variants)),
      create: (payload) =>
        updateState((draft) => {
          const variant = {
            variantId: createId("var"),
            productId: payload.productId,
            storeId: payload.storeId,
            name: payload.name,
            price: payload.price || 0,
            stock: payload.stock || 0,
            status: payload.status || "active",
            shortDesc: payload.shortDesc || "",
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          draft.variants.unshift(variant);
        }),
    },
    inventories: {
      get: (productId) => Promise.resolve(clone(ensureInventory(productId))),
      addItems: (productId, items, note) =>
        updateState((draft) => {
          const inventory = ensureInventory(productId);
          inventory.items.unshift(...items);
          inventory.history.unshift({ action: "upload", count: items.length, note: note || "Text input", createdAt: nowIso() });
        }),
      removeItems: (productId, count, note) =>
        updateState((draft) => {
          const inventory = ensureInventory(productId);
          const removed = inventory.items.splice(0, count);
          inventory.history.unshift({ action: "delete", count: removed.length, note: note || "Manual delete", createdAt: nowIso() });
        }),
      log: (productId, action, count, note) =>
        updateState((draft) => {
          const inventory = ensureInventory(productId);
          inventory.history.unshift({ action, count, note: note || "", createdAt: nowIso() });
        }),
    },
    orders: {
      list: () => Promise.resolve(clone(state.orders)),
    },
    refunds: {
      list: () => Promise.resolve(clone(state.refunds)),
      updateStatus: (requestId, status, note) =>
        updateState((draft) => {
          const item = draft.refunds.find((refund) => refund.requestId === requestId);
          if (!item) return;
          item.status = status;
          item.note = note || "";
          item.updatedAt = nowIso();
        }),
    },
    preorders: {
      list: () => Promise.resolve(clone(state.preorders)),
      updateStatus: (preorderId, status) =>
        updateState((draft) => {
          const preorder = draft.preorders.find((item) => item.preorderId === preorderId);
          if (!preorder) return;
          preorder.status = status;
          preorder.updatedAt = nowIso();
        }),
    },
    coupons: {
      list: () => Promise.resolve(clone(state.coupons)),
      create: (payload) =>
        updateState((draft) => {
          const coupon = {
            couponId: createId("cpn"),
            storeId: payload.storeId || "all",
            code: payload.code || "NEW",
            value: payload.value || "10%",
            status: payload.status || "active",
            expiresAt: payload.expiresAt || "2026-02-01",
            createdAt: nowIso(),
          };
          draft.coupons.unshift(coupon);
        }),
    },
    complaints: {
      list: () => Promise.resolve(clone(state.complaints)),
    },
    reviews: {
      list: () => Promise.resolve(clone(state.reviews)),
    },
    withdrawals: {
      list: () => Promise.resolve(clone(state.withdrawals)),
    },
    balances: {
      get: () => Promise.resolve(clone(state.sellerBalance)),
    },
    payment: {
      get: () => Promise.resolve(clone(state.sellerPayment)),
      update: (updates) =>
        updateState((draft) => {
          draft.sellerPayment = { ...draft.sellerPayment, ...updates };
        }),
    },
    adminBalance: {
      get: () => Promise.resolve(computeAdminBalance()),
    },
    adminWithdrawals: {
      list: () => Promise.resolve(clone(state.adminWithdrawals)),
    },
    users: {
      list: () => Promise.resolve(clone(state.users)),
    },
    revenue: {
      list: () => Promise.resolve(clone(normalizeRevenueSources())),
    },
    financeRequests: {
      list: () => Promise.resolve(clone(state.financeRequests)),
    },
    approvals: {
      list: () => Promise.resolve(clone(state.approvals)),
      updateStatus: (approvalId, status, note) =>
        updateState((draft) => {
          const item = draft.approvals.find((approval) => approval.approvalId === approvalId);
          if (!item) return;
          item.status = status;
          item.reviewNote = note || "";
          item.reviewedAt = nowIso();
        }),
    },
    settings: {
      get: () => Promise.resolve(clone(state.systemSettings)),
      update: (updates) =>
        updateState((draft) => {
          draft.systemSettings = { ...draft.systemSettings, ...updates, updatedAt: nowIso() };
        }),
    },
  };

  const hooks = {
    useStores: () => createResource(services.stores.list),
    useProducts: () => createResource(services.products.list),
    useVariants: () => createResource(services.variants.list),
    useOrders: () => createResource(services.orders.list),
    useRefunds: () => createResource(services.refunds.list),
    usePreorders: () => createResource(services.preorders.list),
    useCoupons: () => createResource(services.coupons.list),
    useComplaints: () => createResource(services.complaints.list),
    useReviews: () => createResource(services.reviews.list),
    useWithdrawals: () => createResource(services.withdrawals.list),
    useBalances: () => createResource(services.balances.get),
    usePayment: () => createResource(services.payment.get),
    useAdminWithdrawals: () => createResource(services.adminWithdrawals.list),
    useUsers: () => createResource(services.users.list),
    useRevenueSources: () => createResource(services.revenue.list),
    useFinanceRequests: () => createResource(services.financeRequests.list),
    useApprovals: () => createResource(services.approvals.list),
    useAdminBalance: () => createResource(services.adminBalance.get),
    useSettings: () => createResource(services.settings.get),
  };

  window.BKPanelData = {
    getState: () => clone(state),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    services,
    hooks,
  };
})();
