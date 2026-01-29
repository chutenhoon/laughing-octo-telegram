import { jsonResponse, readJsonBody, generateId } from "../auth/_utils.js";
import { requireSeller, toPlainText, toSafeHtml, PRODUCT_CATEGORIES } from "../_catalog.js";

async function getSellerShops(db, userId) {
  const rows = await db.prepare("SELECT id, category FROM shops WHERE user_id = ?").bind(userId).all();
  const list = rows && Array.isArray(rows.results) ? rows.results : [];
  return list.map((row) => ({ id: String(row.id), category: row.category || "" }));
}

async function getProductColumns(db) {
  const result = await db.prepare("PRAGMA table_info(products)").all();
  const rows = result && Array.isArray(result.results) ? result.results : [];
  const cols = new Set();
  rows.forEach((row) => {
    if (row && row.name) cols.add(String(row.name));
  });
  return cols;
}

async function getShopProductCount(db, shopId) {
  const row = await db
    .prepare("SELECT COUNT(1) AS count FROM products WHERE shop_id = ? AND kind = 'product'")
    .bind(shopId)
    .first();
  return Number(row && row.count ? row.count : 0);
}

async function getNextSortOrder(db, shopId) {
  const row = await db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM products WHERE shop_id = ? AND kind = 'product'")
    .bind(shopId)
    .first();
  return Number(row && row.max_order ? row.max_order : 0) + 1;
}

