(function () {
  "use strict";

  const guard = document.getElementById("seller-product-create-guard");
  const guardText = document.getElementById("seller-product-create-guard-text");
  const panel = document.getElementById("seller-product-create-panel");
  const backBtn = document.getElementById("product-create-back");

  const pageTitle = document.getElementById("product-create-title");
  const pageSub = document.getElementById("product-create-sub");
  const editorTitle = document.getElementById("product-editor-title");
  const editorSub = document.getElementById("product-editor-sub");

  const storeSelect = document.getElementById("product-store");
  const limitNote = document.getElementById("product-limit-note");
  const nameInput = document.getElementById("product-name");
  const priceInput = document.getElementById("product-price");
  const priceMaxInput = document.getElementById("product-price-max");
  const categorySelect = document.getElementById("product-category");
  const tagsWrap = document.getElementById("product-tags");
  const tagsHint = document.getElementById("product-tags-hint");
  const shortDescInput = document.getElementById("product-short-desc");
  const longDescInput = document.getElementById("product-long-desc");
  const activeCheckbox = document.getElementById("product-active");
  const publishedCheckbox = document.getElementById("product-published");
  const saveBtn = document.getElementById("product-save-btn");
  const resetBtn = document.getElementById("product-reset-btn");

  const loadingModal = document.getElementById("product-create-loading");

  const MAX_PRODUCTS_PER_SHOP = 6;

  const state = {
    categories: null,
    tags: new Set(),
    stores: [],
    products: [],
    editing: false,
    productId: "",
    originalProduct: null,
  };

  const getRootPath = () =>
    window.location.protocol === "file:" && typeof getProjectRoot === "function" ? getProjectRoot() : "/";

  const getPanelUrl = () => `${getRootPath()}seller/panel/${window.location.protocol === "file:" ? "index.html" : ""}`;

  const getProductIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return id ? String(id).trim() : "";
  };

  const getShopIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("shopId");
    return id ? String(id).trim() : "";
  };

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

  const showLoading = (active) => {
    if (!loadingModal) return;
    loadingModal.classList.toggle("open", Boolean(active));
    loadingModal.setAttribute("aria-hidden", active ? "false" : "true");
    if (document.body) document.body.classList.toggle("modal-open", Boolean(active));
  };

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const htmlToText = (value) => {
    if (!value) return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(value || "");
    return wrapper.textContent || wrapper.innerText || "";
  };

  const initGuard = () => {
    const auth = window.BKAuth ? window.BKAuth.read() : { loggedIn: false };
    if (!auth.loggedIn) {
      if (guard) guard.style.display = "block";
      if (guardText) guardText.textContent = guard ? guard.dataset.guardLogin || "" : "";
      if (panel) panel.style.display = "none";
      return false;
    }
    if (!window.BKAuth || !window.BKAuth.isSellerApproved(auth)) {
      if (guard) guard.style.display = "block";
      if (guardText) guardText.textContent = guard ? guard.dataset.guardPending || "" : "";
      if (panel) panel.style.display = "none";
      return false;
    }
    if (guard) guard.style.display = "none";
    if (panel) panel.style.display = "grid";
    return true;
  };

  const loadCategories = async () => {
    if (state.categories) return state.categories;
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
      state.categories = data.categories || { products: [] };
    } catch (error) {
      state.categories = { products: [] };
    }
    return state.categories;
  };

  const renderCategoryOptions = (categories) => {
    if (!categorySelect) return;
    categorySelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Chọn danh mục";
    categorySelect.appendChild(placeholder);
    (categories.products || []).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.labelKey && typeof formatI18n === "function"
        ? formatI18n(typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi", item.labelKey, item.label || item.id)
        : item.label || item.id;
      categorySelect.appendChild(option);
    });
  };

  const renderTags = (categoryId, categories, selected = []) => {
    if (!tagsWrap) return;
    tagsWrap.innerHTML = "";
    tagsWrap.classList.remove("empty");
    state.tags = new Set();
    const category = (categories.products || []).find((item) => String(item.id) === String(categoryId));
    const options = category && Array.isArray(category.subcategories) ? category.subcategories : [];

    if (!categoryId) {
      tagsWrap.classList.add("empty");
      tagsWrap.innerHTML = `<span>${escapeHtml("Chọn danh mục trước")}</span>`;
      if (tagsHint) tagsHint.textContent = "Chọn danh mục để hiển thị thẻ";
      return;
    }

    if (!options.length) {
      tagsWrap.classList.add("empty");
      tagsWrap.innerHTML = `<span>${escapeHtml("Không có thẻ phù hợp")}</span>`;
      if (tagsHint) tagsHint.textContent = "Có thể bỏ qua bước này";
      return;
    }

    if (tagsHint) tagsHint.textContent = "Chọn thẻ phù hợp với sản phẩm";
    options.forEach((tag) => {
      const label = tag.labelKey && typeof formatI18n === "function"
        ? formatI18n(typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi", tag.labelKey, tag.label || tag.id)
        : tag.label || tag.id;
      const wrapper = document.createElement("label");
      wrapper.className = "store-tag-item";
      wrapper.innerHTML = `
        <input type="checkbox" value="${escapeHtml(tag.id)}" />
        <span>${escapeHtml(label)}</span>
      `;
      tagsWrap.appendChild(wrapper);
    });

    selected.forEach((tag) => state.tags.add(String(tag)));
    tagsWrap.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = state.tags.has(input.value);
    });
  };

  const updateLimitNote = () => {
    if (!storeSelect || !limitNote) return;
    const storeId = storeSelect.value;
    const count = state.products.filter((product) => product.storeId === storeId).length;
    limitNote.textContent = `${count}/${MAX_PRODUCTS_PER_SHOP} sản phẩm đã tạo cho gian hàng này.`;
    if (!state.editing && saveBtn) {
      saveBtn.disabled = count >= MAX_PRODUCTS_PER_SHOP;
      if (count >= MAX_PRODUCTS_PER_SHOP) {
        limitNote.textContent = `Gian hàng đã đủ ${MAX_PRODUCTS_PER_SHOP} sản phẩm.`;
      }
    }
  };

  const setPageTitles = (editing) => {
    if (pageTitle) pageTitle.textContent = editing ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm";
    if (pageSub) {
      pageSub.textContent = editing
        ? "Cập nhật thông tin sản phẩm và lưu thay đổi."
        : "Cập nhật thông tin, giá bán và danh mục hiển thị.";
    }
    if (editorTitle) editorTitle.textContent = editing ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm";
    if (editorSub) editorSub.textContent = editing ? "Cập nhật thông tin sản phẩm." : "Chọn gian hàng, nhập mô tả và giá bán.";
    if (saveBtn) saveBtn.textContent = editing ? "Cập nhật" : "Lưu sản phẩm";
  };

  const applyProduct = async (product) => {
    if (!product) return;
    state.editing = true;
    state.productId = product.productId;
    state.originalProduct = product;
    setPageTitles(true);

    if (nameInput) nameInput.value = product.name || "";
    if (priceInput) priceInput.value = product.price != null ? product.price : "";
    if (priceMaxInput) priceMaxInput.value = product.priceMax != null ? product.priceMax : "";
    if (shortDescInput) shortDescInput.value = product.descriptionShort || "";
    if (longDescInput) longDescInput.value = htmlToText(product.descriptionHtml || "");
    if (activeCheckbox) activeCheckbox.checked = product.active !== false;
    if (publishedCheckbox) publishedCheckbox.checked = product.published !== false;

    if (storeSelect) {
      storeSelect.value = product.storeId || storeSelect.value;
      storeSelect.disabled = true;
    }

    const categories = await loadCategories();
    renderCategoryOptions(categories);
    if (categorySelect) categorySelect.value = product.category || "";
    renderTags(product.category || "", categories, product.tags || []);
    updateLimitNote();
  };

  const resetForm = async () => {
    if (state.editing && state.originalProduct) {
      applyProduct(state.originalProduct);
      return;
    }
    if (nameInput) nameInput.value = "";
    if (priceInput) priceInput.value = "";
    if (priceMaxInput) priceMaxInput.value = "";
    if (shortDescInput) shortDescInput.value = "";
    if (longDescInput) longDescInput.value = "";
    if (activeCheckbox) activeCheckbox.checked = true;
    if (publishedCheckbox) publishedCheckbox.checked = true;
    const categories = await loadCategories();
    renderCategoryOptions(categories);
    if (categorySelect) categorySelect.value = "";
    renderTags("", categories, []);
    updateLimitNote();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    if (!initGuard()) return;
    setPageTitles(false);

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

    const services = window.BKPanelData && window.BKPanelData.services ? window.BKPanelData.services : null;
    if (!services || !services.products || !services.stores) {
      showToast("Không thể tải dữ liệu.");
      return;
    }

    const [categories, stores, products] = await Promise.all([
      loadCategories(),
      services.stores.list().catch(() => []),
      services.products.list().catch(() => []),
    ]);

    state.stores = stores || [];
    state.products = products || [];

    renderCategoryOptions(categories);
    renderTags("", categories, []);

    if (storeSelect) {
      const placeholder = `<option value="">Chọn gian hàng</option>`;
      const options = state.stores
        .map((store) => `<option value="${store.storeId}">${escapeHtml(store.name || "")}</option>`)
        .join("");
      storeSelect.innerHTML = `${placeholder}${options}`;
      storeSelect.disabled = state.stores.length === 0;
    }
    if (saveBtn && state.stores.length === 0) {
      saveBtn.disabled = true;
      showToast("Bạn cần tạo gian hàng trước khi tạo sản phẩm.");
    }

    const shopIdFromUrl = getShopIdFromUrl();
    if (shopIdFromUrl && storeSelect) {
      storeSelect.value = shopIdFromUrl;
    }

    const productId = getProductIdFromUrl();
    if (productId) {
      const product = state.products.find((item) => item.productId === productId);
      if (product) {
        await applyProduct(product);
      } else {
        showToast("Không tìm thấy sản phẩm.");
      }
    } else {
      updateLimitNote();
    }

    if (storeSelect) {
      storeSelect.addEventListener("change", async () => {
        updateLimitNote();
        if (state.editing) return;
        const store = state.stores.find((item) => item.storeId === storeSelect.value);
        if (store && store.category && categorySelect && !categorySelect.value) {
          categorySelect.value = store.category;
          renderTags(store.category, categories, store.tags || []);
        }
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        renderTags(categorySelect.value, categories, []);
      });
    }

    if (tagsWrap) {
      tagsWrap.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.tagName !== "INPUT") return;
        if (target.checked) state.tags.add(target.value);
        else state.tags.delete(target.value);
      });
    }

    if (resetBtn) resetBtn.addEventListener("click", resetForm);

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const title = nameInput ? nameInput.value.trim() : "";
        if (!title) {
          showToast("Vui lòng nhập tên sản phẩm.");
          return;
        }
        const storeId = storeSelect ? storeSelect.value : "";
        if (!storeId) {
          showToast("Vui lòng chọn gian hàng.");
          return;
        }
        const price = Number(priceInput ? priceInput.value : 0);
        if (!Number.isFinite(price) || price < 0) {
          showToast("Giá không hợp lệ.");
          return;
        }
        const priceMax = priceMaxInput && priceMaxInput.value ? Number(priceMaxInput.value) : null;
        const category = categorySelect ? categorySelect.value : "";
        const payload = {
          shopId: storeId,
          title,
          price,
          priceMax: priceMax != null && Number.isFinite(priceMax) ? priceMax : null,
          category,
          subcategory: state.tags.size ? Array.from(state.tags)[0] : "",
          tags: Array.from(state.tags),
          descriptionShort: shortDescInput ? shortDescInput.value.trim() : "",
          description: longDescInput ? longDescInput.value.trim() : "",
          isActive: activeCheckbox ? activeCheckbox.checked : true,
          isPublished: publishedCheckbox ? publishedCheckbox.checked : true,
        };

        if (state.editing) payload.id = state.productId;

        showLoading(true);
        saveBtn.disabled = true;
        saveBtn.setAttribute("aria-busy", "true");
        try {
          if (state.editing) {
            await services.products.update(state.productId, payload);
            showToast("Đã cập nhật sản phẩm.");
          } else {
            await services.products.create(payload);
            showToast("Đã tạo sản phẩm.");
          }
          window.location.href = getPanelUrl();
        } catch (error) {
          const code = error && error.message ? error.message : "";
          if (code === "PRODUCT_LIMIT") {
            showToast(`Mỗi gian hàng tối đa ${MAX_PRODUCTS_PER_SHOP} sản phẩm.`);
          } else {
            showToast(state.editing ? "Không thể cập nhật sản phẩm." : "Không thể tạo sản phẩm.");
          }
        } finally {
          showLoading(false);
          saveBtn.disabled = false;
          saveBtn.removeAttribute("aria-busy");
        }
      });
    }
  });
})();
