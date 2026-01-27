import { jsonResponse, readJsonBody } from "../auth/_utils.js";

const DEFAULT_MIGRATION_ID = "2026-01-18-core";
export const SCHEMA_USER_VERSION = 20260201;

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

export function isAuthorized(request, env, body) {
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

const TABLE_DEFS = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT,
      badge TEXT,
      title TEXT,
      rank TEXT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'buyer',
      seller_approved INTEGER NOT NULL DEFAULT 0,
      task_approved INTEGER NOT NULL DEFAULT 0,
      can_post_tasks INTEGER NOT NULL DEFAULT 0,
      can_upload_video INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      locale TEXT DEFAULT 'vi',
      followers INTEGER NOT NULL DEFAULT 0,
      following INTEGER NOT NULL DEFAULT 0,
      follower_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      last_seen_at INTEGER,
      last_login_at INTEGER,
      welcome_sent_at INTEGER,
      reset_token_hash TEXT,
      reset_expires_at INTEGER
    );
  `,
  follows: `
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_user_id TEXT NOT NULL,
      following_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE (follower_user_id, following_user_id),
      FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `,
  system_settings: `
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      value_json TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `,
  media_metadata: `
    CREATE TABLE IF NOT EXISTS media_metadata (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      r2_bucket TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      access_level TEXT NOT NULL DEFAULT 'public',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      width INTEGER,
      height INTEGER,
      duration_seconds REAL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (r2_bucket, r2_key),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `,
  media_tokens: `
    CREATE TABLE IF NOT EXISTS media_tokens (
      token TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE
    );
  `,
  profile_stories: `
    CREATE TABLE IF NOT EXISTS profile_stories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      slot INTEGER NOT NULL DEFAULT 0,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'image',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (user_id, slot),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (media_id) REFERENCES media_metadata(id) ON DELETE CASCADE
    );
  `,
  profile_featured_media: `
    CREATE TABLE IF NOT EXISTS profile_featured_media (
      user_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      title TEXT,
      media_type TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      thumb_key TEXT,
      thumb_type TEXT,
      thumb_size INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, slot)
    );
  `,
  shops: `
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      store_name TEXT NOT NULL,
      store_slug TEXT UNIQUE,
      category TEXT,
      short_desc TEXT,
      long_desc TEXT,
      description TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      avatar_media_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      is_active INTEGER NOT NULL DEFAULT 1,
      rating REAL NOT NULL DEFAULT 0,
      total_reviews INTEGER NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      stock_count INTEGER NOT NULL DEFAULT 0,
      pending_change_json TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (avatar_media_id) REFERENCES media_metadata(id) ON DELETE SET NULL
    );
  `,
  products: `
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      description_short TEXT,
      description_html TEXT,
      category TEXT,
      subcategory TEXT,
      price INTEGER NOT NULL,
      price_max INTEGER,
      stock_count INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'draft',
      kind TEXT NOT NULL DEFAULT 'product',
      type TEXT NOT NULL DEFAULT 'digital',
      stock_type TEXT NOT NULL DEFAULT 'inventory',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_published INTEGER NOT NULL DEFAULT 1,
      thumbnail_media_id TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (thumbnail_media_id) REFERENCES media_metadata(id) ON DELETE SET NULL
    );
  `,
  inventory: `
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      quantity INTEGER NOT NULL DEFAULT 1,
      line_count INTEGER NOT NULL DEFAULT 0,
      consumed_count INTEGER NOT NULL DEFAULT 0,
      r2_object_key TEXT,
      r2_object_etag TEXT,
      content_text TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `,
  orders: `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      currency TEXT NOT NULL DEFAULT 'VND',
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      fee INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      payment_reference TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      paid_at TEXT,
      canceled_at TEXT,
      FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
  `,
  order_items: `
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      inventory_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL,
      line_total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      fulfillment_status TEXT NOT NULL DEFAULT 'pending',
      content_text TEXT,
      content_r2_key TEXT,
      content_r2_etag TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE RESTRICT,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
    );
  `,
  service_requests: `
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      buyer_user_id TEXT NOT NULL,
      order_id TEXT,
      note_text TEXT,
      attachments_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (service_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
  `,
  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      creator_user_id TEXT NOT NULL,
      shop_id TEXT,
      assignee_user_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      reward INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'open',
      due_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL,
      FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `,
  task_assignments: `
    CREATE TABLE IF NOT EXISTS task_assignments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      assignee_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted',
      reward INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      accepted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      submitted_at TEXT,
      review_due_at TEXT,
      approved_at TEXT,
      expired_at TEXT,
      payout_at TEXT,
      deadline_at TEXT,
      proof_link TEXT,
      proof_note TEXT,
      proof_file_name TEXT,
      review_note TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `,
  conversations: `
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'support',
      pair_key TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_id INTEGER,
      last_message_at INTEGER,
      last_message_preview TEXT
    );
  `,
  conversation_participants: `
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      last_read_message_id INTEGER,
      unread_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    );
  `,
  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      text TEXT,
      media_key TEXT,
      client_message_id TEXT,
      created_at INTEGER NOT NULL
    );
  `,
  wallet: `
    CREATE TABLE IF NOT EXISTS wallet (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      balance_available INTEGER NOT NULL DEFAULT 0,
      balance_hold INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (user_id, currency),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `,
  transactions: `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'posted',
      related_order_id TEXT,
      related_order_item_id TEXT,
      reference_id TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      FOREIGN KEY (wallet_id) REFERENCES wallet(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL,
      FOREIGN KEY (related_order_item_id) REFERENCES order_items(id) ON DELETE SET NULL
    );
  `,
};

const COLUMN_DEFS = {
  users: [
    { name: "username", def: "TEXT" },
    { name: "name", def: "TEXT" },
    { name: "display_name", def: "TEXT" },
    { name: "avatar_url", def: "TEXT" },
    { name: "badge", def: "TEXT" },
    { name: "title", def: "TEXT" },
    { name: "rank", def: "TEXT" },
    { name: "role", def: "TEXT DEFAULT 'buyer'" },
    { name: "seller_approved", def: "INTEGER DEFAULT 0" },
    { name: "task_approved", def: "INTEGER DEFAULT 0" },
    { name: "can_post_tasks", def: "INTEGER DEFAULT 0" },
    { name: "can_upload_video", def: "INTEGER DEFAULT 0" },
    { name: "status", def: "TEXT DEFAULT 'active'" },
    { name: "followers", def: "INTEGER DEFAULT 0" },
    { name: "following", def: "INTEGER DEFAULT 0" },
    { name: "follower_count", def: "INTEGER DEFAULT 0" },
    { name: "following_count", def: "INTEGER DEFAULT 0" },
    { name: "created_at", def: "INTEGER" },
    { name: "updated_at", def: "INTEGER" },
    { name: "last_seen_at", def: "INTEGER" },
    { name: "welcome_sent_at", def: "INTEGER" },
  ],
  follows: [
    { name: "follower_user_id", def: "TEXT" },
    { name: "following_user_id", def: "TEXT" },
    { name: "created_at", def: "INTEGER" },
  ],
  shops: [
    { name: "category", def: "TEXT" },
    { name: "short_desc", def: "TEXT" },
    { name: "long_desc", def: "TEXT" },
    { name: "description", def: "TEXT" },
    { name: "contact_email", def: "TEXT" },
    { name: "contact_phone", def: "TEXT" },
    { name: "avatar_media_id", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'pending'" },
    { name: "is_active", def: "INTEGER DEFAULT 1" },
    { name: "rating", def: "REAL DEFAULT 0" },
    { name: "total_reviews", def: "INTEGER DEFAULT 0" },
    { name: "total_orders", def: "INTEGER DEFAULT 0" },
    { name: "stock_count", def: "INTEGER DEFAULT 0" },
    { name: "pending_change_json", def: "TEXT" },
    { name: "review_note", def: "TEXT" },
  ],
  products: [
    { name: "shop_id", def: "TEXT" },
    { name: "description_short", def: "TEXT" },
    { name: "description_html", def: "TEXT" },
    { name: "subcategory", def: "TEXT" },
    { name: "price_max", def: "INTEGER" },
    { name: "stock_count", def: "INTEGER DEFAULT 0" },
    { name: "kind", def: "TEXT DEFAULT 'product'" },
    { name: "is_active", def: "INTEGER DEFAULT 1" },
    { name: "is_published", def: "INTEGER DEFAULT 1" },
  ],
  inventory: [
    { name: "content_text", def: "TEXT" },
    { name: "line_count", def: "INTEGER DEFAULT 0" },
    { name: "consumed_count", def: "INTEGER DEFAULT 0" },
  ],
  order_items: [
    { name: "shop_id", def: "TEXT" },
    { name: "content_text", def: "TEXT" },
  ],
  service_requests: [
    { name: "service_id", def: "TEXT" },
    { name: "buyer_user_id", def: "TEXT" },
    { name: "order_id", def: "TEXT" },
    { name: "note_text", def: "TEXT" },
    { name: "attachments_key", def: "TEXT" },
    { name: "status", def: "TEXT DEFAULT 'pending'" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ],
  tasks: [{ name: "shop_id", def: "TEXT" }],
  media_metadata: [
    { name: "owner_user_id", def: "TEXT" },
    { name: "r2_bucket", def: "TEXT" },
    { name: "r2_key", def: "TEXT" },
    { name: "content_type", def: "TEXT" },
    { name: "access_level", def: "TEXT DEFAULT 'public'" },
    { name: "size_bytes", def: "INTEGER DEFAULT 0" },
    { name: "checksum", def: "TEXT" },
    { name: "width", def: "INTEGER" },
    { name: "height", def: "INTEGER" },
    { name: "duration_seconds", def: "REAL" },
  ],
  media_tokens: [
    { name: "token", def: "TEXT" },
    { name: "media_id", def: "TEXT" },
    { name: "created_at", def: "INTEGER" },
  ],
  profile_stories: [
    { name: "slot", def: "INTEGER DEFAULT 0" },
    { name: "title", def: "TEXT" },
    { name: "type", def: "TEXT DEFAULT 'image'" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ],
  profile_featured_media: [
    { name: "user_id", def: "TEXT" },
    { name: "slot", def: "INTEGER" },
    { name: "title", def: "TEXT" },
    { name: "media_type", def: "TEXT" },
    { name: "r2_key", def: "TEXT" },
    { name: "thumb_key", def: "TEXT" },
    { name: "thumb_type", def: "TEXT" },
    { name: "thumb_size", def: "INTEGER DEFAULT 0" },
    { name: "size", def: "INTEGER DEFAULT 0" },
    { name: "created_at", def: "TEXT" },
    { name: "updated_at", def: "TEXT" },
  ],
  conversations: [
    { name: "type", def: "TEXT DEFAULT 'support'" },
    { name: "pair_key", def: "TEXT" },
    { name: "created_at", def: "INTEGER" },
    { name: "updated_at", def: "INTEGER" },
    { name: "last_message_id", def: "INTEGER" },
    { name: "last_message_at", def: "INTEGER" },
    { name: "last_message_preview", def: "TEXT" },
  ],
  conversation_participants: [
    { name: "conversation_id", def: "TEXT" },
    { name: "user_id", def: "INTEGER" },
    { name: "role", def: "TEXT DEFAULT 'user'" },
    { name: "last_read_message_id", def: "INTEGER" },
    { name: "unread_count", def: "INTEGER DEFAULT 0" },
  ],
  messages: [
    { name: "type", def: "TEXT DEFAULT 'text'" },
    { name: "text", def: "TEXT" },
    { name: "media_key", def: "TEXT" },
    { name: "client_message_id", def: "TEXT" },
    { name: "created_at", def: "INTEGER" },
  ],
};

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

async function readUserVersion(db) {
  try {
    const row = await db.prepare("PRAGMA user_version").first();
    const value = row && (row.user_version ?? row.userVersion);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

async function setUserVersion(db, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  const safeValue = Math.max(0, Math.floor(parsed));
  try {
    await db.prepare(`PRAGMA user_version = ${safeValue}`).run();
  } catch (error) {}
}

export async function getSchemaStatus(db) {
  const userVersion = await readUserVersion(db);
  const tableInfo = {
    messages: await getTableInfo(db, "messages"),
    conversations: await getTableInfo(db, "conversations"),
    conversation_participants: await getTableInfo(db, "conversation_participants"),
  };
  const indexList = {
    messages: await getIndexList(db, "messages"),
    conversations: await getIndexList(db, "conversations"),
    conversation_participants: await getIndexList(db, "conversation_participants"),
  };
  return {
    latestVersion: SCHEMA_USER_VERSION,
    currentVersion: userVersion,
    userVersion,
    tableInfo,
    indexList,
  };
}

async function getTableInfo(db, table) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${table})`).all();
    return result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    return [];
  }
}

