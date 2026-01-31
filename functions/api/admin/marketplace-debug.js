import { jsonResponse } from "../auth/_utils.js";
import { requireAdmin } from "../_catalog.js";

function normalizeCategory(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const url = new URL(context.request.url);
  const productCategory = normalizeCategory(url.searchParams.get("productCategory") || url.searchParams.get("category"));
  const serviceCategory = normalizeCategory(url.searchParams.get("serviceCategory") || url.searchParams.get("category"));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));

  const sql = {
    shops: `
      SELECT id, store_name, status, is_active, store_type, category, created_at
        FROM shops
       ORDER BY created_at DESC
       LIMIT ${limit}
    `,
    products: `
      SELECT id, shop_id, kind, type, is_active, is_published, category, subcategory, created_at
        FROM products
       ORDER BY created_at DESC
       LIMIT ${limit}
    `,
    legacyCounts: `
      SELECT
        SUM(CASE WHEN kind IS NULL THEN 1 ELSE 0 END) AS kind_null,
        SUM(CASE WHEN is_published IS NULL THEN 1 ELSE 0 END) AS published_null,
        SUM(CASE WHEN is_active IS NULL THEN 1 ELSE 0 END) AS active_null
        FROM products
    `,
    productVisible: `
      SELECT COUNT(1) AS total
        FROM products p
        JOIN shops s ON s.id = p.shop_id
       WHERE (lower(trim(p.kind)) = 'product' OR (p.kind IS NULL AND (p.type IS NULL OR lower(trim(p.type)) <> 'service')))
         AND (p.is_active IS NULL OR p.is_active = 1 OR lower(p.is_active) IN ('true','yes'))
         AND (p.is_published IS NULL OR p.is_published = 1 OR lower(p.is_published) IN ('true','yes'))
         AND (s.is_active IS NULL OR s.is_active = 1 OR lower(s.is_active) IN ('true','yes'))
         AND lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update')
         ${productCategory ? "AND lower(trim(coalesce(p.category, s.category))) = ?" : ""}
    `,
    serviceVisible: `
      SELECT COUNT(1) AS total
        FROM products p
        JOIN shops s ON s.id = p.shop_id
       WHERE (lower(trim(p.kind)) = 'service' OR (p.kind IS NULL AND lower(trim(coalesce(p.type,''))) = 'service'))
         AND (p.is_active IS NULL OR p.is_active = 1 OR lower(p.is_active) IN ('true','yes'))
         AND (p.is_published IS NULL OR p.is_published = 1 OR lower(p.is_published) IN ('true','yes'))
         AND (s.is_active IS NULL OR s.is_active = 1 OR lower(s.is_active) IN ('true','yes'))
         AND lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update')
         ${serviceCategory ? "AND lower(trim(coalesce(p.category, s.category))) = ?" : ""}
    `,
  };

  const shops = await db.prepare(sql.shops).all();
  const products = await db.prepare(sql.products).all();
  const legacy = await db.prepare(sql.legacyCounts).first();

  const productVisible = productCategory
    ? await db.prepare(sql.productVisible).bind(productCategory).first()
    : await db.prepare(sql.productVisible).first();
  const serviceVisible = serviceCategory
    ? await db.prepare(sql.serviceVisible).bind(serviceCategory).first()
    : await db.prepare(sql.serviceVisible).first();

  return jsonResponse({
    ok: true,
    params: { productCategory, serviceCategory, limit },
    sql,
    results: {
      shops: shops && Array.isArray(shops.results) ? shops.results : [],
      products: products && Array.isArray(products.results) ? products.results : [],
      legacyCounts: legacy || {},
      productVisible: productVisible || { total: 0 },
      serviceVisible: serviceVisible || { total: 0 },
    },
  });
}
