import type { TrackedTab } from "../types";
import { isServerSyncActive } from "../sync-modes";
import { getEffectiveDeviceId, getEffectiveDeviceName } from "../local-device";
import { getApiClient } from "../api";
import { getLocalState, setLocalState } from "../storage";
import {
  createOfflineTab,
  deleteOfflineTab,
  mergeOfflineTabFromPeer,
  renameOfflineTab,
  takeOverOfflineTab,
  updateOfflineTabLocation,
} from "./offline-store";
import { broadcastLanTabEvent } from "../lan-sync/broadcast";
import { isLocalTrackedTabId, promoteLocalTabsToServer } from "./server-bridge";

export async function syncDeleteTabFromPeer(tabId: string) {
  const state = await getLocalState();

  const bindings = { ...state.bindings };
  for (const [browserTabId, trackedTabId] of Object.entries(bindings)) {
    if (trackedTabId === tabId) delete bindings[browserTabId];
  }

  await deleteOfflineTab(tabId);

  if (
    isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) &&
    !isLocalTrackedTabId(tabId)
  ) {
    try {
      const api = await getApiClient();
      await api.trackedTabs.delete({ id: tabId });
    } catch {
      // peer may have deleted a tab we never had on server
    }
  }

  const localHistory = { ...state.localHistory };
  delete localHistory[tabId];

  await setLocalState({
    bindings,
    localHistory,
    cachedTabs: state.cachedTabs.filter((t) => t.id !== tabId),
  });
}

export async function syncCreateTab(input: {
  name: string;
  emoji?: string | null;
  url: string;
  title?: string | null;
}): Promise<TrackedTab> {
  const state = await getLocalState();
  const deviceId = await getEffectiveDeviceId();
  const deviceName = await getEffectiveDeviceName();
  let tab: TrackedTab | null = null;

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) && state.deviceId) {
    const api = await getApiClient();
    tab = await api.trackedTabs.create({
      deviceId: state.deviceId,
      name: input.name,
      emoji: input.emoji ?? undefined,
      url: input.url,
      title: input.title ?? null,
    });
    await setLocalState({ cachedTabs: mergeTabList(await getLocalState(), tab) });
  } else if (state.syncModes.offline || state.syncModes.lan) {
    tab = await createOfflineTab({
      deviceId,
      deviceName,
      name: input.name,
      emoji: input.emoji,
      url: input.url,
      title: input.title,
    });
  }

  if (!tab) {
    throw new Error("No sync mode available to create tab");
  }

  if (state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_created", tab });
  }

  return tab;
}

export async function syncUpdateTabLocation(input: {
  tabId: string;
  url: string;
  title?: string | null;
}): Promise<TrackedTab | null> {
  const state = await getLocalState();
  const deviceId = await getEffectiveDeviceId();
  const deviceName = await getEffectiveDeviceName();
  let tab: TrackedTab | null = null;
  const isLocalTab = input.tabId.startsWith("local_");

  if (state.syncModes.offline || state.syncModes.lan || isLocalTab) {
    tab = await updateOfflineTabLocation({
      tabId: input.tabId,
      deviceId,
      deviceName,
      url: input.url,
      title: input.title,
    });
  }

  if (
    isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) &&
    state.deviceId &&
    !isLocalTab
  ) {
    try {
      const api = await getApiClient();
      const result = await api.trackedTabs.updateLocation({
        id: input.tabId,
        deviceId: state.deviceId,
        url: input.url,
        title: input.title ?? null,
      });
      if (!result.skipped) {
        tab = result.tab;
        await setLocalState({
          cachedTabs: mergeTabList(await getLocalState(), tab),
        });
      }
    } catch {
      // ownership conflict — keep local result
    }
  }

  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }

  return tab;
}

export async function syncRenameTab(
  tabId: string,
  name: string,
  emoji?: string | null,
): Promise<TrackedTab | null> {
  const state = await getLocalState();
  let tab = await renameOfflineTab(tabId, name, emoji);

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    const api = await getApiClient();
    tab = await api.trackedTabs.rename({ id: tabId, name, emoji });
    await setLocalState({
      cachedTabs: mergeTabList(await getLocalState(), tab),
    });
  }

  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }

  return tab;
}

export async function syncDeleteTab(tabId: string) {
  const state = await getLocalState();
  await deleteOfflineTab(tabId);

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    const api = await getApiClient();
    await api.trackedTabs.delete({ id: tabId });
  }

  await setLocalState({
    cachedTabs: (await getLocalState()).cachedTabs.filter((t) => t.id !== tabId),
  });

  if (state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_deleted", tabId });
  }
}

export async function syncTakeOver(tabId: string): Promise<TrackedTab | null> {
  const state = await getLocalState();
  const deviceId = await getEffectiveDeviceId();
  const deviceName = await getEffectiveDeviceName();
  let tab = await takeOverOfflineTab(tabId, deviceId, deviceName);

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken) && state.deviceId) {
    const api = await getApiClient();
    tab = await api.trackedTabs.takeOver({ id: tabId, deviceId: state.deviceId });
    await setLocalState({
      cachedTabs: mergeTabList(await getLocalState(), tab),
    });
  }

  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }

  return tab;
}

export async function applyPeerTabUpdate(tab: TrackedTab) {
  const state = await getLocalState();
  if (state.syncModes.offline || state.syncModes.lan) {
    await mergeOfflineTabFromPeer(tab);
  } else {
    await setLocalState({
      cachedTabs: mergeTabList(state, tab),
    });
  }

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    await promoteLocalTabsToServer();
  }
}

function mergeTabList(state: { cachedTabs: TrackedTab[] }, tab: TrackedTab) {
  const exists = state.cachedTabs.some((t) => t.id === tab.id);
  return exists ? state.cachedTabs.map((t) => (t.id === tab.id ? tab : t)) : [tab, ...state.cachedTabs];
}
