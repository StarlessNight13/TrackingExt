import type { HistoryEntry, TrackedTab } from "../types";
import { buildLocalDeviceRef } from "../local-device";
import { detectBrowser } from "../device";
import { getLocalState, setLocalState } from "../storage";

function nowIso() {
  return new Date().toISOString();
}

function createLocalTabId() {
  return `local_tab_${crypto.randomUUID()}`;
}

function createHistoryId() {
  return `local_hist_${crypto.randomUUID()}`;
}

export async function listOfflineTabs(): Promise<TrackedTab[]> {
  const state = await getLocalState();
  return state.cachedTabs;
}

export async function createOfflineTab(input: {
  deviceId: string;
  deviceName: string;
  name: string;
  emoji?: string | null;
  url: string;
  title?: string | null;
}): Promise<TrackedTab> {
  const now = nowIso();
  const tab: TrackedTab = {
    id: createLocalTabId(),
    name: input.name,
    emoji: input.emoji ?? null,
    tags: [],
    currentUrl: input.url,
    currentTitle: input.title ?? null,
    activeDeviceId: input.deviceId,
    lastUpdatedDeviceId: input.deviceId,
    lastUpdatedAt: now,
    createdAt: now,
    archivedAt: null,
    activeDevice: buildLocalDeviceRef(input.deviceId, input.deviceName),
    lastUpdatedDevice: buildLocalDeviceRef(input.deviceId, input.deviceName),
  };

  const state = await getLocalState();
  const history = { ...state.localHistory };
  if (state.settings.recordHistory) {
    const entries = history[tab.id] ?? [];
    history[tab.id] = [
      {
        id: createHistoryId(),
        url: input.url,
        title: input.title ?? null,
        visitedAt: now,
      },
      ...entries,
    ].slice(0, 200);
  }

  await setLocalState({
    cachedTabs: [tab, ...state.cachedTabs],
    localHistory: history,
  });

  return tab;
}

export async function updateOfflineTabLocation(input: {
  tabId: string;
  deviceId: string;
  deviceName: string;
  url: string;
  title?: string | null;
}): Promise<TrackedTab | null> {
  const state = await getLocalState();
  const tab = state.cachedTabs.find((t) => t.id === input.tabId);
  if (!tab) return null;

  if (tab.activeDeviceId && tab.activeDeviceId !== input.deviceId) {
    return tab;
  }

  const now = nowIso();
  const urlChanged = tab.currentUrl !== input.url;
  const updated: TrackedTab = {
    ...tab,
    currentUrl: input.url,
    currentTitle: input.title ?? tab.currentTitle,
    activeDeviceId: input.deviceId,
    lastUpdatedDeviceId: input.deviceId,
    lastUpdatedAt: now,
    activeDevice: buildLocalDeviceRef(input.deviceId, input.deviceName),
    lastUpdatedDevice: buildLocalDeviceRef(input.deviceId, input.deviceName),
  };

  const history = { ...state.localHistory };
  if (state.settings.recordHistory && urlChanged) {
    const entries = history[input.tabId] ?? [];
    history[input.tabId] = [
      {
        id: createHistoryId(),
        url: input.url,
        title: input.title ?? null,
        visitedAt: now,
      },
      ...entries,
    ].slice(0, 200);
  }

  await setLocalState({
    cachedTabs: state.cachedTabs.map((t) => (t.id === input.tabId ? updated : t)),
    localHistory: history,
  });

  return updated;
}

export async function renameOfflineTab(
  tabId: string,
  name: string,
  emoji?: string | null,
): Promise<TrackedTab | null> {
  const state = await getLocalState();
  const tab = state.cachedTabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const updated: TrackedTab = {
    ...tab,
    name,
    ...(emoji !== undefined ? { emoji } : {}),
    lastUpdatedAt: nowIso(),
  };

  await setLocalState({
    cachedTabs: state.cachedTabs.map((t) => (t.id === tabId ? updated : t)),
  });

  return updated;
}

export async function deleteOfflineTab(tabId: string) {
  const state = await getLocalState();
  const { [tabId]: _removed, ...restHistory } = state.localHistory;
  await setLocalState({
    cachedTabs: state.cachedTabs.filter((t) => t.id !== tabId),
    localHistory: restHistory,
  });
}

export async function takeOverOfflineTab(tabId: string, deviceId: string, deviceName: string) {
  const state = await getLocalState();
  const tab = state.cachedTabs.find((t) => t.id === tabId);
  if (!tab) return null;

  const updated: TrackedTab = {
    ...tab,
    activeDeviceId: deviceId,
    lastUpdatedDeviceId: deviceId,
    lastUpdatedAt: nowIso(),
    activeDevice: buildLocalDeviceRef(deviceId, deviceName),
    lastUpdatedDevice: buildLocalDeviceRef(deviceId, deviceName),
  };

  await setLocalState({
    cachedTabs: state.cachedTabs.map((t) => (t.id === tabId ? updated : t)),
  });

  return updated;
}

export async function releaseOfflineTab(tabId: string, deviceId: string) {
  const state = await getLocalState();
  const tab = state.cachedTabs.find((t) => t.id === tabId);
  if (!tab || tab.activeDeviceId !== deviceId) return tab ?? null;

  const updated: TrackedTab = { ...tab, activeDeviceId: null, activeDevice: null };
  await setLocalState({
    cachedTabs: state.cachedTabs.map((t) => (t.id === tabId ? updated : t)),
  });
  return updated;
}

export async function getOfflineHistory(tabId: string): Promise<HistoryEntry[]> {
  const state = await getLocalState();
  return state.localHistory[tabId] ?? [];
}

export async function clearOfflineHistory(tabId: string) {
  const state = await getLocalState();
  await setLocalState({
    localHistory: { ...state.localHistory, [tabId]: [] },
  });
}

export async function mergeOfflineTabFromPeer(incoming: TrackedTab) {
  const state = await getLocalState();
  const existing = state.cachedTabs.find((t) => t.id === incoming.id);
  if (existing) {
    if (new Date(incoming.lastUpdatedAt).getTime() <= new Date(existing.lastUpdatedAt).getTime()) {
      return existing;
    }
  }

  const cachedTabs = existing
    ? state.cachedTabs.map((t) => (t.id === incoming.id ? incoming : t))
    : [incoming, ...state.cachedTabs];

  await setLocalState({ cachedTabs });
  return incoming;
}

export { detectBrowser };
