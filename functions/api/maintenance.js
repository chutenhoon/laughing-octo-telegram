import { jsonResponse, readJsonBody } from "./auth/_utils.js";
import {
  MAINTENANCE_CACHE_KEY,
  applyMaintenanceUpdate,
  readMaintenanceConfig,
  writeMaintenanceConfig,
} from "../_lib/maintenance.js";

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

const purgeMaintenanceCache = (context) => {
  if (!context || typeof caches === "undefined" || !caches.default) return;
  try {
    const request = new Request(MAINTENANCE_CACHE_KEY);
    if (typeof context.waitUntil === "function") {
      context.waitUntil(caches.default.delete(request));
    } else {
      caches.default.delete(request);
    }
  } catch (error) {
    // ignore cache purge errors
  }
};

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
    const config = await readMaintenanceConfig(db);
    const response = jsonResponse({ ok: true, config, serverNow: Date.now() }, 200);
    response.headers.set("cache-control", "no-store");
    return response;
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
    const current = await readMaintenanceConfig(db);
    const next = applyMaintenanceUpdate(current, rawConfig, Date.now());
    await writeMaintenanceConfig(db, next);
    purgeMaintenanceCache(context);
    const response = jsonResponse({ ok: true, config: next, serverNow: Date.now() }, 200);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    console.error("MAINTENANCE_POST_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
