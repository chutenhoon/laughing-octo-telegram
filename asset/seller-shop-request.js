(function () {
  "use strict";

  const DEFAULT_MESSAGE = "R\u00fat y\u00eau c\u1ea7u t\u1ea1o/c\u1eadp nh\u1eadt gian h\u00e0ng?";
  const DEFAULT_CONFIRM = "R\u00fat y\u00eau c\u1ea7u";

  const getServices = () => (window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null);
  const getModal = () => (window.BKSellerModal && typeof window.BKSellerModal.open === "function" ? window.BKSellerModal : null);
  const getToast = () =>
    window.BKSellerToast && typeof window.BKSellerToast.show === "function" ? window.BKSellerToast : null;

  const showToast = (message) => {
    const toast = getToast();
    if (toast) {
      toast.show(message);
      return;
    }
    if (message) window.alert(message);
  };

  const withdrawStore = async (storeId) => {
    const services = getServices();
    if (!services || !services.stores || typeof services.stores.withdraw !== "function") return;
    try {
      await services.stores.withdraw(storeId);
      showToast("\u0110\u00e3 r\u00fat y\u00eau c\u1ea7u.");
    } catch (error) {
      showToast("Kh\u00f4ng th\u1ec3 r\u00fat y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i.");
    }
  };

  const confirmWithdraw = (storeId) => {
    const modal = getModal();
    if (!modal) {
      const confirmed = window.confirm(DEFAULT_MESSAGE);
      if (confirmed) withdrawStore(storeId);
      return;
    }
    modal.open({
      title: DEFAULT_CONFIRM,
      message: DEFAULT_MESSAGE,
      confirmText: DEFAULT_CONFIRM,
      onConfirm: () => withdrawStore(storeId),
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("seller-shop-grid");
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-action=\"withdraw-store\"]");
      if (!btn) return;
      const storeId = btn.getAttribute("data-store-id");
      if (!storeId) return;
      confirmWithdraw(storeId);
    });
  });
})();
