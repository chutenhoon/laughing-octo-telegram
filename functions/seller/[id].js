import { jsonResponse } from "../api/auth/_utils.js";

async function resolveShopSlug(db, ref) {
  if (!db || !ref) return "";
  try {
    const row = await db
      .prepare("SELECT store_slug, id FROM shops WHERE id = ? OR store_slug = ? LIMIT 1")
      .bind(ref, ref)
      .first();
    if (!row) return "";
    return row.store_slug || row.id || "";
  } catch (error) {
    return "";
  }
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const queryRef = String(url.searchParams.get("id") || "").trim();
    const paramRef = context?.params?.id ? String(context.params.id).trim() : "";
    const ref = queryRef || paramRef;
    if (!ref) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

    const slug = await resolveShopSlug(context?.env?.DB, ref);
    const targetRef = slug || ref;
    if (!targetRef) return jsonResponse({ ok: false, error: "NOT_FOUND" }, 404);

    const nextParams = new URLSearchParams();
    const preview = String(url.searchParams.get("preview") || "").trim();
    if (preview) nextParams.set("preview", preview);
    const query = nextParams.toString();
    const target = query ? `/gian-hang/${encodeURIComponent(targetRef)}?${query}` : `/gian-hang/${encodeURIComponent(targetRef)}`;
    return Response.redirect(target, 302);
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
