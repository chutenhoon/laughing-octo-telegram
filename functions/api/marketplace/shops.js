import { jsonResponse } from "../auth/_utils.js";
import { createSignedMediaToken, buildMediaUrl } from "../_catalog.js";

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

function parseList(value) {
  const raw = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function normalizeCategory(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

function flagTrue(column) {
  return `(${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${flagTrue(column)})`;
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

function resolveType(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "service" || value === "dichvu") return "service";
  if (value === "product" || value === "sanpham") return "product";
  return "";
}

async function ensureShopImagesTable(db) {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS shop_images (
          id TEXT PRIMARY KEY,
          shop_id TEXT NOT NULL,
          r2_object_key TEXT NOT NULL,
          content_type TEXT,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL DEFAULT 1,
          uploaded_by_role TEXT NOT NULL DEFAULT 'seller',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
        );`
      )
      .run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_shop_images_shop_pos ON shop_images(shop_id, position)").run();
  } catch (error) {
    // ignore missing table errors
  }
}

function buildItemWhere(type, params, binds) {
  const clauses = [];
  if (type === "service") {
    clauses.push("(lower(trim(p.kind)) = 'service' OR (p.kind IS NULL AND lower(trim(coalesce(p.type,''))) = 'service'))");
  } else {
    clauses.push("(lower(trim(p.kind)) = 'product' OR (p.kind IS NULL AND (p.type IS NULL OR lower(trim(p.type)) <> 'service')))");
  }
  clauses.push(flagTrueOrNull("p.is_active"));
  clauses.push(flagTrueOrNull("p.is_published"));
  clauses.push("lower(trim(coalesce(p.status,''))) NOT IN ('disabled','blocked','banned','deleted')");

  if (params.category) {
    clauses.push("lower(trim(COALESCE(p.category, s.category))) = ?");
    binds.push(params.category);
  }
  if (params.subcategories.length) {
    const placeholders = params.subcategories.map(() => "?").join(", ");
    const tagClauses = params.subcategories.map(() => "COALESCE(p.tags_json, s.tags_json, '') LIKE ?").join(" OR ");
    clauses.push(`(COALESCE(p.subcategory, s.subcategory) IN (${placeholders}) OR ${tagClauses})`);
    binds.push(...params.subcategories);
    params.subcategories.forEach((tag) => {
      binds.push(`%\"${tag}\"%`);
    });
  }
  if (params.search) {
    clauses.push("(s.store_name LIKE ? OR p.name LIKE ? OR p.description_short LIKE ? OR p.description LIKE ?)");
    binds.push(params.search, params.search, params.search, params.search);
  }
  return clauses.length ? `(${clauses.join(" AND ")})` : "";
}

function buildOrder(sort) {
  if (sort === "rating") return "ORDER BY s.rating DESC, item_count DESC, latest_item_at DESC";
  if (sort === "newest") return "ORDER BY latest_item_at DESC";
  return "ORDER BY item_count DESC, s.total_orders DESC, latest_item_at DESC";
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const url = new URL(context.request.url);
    const type = resolveType(url.searchParams.get("type"));
    if (!type) return jsonResponse({ ok: false, error: "INVALID_TYPE" }, 400);

    const params = {
      category: normalizeCategory(url.searchParams.get("category")),
      subcategories: parseList(url.searchParams.get("subcategory") || url.searchParams.get("subcategories") || ""),
      search: buildSearch(url.searchParams.get("search") || url.searchParams.get("q") || ""),
      sort: String(url.searchParams.get("sort") || "popular").trim(),
      page: normalizeNumber(url.searchParams.get("page"), 1),
      perPage: normalizeNumber(url.searchParams.get("perPage") || url.searchParams.get("limit"), 10),
    };
    params.page = Math.max(1, Math.floor(params.page));
    params.perPage = Math.min(40, Math.max(1, Math.floor(params.perPage)));

    await ensureShopImagesTable(db);

    const binds = [];
    const itemClause = buildItemWhere(type, params, binds);
    const whereClauses = [
      flagTrueOrNull("s.is_active"),
      "lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update')",
    ];
    if (itemClause) whereClauses.push(itemClause);
    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(1) AS total
        FROM (
          SELECT s.id
            FROM shops s
            JOIN products p ON p.shop_id = s.id
           ${whereClause}
           GROUP BY s.id
        ) t
    `;
    const countRow = await db.prepare(countSql).bind(...binds).first();
    const total = Number(countRow && countRow.total ? countRow.total : 0);

    const offset = (params.page - 1) * params.perPage;
    const orderClause = buildOrder(params.sort);
    const listSql = `
      SELECT s.id, s.store_name, s.store_slug, s.short_desc, s.avatar_r2_key, s.avatar_media_id,
             s.rating, s.total_orders, s.status, s.is_active, s.created_at,
             u.display_name, u.username, u.badge, u.role,
             COUNT(DISTINCT p.id) AS item_count,
             MAX(p.created_at) AS latest_item_at,
             (
               SELECT si.r2_object_key
                 FROM shop_images si
                WHERE si.shop_id = s.id
                ORDER BY si.position ASC, si.created_at ASC
                LIMIT 1
             ) AS cover_key
        FROM shops s
        JOIN products p ON p.shop_id = s.id
        LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       GROUP BY s.id
       ${orderClause}
       LIMIT ? OFFSET ?
    `;
    const rows = await db.prepare(listSql).bind(...binds, params.perPage, offset).all();
    const list = rows && Array.isArray(rows.results) ? rows.results : [];

    const secret =
      context?.env && typeof context.env.MEDIA_SIGNING_SECRET === "string" ? context.env.MEDIA_SIGNING_SECRET.trim() : "";
    const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

    const items = await Promise.all(
      list.map(async (row) => {
        let avatarUrl = "";
        if (secret && row.avatar_r2_key) {
          const token = await createSignedMediaToken(secret, row.avatar_r2_key, exp, "store-avatar");
          avatarUrl = token ? buildMediaUrl(context.request.url, token) : "";
        }
        if (!avatarUrl && row.avatar_media_id) {
          avatarUrl = buildMediaProxyUrl(context.request.url, row.avatar_media_id);
        }

        let coverUrl = "";
        if (secret && row.cover_key) {
          const token = await createSignedMediaToken(secret, row.cover_key, exp, "store-image");
          coverUrl = token ? buildMediaUrl(context.request.url, token) : "";
        }

        return {
          id: row.id,
          slug: row.store_slug || "",
          name: row.store_name || "",
          descriptionShort: row.short_desc || "",
          status: row.status || "pending",
          isActive: Number(row.is_active || 0) === 1,
          rating: Number(row.rating || 0),
          totalOrders: Number(row.total_orders || 0),
          itemCount: Number(row.item_count || 0),
          avatarUrl,
          coverUrl,
          createdAt: row.created_at || null,
          owner: {
            displayName: row.display_name || row.username || "",
            username: row.username || "",
            badge: row.badge || "",
            role: row.role || "",
          },
        };
      })
    );

    return jsonResponse({
      ok: true,
      type,
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
