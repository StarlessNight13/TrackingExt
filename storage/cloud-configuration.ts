import { normalizeCloudDatabaseUrl } from "../lib/cloud-db/spike";
import { bootstrapDatabase } from "../db/bootstrap";
import {
  DEFAULT_CLOUD_SYNC_POLICY,
  migrateCloudSyncPolicy,
  type CloudSyncPolicy,
  type DatabaseProvider,
  withDatabaseClient,
} from "../services/database-service";

export type CloudConfiguration = {
  provider: DatabaseProvider;
  url: string;
  workspaceId: string;
  deviceId: string;
  tokenPersistence: "persistent" | "session";
  behavior: CloudSyncPolicy;
};

const CONFIG_KEY = "cloudConfiguration";
const TOKEN_KEY = "cloudDatabaseToken";

export type CloudStatus = {
  state: "disconnected" | "idle" | "syncing" | "error";
  lastSyncAt: number | null;
  lastError: string | null;
};

const STATUS_KEY = "cloudStatus";

export async function getCloudCredentials() {
  const local = await browser.storage.local.get([CONFIG_KEY, TOKEN_KEY]);
  const configuration = local[CONFIG_KEY] as CloudConfiguration | undefined;
  if (!configuration) return null;
  const session = await browser.storage.session?.get(TOKEN_KEY);
  const token =
    configuration.tokenPersistence === "session" ? session?.[TOKEN_KEY] : local[TOKEN_KEY];
  return typeof token === "string" && token
    ? {
        ...configuration,
        provider: configuration.provider ?? "libsql",
        behavior: migrateCloudSyncPolicy(configuration.behavior),
        url: normalizeCloudDatabaseUrl(configuration.url),
        authToken: token,
      }
    : null;
}

export async function configureCloudDatabase(input: {
  url: string;
  authToken: string;
  tokenPersistence: CloudConfiguration["tokenPersistence"];
  deviceId?: string;
  deviceName: string;
  browser: string;
  provider?: DatabaseProvider;
  behavior?: CloudSyncPolicy;
}) {
  const url = normalizeCloudDatabaseUrl(input.url);
  const authToken = input.authToken.trim();
  if (!authToken) throw new Error("Enter an access token");
  const provider = input.provider ?? "libsql";
  const bootstrap = await withDatabaseClient(
    { provider, url, authToken },
    "connect",
    async (client) => {
      await client.execute("SELECT 1");
      return bootstrapDatabase(client, input);
    },
  );

  const configuration: CloudConfiguration = {
    provider,
    url,
    workspaceId: bootstrap.workspaceId,
    deviceId: bootstrap.deviceId,
    tokenPersistence: input.tokenPersistence,
    behavior: migrateCloudSyncPolicy(input.behavior ?? DEFAULT_CLOUD_SYNC_POLICY),
  };
  await Promise.all([
    browser.storage.local.set({
      [CONFIG_KEY]: configuration,
      [STATUS_KEY]: { state: "idle", lastSyncAt: null, lastError: null } satisfies CloudStatus,
      ...(input.tokenPersistence === "persistent" ? { [TOKEN_KEY]: authToken } : {}),
    }),
    input.tokenPersistence === "session"
      ? browser.storage.session.set({ [TOKEN_KEY]: authToken })
      : browser.storage.session.remove(TOKEN_KEY),
  ]);
  if (input.tokenPersistence === "session") await browser.storage.local.remove(TOKEN_KEY);
  return configuration;
}

export async function disconnectCloudDatabase() {
  await Promise.all([
    browser.storage.local.remove([CONFIG_KEY, TOKEN_KEY]),
    browser.storage.session.remove(TOKEN_KEY),
  ]);
  await setCloudStatus({ state: "disconnected", lastSyncAt: null, lastError: null });
}

export async function updateDatabaseBehavior(behavior: CloudSyncPolicy) {
  const stored = await browser.storage.local.get(CONFIG_KEY);
  const configuration = stored[CONFIG_KEY] as CloudConfiguration | undefined;
  if (!configuration) throw new Error("Connect a database first");
  await browser.storage.local.set({
    [CONFIG_KEY]: { ...configuration, behavior: migrateCloudSyncPolicy(behavior) },
  });
}

export async function getCloudSummary() {
  const [stored, session] = await Promise.all([
    browser.storage.local.get([CONFIG_KEY, STATUS_KEY, TOKEN_KEY]),
    browser.storage.session.get(TOKEN_KEY),
  ]);
  const configuration = stored[CONFIG_KEY] as CloudConfiguration | undefined;
  const status = (stored[STATUS_KEY] as CloudStatus | undefined) ?? {
    state: configuration ? "idle" : "disconnected",
    lastSyncAt: null,
    lastError: null,
  };
  const hasToken = configuration
    ? configuration.tokenPersistence === "session"
      ? typeof session[TOKEN_KEY] === "string"
      : typeof stored[TOKEN_KEY] === "string"
    : false;
  return {
    configuration:
      configuration == null
        ? null
        : {
            ...configuration,
            behavior: migrateCloudSyncPolicy(configuration.behavior),
          },
    status:
      configuration && !hasToken
        ? {
            state: "error" as const,
            lastSyncAt: status.lastSyncAt,
            lastError: "Session token expired. Enter a database token to reconnect.",
          }
        : status,
  };
}

export async function setCloudStatus(status: CloudStatus) {
  await browser.storage.local.set({ [STATUS_KEY]: status });
}