async function tableExists(db, table) {
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
      .bind(table)
      .first();
    return Boolean(row && row.name);
  } catch (error) {
    return false;
  }
}

async function renameTable(db, table, suffix) {
  if (!(await tableExists(db, table))) return "";
  const base = `${table}_${suffix}`;
  let name = base;
  let index = 1;
  while (await tableExists(db, name)) {
    name = `${base}_${index}`;
    index += 1;
  }
  try {
    await db.prepare(`ALTER TABLE ${table} RENAME TO ${name}`).run();
    return name;
  } catch (error) {
    return "";
  }
}

async function getIndexList(db, table) {
  try {
    const result = await db.prepare(`PRAGMA index_list('${table}')`).all();
    return result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    return [];
  }
}

async function ensureTable(db, table, report) {
  const sql = TABLE_DEFS[table];
  if (!sql) return;
  try {
    await db.prepare(sql).run();
    report.createdTables.push(table);
  } catch (error) {
    report.errors.push({ table, action: "create", error: error && error.message ? error.message : String(error) });
  }
}

async function ensureColumns(db, table, columns, report) {
  const defs = COLUMN_DEFS[table];
  if (!defs || !defs.length) return;
  for (const def of defs) {
    if (columns.has(def.name)) continue;
    try {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${def.name} ${def.def}`).run();
      report.addedColumns.push({ table, column: def.name });
      columns.add(def.name);
    } catch (error) {
      report.errors.push({
        table,
        action: "alter",
        column: def.name,
        error: error && error.message ? error.message : String(error),
      });
    }
  }
}

async function backfillShopIds(db, report) {
  const productCols = await getColumns(db, "products");
  if (productCols.has("shop_id") && productCols.has("seller_id")) {
    try {
      await db.prepare("UPDATE products SET shop_id = seller_id WHERE shop_id IS NULL").run();
      report.backfills.push("products.shop_id");
    } catch (error) {
      report.errors.push({ table: "products", action: "backfill", error: String(error) });
    }
  }

  const orderItemCols = await getColumns(db, "order_items");
  if (orderItemCols.has("shop_id") && orderItemCols.has("seller_id")) {
    try {
      await db.prepare("UPDATE order_items SET shop_id = seller_id WHERE shop_id IS NULL").run();
      report.backfills.push("order_items.shop_id");
    } catch (error) {
      report.errors.push({ table: "order_items", action: "backfill", error: String(error) });
    }
  }

  const taskCols = await getColumns(db, "tasks");
  if (taskCols.has("shop_id") && taskCols.has("seller_id")) {
    try {
      await db.prepare("UPDATE tasks SET shop_id = seller_id WHERE shop_id IS NULL").run();
      report.backfills.push("tasks.shop_id");
    } catch (error) {
      report.errors.push({ table: "tasks", action: "backfill", error: String(error) });
    }
  }
}

async function backfillUserIds(db, report) {
  const cols = await getColumns(db, "users");
  if (!cols.has("id")) return;
  try {
    await db.prepare("UPDATE users SET id = rowid WHERE id IS NULL").run();
    report.backfills.push("users.id");
  } catch (error) {
    report.errors.push({ table: "users", action: "backfill", error: String(error) });
  }
}

async function usernameExists(db, username) {
  const row = await db.prepare("SELECT 1 FROM users WHERE lower(username) = ? LIMIT 1").bind(username).first();
  return Boolean(row);
}

async function backfillUsernames(db, report) {
  const cols = await getColumns(db, "users");
  if (!cols.has("username") || !cols.has("email")) return;
  let rows = [];
  try {
    const result = await db
      .prepare("SELECT id, rowid AS row_id, email FROM users WHERE (username IS NULL OR username = '') AND email IS NOT NULL")
      .all();
    rows = result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    report.errors.push({ table: "users", action: "backfill", error: String(error) });
    return;
  }

  for (const row of rows) {
    const email = String(row.email || "");
    const local = email.includes("@") ? email.split("@")[0] : email;
    let base = local.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (base.length < 3) {
      const suffix = String(row.id || row.row_id || Date.now());
      base = `user${suffix}`;
    }
    if (base.length > 20) base = base.slice(0, 20);
    let candidate = base;
    let attempt = 0;
    while (candidate && (await usernameExists(db, candidate))) {
      attempt += 1;
      const suffix = String(attempt);
      const trimmed = base.slice(0, Math.max(1, 20 - suffix.length));
      candidate = `${trimmed}${suffix}`;
    }
    if (!candidate) continue;
    try {
      const userId = row.id ?? null;
      if (userId != null) {
        await db.prepare("UPDATE users SET username = ? WHERE id = ?").bind(candidate, userId).run();
      } else if (row.row_id != null) {
        await db.prepare("UPDATE users SET username = ? WHERE rowid = ?").bind(candidate, row.row_id).run();
      }
      report.backfills.push(`users.username:${candidate}`);
    } catch (error) {
      report.errors.push({ table: "users", action: "backfill", error: String(error) });
    }
  }
}

async function backfillFollowCounters(db, report) {
  try {
    const userCols = await getColumns(db, "users");
    const followCols = await getColumns(db, "follows");
    if (!userCols.size || !followCols.size) return;
    if (!followCols.has("follower_user_id") || !followCols.has("following_user_id")) return;
    const userIdExpr = userCols.has("id") ? "users.id" : "users.rowid";
    const followerUpdates = [];
    if (userCols.has("follower_count")) {
      followerUpdates.push(
        `follower_count = (SELECT COUNT(1) FROM follows f WHERE f.following_user_id = ${userIdExpr})`
      );
    }
    if (userCols.has("followers")) {
      followerUpdates.push(`followers = (SELECT COUNT(1) FROM follows f WHERE f.following_user_id = ${userIdExpr})`);
    }
    if (followerUpdates.length) {
      await db.prepare(`UPDATE users SET ${followerUpdates.join(", ")}`).run();
      report.backfills.push("users.follower_count");
    }

    const followingUpdates = [];
    if (userCols.has("following_count")) {
      followingUpdates.push(
        `following_count = (SELECT COUNT(1) FROM follows f WHERE f.follower_user_id = ${userIdExpr})`
      );
    }
    if (userCols.has("following")) {
      followingUpdates.push(`following = (SELECT COUNT(1) FROM follows f WHERE f.follower_user_id = ${userIdExpr})`);
    }
    if (followingUpdates.length) {
      await db.prepare(`UPDATE users SET ${followingUpdates.join(", ")}`).run();
      report.backfills.push("users.following_count");
    }
  } catch (error) {
    report.errors.push({ table: "users", action: "backfill", error: String(error) });
  }
}

async function backfillConversationPairKeys(db, report) {
  try {
    const convoCols = await getColumns(db, "conversations");
    const participantCols = await getColumns(db, "conversation_participants");
    if (!convoCols.size || !participantCols.size) return;
    if (!convoCols.has("pair_key")) return;
    if (!participantCols.has("conversation_id") || !participantCols.has("user_id")) return;
    await db
      .prepare(
        `
        UPDATE conversations
           SET pair_key = (
             SELECT printf('%s:%s', MIN(cp.user_id), MAX(cp.user_id))
               FROM conversation_participants cp
              WHERE cp.conversation_id = conversations.id
           )
         WHERE (pair_key IS NULL OR pair_key = '')
           AND EXISTS (
             SELECT 1
               FROM conversation_participants cp2
              WHERE cp2.conversation_id = conversations.id
              GROUP BY cp2.conversation_id
             HAVING COUNT(DISTINCT cp2.user_id) = 2
           )
        `
      )
      .run();
    report.backfills.push("conversations.pair_key");
  } catch (error) {
    report.errors.push({ table: "conversations", action: "backfill", error: String(error) });
  }
}

async function backfillFeaturedMedia(db, report) {
  try {
    const userCols = await getColumns(db, "users");
    const targetCols = await getColumns(db, "profile_featured_media");
    if (!userCols.size || !targetCols.size) return;
    const idField = userCols.has("id") ? "id" : "rowid";
    const userIdExpr = idField === "id" ? "u.id" : "u.rowid";
    const nowExpr = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

    const legacyCols = await getColumns(db, "profile_story_media");
    if (legacyCols.size && legacyCols.has("userId") && legacyCols.has("slot") && legacyCols.has("mediaKey")) {
      const joins = [];
      if (userCols.has("id")) joins.push("u.id = s.userId");
      joins.push("u.rowid = s.userId");
      if (userCols.has("username")) joins.push("lower(u.username) = lower(s.userId)");
      if (userCols.has("email")) joins.push("lower(u.email) = lower(s.userId)");
      if (joins.length) {
        const titleExpr = legacyCols.has("title") ? "s.title" : "''";
        const mediaTypeExpr = legacyCols.has("mediaType") ? "COALESCE(s.mediaType, 'image')" : "'image'";
        const thumbKeyExpr = legacyCols.has("thumbKey") ? "s.thumbKey" : "''";
        const thumbTypeExpr = legacyCols.has("thumbType") ? "s.thumbType" : "''";
        const thumbSizeExpr = legacyCols.has("thumbSize") ? "s.thumbSize" : "0";
        const sizeExpr = legacyCols.has("size") ? "s.size" : "0";
        const createdAtExpr = legacyCols.has("createdAt")
          ? `COALESCE(s.createdAt, s.updatedAt, ${nowExpr})`
          : nowExpr;
        const updatedAtExpr = legacyCols.has("updatedAt")
          ? `COALESCE(s.updatedAt, s.createdAt, ${nowExpr})`
          : createdAtExpr;
        const sql = `
          INSERT OR IGNORE INTO profile_featured_media
            (user_id, slot, title, media_type, r2_key, thumb_key, thumb_type, thumb_size, size, created_at, updated_at)
          SELECT
            ${userIdExpr},
            s.slot,
            ${titleExpr},
            ${mediaTypeExpr},
            s.mediaKey,
            ${thumbKeyExpr},
            ${thumbTypeExpr},
            ${thumbSizeExpr},
            ${sizeExpr},
            ${createdAtExpr},
            ${updatedAtExpr}
          FROM profile_story_media s
          JOIN users u ON (${joins.join(" OR ")})
          WHERE s.mediaKey IS NOT NULL AND s.mediaKey <> ''
        `;
        await db.prepare(sql).run();
        report.backfills.push("profile_featured_media.profile_story_media");
      }
    }

    const storyCols = await getColumns(db, "profile_stories");
    const mediaCols = await getColumns(db, "media_metadata");
    if (
      storyCols.size &&
      mediaCols.size &&
      storyCols.has("user_id") &&
      storyCols.has("media_id") &&
      storyCols.has("slot") &&
      mediaCols.has("r2_key")
    ) {
      const joins = [];
      if (userCols.has("id")) joins.push("u.id = s.user_id");
      joins.push("u.rowid = s.user_id");
      if (userCols.has("username")) joins.push("lower(u.username) = lower(s.user_id)");
      if (userCols.has("email")) joins.push("lower(u.email) = lower(s.user_id)");
      if (joins.length) {
        const titleExpr = storyCols.has("title") ? "s.title" : "''";
        const typeExpr = storyCols.has("type") ? "COALESCE(s.type, '')" : "''";
        const contentTypeExpr = mediaCols.has("content_type") ? "COALESCE(m.content_type, '')" : "''";
        const mediaTypeExpr = `CASE WHEN lower(${contentTypeExpr}) LIKE 'video/%' OR lower(${typeExpr}) = 'video' THEN 'video' ELSE 'image' END`;
        const createdAtExpr = storyCols.has("created_at") ? `COALESCE(s.created_at, ${nowExpr})` : nowExpr;
        const updatedAtExpr = storyCols.has("updated_at")
          ? `COALESCE(s.updated_at, s.created_at, ${nowExpr})`
          : createdAtExpr;
        const sql = `
          INSERT OR IGNORE INTO profile_featured_media
            (user_id, slot, title, media_type, r2_key, thumb_key, thumb_type, thumb_size, size, created_at, updated_at)
          SELECT
            ${userIdExpr},
            s.slot,
            ${titleExpr},
            ${mediaTypeExpr},
            m.r2_key,
            '',
            '',
            0,
            0,
            ${createdAtExpr},
            ${updatedAtExpr}
          FROM profile_stories s
          JOIN media_metadata m ON m.id = s.media_id
          JOIN users u ON (${joins.join(" OR ")})
          WHERE m.r2_key IS NOT NULL AND m.r2_key <> ''
        `;
        await db.prepare(sql).run();
        report.backfills.push("profile_featured_media.profile_stories");
      }
    }
  } catch (error) {
    report.errors.push({ table: "profile_featured_media", action: "backfill", error: String(error) });
  }
}

async function ensureIndexes(db, report) {
  try {
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)").run();
    report.createdIndexes = report.createdIndexes || [];
    report.createdIndexes.push("idx_users_username");
  } catch (error) {
    report.errors.push({ table: "users", action: "index", error: String(error) });
  }
}

async function ensureIndexIfColumns(db, report, table, indexName, columnList) {
  const cols = await getColumns(db, table);
  const required = Array.isArray(columnList) ? columnList : [];
  if (!required.length) return;
  if (!required.every((col) => cols.has(col))) return;
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${required.join(", ")})`).run();
    report.createdIndexes = report.createdIndexes || [];
    report.createdIndexes.push(indexName);
  } catch (error) {
    report.errors.push({ table, action: "index", error: String(error) });
  }
}

