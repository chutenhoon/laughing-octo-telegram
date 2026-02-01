import { jsonCachedResponse, PRODUCT_CATEGORIES, SERVICE_CATEGORIES } from "./_catalog.js";

export async function onRequestGet(context) {
  const payload = {
    ok: true,
    categories: {
      products: PRODUCT_CATEGORIES,
      services: SERVICE_CATEGORIES,
    },
    updatedAt: new Date().toISOString(),
  };
  return jsonCachedResponse(context.request, payload, {
    cacheControl: "private, max-age=0, must-revalidate",
    vary: "Cookie",
  });
}
