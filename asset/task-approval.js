(function () {
  "use strict";

  const statusCard = document.getElementById("task-approval-status");
  const loading = document.getElementById("task-approval-loading");
  const submitBtn = document.querySelector("[data-requires-login]");

  const fullNameInput = document.getElementById("task-fullname");
  const phoneInput = document.getElementById("task-phone");
  const contactInput = document.getElementById("task-contact");
  const budgetInput = document.getElementById("task-budget");
  const descInput = document.getElementById("task-desc");

  const showToast = (message) => {
    if (!message) return;
    if (window.BKAuth && typeof window.BKAuth.showToast === "function") {
      window.BKAuth.showToast(message);
      return;
    }
    window.alert(message);
  };

  const buildHeaders = () => {
    const headers = { "content-type": "application/json" };
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

  const setLoading = (active) => {
    if (!loading) return;
    loading.classList.toggle("active", Boolean(active));
    loading.setAttribute("aria-hidden", active ? "false" : "true");
  };

  const setFormDisabled = (disabled) => {
    document.querySelectorAll("#task-fullname, #task-phone, #task-contact, #task-budget, #task-desc").forEach((el) => {
      el.disabled = disabled;
    });
    if (submitBtn) submitBtn.disabled = disabled;
  };

  const renderSkeleton = () => {
    if (!statusCard) return;
    statusCard.classList.remove("is-hidden");
    statusCard.innerHTML = `
      <div class="approval-status-head">
        <span class="approval-status-title">Đang kiểm tra</span>
        <span class="approval-status-badge warn">...</span>
      </div>
      <div class="approval-status-body">
        <div class="approval-status-skeleton"></div>
        <div class="approval-status-skeleton" style="width:70%; margin-top:6px;"></div>
      </div>
    `;
  };

  const renderStatus = (status, note) => {
    if (!statusCard) return;
    const map = {
      pending: { label: "Đang duyệt", className: "warn" },
      approved: { label: "Đã duyệt", className: "good" },
      rejected: { label: "Từ chối", className: "bad" },
    };
    const meta = map[status] || { label: status || "--", className: "warn" };
    const reason = note ? `<div style="margin-top:6px;">Lý do: ${note}</div>` : "";
    statusCard.classList.remove("is-hidden");
    statusCard.innerHTML = `
      <div class="approval-status-head">
        <span class="approval-status-title">Trạng thái yêu cầu</span>
        <span class="approval-status-badge ${meta.className}">${meta.label}</span>
      </div>
      <div class="approval-status-body">
        ${status === "pending" ? "Yêu cầu của bạn đang được xét duyệt." : "Yêu cầu đã được xử lý."}
        ${reason}
      </div>
    `;
  };

  const redirectToPanel = () => {
    if (!window.BKAuth) return;
    const url = typeof window.BKAuth.getTaskPanelUrl === "function" ? window.BKAuth.getTaskPanelUrl() : "/seller/tasks/";
    window.location.href = url;
  };

  const syncApprovedUser = () => {
    if (!window.BKAuth || typeof window.BKAuth.read !== "function" || typeof window.BKAuth.set !== "function") return;
    const auth = window.BKAuth.read();
    if (!auth || !auth.loggedIn || !auth.user) return;
    const next = {
      ...auth.user,
      taskApproved: true,
      canPostTasks: true,
    };
    window.BKAuth.set(next);
  };

  const loadStatus = async () => {
    const auth = window.BKAuth ? window.BKAuth.read() : { loggedIn: false };
    if (!auth.loggedIn) return;
    if (window.BKAuth && window.BKAuth.isTaskApproved(auth)) {
      redirectToPanel();
      return;
    }
    renderSkeleton();
    try {
      const response = await fetch("/api/approvals?type=task", { headers: buildHeaders(), cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
      const items = Array.isArray(data.items) ? data.items : [];
      const latest = items[0];
      if (!latest) {
        if (statusCard) statusCard.classList.add("is-hidden");
        setFormDisabled(false);
        return;
      }
      const status = String(latest.status || "").toLowerCase();
      if (status === "approved") {
        syncApprovedUser();
        redirectToPanel();
        return;
      }
      renderStatus(status, latest.reason || "");
      setFormDisabled(status === "pending");
    } catch (error) {
      if (statusCard) statusCard.classList.add("is-hidden");
      setFormDisabled(false);
    }
  };

  const handleSubmit = async () => {
    const contact = contactInput ? contactInput.value.trim() : "";
    const budgetRaw = budgetInput ? budgetInput.value.trim() : "";
    const budget = Number(budgetRaw);
    if (!contact) {
      showToast("Vui lòng nhập thông tin liên hệ.");
      return;
    }
    if (!budgetRaw || !Number.isFinite(budget) || budget <= 0) {
      showToast("Vui lòng nhập ngân sách hợp lệ.");
      return;
    }
    const payload = {
      fullName: fullNameInput ? fullNameInput.value.trim() : "",
      phone: phoneInput ? phoneInput.value.trim() : "",
      contact,
      budget,
      desc: descInput ? descInput.value.trim() : "",
    };

    setLoading(true);
    if (submitBtn) submitBtn.disabled = true;
    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ type: "task", payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok === false) {
        const error = data && data.error ? data.error : "REQUEST_FAILED";
        if (error === "ALREADY_APPROVED") {
          syncApprovedUser();
          redirectToPanel();
          return;
        }
        if (error === "CONTACT_REQUIRED") {
          showToast("Vui lòng nhập thông tin liên hệ.");
          return;
        }
        if (error === "BUDGET_REQUIRED") {
          showToast("Vui lòng nhập ngân sách.");
          return;
        }
        showToast("Không thể gửi yêu cầu. Vui lòng thử lại.");
        return;
      }
      renderStatus("pending", "");
      setFormDisabled(true);
      showToast("Đã gửi yêu cầu xét duyệt.");
    } catch (error) {
      showToast("Không thể gửi yêu cầu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadStatus();
    if (submitBtn) {
      submitBtn.addEventListener("click", (event) => {
        event.preventDefault();
        handleSubmit();
      });
    }
  });
})();
