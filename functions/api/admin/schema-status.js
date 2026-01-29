import { jsonResponse, readJsonBody } from "../auth/_utils.js";
import { getSchemaStatus, isAuthorized } from "./migrate.js";

async function readBody(request) {
  if (!request) return null;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await readJsonBody(request);
  }
  return null;
}

async function handleRequest(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const body = await readBody(context.request);
    if (!isAuthorized(context.request, context?.env, body)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const status = await getSchemaStatus(db);
    return jsonResponse({ ok: true, ...status }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}

export async function onRequestGet(context) {
  return handleRequest(context);
}

export async function onRequestPost(context) {
  return handleRequest(context);
}
