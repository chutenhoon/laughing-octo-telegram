(function () {
  "use strict";

  const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const IMAGE_LIMIT = 5;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const guard = document.getElementById("seller-create-guard");
  const guardText = document.getElementById("seller-create-guard-text");
  const panel = document.getElementById("seller-create-panel");
  const backBtn = document.getElementById("seller-create-back");

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

  const loadingModal = document.getElementById("seller-create-loading");

  const selectedImages = [];

  const getRootPath = () => (window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/");
  const getPanelUrl = () => `${getRootPath()}seller/panel/${window.location.protocol === "file:" ? "index.html" : ""}`;

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
        if (user.id != null) headers["x-user-id"] = String(user.id);
        if (user.email) headers["x-user-email"] = String(user.email);
        if (user.username) headers["x-user-username"] = String(user.username);
      }
    }
    return headers;
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
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.ok === false) {
      const error = data && data.error ? data.error : "UPLOAD_FAILED";
      throw new Error(error);
    }
  };

  const resetForm = () => {
    if (storeNameInput) storeNameInput.value = "";
    if (storeShortDesc) storeShortDesc.value = "";
    if (storeLongDesc) storeLongDesc.value = "";
    if (storeAvatar) storeAvatar.value = "";
    setAvatarPreview("");
    selectedImages.splice(0, selectedImages.length);
    renderImageList();
    if (window.BKStoreEditor && typeof window.BKStoreEditor.open === "function") {
      window.BKStoreEditor.open(null);
    }
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

  document.addEventListener("DOMContentLoaded", () => {
    initGuard();

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = getPanelUrl();
      });
    }

    document.querySelectorAll("[data-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const link = btn.getAttribute("data-link");
        if (!link) return;
        const root = getRootPath();
        const target = link.startsWith("http") ? link : `${root}${link}`.replace(/\/\.\//g, "/");
        window.location.href = target;
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
          showToast("Không thể tạo gian hàng.");
          return;
        }
        showLoading(true);
        storeSaveBtn.disabled = true;
        storeSaveBtn.setAttribute("aria-busy", "true");
        try {
          const created = await services.stores.create(payload);
          const storeId = created && created.storeId ? created.storeId : "";
          if (!storeId) throw new Error("CREATE_FAILED");
          const avatarFile = storeAvatar && storeAvatar.files ? storeAvatar.files[0] : null;
          if (avatarFile) {
            try {
              await services.stores.uploadAvatar(storeId, avatarFile);
            } catch (error) {
              showToast("Không thể tải ảnh đại diện. Vui lòng thử lại.");
            }
          }
          if (selectedImages.length) {
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
          showToast("Đã gửi yêu cầu tạo gian hàng.");
          window.location.href = getPanelUrl();
        } catch (error) {
          showToast("Không thể tạo gian hàng. Vui lòng thử lại.");
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
