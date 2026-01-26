import { jsonResponse, readJsonBody } from "./auth/_utils.js";

const SETTING_ID = "maintenance";
const DEFAULT_MESSAGE = "Bao tri he thong, xin loi vi su bat tien nay.";
const ALLOWED_SCOPES = new Set([
  "home",
  "products",
  "services",
  "tasks_market",
  "task_posting",
  "seller_panel",
  "profile",
  "checkout",
  "admin_panel",
  "all",
]);

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
  const user = env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER ? env.ADMIN_PANEL_USER : env.ADMIN_AUTH_KEY;
  const pass = env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS ? env.ADMIN_PANEL_PASS : env.ADMIN_PANEL_KEY;
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
}

function normalizeConfig(input) {
  const raw = input && typeof input === "object" ? input : {};
  const enabled = raw.enabled === true || String(raw.enabled || "") === "true";
  const message = typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : DEFAULT_MESSAGE;
  const scopes = Array.isArray(raw.scopes)
    ? raw.scopes.map((scope) => String(scope || "").trim()).filter((scope) => scope && ALLOWED_SCOPES.has(scope))
    : [];
  return { enabled, message, scopes };
}

async function readConfig(db) {
  if (!db) return normalizeConfig({});
  const row = await db.prepare("SELECT value_json FROM system_settings WHERE id = ? LIMIT 1").bind(SETTING_ID).first();
  if (!row || !row.value_json) return normalizeConfig({});
  try {
    const parsed = JSON.parse(row.value_json);
    return normalizeConfig(parsed);
  } catch (error) {
    return normalizeConfig({});
  }
}

async function writeConfig(db, config) {
  if (!db) return;
  const payload = JSON.stringify(config || {});
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO system_settings (id, value_json, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at"
    )
    .bind(SETTING_ID, payload, now, now)
    .run();
}

function isAuthorized(request, env, body) {
  const keys = getAdminPanelKeys(env);
  if (!keys) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  const bodyUser = body && body.adminUser ? body.adminUser : body && body.admin_user ? body.admin_user : "";
  const bodyPass = body && body.adminPass ? body.adminPass : body && body.admin_pass ? body.admin_pass : "";
  const user = headerUser || bodyUser;
  const pass = headerPass || bodyPass;
  return safeEqual(user, keys.authKey) && safeEqual(pass, keys.panelKey);
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const config = await readConfig(db);
    return jsonResponse({ ok: true, config }, 200);
  } catch (error) {
    console.error("MAINTENANCE_GET_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const body = await readJsonBody(context.request);
    if (!body) return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
    if (!isAuthorized(context.request, context?.env, body)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const rawConfig = body.config && typeof body.config === "object" ? body.config : body;
    const config = normalizeConfig(rawConfig);
    await writeConfig(db, config);
    return jsonResponse({ ok: true, config }, 200);
  } catch (error) {
    console.error("MAINTENANCE_POST_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
