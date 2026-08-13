import {
  canAccessLocalStorage,
  clearAuthStateViaBridge,
  getLocalStateViaBridge,
  setLocalStateViaBridge,
} from "./storage-bridge";
import {
  DEFAULT_LOCAL_STATE,
  type LanSignalingMode,
  type LocalState,
  type SyncModes,
} from "./types";
import { resolveLanSignalingMode } from "./sync-modes";

const KEYS = [
  "serverUrl",
  "sessionToken",
  "deviceId",
  "deviceName",
  "localDeviceId",
  "syncModes",
  "lanSignalingMode",
  "onboardingComplete",
  "pairedLanDevices",
  "localHistory",
  "bindings",
  "cachedTabs",
  "settings",
  "pendingReconnect",
  "queuedLocationUpdates",
] as const satisfies readonly (keyof LocalState)[];

function parseSyncModes(raw: unknown): SyncModes {
  if (!raw || typeof raw !== "object") return DEFAULT_LOCAL_STATE.syncModes;
  const parsed = raw as Partial<SyncModes>;
  return {
    offline: Boolean(parsed.offline),
    lan: Boolean(parsed.lan),
    server:
      parsed.server !== undefined ? Boolean(parsed.server) : DEFAULT_LOCAL_STATE.syncModes.server,
  };
}

function migrateLegacyState(stored: Record<string, unknown>): Partial<LocalState> {
  const patch: Partial<LocalState> = {};

  if (stored.syncModes === undefined) {
    const hasServer = typeof stored.serverUrl === "string" && stored.serverUrl.length > 0;
    patch.syncModes = hasServer
      ? { offline: false, lan: false, server: true }
      : DEFAULT_LOCAL_STATE.syncModes;
    patch.onboardingComplete = hasServer || Boolean(stored.sessionToken);
  }

  if (stored.onboardingComplete === undefined && patch.onboardingComplete === undefined) {
    patch.onboardingComplete = false;
  }

  if (stored.pairedLanDevices === undefined) {
    patch.pairedLanDevices = [];
  }

  if (stored.localHistory === undefined) {
    patch.localHistory = {};
  }

  if (stored.localDeviceId === undefined) {
    patch.localDeviceId = null;
  }

  if (stored.queuedLocationUpdates === undefined) {
    patch.queuedLocationUpdates = {};
  }

  if (stored.lanSignalingMode === undefined) {
    const syncModes = parseSyncModes(stored.syncModes ?? patch.syncModes);
    patch.lanSignalingMode = resolveLanSignalingMode(syncModes);
  }

  return patch;
}

function parseLanSignalingMode(raw: unknown, syncModes: SyncModes): LanSignalingMode {
  if (raw === "local" || raw === "server-relay") return raw;
  return resolveLanSignalingMode(syncModes);
}

export async function getLocalState(): Promise<LocalState> {
  if (!canAccessLocalStorage()) {
    return getLocalStateViaBridge();
  }

  const stored = await browser.storage.local.get([...KEYS]);
  const migration = migrateLegacyState(stored);

  if (Object.keys(migration).length > 0) {
    await browser.storage.local.set(migration);
  }

  return {
    serverUrl:
      typeof stored.serverUrl === "string" ? stored.serverUrl : DEFAULT_LOCAL_STATE.serverUrl,
    sessionToken:
      typeof stored.sessionToken === "string"
        ? stored.sessionToken
        : DEFAULT_LOCAL_STATE.sessionToken,
    deviceId: typeof stored.deviceId === "string" ? stored.deviceId : DEFAULT_LOCAL_STATE.deviceId,
    deviceName:
      typeof stored.deviceName === "string" ? stored.deviceName : DEFAULT_LOCAL_STATE.deviceName,
    localDeviceId:
      typeof stored.localDeviceId === "string"
        ? stored.localDeviceId
        : (migration.localDeviceId ?? DEFAULT_LOCAL_STATE.localDeviceId),
    syncModes: parseSyncModes(stored.syncModes ?? migration.syncModes),
    lanSignalingMode: parseLanSignalingMode(
      stored.lanSignalingMode ?? migration.lanSignalingMode,
      parseSyncModes(stored.syncModes ?? migration.syncModes),
    ),
    onboardingComplete:
      typeof stored.onboardingComplete === "boolean"
        ? stored.onboardingComplete
        : Boolean(migration.onboardingComplete),
    pairedLanDevices: Array.isArray(stored.pairedLanDevices)
      ? (stored.pairedLanDevices as LocalState["pairedLanDevices"])
      : (migration.pairedLanDevices ?? []),
    localHistory:
      stored.localHistory && typeof stored.localHistory === "object"
        ? (stored.localHistory as Record<string, LocalState["localHistory"][string]>)
        : (migration.localHistory ?? {}),
    bindings:
      stored.bindings && typeof stored.bindings === "object"
        ? (stored.bindings as Record<string, string>)
        : {},
    cachedTabs: Array.isArray(stored.cachedTabs)
      ? (stored.cachedTabs as LocalState["cachedTabs"])
      : [],
    settings:
      stored.settings && typeof stored.settings === "object"
        ? { ...DEFAULT_LOCAL_STATE.settings, ...(stored.settings as LocalState["settings"]) }
        : DEFAULT_LOCAL_STATE.settings,
    pendingReconnect: Array.isArray(stored.pendingReconnect)
      ? (stored.pendingReconnect as LocalState["pendingReconnect"])
      : [],
    queuedLocationUpdates:
      stored.queuedLocationUpdates && typeof stored.queuedLocationUpdates === "object"
        ? (stored.queuedLocationUpdates as LocalState["queuedLocationUpdates"])
        : (migration.queuedLocationUpdates ?? {}),
  };
}

export async function setLocalState(patch: Partial<LocalState>): Promise<LocalState> {
  if (!canAccessLocalStorage()) {
    return setLocalStateViaBridge(patch);
  }

  await browser.storage.local.set(patch);
  return getLocalState();
}

export async function clearAuthState() {
  if (!canAccessLocalStorage()) {
    await clearAuthStateViaBridge();
    return;
  }

  await browser.storage.local.set({
    sessionToken: null,
    deviceId: null,
    cachedTabs: [],
    bindings: {},
    pendingReconnect: [],
  });
}
