import { onRequestPostUpload } from "../messages.js";

export async function onRequestPost(context) {
  return await onRequestPostUpload(context);
}
