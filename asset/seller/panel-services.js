(function () {
  "use strict";

  const API_ROOT = "/api";
  let storeCache = [];
  let productCache = [];
  let storeEtag = "";
  const listeners = new Set();

  const notify = () => {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        // noop
      }
    });
  };

  const resolveAuthUser = () => {
    if (!window.BKAuth || typeof window.BKAuth.read !== "function") return null;
    const auth = window.BKAuth.read();
    if (!auth || !auth.loggedIn) return null;
    return auth.user || null;
  };

  const getUserRef = (user) => {
    if (!user) return "";
    if (user.id != null && String(user.id).trim()) return String(user.id).trim();
    if (user.username && String(user.username).trim()) return String(user.username).trim();
    if (user.email && String(user.email).trim()) return String(user.email).trim();
    return "";
  };

  const getAuthHeaders = (json = true) => {
    const headers = {};
    if (json) headers["content-type"] = "application/json";
    const user = resolveAuthUser();
    if (user) {
      const userRef = getUserRef(user);
      if (userRef) headers["x-user-id"] = userRef;
      if (user.email) headers["x-user-email"] = String(user.email);
      if (user.username) headers["x-user-username"] = String(user.username);
    }
    return headers;
  };

  const buildError = (response, data, fallback) => {
    const errorCode = (data && data.error) || fallback || "REQUEST_FAILED";
    const error = new Error(errorCode);
    error.status = response ? response.status : 0;
    error.payload = data;
    return error;
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      throw buildError(response, data, "REQUEST_FAILED");
    }
    return data;
  };

  const mapStore = (shop) => ({
    storeId: shop.id,
    name: shop.name || "",
    storeType: shop.storeType || shop.store_type || "",
    category: shop.category || "",
    subcategory: shop.subcategory || "",
    tags: Array.isArray(shop.tags) ? shop.tags : [],
    avatarUrl: shop.avatarUrl || "",
    shortDesc: shop.descriptionShort || "",
    longDesc: shop.descriptionLong || "",
    rating: Number(shop.rating || 0),
    totalReviews: Number(shop.totalReviews || 0),
    orders: Number(shop.totalOrders || 0),
    stock: Number(shop.stockCount || 0),
    approvalStatus: shop.status || "pending",
    active: shop.isActive !== false,
    isAdmin: false,
    pendingChange: shop.pendingChange || null,
    reviewNote: shop.reviewNote || "",
    createdAt: shop.createdAt || "",
    updatedAt: shop.updatedAt || "",
  });

  const mapProduct = (item) => ({
    productId: item.id,
    storeId: item.shopId,
    name: item.title || item.name || "",
    descriptionShort: item.descriptionShort || "",
    descriptionHtml: item.descriptionHtml || "",
    category: item.category || "",
    subcategory: item.subcategory || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    price: Number(item.price || 0),
    priceMax: item.priceMax != null ? Number(item.priceMax || 0) : null,
    stock: Number(item.stockCount || 0),
    sortOrder: item.sortOrder != null ? Number(item.sortOrder || 0) : 0,
    type: "instant",
    active: item.isActive !== false,
    published: item.isPublished !== false,
    approvalStatus: item.status || "draft",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  });

  const services = {
    stores: {
      list: async () => {
        const headers = getAuthHeaders(false);
        if (storeEtag) headers["if-none-match"] = storeEtag;
        const response = await fetch(`${API_ROOT}/seller/shops`, {
          headers,
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 304 && storeCache.length) return storeCache.slice();
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok === false) {
          throw buildError(response, data, "REQUEST_FAILED");
        }
        const etag = response.headers.get("etag") || response.headers.get("ETag") || "";
        if (etag) storeEtag = etag;
        const items = (data.items || []).map(mapStore);
        storeCache = items.slice();
        return items;
      },
      create: async (payload) => {
        const data = await fetchJson(`${API_ROOT}/seller/shops`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload || {}),
        });
        const shop = data.shop ? mapStore(data.shop) : null;
        if (shop) {
          storeCache = storeCache.filter((s) => s.storeId !== shop.storeId);
          storeCache.unshift(shop);
        }
        notify();
        return shop;
      },
      requestUpdate: async (storeId, updates) => {
        return services.stores.create({ ...(updates || {}), id: storeId });
      },
      toggleActive: async (storeId) => {
        const current = storeCache.find((s) => s.storeId === storeId);
        const next = current ? !current.active : true;
        return services.stores.create({ id: storeId, isActive: next });
      },
      delete: async (storeId, password) => {
        if (!storeId) return null;
        const data = await fetchJson(`${API_ROOT}/seller/shops/${encodeURIComponent(storeId)}/delete`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ password: String(password || "") }),
        });
        storeCache = storeCache.filter((store) => store.storeId !== storeId);
        notify();
        return data;
      },
      uploadAvatar: async (storeId, file) => {
        if (!storeId || !file) return null;
        const form = new FormData();
        form.append("storeId", storeId);
        form.append("file", file);
        const data = await fetchJson(`${API_ROOT}/store/avatar`, {
          method: "POST",
          headers: getAuthHeaders(false),
          body: form,
        });
        const avatar = data && data.avatar ? data.avatar : null;
        if (avatar && avatar.url) {
          storeCache = storeCache.map((store) =>
            store.storeId === storeId ? { ...store, avatarUrl: avatar.url } : store
          );
          notify();
        }
        return avatar;
      },
    },
    products: {
      list: async () => {
        const data = await fetchJson(`${API_ROOT}/seller/products`, { headers: getAuthHeaders(false) });
        const items = (data.items || []).map(mapProduct);
        productCache = items.slice();
        return items;
      },
      create: async (payload) => {
        const data = await fetchJson(`${API_ROOT}/seller/products`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload || {}),
        });
        const item = data.product ? mapProduct(data.product) : null;
        if (item) {
          productCache = productCache.filter((p) => p.productId !== item.productId);
          productCache.unshift(item);
        }
        notify();
        return item;
      },
      delete: async (productId) => {
        if (!productId) return null;
        const data = await fetchJson(`${API_ROOT}/seller/products/${encodeURIComponent(productId)}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        productCache = productCache.filter((product) => product.productId !== productId);
        notify();
        return data;
      },
      update: async (productId, updates) => {
        return services.products.create({ ...(updates || {}), id: productId });
      },
      reorder: async (shopId, order) => {
        if (!shopId || !Array.isArray(order)) return null;
        const payload = { shopId, order };
        const data = await fetchJson(`${API_ROOT}/seller/products/reorder`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        const orderMap = new Map();
        order.forEach((id, index) => {
          orderMap.set(String(id), index + 1);
        });
        productCache = productCache.map((product) => {
          const nextOrder = orderMap.get(String(product.productId));
          if (nextOrder != null) {
            return { ...product, sortOrder: nextOrder };
          }
          return product;
        });
        notify();
        return data;
      },
    },
    inventories: {
      list: async (productId, options = {}) => {
        if (!productId) return { items: [], page: 1, perPage: 50, totalPages: 1, totalAvailable: 0 };
        const params = new URLSearchParams();
        if (options.page) params.set("page", String(options.page));
        if (options.perPage) params.set("perPage", String(options.perPage));
        if (options.sort) params.set("sort", String(options.sort));
        if (options.scope) params.set("scope", String(options.scope));
        const fetchOptions = { headers: getAuthHeaders(false) };
        if (options.signal) fetchOptions.signal = options.signal;
        const data = await fetchJson(
          `${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory?${params.toString()}`,
          fetchOptions
        );
        return data;
      },
      history: async (productId, options = {}) => {
        if (!productId) return { items: [], page: 1, perPage: 20, totalPages: 1, total: 0 };
        const params = new URLSearchParams();
        if (options.page) params.set("page", String(options.page));
        if (options.perPage) params.set("perPage", String(options.perPage));
        const fetchOptions = { headers: getAuthHeaders(false) };
        if (options.signal) fetchOptions.signal = options.signal;
        const data = await fetchJson(
          `${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory/history?${params.toString()}`,
          fetchOptions
        );
        return data;
      },
      upload: async (productId, file, note) => {
        if (!productId || !file) return null;
        const form = new FormData();
        form.append("file", file, file.name || "inventory.txt");
        if (note) form.append("note", String(note));
        const data = await fetchJson(`${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory`, {
          method: "POST",
          headers: getAuthHeaders(false),
          body: form,
        });
        notify();
        return data;
      },
      remove: async (productId, payload) => {
        if (!productId) return null;
        const data = await fetchJson(`${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory/delete`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload || {}),
        });
        notify();
        return data;
      },
      downloadUrl: (productId, options = {}) => {
        if (!productId) return "";
        const params = new URLSearchParams();
        if (options.scope) params.set("scope", String(options.scope));
        if (options.format) params.set("format", String(options.format));
        if (options.mode) params.set("mode", String(options.mode));
        return `${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory/download?${params.toString()}`;
      },
      get: async (productId) => {
        const list = await services.inventories.list(productId, { page: 1, perPage: 50, scope: "available" });
        const history = await services.inventories.history(productId, { page: 1, perPage: 20 });
        return { items: list.items || [], history: history.items || [] };
      },
      addItems: async (productId, items, note) => {
        const list = Array.isArray(items) ? items : [];
        const text = list.join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const file = new File([blob], "inventory.txt", { type: "text/plain" });
        return services.inventories.upload(productId, file, note);
      },
      removeItems: async (productId, count, note) => {
        if (!productId || !count) return null;
        return services.inventories.remove(productId, { count, note });
      },
      log: async () => true,
    },
    variants: {
      list: async () => [],
      create: async () => true,
    },
    orders: {
      list: async () => [],
    },
    refunds: {
      list: async () => [],
      updateStatus: async () => true,
    },
    preorders: {
      list: async () => [],
      updateStatus: async () => true,
    },
    coupons: {
      list: async () => [],
      create: async () => true,
    },
    complaints: {
      list: async () => [],
    },
    reviews: {
      list: async () => [],
    },
    withdrawals: {
      list: async () => [],
    },
    balances: {
      get: async () => ({ available: 0, hold: 0, total: 0 }),
    },
    payment: {
      get: async () => ({ bank: "", account: "", holder: "" }),
      update: async () => true,
    },
  };

  const panel = window.BKPanelData || {};
  const baseSubscribe = panel.subscribe;
  panel.services = services;
  panel.notify = notify;
  panel.subscribe = (listener) => {
    if (typeof listener === "function") listeners.add(listener);
    const baseUnsub = typeof baseSubscribe === "function" ? baseSubscribe(listener) : null;
    return () => {
      if (typeof listener === "function") listeners.delete(listener);
      if (typeof baseUnsub === "function") baseUnsub();
    };
  };
  window.BKPanelData = panel;
})();
