(function () {
  "use strict";

  const modal = document.getElementById("seller-delete-modal");
  const passwordInput = document.getElementById("seller-delete-password");
  const cancelBtn = document.getElementById("seller-delete-cancel");
  const confirmBtn = document.getElementById("seller-delete-confirm");

  if (!modal || !passwordInput || !confirmBtn) return;

  let activeStoreId = "";

  const getServices = () => (window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null);
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

  const openModal = (storeId) => {
    activeStoreId = storeId;
    if (passwordInput) passwordInput.value = "";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (document.body) document.body.classList.add("modal-open");
    if (passwordInput) passwordInput.focus();
  };

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    activeStoreId = "";
    if (document.body) document.body.classList.remove("modal-open");
  };

  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  confirmBtn.addEventListener("click", async () => {
    const password = passwordInput.value.trim();
    if (!password) {
      showToast("Vui lòng nhập mật khẩu.");
      passwordInput.focus();
      return;
    }
    if (!activeStoreId) return;
    const services = getServices();
    if (!services || !services.stores || typeof services.stores.delete !== "function") {
      showToast("Không thể xóa gian hàng.");
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.setAttribute("aria-busy", "true");
    try {
      const result = await services.stores.delete(activeStoreId, password);
      closeModal();
      if (result && result.cleanupFailed) {
        showToast("Đã xóa gian hàng. Ảnh sẽ được dọn dẹp sau.");
      } else {
        showToast("Đã xóa gian hàng.");
      }
    } catch (error) {
      const code = error && error.message ? error.message : "";
      if (code === "INVALID_PASSWORD") {
        showToast("Mật khẩu không đúng.");
      } else if (code === "FORBIDDEN") {
        showToast("Bạn không có quyền xóa gian hàng này.");
      } else {
        showToast("Không thể xóa gian hàng.");
      }
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.removeAttribute("aria-busy");
    }
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action=\"delete-store\"]");
    if (!btn) return;
    const storeId = btn.getAttribute("data-store-id");
    if (!storeId) return;
    openModal(storeId);
  });
})();
