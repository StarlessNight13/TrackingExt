import { createClient } from "@libsql/client/web";

import type { DatabaseClient, Statement } from "../db/client";
import { appendDatabaseLog } from "../storage/indexed-db";

export type DatabaseProvider = "libsql" | "d1";
export type DatabaseBehavior = {
  automaticSync: boolean;
  syncIntervalMinutes: 2 | 5 | 15 | 30;
};

export const DEFAULT_DATABASE_BEHAVIOR: DatabaseBehavior = {
  automaticSync: true,
  syncIntervalMinutes: 2,
};

export type DatabaseCredentials = {
  provider: DatabaseProvider;
  url: string;
  authToken: string;
};

type DatabaseAdapter = {
  connect(credentials: DatabaseCredentials): DatabaseClient & { close(): void };
};

type D1Response = {
  results?: Array<{ rows?: Record<string, unknown>[]; rowsAffected?: number }>;
  error?: string;
};

function d1Client({ url, authToken }: DatabaseCredentials): DatabaseClient & { close(): void } {
  const request = async (path: "query" | "batch", statements: unknown[]) => {
    const response = await fetch(`${url}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        statements: statements.map((statement) =>
          typeof statement === "string" ? { sql: statement } : statement,
        ),
      }),
    });
    const body = (await response.json()) as D1Response;
    if (!response.ok || body.error) throw new Error(body.error ?? `D1 Worker returned ${response.status}`);
    return (body.results ?? []).map((result) => ({
      rows: result.rows ?? [],
      rowsAffected: result.rowsAffected ?? 0,
    }));
  };

  return {
    async execute(statement: Statement) {
      const [result] = await request("query", [statement]);
      return result ?? { rows: [], rowsAffected: 0 };
    },
    async batch(statements: Statement[]) {
      return request("batch", statements);
    },
    close() {},
  } as unknown as DatabaseClient & { close(): void };
}

const adapters: Record<DatabaseProvider, DatabaseAdapter> = {
  libsql: {
    connect: ({ url, authToken }) => createClient({ url, authToken }),
  },
  d1: { connect: d1Client },
};

export async function withDatabaseClient<T>(
  credentials: DatabaseCredentials,
  operation: string,
  action: (client: DatabaseClient) => Promise<T>,
) {
  const client = adapters[credentials.provider].connect(credentials);
  try {
    const result = await action(client);
    await appendDatabaseLog({ level: "info", operation, message: "Completed" });
    return result;
  } catch (error) {
    await appendDatabaseLog({
      level: "error",
      operation,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.close();
  }
}