async function ensureIndexIfColumnsRaw(db, report, table, indexName, columnSql, requiredColumns) {
  const cols = await getColumns(db, table);
  const required = Array.isArray(requiredColumns) ? requiredColumns : [];
  if (!required.length) return;
  if (!required.every((col) => cols.has(col))) return;
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${columnSql})`).run();
    report.createdIndexes = report.createdIndexes || [];
    report.createdIndexes.push(indexName);
  } catch (error) {
    report.errors.push({ table, action: "index", error: String(error) });
  }
}

async function ensureUniqueIndexIfColumns(db, report, table, indexName, columnList) {
  const cols = await getColumns(db, table);
  const required = Array.isArray(columnList) ? columnList : [];
  if (!required.length) return;
  if (!required.every((col) => cols.has(col))) return;
  try {
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${table}(${required.join(", ")})`).run();
    report.createdIndexes = report.createdIndexes || [];
    report.createdIndexes.push(indexName);
  } catch (error) {
    report.errors.push({ table, action: "index", error: String(error) });
  }
}

function hasColumn(infoRows, name) {
  return infoRows.some((row) => row && String(row.name) === name);
}

function isIntegerPrimaryKey(infoRows, name) {
  const row = infoRows.find((entry) => entry && String(entry.name) === name);
  if (!row || !row.pk) return false;
  return /int/i.test(String(row.type || ""));
}

