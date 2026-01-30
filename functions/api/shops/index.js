import {
  jsonCachedResponse,
  getSessionUser,
  findUserByRef,
  createSignedMediaToken,
  buildMediaUrl,
  requireAdmin,
} from "../_catalog.js";
import { jsonResponse } from "../auth/_utils.js";

function isTruthyFlag(value) {
  if (value === true || value === 1) return true;
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function isApprovedStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["approved", "active", "published", "pending_update"].includes(normalized);
}

async function buildAvatarUrl(requestUrl, env, key) {
  const r2Key = String(key || "").trim();
  if (!r2Key) return "";
  const secret = env && typeof env.MEDIA_SIGNING_SECRET === "string" ? env.MEDIA_SIGNING_SECRET.trim() : "";
  if (!secret) return "";
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const token = await createSignedMediaToken(secret, r2Key, exp, "store-avatar");
  return token ? buildMediaUrl(requestUrl, token) : "";
}

async function getUserColumns(db) {
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    return new Set();
  }
}

async function loadOwnerProfile(db, ownerId) {
  if (!db || !ownerId) return null;
  const cols = await getUserColumns(db);
  if (!cols.size) return null;
  const select = ["rowid AS row_id"];
  ["id", "username", "display_name", "badge", "title", "rank", "role"].forEach((field) => {
    if (cols.has(field)) select.push(field);
  });
  const row = await db.prepare(`SELECT ${select.join(", ")} FROM users WHERE id = ? LIMIT 1`).bind(ownerId).first();
  if (!row) return null;
  const resolvedId = row.id != null && row.id !== "" ? String(row.id) : String(row.row_id || "");
  return {
    id: resolvedId,
    username: row.username || "",
    displayName: row.display_name || row.username || "",
    badge: row.badge || "",
    title: row.title || "",
    rank: row.rank || "",
    role: row.role || "",
  };
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);

    const url = new URL(context.request.url);
    const ownerRef = String(
      url.searchParams.get("owner") ||
        url.searchParams.get("user") ||
        url.searchParams.get("userId") ||
        url.searchParams.get("username") ||
        ""
    ).trim();
    if (!ownerRef) return jsonResponse({ ok: false, error: "MISSING_OWNER" }, 400);

    const owner = await findUserByRef(db, ownerRef);
    if (!owner) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
    const ownerId = owner.resolvedId || owner.id;

    let isAdmin = false;
    const adminAuth = await requireAdmin(context);
    if (adminAuth.ok) isAdmin = true;
    const session = getSessionUser(context.request);
    let viewer = null;
    if (session && session.id) viewer = await findUserByRef(db, session.id);
    if (viewer && String(viewer.role || "").toLowerCase() === "admin") isAdmin = true;
    const isOwner = viewer && String(viewer.resolvedId || viewer.id) === String(ownerId || "");
    const includeAll = Boolean(isOwner || isAdmin);

    const binds = [ownerId];
    const where = ["s.user_id = ?"];
    if (!includeAll) {
      where.push(" (s.is_active = 1 OR lower(s.is_active) IN ('true','yes')) ");
      where.push(" lower(trim(coalesce(s.status,''))) IN ('approved','active','published','pending_update') ");
    }
    const sql = `
      SELECT s.id, s.store_name, s.store_slug, s.store_type, s.category, s.subcategory, s.tags_json,
             s.short_desc, s.long_desc, s.description, s.avatar_r2_key,
             s.status, s.is_active, s.rating, s.total_reviews, s.total_orders, s.stock_count,
             s.created_at, s.updated_at
        FROM shops s
       WHERE ${where.join(" AND ")}
       ORDER BY s.created_at DESC
    `;
    const rows = await db.prepare(sql).bind(...binds).all();
    const list = rows && Array.isArray(rows.results) ? rows.results : [];
    const ownerProfile = await loadOwnerProfile(db, ownerId);
    const ownerPayload =
      ownerProfile ||
      {
        id: String(ownerId || ""),
        username: owner.username || "",
        displayName: owner.display_name || owner.username || "",
        badge: owner.badge || "",
        title: owner.title || "",
        rank: owner.rank || "",
        role: owner.role || "",
      };

    const items = await Promise.all(
      list.map(async (row) => {
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
          name: row.store_name || "",
          slug: row.store_slug || "",
          storeType: row.store_type || "",
          category: row.category || "",
          subcategory: row.subcategory || "",
          tags,
          descriptionShort: row.short_desc || "",
          descriptionLong: row.long_desc || row.description || "",
          status: row.status || "pending",
          isActive: isTruthyFlag(row.is_active),
          isApproved: isApprovedStatus(row.status) && isTruthyFlag(row.is_active),
          rating: Number(row.rating || 0),
          totalReviews: Number(row.total_reviews || 0),
          totalOrders: Number(row.total_orders || 0),
          stockCount: Number(row.stock_count || 0),
          createdAt: row.created_at || null,
          updatedAt: row.updated_at || null,
          avatarUrl: await buildAvatarUrl(context.request.url, context.env, row.avatar_r2_key),
        };
      })
    );

    return jsonCachedResponse(context.request, { ok: true, owner: ownerPayload, items }, {
      cacheControl: includeAll ? "private, max-age=0, must-revalidate" : "public, max-age=60",
      vary: includeAll ? "Cookie" : "Accept-Encoding",
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
