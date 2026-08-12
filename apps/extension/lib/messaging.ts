import type { PrivacySettings, ReconnectCandidate, TrackedTab } from "./types";

export type PopupSnapshot = {
  authenticated: boolean;
  userEmail: string | null;
  serverUrl: string | null;
  deviceId: string | null;
  deviceName: string | null;
  currentTab: {
    id: number;
    url: string;
    title: string;
    tracked: TrackedTab | null;
    isActiveOwner: boolean;
  } | null;
  trackedTabs: TrackedTab[];
  pendingReconnect: ReconnectCandidate[];
  settings: PrivacySettings;
};

export type ExtensionRequest =
  | { type: "GET_SNAPSHOT" }
  | { type: "SIGN_IN"; email: string; password: string }
  | { type: "SIGN_UP"; name: string; email: string; password: string }
  | { type: "SIGN_OUT" }
  | { type: "TRACK_TAB"; name?: string; emoji?: string; tabId?: number }
  | { type: "STOP_TRACKING"; trackedTabId: string }
  | { type: "RENAME_TAB"; trackedTabId: string; name: string; emoji?: string | null }
  | { type: "OPEN_TAB"; trackedTabId: string; takeOver?: boolean }
  | { type: "TAKE_OVER"; trackedTabId: string }
  | { type: "CONFIRM_RECONNECT"; candidate: ReconnectCandidate; takeOver?: boolean }
  | { type: "DISMISS_RECONNECT"; candidate: ReconnectCandidate }
  | { type: "UPDATE_SETTINGS"; settings: Partial<PrivacySettings> }
  | { type: "RENAME_DEVICE"; name: string }
  | { type: "SET_SERVER_URL"; serverUrl: string }
  | { type: "REFRESH" }
  | { type: "CLEAR_HISTORY"; trackedTabId: string }
  | { type: "GET_HISTORY"; trackedTabId: string };

export type ExtensionResponse =
  | { ok: true; snapshot?: PopupSnapshot; history?: unknown }
  | { ok: false; error: string };

export function sendMessage<T = ExtensionResponse>(message: ExtensionRequest): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}
