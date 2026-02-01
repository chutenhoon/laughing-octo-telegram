import { jsonResponse } from "./auth/_utils.js";
import { jsonCachedResponse, requireAdmin, createSignedMediaToken, buildMediaUrl, toPlainText } from "./_catalog.js";

function normalizeNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function buildSearch(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return `%${trimmed.replace(/\s+/g, "%")}%`;
}

function flagTrue(column) {
  return `(${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${flagTrue(column)})`;
}

function buildWhere(params, binds, options = {}) {
  const clauses = [];
  if (!options.includeInactive) {
    clauses.push(flagTrueOrNull("s.is_active"));
  }
  if (!options.includeUnapproved) {
    clauses.push("lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update')");
  }
  if (params.category) {
    clauses.push("lower(trim(s.category)) = ?");
    binds.push(params.category);
  }
  if (params.storeType) {
    clauses.push("lower(trim(s.store_type)) = ?");
    binds.push(params.storeType);
  }
  if (params.search) {
    clauses.push("(s.store_name LIKE ? OR s.store_slug LIKE ? OR s.short_desc LIKE ? OR s.long_desc LIKE ?)");
    binds.push(params.search, params.search, params.search, params.search);
  }
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function buildOrder(sort) {
  if (sort === "rating") return "ORDER BY s.rating DESC, s.total_orders DESC, s.created_at DESC";
  if (sort === "newest") return "ORDER BY s.created_at DESC";
  return "ORDER BY s.total_orders DESC, s.rating DESC, s.created_at DESC";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const url = new URL(context.request.url);
    const preview = String(url.searchParams.get("preview") || "").toLowerCase();
    let includeUnapproved = false;
    let includeInactive = false;
    if (preview === "1" || preview === "true") {
      const adminAuth = await requireAdmin(context);
      if (adminAuth && adminAuth.ok) {
        includeUnapproved = true;
        includeInactive = true;
      }
    }

    const params = {
      category: String(url.searchParams.get("category") || "").trim().toLowerCase(),
      storeType: String(url.searchParams.get("type") || url.searchParams.get("storeType") || "").trim().toLowerCase(),
      search: buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || ""),
      sort: String(url.searchParams.get("sort") || "popular").trim(),
      page: normalizeNumber(url.searchParams.get("page"), 1),
      perPage: normalizeNumber(url.searchParams.get("perPage") || url.searchParams.get("limit"), 12),
    };
    params.page = Math.max(1, Math.floor(params.page));
    params.perPage = Math.min(40, Math.max(1, Math.floor(params.perPage)));

    const binds = [];
    const whereClause = buildWhere(params, binds, { includeUnapproved, includeInactive });
    const orderClause = buildOrder(params.sort);
    const offset = (params.page - 1) * params.perPage;

    const countSql = `
      SELECT COUNT(1) AS total
        FROM shops s
       ${whereClause}
    `;
    const countRow = await db.prepare(countSql).bind(...binds).first();
    const total = Number(countRow && countRow.total ? countRow.total : 0);

    const listSql = `
      SELECT s.id, s.store_name, s.store_slug, s.store_type, s.category, s.subcategory, s.tags_json,
             s.short_desc, s.long_desc, s.description, s.avatar_media_id, s.avatar_r2_key,
             s.status, s.is_active, s.rating, s.total_reviews, s.total_orders, s.stock_count,
             s.created_at, s.updated_at,
             u.display_name, u.username, u.badge, u.title, u.rank, u.role
        FROM shops s
        LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       ${orderClause}
       LIMIT ? OFFSET ?
    `;
    const rows = await db.prepare(listSql).bind(...binds, params.perPage, offset).all();
    const secret =
      context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
    const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const items = [];
    const results = rows && Array.isArray(rows.results) ? rows.results : [];
    for (const row of results) {
      let avatarUrl = "";
      if (secret && row.avatar_r2_key) {
        const token = await createSignedMediaToken(secret, row.avatar_r2_key, exp, "store-avatar");
        avatarUrl = token ? buildMediaUrl(context.request.url, token) : "";
      }
      let tags = [];
      if (row.tags_json) {
        try {
          tags = JSON.parse(row.tags_json) || [];
        } catch (error) {
          tags = [];
        }
      }
      items.push({
        id: row.id,
        name: row.store_name || "",
        slug: row.store_slug || "",
        storeType: row.store_type || "",
        category: row.category || "",
        subcategory: row.subcategory || "",
        tags,
        descriptionShort: row.short_desc || toPlainText(row.long_desc || row.description || ""),
        rating: Number(row.rating || 0),
        totalReviews: Number(row.total_reviews || 0),
        totalOrders: Number(row.total_orders || 0),
        stockCount: Number(row.stock_count || 0),
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        status: row.status || "pending",
        isActive: row.is_active != null ? Number(row.is_active || 0) === 1 : null,
        avatarUrl,
        owner: {
          displayName: row.display_name || row.username || "",
          username: row.username || "",
          badge: row.badge || "",
          title: row.title || "",
          rank: row.rank || "",
          role: row.role || "",
        },
      });
    }

    return jsonCachedResponse(context.request, {
      ok: true,
      items,
      page: params.page,
      perPage: params.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.perPage)),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
