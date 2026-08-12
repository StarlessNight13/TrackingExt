import { getApiClient } from "../lib/api";
import { getSession, signIn, signOut, signUp } from "../lib/auth";
import { isEmail } from "../lib/auth-credentials";
import { defaultDeviceName, ensureDeviceRegistered, renameDevice } from "../lib/device";
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
import { isServerSyncActive, isValidSyncModes, resolveLanSignalingMode } from "../lib/sync-modes";
import { clearAuthState, getLocalState, setLocalState } from "../lib/storage";
import { normalizeServerUrl } from "../lib/server-url";
import { stripTrackedTabBadge } from "../lib/title-badge";
import {
  canUseTrackingFeatures,
  confirmReconnect,
  dismissReconnect,
  handleTabRemoved,
  handleTabUpdate,
  openTrackedTab,
  reconcileRestoredTabs,
  refreshCachedTabs,
  renameTrackedTab,
  stopTracking,
  syncSettings,
  trackCurrentTab,
  takeOver,
} from "../lib/tracking";
import { buildRememberedUserFromSession, saveRememberedUser } from "../lib/remembered-user";
import type { PrivacySettings, SyncModes } from "../lib/types";

async function runFullSync() {
  const state = await getLocalState();
  if (state.syncModes.lan) {
    await reconnectLanPeersViaOffscreen();
  }
  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    await syncSettings();
    await refreshCachedTabs();
  }
}

async function buildSnapshot(): Promise<PopupSnapshot> {
  const state = await getLocalState();
  let userEmail: string | null = null;
  let authenticated = false;

  if (state.sessionToken && state.serverUrl && state.syncModes.server) {
    const session = await getSession(state.sessionToken);
    if (session?.user) {
      authenticated = true;
      userEmail = session.user.email;
    } else {
      await clearAuthState();
    }
  }

  const effectiveDeviceId = await getEffectiveDeviceId();
  const lanStatus = await getLanStatusFromOffscreen(
    state.pairedLanDevices.map((device) => device.deviceId),
  );
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  let currentTab: PopupSnapshot["currentTab"] = null;

  if (active?.id !== undefined && isTrackableUrl(active.url)) {
    const trackedId = state.bindings[String(active.id)];
    const tracked = trackedId
      ? (state.cachedTabs.find((t) => t.id === trackedId) ?? null)
      : null;
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
    authenticated,
    userEmail,
    serverUrl: state.serverUrl,
    deviceId: state.deviceId ?? state.localDeviceId,
    deviceName: state.deviceName,
    syncModes: state.syncModes,
    lanSignalingMode: state.lanSignalingMode,
    onboardingComplete: state.onboardingComplete,
    pairedLanDevices: state.pairedLanDevices,
    lanConnectedPeers: lanStatus.openChannelCount,
    lanPeerStatus: lanStatus.peerStatus,
    currentTab,
    trackedTabs: state.cachedTabs,
    pendingReconnect: state.pendingReconnect,
    settings: state.settings,
  };
}

async function afterAuth(token: string) {
  await setLocalState({ sessionToken: token });
  await ensureDeviceRegistered();
  await syncSettings();
  await refreshCachedTabs();
  await reconcileRestoredTabs();
}

async function updateSettingsPartial(settings: Partial<PrivacySettings>) {
  const state = await getLocalState();
  const merged = { ...state.settings, ...settings };

  if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
    const api = await getApiClient();
    const updated = await api.settings.update(settings);
    await setLocalState({ settings: updated });
    return updated;
  }

  await setLocalState({ settings: merged });
  return merged;
}