async function needsChatRebuild(db) {
  const messageInfo = await getTableInfo(db, "messages");
  if (!messageInfo.length) return false;
  if (!isIntegerPrimaryKey(messageInfo, "id")) return true;
  if (!hasColumn(messageInfo, "sender_id")) return true;
  if (!hasColumn(messageInfo, "type")) return true;
  if (!hasColumn(messageInfo, "media_key")) return true;
  if (!hasColumn(messageInfo, "client_message_id")) return true;
  const convoInfo = await getTableInfo(db, "conversations");
  if (!convoInfo.length) return true;
  if (!hasColumn(convoInfo, "last_message_id")) return true;
  if (!hasColumn(convoInfo, "last_message_at")) return true;
  if (!hasColumn(convoInfo, "last_message_preview")) return true;
  const participantInfo = await getTableInfo(db, "conversation_participants");
  if (!participantInfo.length) return true;
  if (!hasColumn(participantInfo, "last_read_message_id")) return true;
  if (!hasColumn(participantInfo, "unread_count")) return true;
  return false;
}

async function rebuildChatSchema(db, report) {
  const suffix = `legacy_${Math.floor(Date.now() / 1000)}`;
  report.chatMigration = report.chatMigration || { renamed: {}, copied: [] };
  const renamed = report.chatMigration.renamed;
  renamed.messages = await renameTable(db, "messages", suffix);
  renamed.conversation_participants = await renameTable(db, "conversation_participants", suffix);
  renamed.conversations = await renameTable(db, "conversations", suffix);
  renamed.media = await renameTable(db, "media", suffix);

  await ensureTable(db, "conversations", report);
  await ensureTable(db, "conversation_participants", report);
  await ensureTable(db, "messages", report);

  const convoLegacy = renamed.conversations;
  const participantLegacy = renamed.conversation_participants;
  const messageLegacy = renamed.messages;
  const mediaLegacy = renamed.media;

  if (convoLegacy) {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO conversations (id, type, created_at, updated_at)
           SELECT id, type, created_at, updated_at FROM ${convoLegacy}`
        )
        .run();
      report.chatMigration.copied.push("conversations");
    } catch (error) {
      report.errors.push({ table: "conversations", action: "copy", error: String(error) });
    }
  }

  if (participantLegacy) {
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, role, last_read_message_id, unread_count)
           SELECT conversation_id, user_id, role, NULL, 0 FROM ${participantLegacy}`
        )
        .run();
      report.chatMigration.copied.push("conversation_participants");
    } catch (error) {
      report.errors.push({ table: "conversation_participants", action: "copy", error: String(error) });
    }
  }

  if (messageLegacy) {
    const mediaJoin = mediaLegacy ? `LEFT JOIN ${mediaLegacy} m ON m.id = legacy.media_id` : "";
    const mediaSelect = mediaLegacy ? "m.r2_key" : "NULL";
    try {
      await db
        .prepare(
          `INSERT INTO messages (conversation_id, sender_id, type, text, media_key, client_message_id, created_at)
           SELECT legacy.conversation_id,
                  legacy.sender_user_id,
                  COALESCE(legacy.kind, 'text'),
                  legacy.text,
                  ${mediaSelect},
                  legacy.client_message_id,
                  legacy.created_at
           FROM ${messageLegacy} legacy
           ${mediaJoin}
           ORDER BY legacy.created_at ASC`
        )
        .run();
      report.chatMigration.copied.push("messages");
    } catch (error) {
      report.errors.push({ table: "messages", action: "copy", error: String(error) });
    }
  }

  try {
    await db
      .prepare(
        `UPDATE conversations
         SET last_message_id = (
           SELECT m.id FROM messages m
           WHERE m.conversation_id = conversations.id
           ORDER BY m.id DESC
           LIMIT 1
         ),
         last_message_at = (
           SELECT m.created_at FROM messages m
           WHERE m.conversation_id = conversations.id
           ORDER BY m.id DESC
           LIMIT 1
         ),
         last_message_preview = (
           SELECT CASE
             WHEN m.type = 'text' THEN COALESCE(m.text, '')
            WHEN m.type = 'image' THEN 'Anh'
            ELSE 'Tep'
           END
           FROM messages m
           WHERE m.conversation_id = conversations.id
           ORDER BY m.id DESC
           LIMIT 1
         ),
         updated_at = COALESCE((
           SELECT m.created_at FROM messages m
           WHERE m.conversation_id = conversations.id
           ORDER BY m.id DESC
           LIMIT 1
         ), updated_at)
         WHERE EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id)`
      )
      .run();
  } catch (error) {
    report.errors.push({ table: "conversations", action: "last_message_backfill", error: String(error) });
  }
}

