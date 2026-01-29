import { jsonResponse } from "../../../auth/_utils.js";
import { requireSeller } from "../../../_catalog.js";

export async function onRequestPost(context) {
  const auth = await requireSeller(context);
  if (!auth.ok) return auth.response;
  return jsonResponse({ ok: false, error: "WITHDRAW_DISABLED" }, 409);
}
