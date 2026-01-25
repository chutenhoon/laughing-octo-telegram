import { onRequestGet as mediaGet } from "../media.js";

export async function onRequestGet(context) {
  return mediaGet(context);
}
