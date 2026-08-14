import { defaultDeviceName, detectBrowser, renameDevice } from "../lib/device";
import {
  callOffscreenLan,
  getLanStatusFromOffscreen,
  reconnectLanPeersViaOffscreen,
  removeLanPeerViaOffscreen,
  syncLanManagerViaOffscreen,
} from "../lib/lan-sync/offscreen-bridge";
import { isOffscreenLanMessage } from "../lib/lan-sync/offscreen-protocol";
import { handleStorageBridgeMessage } from "../lib/storage-bridge-handler";
import { isStorageBridgeMessage } from "../lib/storage-bridge";
import { ensureLocalDeviceId, getEffectiveDeviceId } from "../lib/local-device";
import type { ExtensionRequest, ExtensionResponse, PopupSnapshot } from "../lib/messaging";
import { isTrackableUrl } from "../lib/privacy";
import { clearOfflineHistory, getOfflineHistory } from "../lib/sync/offline-store";
import { isValidSyncModes, resolveLanSignalingMode } from "../lib/sync-modes";
import { getLocalState, setLocalState } from "../lib/storage";
import { supportedSyncModes, supportsLanSync } from "../lib/browser-capabilities";
import { stripTrackedTabBadge } from "../lib/title-badge";
import {
  canUseTrackingFeatures,
  confirmReconnect,
  dismissReconnect,
  handleTabRemoved,
  handleTabUpdate,
  openTrackedTab,
  reconcileRestoredTabs,
  renameTrackedTab,
  stopTracking,
  trackCurrentTab,
  takeOver,
} from "../lib/tracking";
import { runCloudDatabaseSpike } from "../lib/cloud-db/spike";
import { syncCloudDatabase } from "../sync/cloud-sync";
import { cloudTabView } from "../sync/cloud-tabs";
import {
  configureCloudDatabase,
  disconnectCloudDatabase,
  getCloudSummary,
  updateDatabaseBehavior,
} from "../storage/cloud-configuration";
import { createExport, restoreExport } from "../storage/export";
import {
  clearDatabaseLogs,
  getSyncStoreSummary,
  listCachedTabs,
  listConflicts,
  listDatabaseLogs,
} from "../storage/indexed-db";
import type { PrivacySettings, SyncModes } from "../lib/types";
import {
  clearCloudHistory,
  assignCloudTab,
  deleteCloudGroup,
  getCloudHistory,
  listCloudDevices,
  listCloudGroups,
  removeCloudDevice,
  renameCloudDevice,
  saveCloudGroup,
  updateCloudSettings,
} from "../db/cloud-management";
import { getCloudCredentials } from "../storage/cloud-configuration";

async function runFullSync() {
  await syncCloudDatabase({ manual: true });
  const state = await getLocalState();
  if (state.syncModes.lan) {
    await reconnectLanPeersViaOffscreen();
  }
}

async function disableUnsupportedLanSync() {
  if (supportsLanSync) return;

  const state = await getLocalState();
  const syncModes = supportedSyncModes(state.syncModes);
  if (syncModes.lan !== state.syncModes.lan || syncModes.offline !== state.syncModes.offline) {
    await setLocalState({ syncModes });
  }
}

async function buildSnapshot(): Promise<PopupSnapshot> {
  const state = await getLocalState();
  const [effectiveDeviceId, lanStatus, activeTabs, cloud, cloudStore, cloudTabs] =
    await Promise.all([
      getEffectiveDeviceId(),
      getLanStatusFromOffscreen(state.pairedLanDevices.map((device) => device.deviceId)),
      browser.tabs.query({ active: true, currentWindow: true }),
      getCloudSummary(),
      getSyncStoreSummary(),
      listCachedTabs(),
    ]);
  const displayedTabs = cloud.configuration
    ? cloudTabs.filter((tab) => !tab.deletedAt).map(cloudTabView)
    : state.cachedTabs;
  const [active] = activeTabs;
  let currentTab: PopupSnapshot["currentTab"] = null;

  if (active?.id !== undefined && isTrackableUrl(active.url)) {
    const trackedId = state.bindings[String(active.id)];
    const tracked = trackedId ? (displayedTabs.find((t) => t.id === trackedId) ?? null) : null;
    const visibleTitle = stripTrackedTabBadge(active.title ?? "", tracked?.emoji) ?? "";
    currentTab = {
      id: active.id,
      url: active.url!,
      title: visibleTitle,
      tracked,
      isActiveOwner: Boolean(tracked && tracked.activeDeviceId === effectiveDeviceId),
    };
  }

  return {
    deviceId: state.deviceId ?? state.localDeviceId,
    deviceName: state.deviceName,
    syncModes: state.syncModes,
    lanSignalingMode: state.lanSignalingMode,
    onboardingComplete: state.onboardingComplete,
    pairedLanDevices: state.pairedLanDevices,
    lanConnectedPeers: lanStatus.openChannelCount,
    lanPeerStatus: lanStatus.peerStatus,
    currentTab,
    trackedTabs: displayedTabs,
    pendingReconnect: state.pendingReconnect,
    pendingSyncCount: Object.keys(state.queuedLocationUpdates).length,
    settings: state.settings,
    cloud: { ...cloud, ...cloudStore },
  };
}

