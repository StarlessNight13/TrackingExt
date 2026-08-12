import type { TrackedTab } from "../types";
import { getApiClient } from "../api";
import { isServerSyncActive } from "../sync-modes";
import { getLocalState, setLocalState } from "../storage";

export function mergeTabsByRecency(serverTabs: TrackedTab[], localTabs: TrackedTab[]): TrackedTab[] {
  const byId = new Map<string, TrackedTab>();

  for (const tab of serverTabs) {
    byId.set(tab.id, tab);
  }

  for (const local of localTabs) {
    const existing = byId.get(local.id);
    if (!existing) {
      byId.set(local.id, local);
      continue;
    }
    if (new Date(local.lastUpdatedAt).getTime() > new Date(existing.lastUpdatedAt).getTime()) {
      byId.set(local.id, local);
    }
  }

  return [...byId.values()].toSorted(
    (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
  );
}

export function isLocalTrackedTabId(tabId: string) {
  return tabId.startsWith("local_tab_");
}

export async function promoteLocalTabsToServer(): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  const state = await getLocalState();

  if (!isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) || !state.deviceId) {
    return idMap;
  }

  const localTabs = state.cachedTabs.filter((tab) => isLocalTrackedTabId(tab.id));
  if (localTabs.length === 0) return idMap;

  const api = await getApiClient();
  const promotedTabs = new Map<string, TrackedTab>();

  for (const tab of localTabs) {
    try {
      const created = await api.trackedTabs.create({
        deviceId: state.deviceId,
        name: tab.name,
        emoji: tab.emoji ?? undefined,
        url: tab.currentUrl,
        title: tab.currentTitle,
      });
      idMap.set(tab.id, created.id);
      promotedTabs.set(tab.id, created);
    } catch {
      // keep local tab if server rejects
    }
  }

  if (idMap.size === 0) return idMap;

  const latest = await getLocalState();
  const bindings = { ...latest.bindings };
  for (const [browserTabId, trackedTabId] of Object.entries(bindings)) {
    const promotedId = idMap.get(trackedTabId);
    if (promotedId) bindings[browserTabId] = promotedId;
  }

  const localHistory = { ...latest.localHistory };
  for (const [oldId, newId] of idMap) {
    if (localHistory[oldId]) {
      localHistory[newId] = localHistory[oldId];
      delete localHistory[oldId];
    }
  }

  const cachedTabs: TrackedTab[] = [];
  for (const tab of latest.cachedTabs) {
    const promoted = promotedTabs.get(tab.id);
    if (promoted) {
      cachedTabs.push(promoted);
      continue;
    }
    if (!idMap.has(tab.id)) {
      cachedTabs.push(tab);
    }
  }

  await setLocalState({
    bindings,
    localHistory,
    cachedTabs: mergeTabsByRecency(cachedTabs, []),
  });

  return idMap;
}

export async function pullServerTabsMergedWithLocal(): Promise<TrackedTab[]> {
  const state = await getLocalState();
  if (!isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    return state.cachedTabs;
  }

  await promoteLocalTabsToServer();

  const api = await getApiClient();
  const serverTabs = await api.trackedTabs.list();
  const refreshed = await getLocalState();
  const remainingLocal = refreshed.cachedTabs.filter((tab) => isLocalTrackedTabId(tab.id));
  const merged = mergeTabsByRecency(serverTabs, remainingLocal);
  await setLocalState({ cachedTabs: merged });
  return merged;
}
