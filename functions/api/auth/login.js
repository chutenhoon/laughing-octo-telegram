import {
  hashPassword,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  normalizeUsername,
  readJsonBody,
  verifyPassword,
} from "./_utils.js";
import { createSessionCookie } from "./session.js";

const ADMIN_WEB_ID = "admin-web";
const ADMIN_DISPLAY_NAME = "B\u1ea1ch Kim";
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

function getAdminWebCredentials(env) {
  const rawUser = env && typeof env.ADMIN_WEB_USER === "string" ? env.ADMIN_WEB_USER : "";
  const rawPass = env && typeof env.ADMIN_WEB_PASS === "string" ? env.ADMIN_WEB_PASS : "";
  const user = rawUser.trim();
  const pass = String(rawPass || "");
  if (!user || !pass) return null;
  return { user, pass };
}

function buildAdminWebUser() {
  const name = ADMIN_DISPLAY_NAME;
  return {
    id: ADMIN_WEB_ID,
    email: "",
    username: ADMIN_USERNAME,
    display_name: name,
    name,
    role: "admin",
    sellerApproved: true,
    taskApproved: true,
    canPostTasks: true,
    badge: "Admin",
    title: "Admin",
    rank: "Admin",
  };
}


async function getUserColumns(db) {
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const cols = new Set();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    console.error("LOGIN_SCHEMA_ERROR", error);
    return new Set();
  }
}

function normalizeEpochSeconds(value) {
  if (value == null || value === "") return null;
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
}

function isOnlineNow(lastSeen) {
  const seconds = normalizeEpochSeconds(lastSeen);
  if (!seconds) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - seconds <= 60;
}

function buildUserSelect(columns, includePassword) {
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
    "created_at",
    "last_seen_at",
  ];
  if (includePassword) {
    fields.push("password_hash", "password_salt");
  }
  fields.forEach((field) => {
    if (columns.has(field)) list.push(field);
  });
  return list.join(", ");
}

function buildIdentifierWhere(columns, normalizedIdentifier) {
  const conditions = [];
  const binds = [];
  if (columns.has("username")) {
    conditions.push("lower(username) = ?");
    binds.push(normalizedIdentifier);
  }
  if (columns.has("display_name")) {
    conditions.push("lower(display_name) = ?");
    binds.push(normalizedIdentifier);
  }
  if (columns.has("email")) {
    conditions.push("lower(email) = ?");
    binds.push(normalizedIdentifier);
  }
  return { conditions, binds };
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
  pushCol("display_name", ADMIN_DISPLAY_NAME);
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
  const lastSeen = user.last_seen_at ?? null;
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
    email: user.email,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    badge: user.badge || "",
    rank: user.rank || "",
    title: user.title || "",
    sellerApproved: Boolean(Number(user.seller_approved)),
    taskApproved: Boolean(Number(user.task_approved)),
    canPostTasks: Boolean(Number(user.can_post_tasks)),
    avatar: user.avatar_url || "",
    followers: Number.isFinite(followerCount) ? followerCount : 0,
    following: Number.isFinite(followingCount) ? followingCount : 0,
    created_at: user.created_at || null,
    createdAt: user.created_at || null,
    last_seen_at: lastSeen,
    is_online: isOnlineNow(lastSeen),
  };
}

