export interface Env {
  DB: D1Database;
  TABTETHER_TOKEN?: string;
  TRACKINGEXT_TOKEN?: string;
}

type Statement = string | { sql: string; args?: unknown[] };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function prepared(db: D1Database, statement: Statement) {
  return db.prepare(typeof statement === "string" ? statement : statement.sql).bind(
    ...(typeof statement === "string" ? [] : statement.args ?? []),
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const token = env.TABTETHER_TOKEN ?? env.TRACKINGEXT_TOKEN;
    if (request.method !== "POST" || !token || request.headers.get("Authorization") !== `Bearer ${token}`)
      return json({ error: "Unauthorized" }, 401);
    try {
      const { statements } = (await request.json()) as { statements?: Statement[] };
      if (!Array.isArray(statements) || !statements.length) return json({ error: "Statements required" }, 400);
      const results = request.url.endsWith("/batch")
        ? await env.DB.batch(statements.map((statement) => prepared(env.DB, statement)))
        : [await prepared(env.DB, statements[0]!).run()];
      return json({
        results: results.map((result) => ({ rows: result.results ?? [], rowsAffected: result.meta.changes })),
      });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "D1 query failed" }, 400);
    }
  },
} satisfies ExportedHandler<Env>;
