const TARGET_PATH = "/seller/[id]/index.html";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = TARGET_PATH;
  return fetch(new Request(url.toString(), context.request));
}
