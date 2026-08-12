import { DEFAULT_LOCAL_STATE, type LocalState, type PrivacySettings, type TrackedTab } from "./types";

const KEYS = [
  "serverUrl",
  "sessionToken",
  "deviceId",
  "deviceName",
  "bindings",
  "cachedTabs",
  "settings",
  "pendingReconnect",
] as const satisfies readonly (keyof LocalState)[];

export async function getLocalState(): Promise<LocalState> {
  const stored = await browser.storage.local.get([...KEYS]);
  return {
    serverUrl:
      typeof stored.serverUrl === "string" ? stored.serverUrl : DEFAULT_LOCAL_STATE.serverUrl,
    sessionToken:
      typeof stored.sessionToken === "string" ? stored.sessionToken : DEFAULT_LOCAL_STATE.sessionToken,
    deviceId: typeof stored.deviceId === "string" ? stored.deviceId : DEFAULT_LOCAL_STATE.deviceId,
    deviceName:
      typeof stored.deviceName === "string" ? stored.deviceName : DEFAULT_LOCAL_STATE.deviceName,
    bindings:
      stored.bindings && typeof stored.bindings === "object"
        ? (stored.bindings as Record<string, string>)
        : {},
    cachedTabs: Array.isArray(stored.cachedTabs) ? (stored.cachedTabs as TrackedTab[]) : [],
    settings:
      stored.settings && typeof stored.settings === "object"
        ? ({ ...DEFAULT_LOCAL_STATE.settings, ...(stored.settings as PrivacySettings) } as PrivacySettings)
        : DEFAULT_LOCAL_STATE.settings,
    pendingReconnect: Array.isArray(stored.pendingReconnect)
      ? (stored.pendingReconnect as LocalState["pendingReconnect"])
      : [],
  };
}

export async function setLocalState(patch: Partial<LocalState>): Promise<LocalState> {
  await browser.storage.local.set(patch);
  return getLocalState();
}

export async function clearAuthState() {
  await browser.storage.local.set({
    sessionToken: null,
    deviceId: null,
    cachedTabs: [],
    bindings: {},
    pendingReconnect: [],
  });
}
