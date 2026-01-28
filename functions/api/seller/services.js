import { jsonResponse, readJsonBody, generateId } from "../auth/_utils.js";
import { requireSeller, toPlainText, toSafeHtml, SERVICE_CATEGORIES } from "../_catalog.js";

async function getSellerShops(db, userId) {
  const rows = await db.prepare("SELECT id FROM shops WHERE user_id = ?").bind(userId).all();
  const list = rows && Array.isArray(rows.results) ? rows.results : [];
  return list.map((row) => String(row.id));
}

function mapService(row) {
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
    status: row.status || "draft",
    isActive: Number(row.is_active || 0) === 1,
    isPublished: Number(row.is_published || 0) === 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function findCategory(categoryId) {
  return SERVICE_CATEGORIES.find((item) => String(item.id) === String(categoryId)) || null;
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
           p.category, p.subcategory, p.tags_json, p.price, p.price_max,
           p.status, p.is_active, p.is_published, p.created_at, p.updated_at
      FROM products p
      JOIN shops s ON s.id = p.shop_id
     WHERE s.user_id = ?
       AND p.kind = 'service'
     ORDER BY p.created_at DESC
  `;
  const rows = await db.prepare(sql).bind(userId).all();
  const items = (rows && Array.isArray(rows.results) ? rows.results : []).map(mapService);
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
  const descriptionShort = String(body.descriptionShort || body.description_short || "").trim();
  const descriptionRaw = String(body.description || body.descriptionHtml || body.description_html || "").trim();
  const descriptionHtml = descriptionRaw ? toSafeHtml(descriptionRaw) : "";

  const shopIdInput = String(body.shopId || body.shop_id || "").trim();
  const sellerShops = await getSellerShops(db, userId);
  const shopId = shopIdInput && sellerShops.includes(shopIdInput) ? shopIdInput : sellerShops[0];
  if (!shopId) return jsonResponse({ ok: false, error: "SHOP_REQUIRED" }, 400);

  const now = new Date().toISOString();
  const existingId = body.id ? String(body.id).trim() : "";
  const isAdmin = String(auth.user.role || "").toLowerCase() === "admin";

  const categoryInfo = category ? findCategory(category) : null;
  const tags = normalizeTags(tagsInput, categoryInfo);
  const primaryTag = tags.length ? tags[0] : subcategoryInput || "";

  if (existingId) {
    const row = await db.prepare("SELECT id, shop_id FROM products WHERE id = ? LIMIT 1").bind(existingId).first();
    if (!row || !sellerShops.includes(String(row.shop_id))) {
      return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);
    }
    const updates = [
      { col: "name", val: title },
      { col: "description", val: toPlainText(descriptionRaw) || "" },
      { col: "description_short", val: descriptionShort || "" },
      { col: "description_html", val: descriptionHtml || "" },
      { col: "category", val: category || null },
      { col: "subcategory", val: primaryTag || null },
      { col: "tags_json", val: tags.length ? JSON.stringify(tags) : null },
      { col: "price", val: price },
      { col: "price_max", val: priceMax },
    ];
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
      `SELECT id, shop_id, name, description_short, description_html, category, subcategory, tags_json, price, price_max,
              status, is_active, is_published, created_at, updated_at
         FROM products WHERE id = ? LIMIT 1`
    ).bind(existingId).first();
    return jsonResponse({ ok: true, service: mapService(updated || {}) });
  }

  const serviceId = generateId();
  const insertSql = `
    INSERT INTO products
      (id, shop_id, name, description, description_short, description_html, category, subcategory, tags_json,
       price, price_max, currency, status, kind, type, stock_type, is_active, is_published, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?, 'service', 'service', 'service', 1, 1, ?, ?)
  `;
  await db.prepare(insertSql).bind(
    serviceId,
    shopId,
    title,
    toPlainText(descriptionRaw) || "",
    descriptionShort || "",
    descriptionHtml || "",
    category || null,
    primaryTag || null,
    tags.length ? JSON.stringify(tags) : null,
    price,
    priceMax,
    "draft",
    now,
    now
  ).run();

  const created = await db.prepare(
    `SELECT id, shop_id, name, description_short, description_html, category, subcategory, tags_json, price, price_max,
            status, is_active, is_published, created_at, updated_at
       FROM products WHERE id = ? LIMIT 1`
  ).bind(serviceId).first();
  return jsonResponse({ ok: true, service: mapService(created || {}) });
}
