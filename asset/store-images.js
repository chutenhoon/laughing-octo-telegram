(function () {
  "use strict";

  const SELLER_LIMIT = 5;
  const SELLER_MAX_SIZE = 2 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

  const ADMIN_CRED_KEY = "bk_admin_creds";

  const showToast = (message) => {
    if (!message) return;
    if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
      window.BKAuth.showToast(message);
      return;
    }
    window.alert(message);
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

  const buildHeaders = (json = false) => {
    const headers = { ...getUserHeaders() };
    const admin = getAdminHeaders();
    if (admin) Object.assign(headers, admin);
    if (json) headers["content-type"] = "application/json";
    return headers;
  };

  const resolveExt = (file) => {
    const name = String(file && file.name ? file.name : "");
    const idx = name.lastIndexOf(".");
    if (idx === -1) return "";
    return name.slice(idx + 1).toLowerCase();
  };

  const validateFile = (file, isAdmin) => {
    const type = String(file.type || "").toLowerCase();
    const ext = resolveExt(file);
    if (type && !ALLOWED_TYPES.has(type)) return "INVALID_FILE_TYPE";
    if (!type && ext && !ALLOWED_EXT.has(ext)) return "INVALID_FILE_TYPE";
    if (!isAdmin && file.size > SELLER_MAX_SIZE) return "FILE_TOO_LARGE";
    return "";
  };

  const createManager = (config) => {
    const root = document.getElementById(config.rootId);
    if (!root) return null;
    const list = document.getElementById(config.listId);
    const upload = document.getElementById(config.uploadId);
    const count = document.getElementById(config.countId);

    const state = {
      shopId: "",
      isAdmin: Boolean(config.isAdmin),
      items: [],
    };

    const setCount = () => {
      if (!count) return;
      if (state.isAdmin) {
        count.textContent = `${state.items.length}`;
      } else {
        count.textContent = `${state.items.length}/${SELLER_LIMIT}`;
      }
    };

    const render = () => {
      if (!list) return;
      if (!state.items.length) {
        list.innerHTML = `<div class="store-image-empty">Ch\u01b0a c\u00f3 \u1ea3nh</div>`;
        setCount();
        if (upload) upload.disabled = !state.shopId;
        return;
      }
      list.innerHTML = state.items
        .map(
          (item) => `
          <div class="store-image-item" data-id="${item.id}">
            <img src="${item.url}" alt="Shop image" loading="lazy" />
            <div class="store-image-actions">
              <button class="btn ghost" type="button" data-action="left">\u2190</button>
              <button class="btn ghost" type="button" data-action="right">\u2192</button>
              <button class="btn ghost" type="button" data-action="remove">\u2715</button>
            </div>
          </div>
        `
        )
        .join("");
      setCount();
      if (upload) upload.disabled = !state.shopId || (!state.isAdmin && state.items.length >= SELLER_LIMIT);
    };

    const load = async () => {
      if (!state.shopId) {
        state.items = [];
        render();
        return;
      }
      try {
        const response = await fetch(`/api/store/images?shopId=${encodeURIComponent(state.shopId)}`, {
          headers: buildHeaders(false),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
        state.items = Array.isArray(data.items) ? data.items : [];
        state.items.sort((a, b) => (Number(a.position || 0) || 0) - (Number(b.position || 0) || 0));
        render();
      } catch (error) {
        state.items = [];
        render();
      }
    };

    const reorder = async (order) => {
      if (!state.shopId) return;
      try {
        const response = await fetch("/api/store/images/reorder", {
          method: "POST",
          headers: buildHeaders(true),
          body: JSON.stringify({ shopId: state.shopId, order }),
        });
        const data = await response.json();
        if (!response.ok || !data || data.ok === false) throw new Error("REORDER_FAILED");
      } catch (error) {
        showToast("Kh\u00f4ng th\u1ec3 s\u1eafp x\u1ebfp \u1ea3nh.");
      }
    };

    const moveItem = async (id, dir) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index < 0) return;
      const nextIndex = index + dir;
      if (nextIndex < 0 || nextIndex >= state.items.length) return;
      const updated = [...state.items];
      const temp = updated[index];
      updated[index] = updated[nextIndex];
      updated[nextIndex] = temp;
      state.items = updated;
      render();
      await reorder(state.items.map((item) => item.id));
    };

    const removeItem = async (id) => {
      if (!state.shopId) return;
      try {
        const response = await fetch(`/api/store/images/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: buildHeaders(false),
        });
        const data = await response.json();
        if (!response.ok || !data || data.ok === false) throw new Error("REMOVE_FAILED");
        state.items = state.items.filter((item) => item.id !== id);
        render();
      } catch (error) {
        showToast("Kh\u00f4ng th\u1ec3 x\u00f3a \u1ea3nh.");
      }
    };

    const uploadFiles = async (files) => {
      if (!state.shopId) {
        showToast("Vui l\u00f2ng t\u1ea1o gian h\u00e0ng tr\u01b0\u1edbc.");
        return;
      }
      const fileList = Array.from(files || []).filter((file) => file && typeof file.arrayBuffer === "function");
      if (!fileList.length) return;
      if (!state.isAdmin && state.items.length + fileList.length > SELLER_LIMIT) {
        showToast(`Ch\u1ec9 \u0111\u01b0\u1ee3c t\u1ed1i \u0111a ${SELLER_LIMIT} \u1ea3nh.`);
        return;
      }
      for (const file of fileList) {
        const error = validateFile(file, state.isAdmin);
        if (error === "INVALID_FILE_TYPE") {
          showToast("Ch\u1ec9 h\u1ed7 tr\u1ee3 JPG, PNG, WEBP.");
          return;
        }
        if (error === "FILE_TOO_LARGE") {
          showToast("M\u1ed7i \u1ea3nh t\u1ed1i \u0111a 2MB.");
          return;
        }
      }
      const form = new FormData();
      form.append("shopId", state.shopId);
      fileList.forEach((file) => form.append("files", file, file.name));
      try {
        const response = await fetch("/api/store/images", {
          method: "POST",
          headers: buildHeaders(false),
          body: form,
        });
        const data = await response.json();
        if (!response.ok || !data || data.ok === false) {
          const errorCode = data && data.error ? data.error : "UPLOAD_FAILED";
          if (errorCode === "IMAGE_LIMIT") {
            showToast(`Ch\u1ec9 \u0111\u01b0\u1ee3c t\u1ed1i \u0111a ${SELLER_LIMIT} \u1ea3nh.`);
            return;
          }
          if (errorCode === "FILE_TOO_LARGE") {
            showToast("M\u1ed7i \u1ea3nh t\u1ed1i \u0111a 2MB.");
            return;
          }
          if (errorCode === "INVALID_FILE_TYPE") {
            showToast("Ch\u1ec9 h\u1ed7 tr\u1ee3 JPG, PNG, WEBP.");
            return;
          }
          throw new Error(errorCode);
        }
        const added = Array.isArray(data.items) ? data.items : [];
        state.items = state.items.concat(added);
        state.items.sort((a, b) => (Number(a.position || 0) || 0) - (Number(b.position || 0) || 0));
        render();
      } catch (error) {
        showToast("Kh\u00f4ng th\u1ec3 t\u1ea3i \u1ea3nh.");
      }
    };

    if (upload) {
      upload.addEventListener("change", (event) => {
        uploadFiles(event.target.files);
        upload.value = "";
      });
    }

    if (list) {
      list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const item = button.closest(".store-image-item");
        if (!item) return;
        const id = item.getAttribute("data-id");
        const action = button.getAttribute("data-action");
        if (action === "left") moveItem(id, -1);
        if (action === "right") moveItem(id, 1);
        if (action === "remove") removeItem(id);
      });
    }

    const open = (detail) => {
      const payload = detail || {};
      state.shopId = String(payload.shopId || "");
      if (typeof payload.isAdmin === "boolean") state.isAdmin = payload.isAdmin;
      load();
    };

    return { open };
  };

  const sellerManager = createManager({
    rootId: "store-image-manager",
    uploadId: "store-image-upload",
    listId: "store-image-list",
    countId: "store-image-count",
    isAdmin: false,
  });

  const adminManager = createManager({
    rootId: "admin-store-image-manager",
    uploadId: "admin-store-image-upload",
    listId: "admin-store-image-list",
    countId: "admin-store-image-count",
    isAdmin: true,
  });

  document.addEventListener("store-images:open", (event) => {
    const detail = event.detail || {};
    if (detail.isAdmin && adminManager) adminManager.open(detail);
    if (!detail.isAdmin && sellerManager) sellerManager.open(detail);
  });

  window.BKStoreImages = {
    open: (detail) => {
      const payload = detail || {};
      if (payload.isAdmin && adminManager) adminManager.open(payload);
      if (!payload.isAdmin && sellerManager) sellerManager.open(payload);
    },
  };
})();
