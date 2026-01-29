const DEFAULT_SLOW_QUERY_MS = 300;

function isDevEnv(env) {
  const mode = String(env && (env.ENVIRONMENT || env.NODE_ENV || env.ENV || env.DEBUG) || "").toLowerCase();
  return mode.includes("dev") || mode === "1" || mode === "true";
}

function formatDuration(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round(ms);
}

function redactParam(value) {
  if (value == null) return null;
  const type = typeof value;
  if (type === "number" || type === "boolean") return value;
  const text = String(value || "");
  if (!text) return "";
  if (/^bearer\\s+/i.test(text)) return "[redacted:bearer]";
  if (/^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/.test(text)) return "[redacted:jwt]";
  if (text.length > 80) return `[redacted:${text.length}]`;
  return text;
}

function sanitizeParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map((value) => redactParam(value));
}

function shouldExplain(sql) {
  const normalized = String(sql || "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("explain")) return false;
  if (normalized.startsWith("pragma")) return false;
  return normalized.startsWith("select") || normalized.startsWith("with");
}

function wrapStatement(statement, sql, metrics, params) {
  const runWithTiming = async (action, runner) => {
    const startedAt = Date.now();
    try {
      return await runner();
    } finally {
      const duration = Date.now() - startedAt;
      metrics.dbMs += duration;
      const entry = {
        sql: String(sql || ""),
        params: Array.isArray(params) ? params : [],
        safeParams: sanitizeParams(params),
        duration,
        action,
      };
      metrics.queries.push(entry);
      if (!metrics.slowest || duration > metrics.slowest.duration) {
        metrics.slowest = entry;
      }
      if (duration > metrics.slowQueryMs) {
        metrics.slowQueries.push(entry);
      }
    }
  };

  return {
    bind(...nextParams) {
      return wrapStatement(statement.bind(...nextParams), sql, metrics, nextParams);
    },
    run() {
      return runWithTiming("run", () => statement.run());
    },
    all() {
      return runWithTiming("all", () => statement.all());
    },
    first() {
      return runWithTiming("first", () => statement.first());
    },
  };
}

function wrapDb(db, metrics) {
  if (!db || typeof db.prepare !== "function") return db;
  return {
    prepare(sql) {
      return wrapStatement(db.prepare(sql), sql, metrics, []);
    },
  };
}

async function logSlowQueries(metrics, totalMs) {
  if (!isDevEnv(metrics.env)) return;
  if (!metrics.slowQueries.length) return;
  const total = formatDuration(totalMs);
  const dbMs = formatDuration(metrics.dbMs);
  metrics.slowQueries.forEach((entry) => {
    const payload = {
      endpoint: metrics.endpoint,
      query_ms: formatDuration(entry.duration),
      db_ms: dbMs,
      total_ms: total,
      sql: entry.sql,
      params: entry.safeParams,
    };
    console.log(`[SLOW_QUERY] ${JSON.stringify(payload)}`);
  });
}

async function logExplainPlan(metrics, db) {
  if (!isDevEnv(metrics.env)) return;
  if (!db || typeof db.prepare !== "function") return;
  const candidates = metrics.queries.filter((entry) => shouldExplain(entry.sql));
  if (!candidates.length) return;
  const target = candidates.reduce((current, entry) => {
    if (!current || entry.duration > current.duration) return entry;
    return current;
  }, null);
  if (!target) return;
  try {
    const explainSql = `EXPLAIN QUERY PLAN ${target.sql}`;
    const result = await db.prepare(explainSql).bind(...(target.params || [])).all();
    const rows = result && Array.isArray(result.results) ? result.results : [];
    const payload = {
      endpoint: metrics.endpoint,
      query_ms: formatDuration(target.duration),
      sql: target.sql,
      params: target.safeParams,
      plan: rows,
    };
    console.log(`[QUERY_PLAN] ${JSON.stringify(payload)}`);
  } catch (error) {
    console.log(
      `[QUERY_PLAN] ${JSON.stringify({
        endpoint: metrics.endpoint,
        error: String((error && error.message) || error),
      })}`
    );
  }
}

export function createRequestTiming(env, endpoint, options = {}) {
  const slowQueryMs = Number.isFinite(options.slowQueryMs) ? options.slowQueryMs : DEFAULT_SLOW_QUERY_MS;
  const metrics = {
    env,
    endpoint: endpoint || "",
    slowQueryMs,
    startedAt: Date.now(),
    dbMs: 0,
    queries: [],
    slowQueries: [],
    slowest: null,
  };

  return {
    wrapDb(db) {
      return wrapDb(db, metrics);
    },
    async finalize(response, db) {
      const totalMs = Date.now() - metrics.startedAt;
      if (response && response.headers && typeof response.headers.set === "function") {
        response.headers.set(
          "Server-Timing",
          `db;dur=${formatDuration(metrics.dbMs)}, total;dur=${formatDuration(totalMs)}`
        );
      }
      await logSlowQueries(metrics, totalMs);
      await logExplainPlan(metrics, db);
      return response;
    },
  };
}
