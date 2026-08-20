import { createClient } from "@libsql/client/web";

import type { DatabaseClient, Statement } from "../db/client";
import { appendDatabaseLog } from "../storage/indexed-db";

export type DatabaseProvider = "libsql" | "d1";
export type CloudSyncPolicy = {
  activitySync: boolean;
  scheduledSync: boolean;
  scheduledSyncIntervalMinutes: 2 | 5 | 15 | 30;
};

type LegacyDatabaseBehavior = {
  automaticSync?: boolean;
  syncIntervalMinutes?: 2 | 5 | 15 | 30;
};

export const DEFAULT_CLOUD_SYNC_POLICY: CloudSyncPolicy = {
  activitySync: true,
  scheduledSync: true,
  scheduledSyncIntervalMinutes: 2,
};

export function migrateCloudSyncPolicy(
  value: CloudSyncPolicy | LegacyDatabaseBehavior | undefined | null,
): CloudSyncPolicy {
  if (
    value &&
    "activitySync" in value &&
    "scheduledSync" in value &&
    "scheduledSyncIntervalMinutes" in value
  ) {
    return value;
  }

  if (value && "automaticSync" in value) {
    const interval = value.syncIntervalMinutes ?? DEFAULT_CLOUD_SYNC_POLICY.scheduledSyncIntervalMinutes;
    if (value.automaticSync === false) {
      return {
        activitySync: false,
        scheduledSync: false,
        scheduledSyncIntervalMinutes: interval,
      };
    }
    return {
      activitySync: true,
      scheduledSync: true,
      scheduledSyncIntervalMinutes: interval,
    };
  }

  return DEFAULT_CLOUD_SYNC_POLICY;
}

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
    return await action(client);
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
