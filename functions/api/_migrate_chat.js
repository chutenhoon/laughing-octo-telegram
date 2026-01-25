import { jsonResponse, readJsonBody } from "./auth/_utils.js";

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function getAdminPanelKeys(env) {
  const user = env && typeof env.ADMIN_PANEL_USER === "string" && env.ADMIN_PANEL_USER ? env.ADMIN_PANEL_USER : env.ADMIN_AUTH_KEY;
  const pass = env && typeof env.ADMIN_PANEL_PASS === "string" && env.ADMIN_PANEL_PASS ? env.ADMIN_PANEL_PASS : env.ADMIN_PANEL_KEY;
  const authKey = String(user || "").trim();
  const panelKey = String(pass || "").trim();
  if (!authKey || !panelKey) return null;
  return { authKey, panelKey };
}

function isAuthorized(request, env, body) {
  const keys = getAdminPanelKeys(env);
  if (!keys) return false;
  const headerUser = request.headers.get("x-admin-user");
  const headerPass = request.headers.get("x-admin-pass");
  const bodyUser = body && (body.adminUser || body.admin_user);
  const bodyPass = body && (body.adminPass || body.admin_pass);
  const user = headerUser || bodyUser;
  const pass = headerPass || bodyPass;
  return safeEqual(user, keys.authKey) && safeEqual(pass, keys.panelKey);
}

async function getColumns(db, table) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const columns = new Set();
    rows.forEach((row) => {
      if (row && row.name) columns.add(String(row.name));
    });
    return columns;
  } catch (error) {
    return new Set();
  }
}

async function hasIndex(db, table, indexName) {
  try {
    const result = await db.prepare(`PRAGMA index_list(${table})`).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    return rows.some((row) => row && String(row.name) === indexName);
  } catch (error) {
    return false;
  }
}

function isDuplicateColumnError(error) {
  const message = error && error.message ? String(error.message).toLowerCase() : "";
  return message.includes("duplicate column") || message.includes("already exists");
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const body = await readJsonBody(context.request);
    if (!isAuthorized(context.request, context?.env, body)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const columns = await getColumns(db, "messages");
    if (!columns.size) {
      return jsonResponse({ ok: false, error: "MESSAGES_TABLE_NOT_READY" }, 500);
    }

    let addedColumn = false;
    if (!columns.has("client_message_id")) {
      try {
        await db.prepare("ALTER TABLE messages ADD COLUMN client_message_id TEXT").run();
        addedColumn = true;
      } catch (error) {
        if (!isDuplicateColumnError(error)) {
          return jsonResponse({ ok: false, error: "ALTER_FAILED", message: String(error?.message || error) }, 500);
        }
      }
    }

    const updatedColumns = await getColumns(db, "messages");
    let addedIndex = false;
    const indexName = "idx_messages_client";
    if (updatedColumns.has("client_message_id")) {
      const exists = await hasIndex(db, "messages", indexName);
      if (!exists) {
        try {
          await db
            .prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON messages(conversation_id, client_message_id)`)
            .run();
          addedIndex = true;
        } catch (error) {
          return jsonResponse({ ok: false, error: "INDEX_FAILED", message: String(error?.message || error) }, 500);
        }
      }
    }

    return jsonResponse(
      {
        ok: true,
        addedColumn,
        addedIndex,
        hasClientMessageId: updatedColumns.has("client_message_id"),
      },
      200
    );
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
