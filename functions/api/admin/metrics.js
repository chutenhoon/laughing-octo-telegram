import { jsonResponse } from "../auth/_utils.js";
import { requireAdmin, jsonCachedResponse } from "../_catalog.js";

async function safeCount(db, sql, binds = []) {
  try {
    const row = await db.prepare(sql).bind(...binds).first();
    const value = row && (row.count ?? row.total);
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  } catch (error) {
    return 0;
  }
}

async function safeSum(db, sql, binds = []) {
  try {
    const row = await db.prepare(sql).bind(...binds).first();
    const value = row && (row.total ?? row.sum ?? row.amount);
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
  } catch (error) {
    return 0;
  }
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const db = auth.db;

  const [
    totalUsers,
    approvedSellers,
    pendingStores,
    pendingStoreUpdates,
    pendingOrders,
    pendingServiceRequests,
    pendingTopups,
    pendingWithdrawals,
    pendingRefunds,
    pendingSellers,
    revenueTotal,
    revenueToday,
  ] = await Promise.all([
    safeCount(db, "SELECT COUNT(1) AS count FROM users"),
    safeCount(
      db,
      "SELECT COUNT(1) AS count FROM users WHERE seller_approved = 1 OR lower(role) IN ('seller','admin')"
    ),
    safeCount(db, "SELECT COUNT(1) AS count FROM shops WHERE lower(status) = 'pending'"),
    safeCount(
      db,
      "SELECT COUNT(1) AS count FROM shops WHERE lower(status) = 'pending_update' OR (pending_change_json IS NOT NULL AND pending_change_json <> '')"
    ),
    safeCount(
      db,
      "SELECT COUNT(1) AS count FROM orders WHERE lower(status) IN ('pending','processing') OR lower(payment_status) IN ('unpaid','pending')"
    ),
    safeCount(db, "SELECT COUNT(1) AS count FROM service_requests WHERE lower(status) = 'pending'"),
    safeCount(db, "SELECT COUNT(1) AS count FROM transactions WHERE type = 'topup' AND lower(status) = 'pending'"),
    safeCount(db, "SELECT COUNT(1) AS count FROM transactions WHERE type = 'withdraw' AND lower(status) = 'pending'"),
    safeCount(db, "SELECT COUNT(1) AS count FROM transactions WHERE type = 'refund' AND lower(status) = 'pending'"),
    safeCount(db, "SELECT COUNT(1) AS count FROM approval_requests WHERE lower(status) = 'pending'"),
    safeSum(
      db,
      "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE lower(status) IN ('completed','success','paid','delivered') OR lower(payment_status) IN ('paid','completed','success')"
    ),
    safeSum(
      db,
      "SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE (lower(status) IN ('completed','success','paid','delivered') OR lower(payment_status) IN ('paid','completed','success')) AND date(created_at) = date('now')"
    ),
  ]);

  const payload = {
    ok: true,
    metrics: {
      totalUsers,
      approvedSellers,
      pendingStores,
      pendingStoreUpdates,
      pendingOrders,
      pendingServiceRequests,
      pendingTopups,
      pendingRefunds,
      pendingWithdrawals,
      pendingSellers,
      revenueTotal,
      revenueToday,
    },
    generatedAt: new Date().toISOString(),
  };

  return jsonCachedResponse(context.request, payload, {
    cacheControl: "private, max-age=0, must-revalidate",
    vary: "Cookie",
  });
}