function mapProduct(row) {
  let tags = [];
  if (row.tags_json) {
    try {
      tags = JSON.parse(row.tags_json) || [];
    } catch (error) {
      tags = [];
    }
  }
  return {
    id: row.id,
    shopId: row.shop_id,
    title: row.name,
    descriptionShort: row.description_short || "",
    descriptionHtml: row.description_html || "",
    category: row.category || "",
    subcategory: row.subcategory || "",
    tags,
    price: Number(row.price || 0),
    priceMax: row.price_max != null ? Number(row.price_max || 0) : null,
    stockCount: Number(row.stock_count || 0),
    sortOrder: row.sort_order != null ? Number(row.sort_order || 0) : 0,
    status: row.status || "draft",
    isActive: Number(row.is_active || 0) === 1,
    isPublished: Number(row.is_published || 0) === 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function findCategory(categoryId) {
  return PRODUCT_CATEGORIES.find((item) => String(item.id) === String(categoryId)) || null;
}

function normalizeTags(input, category) {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const allowed = new Set(
    (category && Array.isArray(category.subcategories) ? category.subcategories : []).map((item) => String(item.id))
  );
  const tags = [];
  raw.forEach((item) => {
    const value = String(item || "").trim();
    if (!value) return;
    if (allowed.size && !allowed.has(value)) return;
    if (!tags.includes(value)) tags.push(value);
  });
  return tags;
}

export async function onRequestGet(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;

  const sql = `
    SELECT p.id, p.shop_id, p.name, p.description_short, p.description_html,
           p.category, p.subcategory, p.tags_json, p.price, p.price_max, p.stock_count,
           p.sort_order, p.status, p.is_active, p.is_published, p.created_at, p.updated_at
      FROM products p
      JOIN shops s ON s.id = p.shop_id
     WHERE s.user_id = ?
       AND p.kind = 'product'
     ORDER BY CASE WHEN p.sort_order IS NULL OR p.sort_order = 0 THEN 1 ELSE 0 END,
              p.sort_order ASC,
              p.created_at DESC
  `;
  const rows = await db.prepare(sql).bind(userId).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map(mapProduct);
  return jsonResponse({ ok: true, items });
}

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;
  const userId = auth.user.resolvedId || auth.user.id;
  const body = await readJsonBody(context.request);
  if (!body || typeof body !== "object") return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);

  const title = String(body.title || body.name || "").trim();
  if (!title) return jsonResponse({ ok: false, error: "TITLE_REQUIRED" }, 400);
  const category = String(body.category || "").trim();
  const subcategoryInput = String(body.subcategory || "").trim();
  const tagsInput = body.tags || body.tags_json || body.tagList || null;
  const price = Number(body.price || 0);
  if (!Number.isFinite(price) || price < 0) return jsonResponse({ ok: false, error: "INVALID_PRICE" }, 400);
  const priceMaxRaw = body.priceMax != null ? Number(body.priceMax) : body.price_max != null ? Number(body.price_max) : null;
  const priceMax = Number.isFinite(priceMaxRaw) && priceMaxRaw >= price ? priceMaxRaw : null;
  const hasPriceMax = body.priceMax != null || body.price_max != null;
  const descriptionShort = String(body.descriptionShort || body.description_short || "").trim();
  const descriptionRaw = String(body.description || body.descriptionHtml || body.description_html || "").trim();
  const descriptionHtml = descriptionRaw ? toSafeHtml(descriptionRaw) : "";

  const shopIdInput = String(body.shopId || body.shop_id || "").trim();
  const sellerShops = await getSellerShops(db, userId);
  const shopMap = new Map(sellerShops.map((shop) => [shop.id, shop]));
  const shopId = shopIdInput && shopMap.has(shopIdInput) ? shopIdInput : sellerShops[0]?.id || "";
  if (!shopId) return jsonResponse({ ok: false, error: "SHOP_REQUIRED" }, 400);
  const shopMeta = shopMap.get(shopId) || {};
  const resolvedCategory = category || shopMeta.category || "";

  const now = new Date().toISOString();
  const existingId = body.id ? String(body.id).trim() : "";
  const isAdmin = String(auth.user.role || "").toLowerCase() === "admin";
  const productColumns = await getProductColumns(db);

  const categoryInfo = resolvedCategory ? findCategory(resolvedCategory) : null;
  const tags = normalizeTags(tagsInput, categoryInfo);
  const primaryTag = tags.length ? tags[0] : subcategoryInput || "";

  if (existingId) {
    const row = await db
      .prepare("SELECT id, shop_id, category FROM products WHERE id = ? LIMIT 1")
      .bind(existingId)
      .first();
    if (!row || !shopMap.has(String(row.shop_id))) {
      return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
    }
    const rowShop = shopMap.get(String(row.shop_id)) || {};
    const nextCategory = resolvedCategory || row.category || rowShop.category || "";
    const nextCategoryInfo = nextCategory ? findCategory(nextCategory) : null;
    const nextTags = normalizeTags(tagsInput, nextCategoryInfo);
    const nextPrimaryTag = nextTags.length ? nextTags[0] : subcategoryInput || "";
    const updates = [
      { col: "name", val: title },
      { col: "description", val: toPlainText(descriptionRaw) || "" },
      { col: "description_short", val: descriptionShort || "" },
      { col: "description_html", val: descriptionHtml || "" },
      { col: "category", val: nextCategory || null },
      { col: "subcategory", val: nextPrimaryTag || null },
      { col: "tags_json", val: nextTags.length ? JSON.stringify(nextTags) : null },
      { col: "price", val: price },
    ];
    if (hasPriceMax) updates.push({ col: "price_max", val: priceMax });
    if (body.isActive != null) updates.push({ col: "is_active", val: body.isActive ? 1 : 0 });
    if (body.isPublished != null) updates.push({ col: "is_published", val: body.isPublished ? 1 : 0 });
    if (body.status) {
      const statusValue = String(body.status).trim().toLowerCase();
      const allowed = isAdmin || ["draft", "pending", "disabled"].includes(statusValue);
      if (allowed) updates.push({ col: "status", val: statusValue });
    }
    updates.push({ col: "updated_at", val: now });
    const setSql = updates.map((u) => `${u.col} = ?`).join(", ");
    await db
      .prepare(`UPDATE products SET ${setSql} WHERE id = ?`)
      .bind(...updates.map((u) => u.val), existingId)
      .run();
    const updated = await db.prepare(
      `SELECT id, shop_id, name, description_short, description_html, category, subcategory, tags_json, price, price_max, stock_count,
              sort_order, status, is_active, is_published, created_at, updated_at
         FROM products WHERE id = ? LIMIT 1`
    ).bind(existingId).first();
    return jsonResponse({ ok: true, product: mapProduct(updated || {}) });
  }

  const currentCount = await getShopProductCount(db, shopId);
  if (currentCount >= 6) {
    return jsonResponse({ ok: false, error: "PRODUCT_LIMIT", limit: 6 }, 409);
  }

  const productId = generateId();
  const sortOrder = productColumns.has("sort_order") ? await getNextSortOrder(db, shopId) : null;
  const columns = [
    "id",
    "shop_id",
    "name",
    "description",
    "description_short",
    "description_html",
    "category",
    "subcategory",
    "tags_json",
    "price",
    "price_max",
    "currency",
    "status",
    "kind",
    "type",
    "stock_type",
    "is_active",
    "is_published",
    "created_at",
    "updated_at",
  ];
  const values = [
    productId,
    shopId,
    title,
    toPlainText(descriptionRaw) || "",
    descriptionShort || "",
    descriptionHtml || "",
    resolvedCategory || null,
    primaryTag || null,
    tags.length ? JSON.stringify(tags) : null,
    price,
    priceMax,
    "VND",
    "draft",
    "product",
    "digital",
    "inventory",
    1,
    1,
    now,
    now,
  ];
  if (productColumns.has("sort_order")) {
    columns.splice(11, 0, "sort_order");
    values.splice(11, 0, sortOrder);
  }

  const placeholders = columns.map(() => "?").join(", ");
  await db.prepare(`INSERT INTO products (${columns.join(", ")}) VALUES (${placeholders})`).bind(...values).run();

  const created = await db.prepare(
    `SELECT id, shop_id, name, description_short, description_html, category, subcategory, tags_json, price, price_max, stock_count,
            sort_order, status, is_active, is_published, created_at, updated_at
       FROM products WHERE id = ? LIMIT 1`
  ).bind(productId).first();
  return jsonResponse({ ok: true, product: mapProduct(created || {}) });
}
