import { jsonResponse } from "../auth/_utils.js";
import {
  ensureProfileTables,
  ensureTableColumns,
  ensureStoryMediaColumns,
  getUserColumns,
  ensureUserColumns,
  ensureUserIdIndex,
  handleAvatarUpload,
  handleStoryUpload,
  handleStoryThumbUpdate,
} from "../profile.js";

function errorResponse(error, status, hint, message) {
  return jsonResponse(
    {
      ok: false,
      error,
      hint: hint || "",
      message: message || "",
    },
    status
  );
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) {
      return errorResponse("DB_NOT_CONFIGURED", 500, "Set DB binding");
    }
    await ensureProfileTables(db);
    await ensureTableColumns(db, "media_metadata", [
      { name: "owner_user_id", def: "TEXT" },
      { name: "r2_bucket", def: "TEXT" },
      { name: "r2_key", def: "TEXT" },
      { name: "content_type", def: "TEXT" },
      { name: "access_level", def: "TEXT DEFAULT 'public'" },
      { name: "created_at", def: "TEXT" },
    ]);
    await ensureTableColumns(db, "media_tokens", [
      { name: "token", def: "TEXT" },
      { name: "media_id", def: "TEXT" },
      { name: "created_at", def: "INTEGER" },
    ]);
    await ensureTableColumns(db, "profile_stories", [
      { name: "slot", def: "INTEGER DEFAULT 0" },
      { name: "title", def: "TEXT" },
      { name: "type", def: "TEXT DEFAULT 'image'" },
      { name: "created_at", def: "TEXT" },
      { name: "updated_at", def: "TEXT" },
    ]);
    await ensureStoryMediaColumns(db);
    let userColumns = await getUserColumns(db);
    if (userColumns.size) await ensureUserColumns(db, userColumns);
    await ensureUserIdIndex(db, userColumns);

    const contentType = context?.request?.headers?.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return errorResponse("INVALID_CONTENT_TYPE", 415, "Use multipart/form-data");
    }

    let form;
    try {
      form = await context.request.formData();
    } catch (error) {
      return errorResponse("INVALID_FORM", 400, "", error && error.message ? error.message : "");
    }

    const action = String(form.get("action") || form.get("type") || form.get("kind") || form.get("upload") || "")
      .trim()
      .toLowerCase();
    const kind = String(form.get("kind") || "").trim().toLowerCase();
    if (action === "avatar" || kind === "avatar") {
      return await handleAvatarUpload(context, form);
    }
    const wantsThumb = action === "thumb" || action === "thumbnail" || action === "story-thumb";
    if (wantsThumb) {
      return await handleStoryThumbUpdate(context, form);
    }
    return await handleStoryUpload(context, form);
  } catch (error) {
    return errorResponse("INTERNAL", 500, "", error && error.message ? error.message : "");
  }
}
