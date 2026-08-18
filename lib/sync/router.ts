import type { TrackedTab } from "../types";
import type { SeriesTetherPattern, TetherMode } from "../tether-series";
import { getEffectiveDeviceId, getEffectiveDeviceName } from "../local-device";
import { getLocalState, setLocalState } from "../storage";
import {
  createOfflineTab,
  deleteOfflineTab,
  mergeOfflineTabFromPeer,
  renameOfflineTab,
  takeOverOfflineTab,
  updateOfflineTabLocation,
  updateOfflineTabSeriesPattern,
  updateOfflineTabTether,
} from "./offline-store";
import { broadcastLanTabEvent } from "../lan-sync/broadcast";
import { getCloudCredentials } from "../../storage/cloud-configuration";
import {
  createCloudTab,
  deleteCloudTab,
  renameCloudTab,
  takeOverCloudTab,
  updateCloudTabLocation,
} from "../../sync/cloud-tabs";

export async function syncDeleteTabFromPeer(tabId: string) {
  const state = await getLocalState();

  const bindings = { ...state.bindings };
  for (const [browserTabId, trackedTabId] of Object.entries(bindings)) {
    if (trackedTabId === tabId) delete bindings[browserTabId];
  }

  await deleteOfflineTab(tabId);

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
  tetherMode?: TetherMode;
  seriesPattern?: SeriesTetherPattern;
}): Promise<TrackedTab> {
  const state = await getLocalState();
  if (await getCloudCredentials()) {
    const tab = await createCloudTab({ ...input, recordHistory: state.settings.recordHistory });
    if (!tab) throw new Error("Cloud database is not configured");
    if (state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_created", tab });
    return tab;
  }
  const deviceId = await getEffectiveDeviceId();
  const deviceName = await getEffectiveDeviceName();
  let tab: TrackedTab | null = null;

  if (state.syncModes.offline || state.syncModes.lan) {
    tab = await createOfflineTab({
      deviceId,
      deviceName,
      name: input.name,
      emoji: input.emoji,
      url: input.url,
      title: input.title,
      tetherMode: input.tetherMode,
      seriesPattern: input.seriesPattern,
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
  if (await getCloudCredentials()) {
    const tab = await updateCloudTabLocation(
      input.tabId,
      input.url,
      input.title ?? null,
      state.settings.recordHistory,
    );
    if (tab && state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_updated", tab });
    return tab;
  }
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

  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }

  return tab;
}

export async function syncUpdateTabSeriesPattern(input: {
  tabId: string;
  seriesPattern: SeriesTetherPattern;
}): Promise<TrackedTab | null> {
  if (await getCloudCredentials()) {
    const state = await getLocalState();
    return state.cachedTabs.find((tab) => tab.id === input.tabId) ?? null;
  }

  const tab = await updateOfflineTabSeriesPattern(input);
  const state = await getLocalState();
  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }
  return tab;
}

export async function syncUpdateTabTether(input: {
  tabId: string;
  tetherMode: TetherMode;
  seriesPattern?: SeriesTetherPattern;
}): Promise<TrackedTab | null> {
  if (await getCloudCredentials()) {
    const state = await getLocalState();
    const existing = state.cachedTabs.find((tab) => tab.id === input.tabId);
    if (!existing) return null;
    const updated: TrackedTab = {
      ...existing,
      tetherMode: input.tetherMode,
      seriesPattern: input.seriesPattern,
      lastUpdatedAt: new Date().toISOString(),
    };
    await setLocalState({
      cachedTabs: state.cachedTabs.map((tab) => (tab.id === input.tabId ? updated : tab)),
    });
    if (state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_updated", tab: updated });
    return updated;
  }

  const tab = await updateOfflineTabTether(input);
  const state = await getLocalState();
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
  if (await getCloudCredentials()) {
    const tab = await renameCloudTab(tabId, name, emoji);
    if (tab && state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_updated", tab });
    return tab;
  }
  let tab = await renameOfflineTab(tabId, name, emoji);

  if (tab && state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_updated", tab });
  }

  return tab;
}

export async function syncDeleteTab(tabId: string) {
  const state = await getLocalState();
  if (await getCloudCredentials()) {
    await deleteCloudTab(tabId);
    if (state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_deleted", tabId });
    return;
  }
  await deleteOfflineTab(tabId);

  await setLocalState({
    cachedTabs: (await getLocalState()).cachedTabs.filter((t) => t.id !== tabId),
  });

  if (state.syncModes.lan) {
    void broadcastLanTabEvent({ type: "tab_deleted", tabId });
  }
}

export async function syncTakeOver(tabId: string): Promise<TrackedTab | null> {
  const state = await getLocalState();
  if (await getCloudCredentials()) {
    const tab = await takeOverCloudTab(tabId);
    if (tab && state.syncModes.lan) void broadcastLanTabEvent({ type: "tab_updated", tab });
    return tab;
  }
  const deviceId = await getEffectiveDeviceId();
  const deviceName = await getEffectiveDeviceName();
  let tab = await takeOverOfflineTab(tabId, deviceId, deviceName);

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
}

function mergeTabList(state: { cachedTabs: TrackedTab[] }, tab: TrackedTab) {
  const exists = state.cachedTabs.some((t) => t.id === tab.id);
  return exists
    ? state.cachedTabs.map((t) => (t.id === tab.id ? tab : t))
    : [tab, ...state.cachedTabs];
}
