const MIN_AMOUNT = 10000;
const MAX_AMOUNT = 499000000;
const DEFAULT_CURRENCY = "VND";

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

const readJsonBody = async (request) => {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
};

const normalizeCurrency = (currency) => {
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  return code === "VND" ? "VND" : DEFAULT_CURRENCY;
};

const buildReference = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TP${stamp}${rand}`;
};

const normalizeQrValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 120) {
    return `data:image/png;base64,${trimmed}`;
  }
  return "";
};

const extractQrImage = (data) => {
  if (!data || typeof data !== "object") return "";
  const nested = data.data && typeof data.data === "object" ? data.data : null;
  const candidates = [
    data.qrImage,
    data.qr_image,
    data.qrImageUrl,
    data.qr_image_url,
    data.qrUrl,
    data.qr_url,
    nested && nested.qrImage,
    nested && nested.qr_image,
    nested && nested.qrImageUrl,
    nested && nested.qr_image_url,
    nested && nested.qrUrl,
    nested && nested.qr_url,
  ].filter(Boolean);

  for (const value of candidates) {
    const normalized = normalizeQrValue(value);
    if (normalized) return normalized;
  }

  const codeCandidates = [
    data.qrCode,
    data.qr_code,
    data.qrText,
    data.qr_text,
    nested && nested.qrCode,
    nested && nested.qr_code,
    nested && nested.qrText,
    nested && nested.qr_text,
  ].filter(Boolean);

  for (const value of codeCandidates) {
    const normalized = normalizeQrValue(value);
    if (normalized) return normalized;
  }

  return "";
};

const buildSepayUrl = (env) => {
  if (env.SEPAY_API_URL) return env.SEPAY_API_URL;
  const base = env.SEPAY_API_BASE || "https://api.sepay.vn";
  const path = env.SEPAY_QR_PATH || "/qr";
  return new URL(path, base).toString();
};

const buildSepayPayload = (env, amount, currency, reference) => ({
  amount,
  currency,
  content: reference,
  description: reference,
  orderId: reference,
  accountNumber: env.SEPAY_ACCOUNT_NUMBER,
  accountName: env.SEPAY_ACCOUNT_NAME,
  clientReferenceId: reference,
});

const ensureUser = async (db, userId) => {
  const user = await db.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
  return Boolean(user && user.id);
};

const ensureWallet = async (db, userId, currency) => {
  const existing = await db
    .prepare("SELECT id FROM wallet WHERE user_id = ? AND currency = ?")
    .bind(userId, currency)
    .first();
  if (existing && existing.id) return { id: existing.id };
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO wallet (id, user_id, currency, balance_available, balance_hold) VALUES (?, ?, ?, 0, 0)")
    .bind(id, userId, currency)
    .run();
  return { id };
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const body = await readJsonBody(request);
  if (!body) {
    return jsonResponse({ ok: false, error: "INVALID_BODY" }, 400);
  }

  const amount = Number(body.amount);
  const currency = normalizeCurrency(body.currency);
  const userId = String(body.userId || "").trim();

  if (!userId) {
    return jsonResponse({ ok: false, error: "AUTH_REQUIRED" }, 401);
  }
  if (!Number.isFinite(amount)) {
    return jsonResponse({ ok: false, error: "INVALID_AMOUNT" }, 400);
  }
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return jsonResponse({ ok: false, error: "AMOUNT_OUT_OF_RANGE" }, 400);
  }
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
  }

  const apiKey = env.SEPAY_API_KEY;
  const accountName = env.SEPAY_ACCOUNT_NAME;
  const accountNumber = env.SEPAY_ACCOUNT_NUMBER;
  if (!apiKey || !accountName || !accountNumber) {
    return jsonResponse({ ok: false, error: "SEPAY_NOT_CONFIGURED" }, 500);
  }

  const userExists = await ensureUser(env.DB, userId);
  if (!userExists) {
    return jsonResponse({ ok: false, error: "USER_NOT_FOUND" }, 404);
  }

  const wallet = await ensureWallet(env.DB, userId, currency);
  const reference = buildReference();
  const transactionId = crypto.randomUUID();
  const metadata = JSON.stringify({ provider: "sepay", reference, intent: "topup" });

  await env.DB
    .prepare(
      "INSERT INTO transactions (id, wallet_id, user_id, type, amount, currency, status, reference_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(transactionId, wallet.id, userId, "topup", amount, currency, "pending", reference, metadata)
    .run();

  const payload = buildSepayPayload(env, amount, currency, reference);
  const sepayUrl = buildSepayUrl(env);
  const sepayResponse = await fetch(sepayUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!sepayResponse.ok) {
    await env.DB.prepare("UPDATE transactions SET status = ? WHERE id = ?").bind("failed", transactionId).run();
    return jsonResponse({ ok: false, error: "SEPAY_REQUEST_FAILED" }, 502);
  }

  const sepayData = await sepayResponse.json().catch(() => null);
  const qrImage = extractQrImage(sepayData);
  if (!qrImage) {
    await env.DB.prepare("UPDATE transactions SET status = ? WHERE id = ?").bind("failed", transactionId).run();
    return jsonResponse({ ok: false, error: "SEPAY_QR_MISSING" }, 502);
  }

  return jsonResponse({
    ok: true,
    qrImage,
    accountName,
  });
}
