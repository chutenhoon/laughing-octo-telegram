import { jsonCachedResponse, createSignedMediaToken, buildMediaUrl } from "../_catalog.js";
import { jsonResponse } from "../auth/_utils.js";

const PAGE_SIZE_DEFAULT = 12;
const PAGE_SIZE_MAX = 40;

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function buildSearch(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return `%${trimmed.replace(/\s+/g, "%")}%`;
}

function parseList(value, limit = 12) {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((item) => item.toLowerCase());
  return Array.from(new Set(list));
}

function normalizeSort(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "rating" || raw === "newest") return raw;
  return "popular";
}

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function buildMediaProxyUrl(requestUrl, mediaId) {
  const id = String(mediaId || "").trim();
  if (!id) return "";
  try {
    const url = new URL(requestUrl);
    url.pathname = "/api/media";
    url.search = `id=${encodeURIComponent(id)}`;
    return url.toString();
  } catch (error) {
    return `/api/media?id=${encodeURIComponent(id)}`;
  }
}

function buildOrderClause(sort) {
  if (sort === "rating") {
    return "ORDER BY COALESCE(p.rating, 0) DESC, COALESCE(p.sold_count, 0) DESC, p.created_at DESC";
  }
  if (sort === "newest") {
    return "ORDER BY p.created_at DESC";
  }
  return "ORDER BY COALESCE(p.sold_count, 0) DESC, COALESCE(p.rating, 0) DESC, p.created_at DESC";
}

export async function onRequestGet(context) {
  const db = context?.env?.DB;
  if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

  const url = new URL(context.request.url);
  const group = String(url.searchParams.get("category") || "").trim();
  const filters = parseList(url.searchParams.get("filters") || "", 20);
  const search = buildSearch(url.searchParams.get("q") || "");
  const sort = normalizeSort(url.searchParams.get("sort") || "");
  const page = normalizePage(url.searchParams.get("page") || 1);
  const limitRaw = Number.parseInt(String(url.searchParams.get("limit") || PAGE_SIZE_DEFAULT), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(PAGE_SIZE_MAX, Math.max(6, limitRaw)) : PAGE_SIZE_DEFAULT;
  const offset = (page - 1) * limit;

  const clauses = [
    "p.shop_id = s.id",
    "(p.status IS NULL OR trim(p.status) = '' OR lower(p.status) IN ('active','published'))",
    flagTrueOrNull("p.is_active"),
    flagTrueOrNull("p.is_published"),
    flagTrueOrNull("s.is_active"),
    "(s.status IS NULL OR lower(s.status) IN ('approved','active','published','pending_update'))",
    "(s.is_public IS NULL OR s.is_public = 1 OR lower(s.is_public) IN ('true','yes'))",
  ];
  const binds = [];

  if (group) {
    clauses.push("lower(c.group_name) = ?");
    binds.push(group.toLowerCase());
  }
  if (filters.length) {
    const placeholders = filters.map(() => "?").join(", ");
    clauses.push(`lower(COALESCE(p.category_slug, p.subcategory, p.category)) IN (${placeholders})`);
    binds.push(...filters);
  }
  if (search) {
    clauses.push("(p.title LIKE ? OR p.name LIKE ? OR p.description LIKE ? OR p.description_short LIKE ?)");
    binds.push(search, search, search, search);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(1) AS total
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN categories c ON lower(c.slug) = lower(COALESCE(p.category_slug, p.subcategory, p.category))
     ${whereClause}
  `;

  let total = 0;
  try {
    const row = await db.prepare(countSql).bind(...binds).first();
    total = Number(row && row.total ? row.total : 0);
  } catch (error) {
    total = 0;
  }

  const listSql = `
    SELECT p.id, p.slug, p.title, p.name, p.description_short, p.description,
           p.category_slug, p.category, p.subcategory,
           p.price_min, p.price, p.price_max, p.stock_count, p.sold_count, p.rating, p.is_hot,
           p.status, p.created_at, p.thumbnail_media_id,
           s.id AS shop_id, s.slug AS shop_slug, s.store_slug, s.name AS shop_name, s.store_name,
           s.owner_user_id, s.user_id,
           u.display_name, u.username, u.badge, u.role,
           c.label AS category_label, c.group_name AS category_group,
           (
             SELECT r2_key
               FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.sort_order ASC, pi.created_at ASC
              LIMIT 1
           ) AS image_key
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN categories c ON lower(c.slug) = lower(COALESCE(p.category_slug, p.subcategory, p.category))
     ${whereClause}
     ${buildOrderClause(sort)}
     LIMIT ? OFFSET ?
  `;

  let rows = [];
  try {
    const result = await db.prepare(listSql).bind(...binds, limit, offset).all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    rows = [];
  }

  const secret =
    context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const items = [];
  for (const row of rows) {
    const priceMin = row.price_min != null ? Number(row.price_min || 0) : Number(row.price || 0);
    const priceMaxRaw = row.price_max != null ? Number(row.price_max || 0) : null;
    const priceMax = priceMaxRaw != null && priceMaxRaw > priceMin ? priceMaxRaw : null;
    const title = String(row.title || row.name || "").trim();
    const slug = String(row.slug || row.id || "").trim();
    const shopSlug = String(row.shop_slug || row.store_slug || "").trim();
    const shopName = String(row.shop_name || row.store_name || "").trim();
    const categoryLabel = String(row.category_label || row.subcategory || row.category || "").trim();
    const categorySlug = String(row.category_slug || row.subcategory || row.category || "").trim();

    let imageUrl = "";
    if (secret && row.image_key) {
      const token = await createSignedMediaToken(secret, row.image_key, exp, "product-image");
      imageUrl = token ? buildMediaUrl(context.request.url, token) : "";
    }
    if (!imageUrl && row.thumbnail_media_id) {
      imageUrl = buildMediaProxyUrl(context.request.url, row.thumbnail_media_id);
    }

    items.push({
      id: row.id,
      slug,
      title,
      descriptionShort: row.description_short || "",
      categoryLabel,
      categorySlug,
      priceMin,
      priceMax,
      stock: Number(row.stock_count || 0),
      sold: Number(row.sold_count || 0),
      rating: Number(row.rating || 0),
      isHot: Number(row.is_hot || 0) === 1,
      imageUrl,
      shop: {
        id: row.shop_id,
        slug: shopSlug,
        name: shopName,
        ownerUserId: row.owner_user_id || row.user_id || "",
        badge: row.badge || "",
        role: row.role || "",
        displayName: row.display_name || row.username || "",
        username: row.username || "",
      },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return jsonCachedResponse(
    context.request,
    {
      ok: true,
      items,
      page,
      perPage: limit,
      total,
      totalPages,
    },
    {
      cacheControl: "public, max-age=120, stale-while-revalidate=300",
      vary: "Accept-Encoding",
    }
  );
}
