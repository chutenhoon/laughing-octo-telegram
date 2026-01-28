(function () {
  "use strict";

  const typeInput = document.getElementById("store-type");
  const typeOptions = document.getElementById("store-type-options");
  const categorySelect = document.getElementById("store-category");
  const tagsWrap = document.getElementById("store-tags");
  const tagsHint = document.getElementById("store-tags-hint");

  if (!typeInput || !typeOptions || !categorySelect || !tagsWrap) return;

  const state = {
    categories: null,
    type: "",
    category: "",
    tags: new Set(),
    disabled: false,
  };

  const getLanguage = () => (typeof getCurrentLanguage === "function" ? getCurrentLanguage() : "vi");
  const translate = (key, fallback) =>
    typeof formatI18n === "function" ? formatI18n(getLanguage(), key, fallback) : fallback || key;

  const escapeHtml = (value) =>
    String(value || "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[char] || char;
    });

  const loadCategories = async () => {
    if (state.categories) return state.categories;
    try {
      const response = await fetch("/api/categories", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data || data.ok === false) throw new Error("FETCH_FAILED");
      state.categories = data.categories || { products: [], services: [] };
    } catch (error) {
      state.categories = { products: [], services: [] };
    }
    return state.categories;
  };

  const resolveTypeFromCategory = (categoryId, categories) => {
    if (!categoryId || !categories) return "";
    const inProducts = (categories.products || []).some((item) => String(item.id) === String(categoryId));
    if (inProducts) return "product";
    const inServices = (categories.services || []).some((item) => String(item.id) === String(categoryId));
    return inServices ? "service" : "";
  };

  const renderCategoryOptions = (type, categories) => {
    categorySelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = translate("store.category.choose", "Ch\u1ecdn danh m\u1ee5c");
    categorySelect.appendChild(placeholder);

    const list = type === "service" ? categories.services || [] : categories.products || [];
    list.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      const label = item.labelKey ? translate(item.labelKey, item.label || item.id) : item.label || item.id;
      option.textContent = label;
      categorySelect.appendChild(option);
    });
  };

  const renderTags = (categoryInfo) => {
    tagsWrap.innerHTML = "";
    tagsWrap.classList.remove("empty");
    state.tags = new Set();

    const tags = categoryInfo && Array.isArray(categoryInfo.subcategories) ? categoryInfo.subcategories : [];
    if (!tags.length) {
      tagsWrap.classList.add("empty");
      tagsWrap.innerHTML = `<span>${escapeHtml(translate("store.tags.none", "Kh\u00f4ng c\u00f3 th\u1ebb ph\u00f9 h\u1ee3p"))}</span>`;
      if (tagsHint) tagsHint.textContent = translate("store.tags.optional", "C\u00f3 th\u1ec3 b\u1ecf qua b\u01b0\u1edbc n\u00e0y");
      return;
    }
    if (tagsHint) tagsHint.textContent = translate("store.tags.pick", "Ch\u1ecdn th\u1ebb ph\u00f9 h\u1ee3p v\u1edbi gian h\u00e0ng");
    tags.forEach((tag) => {
      const label = tag.labelKey ? translate(tag.labelKey, tag.label || tag.id) : tag.label || tag.id;
      const wrapper = document.createElement("label");
      wrapper.className = "store-tag-item";
      wrapper.innerHTML = `
        <input type="checkbox" value="${escapeHtml(tag.id)}" />
        <span>${escapeHtml(label)}</span>
      `;
      tagsWrap.appendChild(wrapper);
    });
  };

  const setType = async (type, options = {}) => {
    const categories = await loadCategories();
    state.type = type;
    typeInput.value = type;

    const buttons = typeOptions.querySelectorAll(".store-type-pill");
    buttons.forEach((btn) => {
      const isActive = btn.getAttribute("data-type") === type;
      btn.classList.toggle("active", isActive);
      btn.disabled = state.disabled;
    });

    categorySelect.disabled = state.disabled || !type;
    renderCategoryOptions(type || "product", categories);

    if (!options.keepCategory) {
      state.category = "";
      categorySelect.value = "";
      renderTags(null);
    }
  };

  const setCategory = async (categoryId, options = {}) => {
    const categories = await loadCategories();
    state.category = categoryId || "";
    categorySelect.value = categoryId || "";

    const list = state.type === "service" ? categories.services || [] : categories.products || [];
    const categoryInfo = list.find((item) => String(item.id) === String(categoryId)) || null;
    renderTags(categoryInfo);

    if (options.tags && Array.isArray(options.tags)) {
      options.tags.forEach((tag) => state.tags.add(String(tag)));
      tagsWrap.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = state.tags.has(input.value);
      });
    }

    if (state.disabled) {
      tagsWrap.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });
    }
  };

  const getSelection = () => {
    const tags = Array.from(state.tags);
    return {
      storeType: state.type,
      category: state.category,
      tags,
      subcategory: tags.length ? tags[0] : "",
    };
  };

  const open = async (store) => {
    const categories = await loadCategories();
    if (!store) {
      state.disabled = false;
      await setType("", { keepCategory: false });
      return;
    }
    const type = store.storeType || resolveTypeFromCategory(store.category, categories) || "";
    state.disabled = true;
    await setType(type, { keepCategory: true });
    await setCategory(store.category || "", { tags: store.tags || (store.subcategory ? [store.subcategory] : []) });
  };

  const setDisabled = (disabled) => {
    state.disabled = Boolean(disabled);
    const buttons = typeOptions.querySelectorAll(".store-type-pill");
    buttons.forEach((btn) => {
      btn.disabled = state.disabled;
    });
    categorySelect.disabled = state.disabled || !state.type;
    tagsWrap.querySelectorAll("input").forEach((input) => {
      input.disabled = state.disabled || !state.category;
    });
  };

  typeOptions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type]");
    if (!button || state.disabled) return;
    const type = button.getAttribute("data-type");
    if (!type || type === state.type) return;
    setType(type, { keepCategory: false });
  });

  categorySelect.addEventListener("change", () => {
    if (state.disabled) return;
    setCategory(categorySelect.value, {});
  });

  tagsWrap.addEventListener("change", (event) => {
    const target = event.target;
    if (!target || target.tagName !== "INPUT") return;
    if (target.checked) state.tags.add(target.value);
    else state.tags.delete(target.value);
  });

  window.BKStoreEditor = {
    open,
    getSelection,
    setDisabled,
  };
})();
