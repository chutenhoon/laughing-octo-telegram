import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  isValidUsername,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  normalizeUsername,
  readJsonBody,
} from "./_utils.js";
import { createWelcomeMessageForNewUser } from "../messages.js";

async function getUserColumns(db) {
  if (!db) return new Set();
  try {
    const result = await db.prepare("PRAGMA table_info(users)").all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const cols = new Set();
    rows.forEach((row) => {
      if (row && row.name) cols.add(String(row.name));
    });
    return cols;
  } catch (error) {
    return new Set();
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) {
      return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
    }
    const body = await readJsonBody(context.request);
    if (!body) {
      return jsonResponse({ ok: false, error: "INVALID_INPUT" }, 400);
    }

    const displayName = String(body.display_name || body.displayName || body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const confirm = String(body.confirm || "");
    const username = normalizeUsername(body.username);
    const termsAccepted = body.terms === true || String(body.terms || "").toLowerCase() === "true";

    if (!displayName) return jsonResponse({ ok: false, error: "NAME_REQUIRED" }, 400);
    if (!email || !isValidEmail(email)) return jsonResponse({ ok: false, error: "INVALID_EMAIL" }, 400);
    if (!username) return jsonResponse({ ok: false, error: "USERNAME_REQUIRED" }, 400);
    if (!isValidUsername(username)) return jsonResponse({ ok: false, error: "INVALID_USERNAME" }, 400);
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse({ ok: false, error: "PASSWORD_TOO_SHORT" }, 400);
    }
    if (password !== confirm) {
      return jsonResponse({ ok: false, error: "PASSWORD_MISMATCH" }, 400);
    }
    if (!termsAccepted) return jsonResponse({ ok: false, error: "TERMS_REQUIRED" }, 400);

    const hashResult = await hashPassword(password);
    const hashValue = hashResult.hash;
    const saltValue = hashResult.salt;
    if (!hashValue || !saltValue) {
      console.error("REGISTER_ERROR", new Error("hash_failed"));
      return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
    }

    const displayNameValue = displayName || null;
    const createdAt = Math.floor(Date.now() / 1000);
    const userColumns = await getUserColumns(db);
    if (!userColumns.has("username")) {
      return jsonResponse({ ok: false, error: "DB_NOT_READY" }, 500);
    }

    try {
      const existingEmail = await db.prepare("SELECT 1 FROM users WHERE lower(email) = ? LIMIT 1").bind(email).first();
      if (existingEmail) return jsonResponse({ ok: false, error: "EMAIL_EXISTS" }, 409);
      const existingUsername = await db
        .prepare("SELECT 1 FROM users WHERE lower(username) = ? LIMIT 1")
        .bind(username)
        .first();
      if (existingUsername) return jsonResponse({ ok: false, error: "USERNAME_EXISTS" }, 409);

      const insertCols = ["email", "username", "display_name", "password_hash", "password_salt", "created_at"];
      const insertValues = [email, username, displayNameValue, hashValue, saltValue, createdAt];
      if (userColumns.has("last_seen_at")) {
        insertCols.push("last_seen_at");
        insertValues.push(createdAt);
      }
      const placeholders = insertCols.map(() => "?").join(", ");
      const result = await db
        .prepare(`INSERT INTO users (${insertCols.join(", ")}) VALUES (${placeholders}) ON CONFLICT(email) DO NOTHING`)
        .bind(...insertValues)
        .run();
      const rowsAffected = result && result.meta && typeof result.meta.changes === "number" ? result.meta.changes : 0;
      if (rowsAffected === 0) {
        return jsonResponse({ ok: false, error: "EMAIL_EXISTS" }, 409);
      }
      await db.prepare("UPDATE users SET id = rowid WHERE id IS NULL AND email = ?").bind(email).run();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (message.includes("users.username") || message.includes("idx_users_username")) {
        return jsonResponse({ ok: false, error: "USERNAME_EXISTS" }, 409);
      }
      console.error("REGISTER_ERROR", error);
      return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
    }

    try {
      const userRow = await db
        .prepare("SELECT id, rowid AS row_id, email, username, display_name FROM users WHERE email = ? LIMIT 1")
        .bind(email)
        .first();
      const userId = userRow && (userRow.id ?? userRow.row_id) ? String(userRow.id ?? userRow.row_id) : "";
      if (userId) {
        await createWelcomeMessageForNewUser(db, context.env, {
          id: userId,
          email: email,
          username: username,
          name: displayNameValue || displayName,
        });
      }
    } catch (error) {
      console.error("WELCOME_MESSAGE_ERROR", error);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("REGISTER_ERROR", error);
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
