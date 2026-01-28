(function () {
  "use strict";

  const gallery = document.getElementById("store-gallery");
  const track = document.getElementById("store-gallery-track");
  const prev = document.getElementById("store-gallery-prev");
  const next = document.getElementById("store-gallery-next");

  if (!gallery || !track) return;

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const render = (shop) => {
    const images = (shop && Array.isArray(shop.images) ? shop.images : []).filter((item) => item && item.url);
    if (!images.length) {
      gallery.classList.add("is-hidden");
      return;
    }
    gallery.classList.remove("is-hidden");
    track.innerHTML = images
      .slice(0, 5)
      .map(
        (item) => `
        <div class="store-gallery-item">
          <img src="${escapeHtml(item.url)}" alt="Shop image" loading="lazy" />
        </div>`
      )
      .join("");
  };

  const scrollByPage = (dir) => {
    if (!track) return;
    const width = track.clientWidth || 0;
    track.scrollBy({ left: dir * Math.max(width * 0.8, 240), behavior: "smooth" });
  };

  if (prev) prev.addEventListener("click", () => scrollByPage(-1));
  if (next) next.addEventListener("click", () => scrollByPage(1));

  if (window.BKStoreShop) render(window.BKStoreShop);
  document.addEventListener("store:loaded", (event) => render(event.detail));
})();