async function updateSettingsPartial(settings: Partial<PrivacySettings>) {
  const state = await getLocalState();
  const merged = { ...state.settings, ...settings };

  if (await getCloudCredentials()) {
    await updateCloudSettings(merged);
    await setLocalState({ settings: merged });
    return merged;
  }

  await setLocalState({ settings: merged });
  return merged;
}

async function handleMessage(message: ExtensionRequest): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case "GET_SNAPSHOT": {
        try {
          await syncCloudDatabase();
        } catch {
          // Cached data remains available while the cloud database is unavailable.
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "TRACK_TAB": {
        let tabId = message.tabId;
        if (tabId === undefined) {
          const [active] = await browser.tabs.query({ active: true, currentWindow: true });
          tabId = active?.id;
        }
        if (tabId === undefined) throw new Error("No active tab");
        await trackCurrentTab(tabId, message.name, message.emoji);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "STOP_TRACKING": {
        await stopTracking(message.trackedTabId);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "RENAME_TAB": {
        await renameTrackedTab(message.trackedTabId, message.name, message.emoji);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "OPEN_TAB": {
        const state = await getLocalState();
        const tracked = state.cachedTabs.find((t) => t.id === message.trackedTabId);
        if (!tracked) throw new Error("Tracked tab not found");
        await openTrackedTab(tracked, message.takeOver ?? false);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "TAKE_OVER": {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        await takeOver(message.trackedTabId, active?.id);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "CONFIRM_RECONNECT": {
        await confirmReconnect(message.candidate, message.takeOver ?? true);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "DISMISS_RECONNECT": {
        await dismissReconnect(message.candidate);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "UPDATE_SETTINGS": {
        await updateSettingsPartial(message.settings);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "UPDATE_SYNC_MODES": {
        const syncModes = supportedSyncModes(message.syncModes);
        if (!isValidSyncModes(syncModes)) {
          throw new Error("Select at least one sync mode");
        }
        await setLocalState({
          syncModes,
          lanSignalingMode: resolveLanSignalingMode(),
        });
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "UPDATE_LAN_SIGNALING_MODE": {
        const current = await getLocalState();
        if (!current.syncModes.lan) {
          throw new Error("Enable LAN sync first");
        }
        await setLocalState({ lanSignalingMode: message.lanSignalingMode });
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "RENAME_DEVICE": {
        await renameDevice(message.name);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "COMPLETE_ONBOARDING": {
        if (!isValidSyncModes(message.syncModes)) {
          throw new Error("Select at least one sync mode");
        }
        await ensureLocalDeviceId();
        await setLocalState({
          syncModes: message.syncModes,
          lanSignalingMode: resolveLanSignalingMode(),
          deviceName: message.deviceName.trim() || defaultDeviceName(),
          onboardingComplete: message.markComplete !== false,
        });
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "FINISH_ONBOARDING": {
        await setLocalState({ onboardingComplete: true });
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "START_LOCAL_LAN_PAIRING": {
        const session = await callOffscreenLan({ type: "START_LOCAL_LAN_PAIRING" });
        return {
          ok: true,
          localPairingToken: session.localPairingToken,
          snapshot: await buildSnapshot(),
        };
      }

      case "JOIN_LOCAL_LAN_PAIRING": {
        const session = await callOffscreenLan({
          type: "JOIN_LOCAL_LAN_PAIRING",
          offerToken: message.offerToken,
        });
        return {
          ok: true,
          localPairingToken: session.localPairingToken,
          snapshot: await buildSnapshot(),
        };
      }

      case "COMPLETE_LOCAL_LAN_PAIRING": {
        await callOffscreenLan({
          type: "COMPLETE_LOCAL_LAN_PAIRING",
          answerToken: message.answerToken,
        });
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "CANCEL_LOCAL_LAN_PAIRING": {
        await callOffscreenLan({ type: "CANCEL_LOCAL_LAN_PAIRING" });
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "RECONNECT_LAN": {
        await reconnectLanPeersViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SYNC_NOW": {
        await runFullSync();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "REMOVE_LAN_PEER": {
        await removeLanPeerViaOffscreen(message.deviceId);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "REFRESH": {
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "CLEAR_HISTORY": {
        const state = await getLocalState();
        if (await getCloudCredentials()) {
          await clearCloudHistory(message.trackedTabId);
        } else {
          await clearOfflineHistory(message.trackedTabId);
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "GET_HISTORY": {
        const state = await getLocalState();
        if (await getCloudCredentials()) {
          const history = await getCloudHistory(message.trackedTabId);
          return { ok: true, history, snapshot: await buildSnapshot() };
        }
        const history = await getOfflineHistory(message.trackedTabId);
        return { ok: true, history, snapshot: await buildSnapshot() };
      }

      case "RUN_CLOUD_DB_SPIKE": {
        const cloudDatabaseSpike = await runCloudDatabaseSpike({
          url: message.url,
          authToken: message.authToken,
        });
        return { ok: true, cloudDatabaseSpike };
      }

      case "CONFIGURE_CLOUD_DATABASE": {
        const state = await getLocalState();
        const deviceId = await ensureLocalDeviceId();
        await configureCloudDatabase({
          url: message.url,
          authToken: message.authToken,
          provider: message.provider,
          tokenPersistence: message.tokenPersistence,
          deviceId,
          deviceName: message.deviceName.trim() || state.deviceName || defaultDeviceName(),
          browser: detectBrowser(),
        });
        await updateCloudSettings(state.settings);
        await syncCloudDatabase();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "DISCONNECT_CLOUD_DATABASE": {
        await disconnectCloudDatabase();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "EXPORT_DATA": {
        const state = await getLocalState();
        return { ok: true, exportData: await createExport(state.settings) };
      }

      case "IMPORT_DATA": {
        const settings = await restoreExport(message.data);
        await setLocalState({ settings });
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "GET_CONFLICTS": {
        return { ok: true, conflicts: await listConflicts() };
      }

      case "GET_DATABASE_LOGS":
        return { ok: true, logs: await listDatabaseLogs() };

      case "CLEAR_DATABASE_LOGS":
        await clearDatabaseLogs();
        return { ok: true, logs: [] };

      case "UPDATE_DATABASE_BEHAVIOR":
        await updateDatabaseBehavior(message.behavior);
        await browser.alarms.clear("trackingext-sync");
        if (message.behavior.automaticSync) {
          browser.alarms.create("trackingext-sync", {
            periodInMinutes: message.behavior.syncIntervalMinutes,
          });
        }
        return { ok: true, snapshot: await buildSnapshot() };

      case "LIST_CLOUD_GROUPS":
        return { ok: true, groups: await listCloudGroups() };

      case "SAVE_CLOUD_GROUP":
        await saveCloudGroup(message);
        return { ok: true, groups: await listCloudGroups(), snapshot: await buildSnapshot() };

      case "DELETE_CLOUD_GROUP":
        await deleteCloudGroup(message.id, message.revision);
        return { ok: true, groups: await listCloudGroups(), snapshot: await buildSnapshot() };

      case "LIST_CLOUD_DEVICES":
        return { ok: true, devices: await listCloudDevices() };

      case "RENAME_CLOUD_DEVICE":
        await renameCloudDevice(message.id, message.name, message.revision);
        return { ok: true, devices: await listCloudDevices(), snapshot: await buildSnapshot() };

      case "REMOVE_CLOUD_DEVICE":
        await removeCloudDevice(message.id, message.revision);
        return { ok: true, devices: await listCloudDevices(), snapshot: await buildSnapshot() };

      case "ASSIGN_CLOUD_TAB":
        await assignCloudTab(message.tabId, message.groupId, message.revision);
        await syncCloudDatabase();
        return { ok: true, snapshot: await buildSnapshot() };

      default: {
        const unknownType =
          typeof message === "object" && message !== null && "type" in message
            ? String((message as { type: unknown }).type)
            : "undefined";
        console.warn("[TrackingExt] Unhandled extension message:", message);
        return {
          ok: false,
          error: `Unhandled extension action "${unknownType}". Reload the extension and try again.`,
        };
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Something went wrong";
    const action =
      typeof message === "object" && message !== null && "type" in message
        ? String((message as { type: unknown }).type)
        : "unknown";
    console.error(`[TrackingExt] ${action} failed:`, error);
    return {
      ok: false,
      error: `${action}: ${detail}`,
    };
  }
}

const TRACK_CONTEXT_MENU_ID = "trackingext-track-page";
const NOTIFICATION_ICON = browser.runtime.getURL("/icon/128.png");

async function showNotification(title: string, message: string) {
  try {
    await browser.notifications.create({
      type: "basic",
      iconUrl: NOTIFICATION_ICON,
      title,
      message,
    });
  } catch {
    // Notifications are best-effort only.
  }
}

async function ensureContextMenus() {
  try {
    await browser.contextMenus.removeAll();
  } catch {
    // ignore — menu may not exist yet
  }

  await browser.contextMenus.create({
    id: TRACK_CONTEXT_MENU_ID,
    title: "Track this tab",
    contexts: ["page", "tab"],
  });
}

async function trackFromContextMenu(tabId: number | undefined) {
  if (tabId === undefined) return;

  if (!(await canUseTrackingFeatures())) {
    await showNotification("TrackingExt", "Complete setup and enable tracking first.");
    return;
  }

  try {
    const tracked = await trackCurrentTab(tabId);
    await showNotification("Tracked tab saved", tracked.name);
  } catch (error) {
    console.warn("Failed to track page from context menu", error);
    await showNotification(
      "Could not track this tab",
      error instanceof Error ? error.message : "Something went wrong.",
    );
  }
}

async function startLanSyncIfEnabled() {
  if (!supportsLanSync) return;
  try {
    const state = await getLocalState();
    if (!state.syncModes.lan || !state.onboardingComplete) return;
    await syncLanManagerViaOffscreen();
  } catch (error) {
    console.warn("[TrackingExt] LAN sync startup failed:", error);
  }
}

const RESUME_COMMAND = "resume-activity";

async function openResumePicker() {
  const url = browser.runtime.getURL("/resume.html");
  const existing = await browser.tabs.query({ url });
  const tab = existing[0];
  if (tab?.id !== undefined) {
    await browser.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
    return;
  }
  await browser.tabs.create({ url, active: true });
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isOffscreenLanMessage(message)) return false;

    if (isStorageBridgeMessage(message)) {
      void handleStorageBridgeMessage(message).then(sendResponse);
      return true;
    }

    void handleMessage(message).then(sendResponse);
    return true;
  });

  void disableUnsupportedLanSync();
  if (!import.meta.env.BROWSER || import.meta.env.BROWSER !== "firefox-android") {
    void ensureContextMenus();
  }
  void startLanSyncIfEnabled();
  void syncCloudDatabase();

  if (import.meta.env.BROWSER !== "firefox-android") {
    browser.commands.onCommand.addListener((command) => {
      if (command !== RESUME_COMMAND) return;
      void openResumePicker();
    });

    browser.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId !== TRACK_CONTEXT_MENU_ID) return;
      void trackFromContextMenu(tab?.id);
    });
  }

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url && !changeInfo.title && changeInfo.status !== "complete") return;
    const url = changeInfo.url ?? tab.url;
    const title = changeInfo.title ?? tab.title;
    void handleTabUpdate(tabId, url, title);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void handleTabRemoved(tabId);
  });

  browser.runtime.onInstalled.addListener(() => {
    void disableUnsupportedLanSync();
    if (import.meta.env.BROWSER !== "firefox-android") {
      void ensureContextMenus();
    }
    void reconcileRestoredTabs();
    void startLanSyncIfEnabled();
  });

  browser.runtime.onStartup.addListener(() => {
    void disableUnsupportedLanSync();
    if (import.meta.env.BROWSER !== "firefox-android") {
      void ensureContextMenus();
    }
    void reconcileRestoredTabs();
    void startLanSyncIfEnabled();
    void syncCloudDatabase();
  });

  void getCloudCredentials().then((credentials) => {
    if (credentials?.behavior.automaticSync) {
      browser.alarms.create("trackingext-sync", {
        periodInMinutes: credentials.behavior.syncIntervalMinutes,
      });
    }
  });
  if (supportsLanSync) {
    browser.alarms.create("trackingext-lan", { periodInMinutes: 1 });
  }
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "trackingext-lan") {
      void startLanSyncIfEnabled();
      return;
    }
    if (alarm.name !== "trackingext-sync") return;
    void (async () => {
      try {
        await syncCloudDatabase();
      } catch {
        // Durable outbox retries on the next trigger.
      }
    })();
  });

  globalThis.addEventListener("online", () => void syncCloudDatabase());
});
