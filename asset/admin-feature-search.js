(function () {
  "use strict";

  const openBtn = document.getElementById("admin-feature-open");
  const modal = document.getElementById("admin-feature-modal");
  const closeBtn = document.getElementById("admin-feature-close");
  const input = document.getElementById("admin-feature-query");
  const results = document.getElementById("admin-feature-results");
  const empty = document.getElementById("admin-feature-empty");
  const loading = document.getElementById("admin-feature-loading");
  const navButtons = Array.from(document.querySelectorAll("#admin-nav button[data-view]"));

  if (!openBtn || !modal || !input || !results) return;

  const features = navButtons.map((btn) => {
    const view = btn.getAttribute("data-view") || "";
    const title = btn.getAttribute("data-title") || btn.textContent || view;
    const sub = btn.getAttribute("data-sub") || "";
    return { view, title: title.trim(), sub: sub.trim() };
  });

  const normalize = (value) => String(value || "").trim().toLowerCase();

  const setLoading = (active) => {
    if (!loading) return;
    loading.classList.toggle("active", Boolean(active));
    loading.setAttribute("aria-hidden", active ? "false" : "true");
  };

  const openModal = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    if (document.body) document.body.classList.add("modal-open");
    input.value = "";
    renderResults("");
    input.focus();
  };

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (document.body && !document.querySelector(".modal-backdrop.open")) {
      document.body.classList.remove("modal-open");
    }
  };

  const renderResults = (query) => {
    const term = normalize(query);
    const list = features.filter((item) => {
      if (!term) return true;
      return normalize(item.title).includes(term) || normalize(item.sub).includes(term) || normalize(item.view).includes(term);
    });
    if (!list.length) {
      results.innerHTML = "";
      if (empty) empty.classList.remove("is-hidden");
      return;
    }
    if (empty) empty.classList.add("is-hidden");
    results.innerHTML = list
      .map(
        (item) => `
        <button class="admin-feature-item" type="button" data-view="${item.view}">
          <span class="admin-feature-title">${item.title}</span>
          <span class="admin-feature-sub">${item.sub || "Tuyến điều hướng nội bộ"}</span>
        </button>
      `
      )
      .join("");
  };

  const navigateTo = (view) => {
    if (!view) return;
    const target = document.querySelector(`#admin-nav button[data-view="${view}"]`);
    if (!target) return;
    setLoading(true);
    target.click();
    window.setTimeout(() => {
      setLoading(false);
    }, 360);
  };

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  input.addEventListener("input", () => {
    renderResults(input.value);
  });

  results.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-view]");
    if (!btn) return;
    const view = btn.getAttribute("data-view");
    closeModal();
    navigateTo(view);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });

  renderResults("");
})();
