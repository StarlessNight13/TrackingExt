import { getApiClient } from "../lib/api";
import { getSession, signIn, signOut, signUp } from "../lib/auth";
import { ensureDeviceRegistered, renameDevice } from "../lib/device";
import type { ExtensionRequest, ExtensionResponse, PopupSnapshot } from "../lib/messaging";
import { isTrackableUrl } from "../lib/privacy";
import { clearAuthState, getLocalState, setLocalState } from "../lib/storage";
import { normalizeServerUrl } from "../lib/server-url";
import { stripTrackedTabBadge } from "../lib/title-badge";
import {
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

async function buildSnapshot(): Promise<PopupSnapshot> {
  const state = await getLocalState();
  let userEmail: string | null = null;
  let authenticated = false;

  if (state.sessionToken) {
    if (state.serverUrl) {
      const session = await getSession(state.sessionToken);
      if (session?.user) {
        authenticated = true;
        userEmail = session.user.email;
      } else {
        await clearAuthState();
      }
    } else {
      await clearAuthState();
    }
  }

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
      isActiveOwner: Boolean(
        tracked && state.deviceId && tracked.activeDeviceId === state.deviceId,
      ),
    };
  }

  return {
    authenticated,
    userEmail,
    serverUrl: state.serverUrl,
    deviceId: state.deviceId,
    deviceName: state.deviceName,
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

async function handleMessage(message: ExtensionRequest): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case "GET_SNAPSHOT": {
        const state = await getLocalState();
        if (state.sessionToken && state.serverUrl) {
          try {
            await refreshCachedTabs();
          } catch {
            // show cached list if sync is briefly unavailable
          }
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_IN": {
        const result = await signIn(message.email, message.password);
        await afterAuth(result.token);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_UP": {
        const result = await signUp(message.name, message.email, message.password);
        await afterAuth(result.token);
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "SIGN_OUT": {
        const state = await getLocalState();
        await signOut(state.sessionToken);
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
        const api = await getApiClient();
        const settings = await api.settings.update(message.settings);
        await setLocalState({ settings });
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
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "REFRESH": {
        const state = await getLocalState();
        if (state.sessionToken && state.serverUrl) {
          await syncSettings();
          await refreshCachedTabs();
        }
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "CLEAR_HISTORY": {
        const api = await getApiClient();
        await api.trackedTabs.clearHistory({ id: message.trackedTabId });
        return { ok: true, snapshot: await buildSnapshot() };
      }

      case "GET_HISTORY": {
        const api = await getApiClient();
        const history = await api.trackedTabs.history({ id: message.trackedTabId });
        return { ok: true, history, snapshot: await buildSnapshot() };
      }

      default:
        return { ok: false, error: "Unknown message" };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong",
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

  const state = await getLocalState();
  if (!state.sessionToken) {
    await showNotification("TrackingExt", "Sign in before tracking tabs.");
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

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: ExtensionRequest) => handleMessage(message));

  void ensureContextMenus();

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
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureContextMenus();
    void reconcileRestoredTabs();
  });

  // Periodic soft sync for cross-device updates while popup is closed
  browser.alarms.create("trackingext-sync", { periodInMinutes: 5 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "trackingext-sync") return;
    void (async () => {
      const state = await getLocalState();
      if (!state.sessionToken) return;
      try {
        await refreshCachedTabs();
      } catch {
        // ignore
      }
    })();
  });
});
