import {
  hashPassword,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  normalizeUsername,
} from "../auth/_utils.js";

const ADMIN_WEB_ID = "admin-web";
const ADMIN_NAME = "B\u1ea1ch Kim";
const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@admin.local";

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

function getAdminPanelKeys(env) {
  const user =
    env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER
      ? env.ADMIN_PANEL_USER
      : env && typeof env.ADMIN_AUTH_KEY === "string"
        ? env.ADMIN_AUTH_KEY
        : "";
  const pass =
    env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS
      ? env.ADMIN_PANEL_PASS
      : env && typeof env.ADMIN_PANEL_KEY === "string"
        ? env.ADMIN_PANEL_KEY
        : "";
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
}

function isAuthorized(request, env) {
  const keys = getAdminPanelKeys(env);
  if (!keys) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  return safeEqual(headerUser, keys.authKey) && safeEqual(headerPass, keys.panelKey);
}

function getAdminWebCredentials(env) {
  const rawUser = env && typeof env.ADMIN_WEB_USER === "string" ? env.ADMIN_WEB_USER : "";
  const rawPass = env && typeof env.ADMIN_WEB_PASS === "string" ? env.ADMIN_WEB_PASS : "";
  const user = rawUser.trim();
  const pass = String(rawPass || "");
  if (!user || !pass) return null;
  return { user, pass };
}

