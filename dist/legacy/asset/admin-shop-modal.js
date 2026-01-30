(function () {
  "use strict";

  const ADMIN_CRED_KEY = "bk_admin_creds";

  const previewModal = document.getElementById("admin-store-preview-modal");
  const previewClose = document.getElementById("admin-store-preview-close");
  const rejectModal = document.getElementById("admin-store-reject-modal");
  const rejectCancel = document.getElementById("admin-store-reject-cancel");
  const rejectConfirm = document.getElementById("admin-store-reject-confirm");
  const rejectInput = document.getElementById("admin-store-reject-input");

  const galleryRoot = document.getElementById("admin-store-gallery");
  const galleryTrack = document.getElementById("admin-store-gallery-track");
  const galleryPrev = document.getElementById("admin-store-gallery-prev");
  const galleryNext = document.getElementById("admin-store-gallery-next");

  const galleryCache = new Map();
  let rejectHandler = null;

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

  const buildHeaders = () => {
    const headers = { ...getUserHeaders() };
    const admin = getAdminHeaders();
    if (admin) Object.assign(headers, admin);
    return headers;
  };

  const openModal = (modal) => {
    if (!modal) return;
    modal.classList.add("open");
    if (document.body) document.body.classList.add("modal-open");
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove("open");
    if (document.body && !document.querySelector(".modal-backdrop.open")) {
      document.body.classList.remove("modal-open");
    }
  };

  const closeOnBackdrop = (modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  };

  const renderGallery = (items) => {
    if (!galleryRoot || !galleryTrack) return;
    const list = Array.isArray(items) ? items.filter((item) => item && item.url) : [];
    if (!list.length) {
      galleryTrack.innerHTML = "";
      galleryRoot.classList.add("is-hidden");
      return;
    }
    galleryRoot.classList.remove("is-hidden");
    galleryTrack.innerHTML = list
      .map(
        (item) => `
        <div class="admin-store-gallery-item">
          <img src="${item.url}" alt="Shop image" loading="lazy" />
        </div>
      `
      )
      .join("");
  };

  const loadGallery = async (shopId) => {
    if (!shopId) {
      renderGallery([]);
      return;
    }
    if (galleryCache.has(shopId)) {
      renderGallery(galleryCache.get(shopId));
      return;
    }
    try {
      const response = await fetch(`/api/store/images?shopId=${encodeURIComponent(shopId)}`, {
        headers: buildHeaders(),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
      const items = Array.isArray(data.items) ? data.items : [];
      galleryCache.set(shopId, items);
      renderGallery(items);
    } catch (error) {
      renderGallery([]);
    }
  };

  const scrollGallery = (dir) => {
    if (!galleryTrack) return;
    const width = galleryTrack.clientWidth || 0;
    galleryTrack.scrollBy({ left: dir * Math.max(width * 0.7, 200), behavior: "smooth" });
  };

  if (galleryPrev) galleryPrev.addEventListener("click", () => scrollGallery(-1));
  if (galleryNext) galleryNext.addEventListener("click", () => scrollGallery(1));

  if (previewClose) previewClose.addEventListener("click", () => closeModal(previewModal));
  if (rejectCancel) rejectCancel.addEventListener("click", () => closeModal(rejectModal));

  if (rejectConfirm) {
    rejectConfirm.addEventListener("click", () => {
      const reason = rejectInput ? rejectInput.value.trim() : "";
      if (rejectHandler) rejectHandler(reason);
      rejectHandler = null;
      closeModal(rejectModal);
    });
  }

  closeOnBackdrop(previewModal);
  closeOnBackdrop(rejectModal);

  window.BKAdminShopModal = {
    openPreview: (shopId) => {
      openModal(previewModal);
      loadGallery(shopId);
    },
    closePreview: () => closeModal(previewModal),
    openReject: ({ defaultReason, onConfirm } = {}) => {
      if (rejectInput) rejectInput.value = defaultReason || "";
      rejectHandler = typeof onConfirm === "function" ? onConfirm : null;
      openModal(rejectModal);
    },
    closeReject: () => closeModal(rejectModal),
    loadGallery,
  };
})();