async function ensureAdminDbUser(db, adminCredentials, columns) {
  if (!db || !adminCredentials) return null;
  const userColumns = columns || (await getUserColumns(db));
  const selectFields = buildUserSelect(userColumns, true);
  const normalizedAdminUser = normalizeUsername(ADMIN_USERNAME);
  const normalizedAdminEmail = normalizeEmail(ADMIN_EMAIL);

  const adminConditions = [];
  const adminBinds = [];
  if (userColumns.has("username")) {
    adminConditions.push("lower(username) = ?");
    adminBinds.push(normalizedAdminUser);
  }
  if (userColumns.has("email")) {
    adminConditions.push("lower(email) = ?");
    adminBinds.push(normalizedAdminEmail);
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
    pushUpdate("display_name", ADMIN_DISPLAY_NAME, user.display_name);
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

  const adminEmail = ADMIN_EMAIL;
  const adminUsername = ADMIN_USERNAME;
  const hashResult = await hashPassword(adminCredentials.pass);
  const createdAt = Math.floor(Date.now() / 1000);
  const insertSpec = buildAdminInsert(userColumns, adminEmail, adminUsername, hashResult, createdAt);
  if (insertSpec) {
    await db.prepare(insertSpec.sql).bind(...insertSpec.binds).run();
  } else {
    return null;
  }

  const adminLookupConditions = [];
  const adminLookupBinds = [];
  if (userColumns.has("email")) {
    adminLookupConditions.push("lower(email) = ?");
    adminLookupBinds.push(adminEmail);
  }
  if (userColumns.has("username")) {
    adminLookupConditions.push("lower(username) = ?");
    adminLookupBinds.push(adminUsername);
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

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) {
      return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
    }

    const body = await readJsonBody(context.request);
    if (!body) {
      return jsonResponse({ ok: false, error: "MISSING_CREDENTIALS" }, 400);
    }

    const identifier = String(body.identifier || body.username || body.email || "").trim();
    const password = String(body.password || "");
    if (!identifier || !password) {
      return jsonResponse({ ok: false, error: "MISSING_CREDENTIALS" }, 400);
    }

    const userColumns = await getUserColumns(db);
    const adminCredentials = getAdminWebCredentials(context?.env);
    if (adminCredentials) {
      const isAdminUser = safeEqual(identifier, adminCredentials.user);
      const isAdminPass = safeEqual(password, adminCredentials.pass);
      if (isAdminUser && isAdminPass) {
        const adminDbUser = await ensureAdminDbUser(db, adminCredentials, userColumns);
        if (adminDbUser && userColumns.has("last_seen_at")) {
          const now = Math.floor(Date.now() / 1000);
          await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now, adminDbUser.id).run();
          adminDbUser.last_seen_at = now;
          adminDbUser.is_online = true;
        }
        const session = await createSessionCookie(adminDbUser || buildAdminWebUser(), context.env);
        if (!session || !session.cookie) {
          return jsonResponse({ ok: false, error: "SESSION_NOT_CONFIGURED" }, 500);
        }
        const response = jsonResponse({ ok: true, user: adminDbUser || buildAdminWebUser() }, 200);
        response.headers.set("set-cookie", session.cookie);
        response.headers.set("cache-control", "no-store");
        return response;
      }
    }

    const normalizedIdentifier = normalizeUsername(identifier);
    let user;
    const selectFields = buildUserSelect(userColumns, true);

    if (identifier.includes("@")) {
      const email = normalizeEmail(identifier);
      if (!isValidEmail(email)) {
        return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
      }
      if (!userColumns.has("email")) {
        return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
      }
      user = await db.prepare(`SELECT ${selectFields} FROM users WHERE lower(email) = ? LIMIT 1`).bind(email).first();
    } else {
      const { conditions, binds } = buildIdentifierWhere(userColumns, normalizedIdentifier);
      if (!conditions.length) {
        return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
      }
      user = await db
        .prepare(`SELECT ${selectFields} FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`)
        .bind(...binds)
        .first();
    }

    const resolvedId = user ? user.id ?? user.row_id : null;
    if (!user || !resolvedId) {
      return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }
    if (userColumns.has("status") && user.status && user.status !== "active") {
      return jsonResponse({ ok: false, error: "ACCOUNT_DISABLED" }, 403);
    }

    if (!user.password_hash || !user.password_salt) {
      return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }
    const valid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      return jsonResponse({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }
    if (user.id == null && user.row_id != null && userColumns.has("id")) {
      await db.prepare("UPDATE users SET id = ? WHERE rowid = ?").bind(resolvedId, user.row_id).run();
    }
    if (userColumns.has("last_seen_at")) {
      const now = Math.floor(Date.now() / 1000);
      await db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now, resolvedId).run();
      user.last_seen_at = now;
    }

    const userPayload = formatUserResponse(user, resolvedId);
    const session = await createSessionCookie(userPayload, context.env);
    if (!session || !session.cookie) {
      return jsonResponse({ ok: false, error: "SESSION_NOT_CONFIGURED" }, 500);
    }
    const response = jsonResponse({ ok: true, user: userPayload }, 200);
    response.headers.set("set-cookie", session.cookie);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    console.error("REGISTER_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
