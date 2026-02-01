(function () {
  "use strict";

  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const IMAGE_LIMIT = 5;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const guard = document.getElementById("seller-create-guard");
  const guardText = document.getElementById("seller-create-guard-text");
  const panel = document.getElementById("seller-create-panel");
  const backBtn = document.getElementById("seller-create-back");
  const pageTitle = document.getElementById("seller-create-title");
  const pageSub = document.getElementById("seller-create-sub");
  const editorTitle = document.getElementById("seller-editor-title");
  const editorSub = document.getElementById("seller-editor-sub");

  const storeNameInput = document.getElementById("store-name");
  const storeShortDesc = document.getElementById("store-short-desc");
  const storeLongDesc = document.getElementById("store-long-desc");
  const storeAvatar = document.getElementById("store-avatar");
  const storeAvatarPreview = document.getElementById("store-avatar-preview");
  const storeAvatarPreviewWrap = document.getElementById("store-avatar-preview-wrap");
  const storeSaveBtn = document.getElementById("store-save-btn");
  const storeResetBtn = document.getElementById("store-reset-btn");

  const imageUpload = document.getElementById("create-store-image-upload");
  const imageList = document.getElementById("create-store-image-list");
  const imageCount = document.getElementById("create-store-image-count");
  const createImageManager = document.getElementById("create-store-image-manager");
  const editImageManager = document.getElementById("store-image-manager");

  const loadingModal = document.getElementById("seller-create-loading");

  const selectedImages = [];
  let editing = false;
  let currentStoreId = "";
  let originalStore = null;

  const getRootPath = () =>
    window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";
  const getPanelUrl = (view) => {
    const base = `${getRootPath()}seller/panel/${window.location.protocol === "file:" ? "index.html" : ""}`;
    if (!view) return base;
    return `${base}?view=${encodeURIComponent(view)}`;
  };

  const showToast = (message) => {
    if (!message) return;
    if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
      window.BKAuth.showToast(message);
      return;
    }
    window.alert(message);
  };

  const showLoading = (active) => {
    if (!loadingModal) return;
    loadingModal.classList.toggle("open", Boolean(active));
    loadingModal.setAttribute("aria-hidden", active ? "false" : "true");
    if (document.body) document.body.classList.toggle("modal-open", Boolean(active));
  };

  const setAvatarPreview = (url) => {
    if (!storeAvatarPreview || !storeAvatarPreviewWrap) return;
    if (url) {
      storeAvatarPreview.src = url;
      storeAvatarPreviewWrap.classList.remove("is-empty");
    } else {
      storeAvatarPreview.removeAttribute("src");
      storeAvatarPreviewWrap.classList.add("is-empty");
    }
  };

  const renderImageList = () => {
    if (!imageList) return;
    if (!selectedImages.length) {
      imageList.innerHTML = `<div class="store-image-empty">Chưa có ảnh</div>`;
    } else {
      imageList.innerHTML = selectedImages
        .map(
          (file, index) => `
          <div class="store-image-item">
            <img src="${URL.createObjectURL(file)}" alt="Shop image" loading="lazy" />
            <div class="seller-create-image-actions">
              <button class="btn ghost" type="button" data-action="remove" data-index="${index}">✕</button>
            </div>
          </div>
        `
        )
        .join("");
    }
    if (imageCount) {
      imageCount.textContent = `${selectedImages.length}/${IMAGE_LIMIT}`;
    }
    if (imageUpload) {
      imageUpload.disabled = selectedImages.length >= IMAGE_LIMIT;
    }
  };

  const addImages = (files) => {
    const fileList = Array.from(files || []);
    if (!fileList.length) return;
    for (const file of fileList) {
      if (!file || !file.type) {
        showToast("Chỉ hỗ trợ ảnh JPG, PNG, WEBP.");
        return;
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        showToast("Chỉ hỗ trợ ảnh JPG, PNG, WEBP.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        showToast("Mỗi ảnh tối đa 2MB.");
        return;
      }
    }
    const remaining = IMAGE_LIMIT - selectedImages.length;
    selectedImages.push(...fileList.slice(0, remaining));
    renderImageList();
  };

  const removeImage = (index) => {
    if (index < 0 || index >= selectedImages.length) return;
    selectedImages.splice(index, 1);
    renderImageList();
  };

  const buildAuthHeaders = () => {
    const headers = {};
    if (window.BKAuth && typeof window.BKAuth.read === "function") {
      const auth = window.BKAuth.read();
      if (auth && auth.loggedIn) {
        const user = auth.user || {};
        const userRef =
          user.id != null && String(user.id).trim()
            ? String(user.id).trim()
            : user.username && String(user.username).trim()
              ? String(user.username).trim()
              : user.email && String(user.email).trim()
                ? String(user.email).trim()
                : "";
        if (userRef) headers["x-user-id"] = userRef;
        if (user.email) headers["x-user-email"] = String(user.email);
        if (user.username) headers["x-user-username"] = String(user.username);
      }
    }
    return headers;
  };

  const goBack = (fallbackView) => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = getPanelUrl(fallbackView);
  };

  const uploadShopImages = async (shopId) => {
    if (!shopId || !selectedImages.length) return;
    const form = new FormData();
    form.append("shopId", shopId);
    selectedImages.forEach((file) => form.append("files", file, file.name));
    const response = await fetch("/api/store/images", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: form,
      credentials: "same-origin",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = data && data.error ? data.error : "UPLOAD_FAILED";
      throw new Error(error);
    }
  };

  const resetForm = () => {
    if (editing && originalStore) {
      applyStore(originalStore);
      return;
    }
    if (storeNameInput) storeNameInput.value = "";
    if (storeShortDesc) storeShortDesc.value = "";
    if (storeLongDesc) storeLongDesc.value = "";
    if (storeAvatar) storeAvatar.value = "";
    setAvatarPreview("");
    selectedImages.splice(0, selectedImages.length);
    renderImageList();
    if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
      window.BKStoreEditor.open(null);
      if (typeof window.BKStoreEditor.setDisabled === "function") {
        window.BKStoreEditor.setDisabled(false);
      }
    }
  };

  const getStoreIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return id ? String(id).trim() : "";
  };

  const applyStore = (store) => {
    if (!store) return;
    if (storeNameInput) storeNameInput.value = store.name || "";
    if (storeShortDesc) storeShortDesc.value = store.shortDesc || "";
    if (storeLongDesc) storeLongDesc.value = store.longDesc || "";
    setAvatarPreview(store.avatarUrl || "");
    if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
      window.BKStoreEditor.open(store);
      if (typeof window.BKStoreEditor.setDisabled === "function") {
        window.BKStoreEditor.setDisabled(false);
      }
    }
  };

  const setEditMode = (store) => {
    editing = true;
    currentStoreId = store ? store.storeId || store.id || "" : "";
    originalStore = store;
    if (pageTitle) pageTitle.textContent = "Chỉnh sửa gian hàng";
    if (pageSub) pageSub.textContent = "Cập nhật thông tin và gửi yêu cầu xét duyệt lại.";
    if (editorTitle) editorTitle.textContent = "Chỉnh sửa gian hàng";
    if (editorSub) editorSub.textContent = "Cập nhật thông tin gian hàng, ảnh đại diện và mô tả hiển thị.";
    if (storeSaveBtn) storeSaveBtn.textContent = "Cập nhật";
    if (createImageManager) createImageManager.classList.add("is-hidden");
    if (editImageManager) editImageManager.classList.remove("is-hidden");
    if (editImageManager) {
      try {
        document.dispatchEvent(new CustomEvent("store-images:open", { detail: { shopId: currentStoreId, isAdmin: false } }));
      } catch (error) {}
    }
    applyStore(store);
  };

  const initGuard = () => {
    const auth = window.BKAuth ? window.BKAuth.read() : { loggedIn: false };
    if (!auth.loggedIn) {
      if (guard) guard.style.display = "block";
      if (guardText) guardText.textContent = guard ? guard.dataset.guardLogin || "" : "";
      if (panel) panel.style.display = "none";
      return;
    }
    if (!window.BKAuth || !window.BKAuth.isSellerApproved(auth)) {
      if (guard) guard.style.display = "block";
      if (guardText) guardText.textContent = guard ? guard.dataset.guardPending || "" : "";
      if (panel) panel.style.display = "none";
      return;
    }
    if (guard) guard.style.display = "none";
    if (panel) panel.style.display = "grid";
  };

  const loadEditStore = async () => {
    const storeId = getStoreIdFromUrl();
    if (!storeId) {
      if (createImageManager) createImageManager.classList.remove("is-hidden");
      if (editImageManager) editImageManager.classList.add("is-hidden");
      return;
    }
    const services = window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null;
    if (!services || !services.stores || typeof services.stores.list !== "function") {
      showToast("Không thể tải gian hàng.");
      return;
    }
    try {
      const stores = await services.stores.list();
      const store = (stores || []).find((item) => String(item.storeId) === String(storeId));
      if (!store) {
        showToast("Không tìm thấy gian hàng.");
        return;
      }
      setEditMode(store);
    } catch (error) {
      showToast("Không thể tải gian hàng.");
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    initGuard();
    loadEditStore();

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        goBack("shops");
      });
    }

    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => {
        goBack("shops");
      });
    });

    if (storeAvatar) {
      storeAvatar.addEventListener("change", (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith("image/")) {
          showToast("Chỉ hỗ trợ ảnh.");
          storeAvatar.value = "";
          return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          showToast("Ảnh vượt quá 2MB.");
          storeAvatar.value = "";
          return;
        }
        setAvatarPreview(URL.createObjectURL(file));
      });
    }

    if (imageUpload) {
      imageUpload.addEventListener("change", (event) => {
        addImages(event.target.files);
        imageUpload.value = "";
      });
    }

    if (imageList) {
      imageList.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-action=\"remove\"]");
        if (!btn) return;
        const index = Number(btn.getAttribute("data-index"));
        if (Number.isFinite(index)) removeImage(index);
      });
    }

    if (storeResetBtn) {
      storeResetBtn.addEventListener("click", resetForm);
    }

    if (storeSaveBtn) {
      storeSaveBtn.addEventListener("click", async () => {
        const name = storeNameInput ? storeNameInput.value.trim() : "";
        if (!name) {
          showToast("Vui lòng nhập tên gian hàng.");
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
        const services = window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null;
        if (!services || !services.stores || typeof services.stores.create !== "function") {
          showToast("Không thể xử lý gian hàng.");
          return;
        }
        showLoading(true);
        storeSaveBtn.disabled = true;
        storeSaveBtn.setAttribute("aria-busy", "true");
        try {
          let storeId = currentStoreId;
          if (editing) {
            const updated = await services.stores.requestUpdate(currentStoreId, payload);
            storeId = updated && updated.storeId ? updated.storeId : currentStoreId;
          } else {
            const created = await services.stores.create(payload);
            storeId = created && created.storeId ? created.storeId : "";
          }
          if (!storeId) throw new Error("CREATE_FAILED");

          const avatarFile = storeAvatar && storeAvatar.files ? storeAvatar.files[0] : null;
          if (avatarFile) {
            try {
              await services.stores.uploadAvatar(storeId, avatarFile);
            } catch (error) {
              showToast("Không thể tải ảnh đại diện. Vui lòng thử lại.");
            }
          }
          if (!editing && selectedImages.length) {
            try {
              await uploadShopImages(storeId);
            } catch (error) {
              const code = error && error.message ? error.message : "";
              if (code === "IMAGE_LIMIT") {
                showToast("Chỉ được tối đa 5 ảnh.");
              } else if (code === "FILE_TOO_LARGE") {
                showToast("Mỗi ảnh tối đa 2MB.");
              } else if (code === "INVALID_FILE_TYPE") {
                showToast("Chỉ hỗ trợ ảnh JPG, PNG, WEBP.");
              } else {
                showToast("Không thể tải ảnh gian hàng.");
              }
            }
          }
          showToast(editing ? "Đã gửi yêu cầu cập nhật gian hàng." : "Đã gửi yêu cầu tạo gian hàng.");
          window.location.href = getPanelUrl("shops");
        } catch (error) {
          showToast(editing ? "Không thể cập nhật gian hàng." : "Không thể tạo gian hàng. Vui lòng thử lại.");
        } finally {
          showLoading(false);
          storeSaveBtn.disabled = false;
          storeSaveBtn.removeAttribute("aria-busy");
        }
      });
    }

    renderImageList();
    if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
      window.BKStoreEditor.open(null);
    }
  });
})();
