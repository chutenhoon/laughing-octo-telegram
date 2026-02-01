import { onRequestGet as followGet } from "./follow.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.searchParams.set("list", "following");
  const request = new Request(url.toString(), context.request);
  return followGet({ ...context, request });
}
