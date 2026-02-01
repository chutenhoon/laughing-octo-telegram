import { jsonCachedResponse } from "../_catalog.js";
import { jsonResponse } from "../auth/_utils.js";

const DEFAULT_GROUP_ORDER = ["Email", "Software", "Accounts", "Other"];
let categoriesReady = false;

function flagTrueOrNull(column) {
  return `(${column} IS NULL OR ${column} = 1 OR lower(${column}) IN ('true','yes'))`;
}

function normalizeGroupName(value) {
  const raw = String(value || "").trim();
  return raw || "Other";
}

async function ensureCategoriesTable(db) {
  if (categoriesReady) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS categories (
          slug TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          group_name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0
        )`
      )
      .run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_categories_group_sort ON categories(group_name, sort_order)").run();
  } catch (error) {
    // ignore schema errors to keep response safe
  }
  categoriesReady = true;
}

export async function onRequestGet(context) {
  const db = context?.env?.DB;
  if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

  await ensureCategoriesTable(db);

  let rows = [];
  try {
    const result = await db
      .prepare("SELECT slug, label, group_name, sort_order FROM categories ORDER BY group_name ASC, sort_order ASC, label ASC")
      .all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    return jsonResponse({ ok: false, error: "SCHEMA_MISSING" }, 500);
  }

  const counts = new Map();
  try {
    const clauses = [
      "p.shop_id = s.id",
      "(p.status IS NULL OR trim(p.status) = '' OR lower(p.status) IN ('active','published'))",
      flagTrueOrNull("p.is_active"),
      flagTrueOrNull("p.is_published"),
      flagTrueOrNull("s.is_active"),
      "(s.status IS NULL OR lower(s.status) IN ('approved','active','published','pending_update'))",
      "(s.is_public IS NULL OR s.is_public = 1 OR lower(s.is_public) IN ('true','yes'))",
    ];
    const sql = `
      SELECT lower(COALESCE(p.category_slug, p.subcategory, p.category, '')) AS slug, COUNT(1) AS total
        FROM products p
        JOIN shops s ON s.id = p.shop_id
       WHERE ${clauses.join(" AND ")}
       GROUP BY lower(COALESCE(p.category_slug, p.subcategory, p.category, ''))
    `;
    const result = await db.prepare(sql).all();
    const list = result && Array.isArray(result.results) ? result.results : [];
    list.forEach((row) => {
      const slug = String(row.slug || "").trim();
      if (!slug) return;
      counts.set(slug, Number(row.total || 0));
    });
  } catch (error) {
    // keep counts empty
  }

  const categories = rows.map((row) => {
    const slug = String(row.slug || "").trim();
    const key = slug.toLowerCase();
    return {
      slug,
      label: String(row.label || "").trim(),
      group: normalizeGroupName(row.group_name),
      sortOrder: Number(row.sort_order || 0),
      count: counts.get(key) || 0,
    };
  });

  const groupsMap = new Map();
  categories.forEach((cat) => {
    const name = normalizeGroupName(cat.group);
    const entry = groupsMap.get(name) || { name, slug: name.toLowerCase(), count: 0 };
    entry.count += Number(cat.count || 0);
    groupsMap.set(name, entry);
  });

  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    const aIdx = DEFAULT_GROUP_ORDER.indexOf(a.name);
    const bIdx = DEFAULT_GROUP_ORDER.indexOf(b.name);
    if (aIdx !== -1 || bIdx !== -1) {
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    }
    return a.name.localeCompare(b.name);
  });

  return jsonCachedResponse(
    context.request,
    {
      ok: true,
      groups,
      categories,
    },
    {
      cacheControl: "public, max-age=120, stale-while-revalidate=300",
      vary: "Accept-Encoding",
    }
  );
}