async function migrateSellerToShops(db, report) {
  const shopCols = await getColumns(db, "shops");
  const sellerCols = await getColumns(db, "seller");
  if (!shopCols.size || !sellerCols.size) return;
  try {
    const countRow = await db.prepare("SELECT COUNT(1) AS count FROM shops").first();
    const count = countRow && typeof countRow.count === "number" ? countRow.count : 0;
    if (count > 0) return;
  } catch (error) {
    return;
  }

  const copyCols = [
    "id",
    "user_id",
    "store_name",
    "store_slug",
    "description",
    "contact_email",
    "contact_phone",
    "avatar_media_id",
    "status",
    "rating",
    "total_reviews",
    "total_orders",
    "created_at",
    "updated_at",
  ].filter((col) => shopCols.has(col) && sellerCols.has(col));

  if (!copyCols.length) return;
  const sql = `INSERT INTO shops (${copyCols.join(", ")}) SELECT ${copyCols.join(", ")} FROM seller`;
  try {
    await db.prepare(sql).run();
    report.backfills.push("shops.from_seller");
  } catch (error) {
    report.errors.push({ table: "shops", action: "copy", error: String(error) });
  }
}

async function ensureMigrationTable(db) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at INTEGER)"
    )
    .run();
  const cols = await getColumns(db, "_migrations");
  if (cols.size) {
    if (!cols.has("name")) {
      try {
        await db.prepare("ALTER TABLE _migrations ADD COLUMN name TEXT").run();
      } catch (error) {}
    }
    if (!cols.has("applied_at")) {
      try {
        await db.prepare("ALTER TABLE _migrations ADD COLUMN applied_at INTEGER").run();
      } catch (error) {}
    }
  }
  try {
    const updatedCols = await getColumns(db, "_migrations");
    if (updatedCols.has("name")) {
      await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_migrations_name ON _migrations(name)").run();
    }
  } catch (error) {}
}

