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

  const getAuthHeaders = (json = true) => {
    const headers = {};
    if (json) headers["content-type"] = "application/json";
    if (window.BKAuth && typeof window.BKAuth.read === "function") {
      const auth = window.BKAuth.read();
      if (auth && auth.loggedIn) {
        const user = auth.user || {};
        if (user.id != null) headers["x-user-id"] = String(user.id);
        if (user.email) headers["x-user-email"] = String(user.email);
        if (user.username) headers["x-user-username"] = String(user.username);
      }
    }
    return headers;
  };

  const fetchJson = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = (data && data.error) || "REQUEST_FAILED";
      throw new Error(error);
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
    name: item.title || "",
    price: Number(item.price || 0),
    stock: Number(item.stockCount || 0),
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
        const response = await fetch(`${API_ROOT}/seller/shops`, { headers, cache: "no-store" });
        if (response.status === 304 && storeCache.length) return storeCache.slice();
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok === false) {
          const error = (data && data.error) || "REQUEST_FAILED";
          throw new Error(error);
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
      update: async (productId, updates) => {
        return services.products.create({ ...(updates || {}), id: productId });
      },
    },
    inventories: {
      list: async () => {
        if (!productCache.length) {
          await services.products.list();
        }
        return productCache.map((product) => ({
          productId: product.productId,
          items: new Array(Number(product.stock || 0)),
          history: [],
        }));
      },
      get: async (productId) => {
        const data = await fetchJson(`${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory`, {
          headers: getAuthHeaders(false),
        });
        const items = (data.items || []).map((entry, index) => {
          const available = Number(entry.availableCount || 0);
          const total = Number(entry.lineCount || 0);
          return `Batch ${index + 1} • ${available}/${total}`;
        });
        const history = (data.items || []).map((entry) => ({
          action: "upload",
          count: Number(entry.lineCount || 0),
          note: entry.id || "",
          createdAt: entry.createdAt || "",
        }));
        return { items, history };
      },
      addItems: async (productId, items, note) => {
        const list = Array.isArray(items) ? items : [];
        const text = list.join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const form = new FormData();
        form.append("file", blob, "inventory.txt");
        if (note) form.append("note", String(note));
        await fetchJson(`${API_ROOT}/seller/products/${encodeURIComponent(productId)}/inventory`, {
          method: "POST",
          headers: getAuthHeaders(false),
          body: form,
        });
        notify();
        return true;
      },
      removeItems: async () => true,
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
