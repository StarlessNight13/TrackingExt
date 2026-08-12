import type { LanSignalingMode, PairedLanDevice, PrivacySettings, ReconnectCandidate, SyncModes, TrackedTab } from "./types";

export type PopupSnapshot = {
  authenticated: boolean;
  userEmail: string | null;
  serverUrl: string | null;
  deviceId: string | null;
  deviceName: string | null;
  syncModes: SyncModes;
  lanSignalingMode: LanSignalingMode;
  onboardingComplete: boolean;
  pairedLanDevices: PairedLanDevice[];
  lanConnectedPeers: number;
  lanPeerStatus: Record<string, boolean>;
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
  | { type: "SIGN_IN"; loginId: string; password: string; rememberMe?: boolean }
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
  | { type: "UPDATE_SYNC_MODES"; syncModes: SyncModes }
  | { type: "UPDATE_LAN_SIGNALING_MODE"; lanSignalingMode: LanSignalingMode }
  | { type: "RENAME_DEVICE"; name: string }
  | { type: "SET_SERVER_URL"; serverUrl: string }
  | { type: "COMPLETE_ONBOARDING"; syncModes: SyncModes; deviceName: string; skipPairing?: boolean; markComplete?: boolean }
  | { type: "FINISH_ONBOARDING" }
  | { type: "START_LAN_PAIRING" }
  | { type: "POLL_LAN_PAIRING"; code: string }
  | { type: "JOIN_LAN_PAIRING"; code: string }
  | { type: "START_LOCAL_LAN_PAIRING" }
  | { type: "JOIN_LOCAL_LAN_PAIRING"; offerToken: string }
  | { type: "COMPLETE_LOCAL_LAN_PAIRING"; answerToken: string }
  | { type: "CANCEL_LOCAL_LAN_PAIRING" }
  | { type: "RECONNECT_LAN" }
  | { type: "SYNC_NOW" }
  | { type: "REMOVE_LAN_PEER"; deviceId: string }
  | { type: "REFRESH" }
  | { type: "CLEAR_HISTORY"; trackedTabId: string }
  | { type: "GET_HISTORY"; trackedTabId: string };

export type ExtensionResponse =
  | {
      ok: true;
      snapshot?: PopupSnapshot;
      history?: unknown;
      pairingCode?: string;
      pairingComplete?: boolean;
      localPairingToken?: string;
    }
  | { ok: false; error: string };

export function sendMessage(message: ExtensionRequest): Promise<ExtensionResponse> {
  return browser.runtime
    .sendMessage(message)
    .then((response): ExtensionResponse => {
      if (response === undefined) {
        return {
          ok: false,
          error: `"${message.type}" got no response from the extension background. Reload the extension and try again.`,
        };
      }
      if (typeof response === "object" && response !== null && "ok" in response) {
        return response as ExtensionResponse;
      }
      return {
        ok: false,
        error: `"${message.type}" returned an unexpected response from the extension background.`,
      };
    })
    .catch((error: unknown): ExtensionResponse => {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: `"${message.type}" failed: ${detail}`,
      };
    });
}
