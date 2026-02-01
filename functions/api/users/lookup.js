import { jsonResponse, normalizeUsername } from "../auth/_utils.js";

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function getAdminCredentials(env) {
  const webUser = env && typeof env.ADMIN_WEB_USER === "string" ? env.ADMIN_WEB_USER : "";
  const webPass = env && typeof env.ADMIN_WEB_PASS === "string" ? env.ADMIN_WEB_PASS : "";
  if (webUser && webPass) {
    return { user: webUser.trim(), pass: String(webPass) };
  }
  const panelUser = env && typeof env.ADMIN_PANEL_USER === "string" ? env.ADMIN_PANEL_USER : "";
  const panelPass = env && typeof env.ADMIN_PANEL_PASS === "string" ? env.ADMIN_PANEL_PASS : "";
  if (!panelUser || !panelPass) return null;
  return { user: panelUser.trim(), pass: String(panelPass) };
}

function isAdminAuthorized(request, env) {
  const creds = getAdminCredentials(env);
  if (!creds || !request) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  if (!headerUser || !headerPass) return false;
  return safeEqual(headerUser, creds.user) && safeEqual(headerPass, creds.pass);
}

async function getTableColumns(db, table) {
  if (!db || !table) return new Set();
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
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

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    if (!isAdminAuthorized(context.request, context.env)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const url = new URL(context.request.url);
    const usernameParam = url.searchParams.get("username") || url.searchParams.get("u") || "";
    const username = normalizeUsername(usernameParam);
    if (!username) return jsonResponse({ ok: false, error: "INVALID_USERNAME" }, 400);

  const cols = await getTableColumns(db, "users");
  if (!cols.has("username")) return jsonResponse({ ok: false, error: "DB_NOT_READY" }, 500);

    const idField = cols.has("id") ? "id" : "rowid";
    const select = [idField === "id" ? "id" : "rowid AS id"];
    if (idField === "id") select.push("rowid AS row_id");
    select.push("username");
    if (cols.has("follower_count")) select.push("follower_count");
    if (cols.has("following_count")) select.push("following_count");
    if (cols.has("followers")) select.push("followers");
    if (cols.has("following")) select.push("following");

    const row = await db
      .prepare(`SELECT ${select.join(", ")} FROM users WHERE lower(username) = ? LIMIT 1`)
      .bind(username)
      .first();
    if (!row) return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);

    if (idField === "id" && (row.id == null || String(row.id).trim() === "") && row.row_id != null) {
      try {
        await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(row.row_id, row.row_id).run();
        row.id = row.row_id;
      } catch (error) {}
    }

    const followerCount =
      row && row.follower_count != null ? Number(row.follower_count || 0) : Number(row.followers || 0);
    const followingCount =
      row && row.following_count != null ? Number(row.following_count || 0) : Number(row.following || 0);

    return jsonResponse(
      {
        ok: true,
        user: {
          id: row.id,
          username: row.username || "",
          follower_count: Number.isFinite(followerCount) ? followerCount : 0,
          following_count: Number.isFinite(followingCount) ? followingCount : 0,
        },
      },
      200
    );
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
