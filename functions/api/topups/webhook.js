const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });

const parseBody = async (request) => {
  const raw = await request.text();
  if (!raw) return { raw: "", data: {} };
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === "object") return { raw, data: json };
  } catch (error) {
    // fall through to form parsing
  }
  const params = new URLSearchParams(raw);
  return { raw, data: Object.fromEntries(params.entries()) };
};

const pick = (obj, keys) => {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const extractReference = (data) => {
  const direct = pick(data, [
    "reference",
    "reference_id",
    "order_code",
    "orderCode",
    "transaction_code",
    "transactionCode",
    "orderId",
    "order_id",
    "code",
  ]);
  if (direct) return String(direct).trim();

  const content = pick(data, ["content", "description", "message", "transaction_content", "trans_content"]);
  if (content) {
    const match = String(content).toUpperCase().match(/TP[A-Z0-9]{6,}/);
    if (match) return match[0];
  }
  return "";
};

const extractAmount = (data) => {
  const raw = pick(data, ["amount", "amount_vnd", "transaction_amount", "paid_amount", "value", "total"]);
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.round(amount) : null;
};

const extractProviderId = (data) =>
  pick(data, ["transaction_id", "transactionId", "id", "sepay_id", "provider_transaction_id"]);

const normalizePayload = (data) => {
  if (!data || typeof data !== "object") return {};
  if (data.data && typeof data.data === "object") {
    return { ...data, ...data.data };
  }
  return data;
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "DB_NOT_CONFIGURED" }, 500);
  }

  const { data } = await parseBody(request);
  const payload = normalizePayload(data);
  const reference = extractReference(payload);
  if (!reference) {
    return jsonResponse({ ok: true });
  }

  const tx = await env.DB
    .prepare(
      "SELECT id, wallet_id, user_id, amount, currency, status, metadata_json FROM transactions WHERE reference_id = ? LIMIT 1"
    )
    .bind(reference)
    .first();
  if (!tx || !tx.id) {
    return jsonResponse({ ok: true });
  }
  if (tx.status === "posted") {
    return jsonResponse({ ok: true });
  }

  const providerId = extractProviderId(payload);
  let amount = extractAmount(payload);
  if (!Number.isFinite(amount) || amount <= 0) {
    amount = Number(tx.amount) || 0;
  }

  const postedAt = new Date().toISOString();
  await env.DB
    .prepare(
      "UPDATE wallet SET balance_available = balance_available + ?, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?"
    )
    .bind(amount, tx.wallet_id)
    .run();

  let metadata = {};
  if (tx.metadata_json) {
    try {
      metadata = JSON.parse(tx.metadata_json) || {};
    } catch (error) {
      metadata = {};
    }
  }
  metadata.provider = "sepay";
  metadata.reference = reference;
  metadata.postedAt = postedAt;
  if (providerId) metadata.providerTransactionId = String(providerId);
  if (Number.isFinite(amount) && amount !== Number(tx.amount)) {
    metadata.receivedAmount = amount;
  }

  await env.DB
    .prepare("UPDATE transactions SET status = ?, metadata_json = ? WHERE id = ?")
    .bind("posted", JSON.stringify(metadata), tx.id)
    .run();

  if (env.R2_TOPUPS) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const key = `topups/${year}/${month}/${day}/${reference}.json`;
    const record = {
      id: tx.id,
      walletId: tx.wallet_id,
      userId: tx.user_id,
      reference,
      amount,
      currency: tx.currency || "VND",
      providerTransactionId: providerId ? String(providerId) : null,
      postedAt,
    };
    await env.R2_TOPUPS.put(key, JSON.stringify(record), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  return jsonResponse({ ok: true });
}
