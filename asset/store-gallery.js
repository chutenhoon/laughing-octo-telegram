(function () {
  "use strict";

  const gallery = document.getElementById("store-gallery");
  const track = document.getElementById("store-gallery-track");
  const prev = document.getElementById("store-gallery-prev");
  const next = document.getElementById("store-gallery-next");
  const dots = document.getElementById("store-gallery-dots");

  if (!gallery || !track) return;

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const state = {
    items: [],
    index: 0,
  };

  const buildImages = (shop) => {
    const list = [];
    if (shop && shop.avatarUrl) {
      list.push({ url: shop.avatarUrl, kind: "cover" });
    }
    const extra = shop && Array.isArray(shop.images) ? shop.images : [];
    extra.forEach((item) => {
      if (item && item.url) list.push({ url: item.url, kind: "image" });
    });
    const unique = [];
    const seen = new Set();
    list.forEach((item) => {
      const url = String(item.url || "").trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      unique.push(item);
    });
    return unique.slice(0, 6);
  };

  const updateDots = () => {
    if (!dots) return;
    dots.querySelectorAll("button").forEach((btn, idx) => {
      btn.classList.toggle("active", idx === state.index);
      btn.setAttribute("aria-current", idx === state.index ? "true" : "false");
    });
  };

  const scrollToIndex = (index, smooth = true) => {
    const width = track.clientWidth || 0;
    if (!width) return;
    const safeIndex = Math.max(0, Math.min(index, state.items.length - 1));
    state.index = safeIndex;
    track.scrollTo({ left: width * safeIndex, behavior: smooth ? "smooth" : "auto" });
    updateDots();
  };

  const render = (shop) => {
    const images = buildImages(shop);
    if (!images.length) {
      gallery.classList.add("is-hidden");
      if (dots) dots.innerHTML = "";
      track.innerHTML = "";
      return;
    }
    gallery.classList.remove("is-hidden");
    state.items = images;
    state.index = 0;
    track.innerHTML = images
      .map(
        (item) => `
        <div class="store-gallery-item">
          <img src="${escapeHtml(item.url)}" alt="Shop image" loading="lazy" />
        </div>`
      )
      .join("");
    if (dots) {
      dots.innerHTML = images
        .map(
          (_, idx) =>
            `<button class="store-gallery-dot${idx === 0 ? " active" : ""}" type="button" data-index="${idx}" aria-label="Slide ${
              idx + 1
            }"></button>`
        )
        .join("");
    }
    requestAnimationFrame(() => scrollToIndex(0, false));
  };

  const stepIndex = (dir) => {
    if (!state.items.length) return;
    const nextIndex = state.index + dir;
    const target = nextIndex < 0 ? state.items.length - 1 : nextIndex >= state.items.length ? 0 : nextIndex;
    scrollToIndex(target, true);
  };

  if (prev) prev.addEventListener("click", () => stepIndex(-1));
  if (next) next.addEventListener("click", () => stepIndex(1));

  if (dots) {
    dots.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-index]");
      if (!btn) return;
      const idx = Number(btn.getAttribute("data-index"));
      if (!Number.isFinite(idx)) return;
      scrollToIndex(idx, true);
    });
  }

  let scrollRaf = null;
  track.addEventListener("scroll", () => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const width = track.clientWidth || 0;
      if (!width) return;
      const idx = Math.round(track.scrollLeft / width);
      if (idx !== state.index) {
        state.index = idx;
        updateDots();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (!state.items.length) return;
    scrollToIndex(state.index, false);
  });

  if (window.BKStoreShop) render(window.BKStoreShop);
  document.addEventListener("store:loaded", (event) => render(event.detail));
})();
