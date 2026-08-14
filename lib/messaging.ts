import type {
  LanSignalingMode,
  PairedLanDevice,
  PrivacySettings,
  ReconnectCandidate,
  SyncModes,
  TrackedTab,
} from "./types";
import type { CloudDatabaseSpikeResult } from "./cloud-db/spike";
import type { CloudConfiguration, CloudStatus } from "../storage/cloud-configuration";
import type { TrackingExtExport } from "../storage/export";
import type { DatabaseBehavior } from "../services/database-service";
import type { DatabaseProvider } from "../services/database-service";

export type PopupSnapshot = {
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
  pendingSyncCount: number;
  settings: PrivacySettings;
  cloud: {
    configuration: CloudConfiguration | null;
    status: CloudStatus;
    pending: number;
    conflicts: number;
  };
};

export type ExtensionRequest =
  | { type: "GET_SNAPSHOT" }
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
  | {
      type: "COMPLETE_ONBOARDING";
      syncModes: SyncModes;
      deviceName: string;
      skipPairing?: boolean;
      markComplete?: boolean;
    }
  | { type: "FINISH_ONBOARDING" }
  | { type: "START_LOCAL_LAN_PAIRING" }
  | { type: "JOIN_LOCAL_LAN_PAIRING"; offerToken: string }
  | { type: "COMPLETE_LOCAL_LAN_PAIRING"; answerToken: string }
  | { type: "CANCEL_LOCAL_LAN_PAIRING" }
  | { type: "RECONNECT_LAN" }
  | { type: "SYNC_NOW" }
  | { type: "REMOVE_LAN_PEER"; deviceId: string }
  | { type: "REFRESH" }
  | { type: "CLEAR_HISTORY"; trackedTabId: string }
  | { type: "GET_HISTORY"; trackedTabId: string }
  | { type: "RUN_CLOUD_DB_SPIKE"; url: string; authToken: string }
  | {
      type: "CONFIGURE_CLOUD_DATABASE";
      url: string;
      authToken: string;
      provider: DatabaseProvider;
      tokenPersistence: "persistent" | "session";
      deviceName: string;
    }
  | { type: "DISCONNECT_CLOUD_DATABASE" }
  | { type: "EXPORT_DATA" }
  | { type: "IMPORT_DATA"; data: unknown }
  | { type: "GET_CONFLICTS" }
  | { type: "GET_DATABASE_LOGS" }
  | { type: "CLEAR_DATABASE_LOGS" }
  | { type: "UPDATE_DATABASE_BEHAVIOR"; behavior: DatabaseBehavior }
  | { type: "LIST_CLOUD_GROUPS" }
  | { type: "SAVE_CLOUD_GROUP"; id?: string; name: string; notes?: string; revision?: number }
  | { type: "DELETE_CLOUD_GROUP"; id: string; revision: number }
  | { type: "LIST_CLOUD_DEVICES" }
  | { type: "RENAME_CLOUD_DEVICE"; id: string; name: string; revision: number }
  | { type: "REMOVE_CLOUD_DEVICE"; id: string; revision: number }
  | { type: "ASSIGN_CLOUD_TAB"; tabId: string; groupId: string | null; revision: number };

export type ExtensionResponse =
  | {
      ok: true;
      snapshot?: PopupSnapshot;
      history?: unknown;
      localPairingToken?: string;
      cloudDatabaseSpike?: CloudDatabaseSpikeResult;
      exportData?: TrackingExtExport;
      conflicts?: unknown[];
      groups?: unknown[];
      devices?: unknown[];
      logs?: unknown[];
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