async function readMigrations(db) {
  try {
    const cols = await getColumns(db, "_migrations");
    const hasName = cols.has("name");
    const select = hasName ? "id, name, applied_at" : "id, applied_at, notes";
    const result = await db.prepare(`SELECT ${select} FROM _migrations ORDER BY applied_at DESC`).all();
    return result && Array.isArray(result.results) ? result.results : [];
  } catch (error) {
    return [];
  }
}

async function logMigration(db, name, notes) {
  const appliedAt = Math.floor(Date.now() / 1000);
  const cols = await getColumns(db, "_migrations");
  if (cols.has("name")) {
    await db
      .prepare(
        "INSERT INTO _migrations (name, applied_at) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET applied_at = excluded.applied_at"
      )
      .bind(name, appliedAt)
      .run();
    return;
  }
  await db
    .prepare(
      "INSERT INTO _migrations (id, applied_at, notes) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET applied_at = excluded.applied_at, notes = excluded.notes"
    )
    .bind(name, String(appliedAt), notes || "")
    .run();
}

export async function runMigrations(db, options = {}) {
  const report = {
    createdTables: [],
    addedColumns: [],
    backfills: [],
    errors: [],
  };

  await ensureMigrationTable(db);

  const userVersionBefore = await readUserVersion(db);

  if (await needsChatRebuild(db)) {
    await rebuildChatSchema(db, report);
  }

  const tables = Object.keys(TABLE_DEFS);
  for (const table of tables) {
    await ensureTable(db, table, report);
    const columns = await getColumns(db, table);
    if (!columns.size) {
      report.errors.push({ table, action: "columns", error: "missing_table" });
      continue;
    }
    await ensureColumns(db, table, columns, report);
  }

  if (report.addedColumns.some((item) => item.table === "users" && item.column === "last_seen_at")) {
    await logMigration(db, "add_users_last_seen_at", "");
  }

  await migrateSellerToShops(db, report);
  await backfillShopIds(db, report);
  await backfillUserIds(db, report);
  await backfillUsernames(db, report);
  await backfillFeaturedMedia(db, report);
  await backfillFollowCounters(db, report);
  await backfillConversationPairKeys(db, report);
  await ensureIndexes(db, report);
  await ensureUniqueIndexIfColumns(db, report, "users", "idx_users_id", ["id"]);
  await ensureIndexIfColumns(db, report, "products", "idx_products_shop", ["shop_id"]);
  await ensureIndexIfColumns(db, report, "products", "idx_products_kind", ["kind"]);
  await ensureIndexIfColumns(db, report, "orders", "idx_orders_buyer_status", ["buyer_user_id", "status"]);
  await ensureIndexIfColumns(db, report, "order_items", "idx_order_items_shop", ["shop_id"]);
  await ensureIndexIfColumns(db, report, "service_requests", "idx_service_requests_service", ["service_id"]);
  await ensureIndexIfColumns(db, report, "service_requests", "idx_service_requests_buyer", ["buyer_user_id"]);
  await ensureIndexIfColumns(db, report, "service_requests", "idx_service_requests_status", ["status"]);
  await ensureIndexIfColumns(db, report, "tasks", "idx_tasks_shop", ["shop_id"]);
  await ensureIndexIfColumns(db, report, "transactions", "idx_transactions_type_status_user", ["type", "status", "user_id"]);
  await ensureIndexIfColumns(db, report, "media_metadata", "idx_media_access", ["access_level"]);
  await ensureIndexIfColumns(db, report, "media_tokens", "idx_media_tokens_media", ["media_id"]);
  await ensureIndexIfColumns(db, report, "profile_featured_media", "idx_profile_featured_user", ["user_id"]);
  await ensureIndexIfColumns(db, report, "profile_featured_media", "idx_profile_featured_user_created", ["user_id", "created_at"]);
  await ensureIndexIfColumns(db, report, "profile_featured_media", "idx_profile_featured_user_updated", ["user_id", "updated_at"]);
  await ensureIndexIfColumns(db, report, "conversations", "idx_conversations_type", ["type"]);
  await ensureIndexIfColumnsRaw(db, report, "conversations", "idx_conversations_updated_desc", "updated_at DESC", ["updated_at"]);
  await ensureUniqueIndexIfColumns(db, report, "conversations", "idx_conversations_pair_key", ["pair_key"]);
  await ensureIndexIfColumns(db, report, "conversation_participants", "idx_conversation_participants_user_convo", [
    "user_id",
    "conversation_id",
  ]);
  await ensureIndexIfColumnsRaw(db, report, "messages", "idx_messages_conv_id_desc", "conversation_id, id DESC", [
    "conversation_id",
    "id",
  ]);
  await ensureIndexIfColumnsRaw(db, report, "messages", "idx_messages_conv_created_desc", "conversation_id, created_at DESC", [
    "conversation_id",
    "created_at",
  ]);
  await ensureUniqueIndexIfColumns(db, report, "messages", "idx_messages_client", ["conversation_id", "client_message_id"]);
  await ensureIndexIfColumns(db, report, "follows", "idx_follows_follower", ["follower_user_id"]);
  await ensureIndexIfColumns(db, report, "follows", "idx_follows_following", ["following_user_id"]);
  await ensureIndexIfColumns(db, report, "follows", "idx_follows_created_at", ["created_at"]);
  await ensureUniqueIndexIfColumns(db, report, "follows", "idx_follows_pair", ["follower_user_id", "following_user_id"]);

  const migrationId = options && options.migrationId ? String(options.migrationId) : DEFAULT_MIGRATION_ID;
  await logMigration(db, migrationId, JSON.stringify({ added: report.addedColumns.length }));

  const userVersionTarget = Number.isFinite(Number(options.userVersion)) ? Math.floor(Number(options.userVersion)) : SCHEMA_USER_VERSION;
  if (userVersionTarget > 0) {
    await setUserVersion(db, userVersionTarget);
  }
  const status = await getSchemaStatus(db);

  return {
    report,
    userVersionBefore,
    userVersionTarget,
    ...status,
  };
}

export async function onRequestGet(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    if (!isAuthorized(context.request, context?.env, null)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    await ensureMigrationTable(db);
    const rows = await readMigrations(db);
    const userVersion = await readUserVersion(db);
    return jsonResponse({ ok: true, migrations: rows, userVersion }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context?.env?.DB;
    if (!db) return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
    const body = await readJsonBody(context.request);
    if (!isAuthorized(context.request, context?.env, body)) {
      return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const result = await runMigrations(db, {
      migrationId: body && body.migrationId ? String(body.migrationId) : DEFAULT_MIGRATION_ID,
      userVersion: SCHEMA_USER_VERSION,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "INTERNAL" }, 500);
  }
}
