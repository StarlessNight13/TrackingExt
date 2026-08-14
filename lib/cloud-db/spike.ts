import { createClient, type Client, type InValue } from "@libsql/client/web";

export type CloudDatabaseCredentials = {
  url: string;
  authToken: string;
};

export type CloudDatabaseSpikeResult = {
  endpoint: string;
  queryCount: number;
  durationMs: number;
  select: true;
  ddl: true;
  transactionalBatch: true;
  conditionalUpdate: true;
  clientRecreation: true;
};

const PROBE_TABLE = "__trackingext_phase0_probe";

export function normalizeCloudDatabaseUrl(value: string): string {
  const input = value.trim();
  if (!input) throw new Error("Enter a database URL");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid database URL");
  }

  const local =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (
    url.protocol !== "https:" &&
    url.protocol !== "libsql:" &&
    !(local && url.protocol === "http:")
  ) {
    throw new Error("Database URLs must use HTTPS (HTTP is allowed only for localhost)");
  }
  url.username = "";
  url.password = "";
  return url.toString().replace(/\/$/, "");
}

function connect(credentials: CloudDatabaseCredentials): Client {
  const url = normalizeCloudDatabaseUrl(credentials.url);
  const authToken = credentials.authToken.trim();
  if (!authToken && !url.startsWith("http://")) {
    throw new Error("Enter a database-scoped token");
  }
  return createClient({ url, authToken: authToken || undefined });
}

export async function runCloudDatabaseSpike(
  credentials: CloudDatabaseCredentials,
): Promise<CloudDatabaseSpikeResult> {
  const startedAt = performance.now();
  const operationId = crypto.randomUUID();
  let queryCount = 0;
  const execute = async (client: Client, sql: string, args: InValue[] = []) => {
    queryCount += 1;
    return client.execute({ sql, args });
  };

  const client = connect(credentials);
  await execute(client, "SELECT 1 AS connected");
  queryCount += 3;
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS ${PROBE_TABLE} (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL)`,
      { sql: `DELETE FROM ${PROBE_TABLE} WHERE id = ?`, args: [operationId] },
      {
        sql: `INSERT INTO ${PROBE_TABLE} (id, revision, value) VALUES (?, 1, 'created')`,
        args: [operationId],
      },
    ],
    "write",
  );

  const updated = await execute(
    client,
    `UPDATE ${PROBE_TABLE} SET value = 'updated', revision = revision + 1 WHERE id = ? AND revision = 1`,
    [operationId],
  );
  if (updated.rowsAffected !== 1) throw new Error("Conditional update did not affect one row");

  const stale = await execute(
    client,
    `UPDATE ${PROBE_TABLE} SET value = 'stale' WHERE id = ? AND revision = 1`,
    [operationId],
  );
  if (stale.rowsAffected !== 0) throw new Error("Stale conditional update was not rejected");
  client.close();

  const recreated = connect(credentials);
  const readBack = await execute(
    recreated,
    `SELECT revision, value FROM ${PROBE_TABLE} WHERE id = ?`,
    [operationId],
  );
  const row = readBack.rows[0];
  if (Number(row?.revision) !== 2 || row?.value !== "updated") {
    throw new Error("Recreated client could not read the committed result");
  }
  await execute(recreated, `DELETE FROM ${PROBE_TABLE} WHERE id = ?`, [operationId]);
  recreated.close();

  return {
    endpoint: normalizeCloudDatabaseUrl(credentials.url),
    queryCount,
    durationMs: Math.round(performance.now() - startedAt),
    select: true,
    ddl: true,
    transactionalBatch: true,
    conditionalUpdate: true,
    clientRecreation: true,
  };
}
