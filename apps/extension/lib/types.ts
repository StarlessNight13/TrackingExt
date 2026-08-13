import {
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  type DashboardThemeVariant,
} from "@trackingext/api/lib/settings.constants";

import { DEFAULT_SYNC_MODES } from "./sync-modes";

export type { DashboardThemeVariant };

export type LanSignalingMode = "local" | "server-relay";

export type SyncModes = {
  offline: boolean;
  lan: boolean;
  server: boolean;
};

export type PairedLanDevice = {
  deviceId: string;
  deviceName: string;
  browser?: string;
  pairedAt: string;
};

export type PrivacySettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
  dashboardThemeSeed: string;
  dashboardThemeVariant: DashboardThemeVariant;
  historyRetentionDays: 7 | 30 | 90 | null;
};

export type DeviceInfo = {
  id: string;
  name: string;
  browser: string;
  lastSeenAt: string;
  createdAt: string;
};

export type TrackedTab = {
  id: string;
  name: string;
  emoji: string | null;
  tags: string[];
  collectionId: string | null;
  collection: { id: string; name: string } | null;
  currentUrl: string;
  currentTitle: string | null;
  activeDeviceId: string | null;
  lastUpdatedDeviceId: string | null;
  lastUpdatedAt: string;
  createdAt: string;
  archivedAt: string | null;
  isPrivate: boolean;
  activeDevice: { id: string; name: string; browser: string; lastSeenAt?: string } | null;
  lastUpdatedDevice: { id: string; name: string; browser: string; lastSeenAt?: string } | null;
  health?: {
    stale: boolean;
    ownerOffline: boolean;
    ownershipConflict: boolean;
    issues: Array<"stale" | "owner_offline" | "ownership_conflict">;
  };
};

export type QueuedLocationUpdate = {
  tabId: string;
  url: string;
  title: string | null;
  queuedAt: string;
};

export type HistoryEntry = {
  id: string;
  url: string;
  title: string | null;
  visitedAt: string;
};

export type ReconnectCandidate = {
  trackedTabId: string;
  trackedTabName: string;
  url: string;
  title: string | null;
  browserTabId: number;
};

export type LocalState = {
  serverUrl: string | null;
  sessionToken: string | null;
  deviceId: string | null;
  deviceName: string | null;
  localDeviceId: string | null;
  syncModes: SyncModes;
  lanSignalingMode: LanSignalingMode;
  onboardingComplete: boolean;
  pairedLanDevices: PairedLanDevice[];
  localHistory: Record<string, HistoryEntry[]>;
  /** browser tabId -> tracked tab id */
  bindings: Record<string, string>;
  /** Cached remote tabs for offline-ish popup */
  cachedTabs: TrackedTab[];
  settings: PrivacySettings;
  pendingReconnect: ReconnectCandidate[];
  /** Latest unsent location update per server-backed tracked tab. */
  queuedLocationUpdates: Record<string, QueuedLocationUpdate>;
};

export const DEFAULT_SETTINGS: PrivacySettings = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
  dashboardThemeSeed: DEFAULT_DASHBOARD_THEME_SEED,
  dashboardThemeVariant: DEFAULT_DASHBOARD_THEME_VARIANT,
  historyRetentionDays: null,
};

export const DEFAULT_LOCAL_STATE: LocalState = {
  serverUrl: null,
  sessionToken: null,
  deviceId: null,
  deviceName: null,
  localDeviceId: null,
  syncModes: DEFAULT_SYNC_MODES,
  lanSignalingMode: "local",
  onboardingComplete: false,
  pairedLanDevices: [],
  localHistory: {},
  bindings: {},
  cachedTabs: [],
  settings: DEFAULT_SETTINGS,
  pendingReconnect: [],
  queuedLocationUpdates: {},
};