function buildAdminFallbackUser() {
  return {
    id: ADMIN_WEB_ID,
    email: "",
    username: ADMIN_USERNAME,
    display_name: ADMIN_NAME,
    name: ADMIN_NAME,
    role: "admin",
    sellerApproved: true,
    taskApproved: true,
    canPostTasks: true,
    badge: "Admin",
    title: "Admin",
    rank: "Admin",
    avatar: "",
  };
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

function buildUserSelect(columns) {
  const list = ["rowid AS row_id"];
  const fields = [
    "id",
    "email",
    "username",
    "display_name",
    "role",
    "status",
    "badge",
    "rank",
    "title",
    "seller_approved",
    "task_approved",
    "can_post_tasks",
    "avatar_url",
    "followers",
    "following",
    "follower_count",
    "following_count",
  ];
  fields.forEach((field) => {
    if (columns.has(field)) list.push(field);
  });
  return list.join(", ");
}

function buildAdminInsert(columns, adminEmail, adminUsername, hashResult, createdAt) {
  const required = ["email", "password_hash", "password_salt"];
  if (!required.every((col) => columns.has(col))) return null;
  const cols = [];
  const values = [];
  const binds = [];
  const pushCol = (col, val) => {
    if (!columns.has(col)) return;
    cols.push(col);
    values.push("?");
    binds.push(val);
  };
  pushCol("email", adminEmail);
  pushCol("username", adminUsername);
  pushCol("display_name", ADMIN_NAME);
  pushCol("password_hash", hashResult.hash);
  pushCol("password_salt", hashResult.salt);
  pushCol("role", "admin");
  pushCol("status", "active");
  pushCol("created_at", createdAt);
  pushCol("badge", "Admin");
  pushCol("rank", "Admin");
  pushCol("title", "Admin");
  pushCol("seller_approved", 1);
  pushCol("task_approved", 1);
  pushCol("can_post_tasks", 1);
  if (!cols.length) return null;
  const sql = `INSERT OR IGNORE INTO users (${cols.join(", ")}) VALUES (${values.join(", ")})`;
  return { sql, binds };
}

function formatUserResponse(user, resolvedId) {
  const followerCount =
    user && user.follower_count != null
      ? Number(user.follower_count || 0)
      : Number(user && user.followers != null ? user.followers : 0);
  const followingCount =
    user && user.following_count != null
      ? Number(user.following_count || 0)
      : Number(user && user.following != null ? user.following : 0);
  return {
    id: resolvedId,
    email: user.email || "",
    username: user.username || "",
    display_name: user.display_name || ADMIN_NAME,
    name: user.display_name || ADMIN_NAME,
    role: user.role || "admin",
    badge: user.badge || "Admin",
    rank: user.rank || "Admin",
    title: user.title || "Admin",
    sellerApproved: Boolean(Number(user.seller_approved)),
    taskApproved: Boolean(Number(user.task_approved)),
    canPostTasks: Boolean(Number(user.can_post_tasks)),
    avatar: user.avatar_url || "",
    followers: Number.isFinite(followerCount) ? followerCount : 0,
    following: Number.isFinite(followingCount) ? followingCount : 0,
  };
}

async function ensureAdminDbUser(db, adminCredentials, columns) {
  if (!db || !adminCredentials) return null;
  const userColumns = columns || (await getUserColumns(db));
  const selectFields = buildUserSelect(userColumns);
  const adminConditions = [];
  const adminBinds = [];
  if (userColumns.has("username")) {
    adminConditions.push("lower(username) = ?");
    adminBinds.push(normalizeUsername(ADMIN_USERNAME));
  }
  if (userColumns.has("email")) {
    adminConditions.push("lower(email) = ?");
    adminBinds.push(normalizeEmail(ADMIN_EMAIL));
  }
  let user = null;
  if (adminConditions.length) {
    user = await db
      .prepare(`SELECT ${selectFields} FROM users WHERE ${adminConditions.join(" OR ")} LIMIT 1`)
      .bind(...adminBinds)
      .first();
  }

  const raw = String(adminCredentials.user || "").trim();
  if (!user && raw) {
    const normalizedEmail = normalizeEmail(raw);
    const isEmail = raw.includes("@") && isValidEmail(normalizedEmail);
    const normalizedUser = normalizeUsername(raw);
    const lookupValue = isEmail ? normalizedEmail : normalizedUser;
    const legacyConditions = [];
    const legacyBinds = [];
    if (userColumns.has("email")) {
      legacyConditions.push("lower(email) = ?");
      legacyBinds.push(lookupValue);
    }
    if (userColumns.has("username")) {
      legacyConditions.push("lower(username) = ?");
      legacyBinds.push(normalizedUser);
    }
    if (legacyConditions.length) {
      user = await db
        .prepare(`SELECT ${selectFields} FROM users WHERE ${legacyConditions.join(" OR ")} LIMIT 1`)
        .bind(...legacyBinds)
        .first();
    }
  }
  if (user && (user.id ?? user.row_id)) {
    const resolvedId = user.id ?? user.row_id;
    if (user.id == null && user.row_id != null && userColumns.has("id")) {
      await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(resolvedId, user.row_id).run();
    }
    const updates = [];
    const binds = [];
    const pushUpdate = (col, value, current) => {
      if (!userColumns.has(col)) return;
      if (String(current ?? "") === String(value ?? "")) return;
      updates.push(`${col} = ?`);
      binds.push(value);
      user[col] = value;
    };
    pushUpdate("display_name", ADMIN_NAME, user.display_name);
    pushUpdate("username", ADMIN_USERNAME, user.username);
    pushUpdate("email", ADMIN_EMAIL, user.email);
    pushUpdate("role", "admin", user.role);
    pushUpdate("status", "active", user.status);
    pushUpdate("badge", "Admin", user.badge);
    pushUpdate("rank", "Admin", user.rank);
    pushUpdate("title", "Admin", user.title);
    pushUpdate("seller_approved", 1, user.seller_approved);
    pushUpdate("task_approved", 1, user.task_approved);
    pushUpdate("can_post_tasks", 1, user.can_post_tasks);
    if (updates.length) {
      await db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...binds, resolvedId).run();
    }
    return formatUserResponse(user, resolvedId);
  }

  const hashResult = await hashPassword(adminCredentials.pass);
  const createdAt = Math.floor(Date.now() / 1000);
  const insertSpec = buildAdminInsert(userColumns, ADMIN_EMAIL, ADMIN_USERNAME, hashResult, createdAt);
  if (insertSpec) {
    await db.prepare(insertSpec.sql).bind(...insertSpec.binds).run();
  } else {
    return null;
  }

  const adminLookupConditions = [];
  const adminLookupBinds = [];
  if (userColumns.has("email")) {
    adminLookupConditions.push("lower(email) = ?");
    adminLookupBinds.push(normalizeEmail(ADMIN_EMAIL));
  }
  if (userColumns.has("username")) {
    adminLookupConditions.push("lower(username) = ?");
    adminLookupBinds.push(normalizeUsername(ADMIN_USERNAME));
  }
  if (!adminLookupConditions.length) return null;
  user = await db
    .prepare(`SELECT ${selectFields} FROM users WHERE ${adminLookupConditions.join(" OR ")} LIMIT 1`)
    .bind(...adminLookupBinds)
    .first();
  if (!user || (!user.id && !user.row_id)) return null;
  const resolvedId = user.id ?? user.row_id;
  if (user.id == null && user.row_id != null && userColumns.has("id")) {
    await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(resolvedId, user.row_id).run();
  }
  return formatUserResponse(user, resolvedId);
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    if (!isAuthorized(context.request, context?.env)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const credentials = getAdminWebCredentials(context?.env);
    if (!credentials) {
      return jsonResponse({ ok: true, user: buildAdminFallbackUser() }, 200);
    }
    const userColumns = await getUserColumns(db);
    const adminUser = await ensureAdminDbUser(db, credentials, userColumns);
    if (!adminUser) {
      return jsonResponse({ ok: false, error: "ADMIN_NOT_CONFIGURED" }, 500);
    }
    return jsonResponse({ ok: true, user: adminUser }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