async function handleMessage(message: ExtensionRequest): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case "GET_SNAPSHOT": {
        const state = await getLocalState();
        if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
          try {
            await refreshCachedTabs();
          } catch {
            // show cached list if sync is briefly unavailable
          }
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_IN": {
        const result = await signIn(message.loginId, message.password);
        await afterAuth(result.token);
        if (message.rememberMe !== false && result.user) {
          const signInMethod = message.loginId.includes("@") ? "email" : "username";
          await saveRememberedUser(
            buildRememberedUserFromSession({
              loginId: message.loginId.trim(),
              signInMethod,
              user: result.user,
            }),
          );
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_UP": {
        const result = await signUp(message.name, message.email, message.password);
        await afterAuth(result.token);
        if (result.user) {
          await saveRememberedUser(
            buildRememberedUserFromSession({
              loginId: isEmail(message.email) ? message.email : message.name,
              signInMethod: isEmail(message.email) ? "email" : "username",
              user: result.user,
            }),
          );
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_OUT": {
        const state = await getLocalState();
        if (state.sessionToken) {
          await signOut(state.sessionToken);
        }
        await clearAuthState();
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
        if (!isValidSyncModes(message.syncModes)) {
          throw new Error("Select at least one sync mode");
        }
        const current = await getLocalState();
        await setLocalState({
          syncModes: message.syncModes,
          lanSignalingMode: resolveLanSignalingMode(message.syncModes, current.lanSignalingMode),
        });
        await syncLanManagerViaOffscreen();
        const next = await getLocalState();
        if (isServerSyncActive(next.syncModes, next.serverUrl, next.sessionToken)) {
          try {
            await refreshCachedTabs();
          } catch {
            // keep local tabs if server is briefly unavailable
          }
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "UPDATE_LAN_SIGNALING_MODE": {
        const current = await getLocalState();
        if (!current.syncModes.lan) {
          throw new Error("Enable LAN sync first");
        }
        if (message.lanSignalingMode === "server-relay" && !current.serverUrl && !current.syncModes.server) {
          throw new Error("Set a relay server URL before using server relay");
        }
        await setLocalState({ lanSignalingMode: message.lanSignalingMode });
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "RENAME_DEVICE": {
        await renameDevice(message.name);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SET_SERVER_URL": {
        const serverUrl = normalizeServerUrl(message.serverUrl);
        const state = await getLocalState();
        if (state.serverUrl !== serverUrl) {
          await clearAuthState();
          await setLocalState({
            serverUrl,
            deviceId: null,
          });
        } else {
          await setLocalState({ serverUrl });
        }
        await syncLanManagerViaOffscreen();
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "COMPLETE_ONBOARDING": {
        if (!isValidSyncModes(message.syncModes)) {
          throw new Error("Select at least one sync mode");
        }
        await ensureLocalDeviceId();
        await setLocalState({
          syncModes: message.syncModes,
          lanSignalingMode: resolveLanSignalingMode(message.syncModes),
          deviceName: message.deviceName.trim() || defaultDeviceName(),
          onboardingComplete: message.markComplete !== false,
        });
        const state = await getLocalState();
        if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
          await ensureDeviceRegistered();
          await syncSettings();
          await refreshCachedTabs();
        }
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

      case "START_LAN_PAIRING": {
        const state = await getLocalState();
        if (state.lanSignalingMode === "local") {
          const session = await callOffscreenLan({ type: "START_LOCAL_LAN_PAIRING" });
          return {
            ok: true,
            localPairingToken: session.localPairingToken,
            snapshot: await buildSnapshot(),
          };
        }
        if (!state.serverUrl) {
          throw new Error("Set a relay server URL before pairing, or switch to local pairing");
        }
        const session = await callOffscreenLan({ type: "START_LAN_PAIRING" });
        return {
          ok: true,
          pairingCode: session.pairingCode,
          snapshot: await buildSnapshot(),
        };
      }

      case "POLL_LAN_PAIRING": {
        const result = await callOffscreenLan({
          type: "POLL_LAN_PAIRING",
          code: message.code,
        });
        return {
          ok: true,
          pairingComplete: Boolean(result.pairingComplete),
          snapshot: await buildSnapshot(),
        };
      }

      case "JOIN_LAN_PAIRING": {
        const state = await getLocalState();
        if (state.lanSignalingMode === "local") {
          throw new Error("Use local pairing tokens instead of a numeric code");
        }
        await callOffscreenLan({ type: "JOIN_LAN_PAIRING", code: message.code });
        return { ok: true, snapshot: await buildSnapshot() };
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
        const state = await getLocalState();
        if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
          await syncSettings();
          await refreshCachedTabs();
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "CLEAR_HISTORY": {
        const state = await getLocalState();
        if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
          const api = await getApiClient();
          await api.trackedTabs.clearHistory({ id: message.trackedTabId });
        } else {
          await clearOfflineHistory(message.trackedTabId);
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "GET_HISTORY": {
        const state = await getLocalState();
        if (isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) {
          const api = await getApiClient();
          const history = await api.trackedTabs.history({ id: message.trackedTabId });
          return { ok: true, history, snapshot: await buildSnapshot() };
        }
        const history = await getOfflineHistory(message.trackedTabId);
        return { ok: true, history, snapshot: await buildSnapshot() };
      }

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
const NOTIFICATION_ICON = browser.runtime.getURL("/wxt.svg");

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
  try {
    const state = await getLocalState();
    if (!state.syncModes.lan || !state.onboardingComplete) return;
    await syncLanManagerViaOffscreen();
  } catch (error) {
    console.warn("[TrackingExt] LAN sync startup failed:", error);
  }
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

  void ensureContextMenus();
  void startLanSyncIfEnabled();

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== TRACK_CONTEXT_MENU_ID) return;
    void trackFromContextMenu(tab?.id);
  });

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
    void ensureContextMenus();
    void reconcileRestoredTabs();
    void startLanSyncIfEnabled();
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureContextMenus();
    void reconcileRestoredTabs();
    void startLanSyncIfEnabled();
  });

  browser.alarms.create("trackingext-sync", { periodInMinutes: 5 });
  browser.alarms.create("trackingext-lan", { periodInMinutes: 1 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "trackingext-lan") {
      void startLanSyncIfEnabled();
      return;
    }
    if (alarm.name !== "trackingext-sync") return;
    void (async () => {
      const state = await getLocalState();
      if (!isServerSyncActive(state.syncModes, state.serverUrl, state.sessionToken)) return;
      try {
        await refreshCachedTabs();
      } catch {
        // ignore
      }
    })();
  });
});
