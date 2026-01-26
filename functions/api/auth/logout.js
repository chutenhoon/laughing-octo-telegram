import { jsonResponse } from "./_utils.js";
import { buildLogoutCookie } from "./session.js";

export async function onRequestPost() {
  const response = jsonResponse({ ok: true }, 200);
  response.headers.set("set-cookie", buildLogoutCookie());
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function onRequestGet() {
  return onRequestPost();
}
