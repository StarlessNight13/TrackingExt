export type PrivacySettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
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
  currentUrl: string;
  currentTitle: string | null;
  activeDeviceId: string | null;
  lastUpdatedDeviceId: string | null;
  lastUpdatedAt: string;
  createdAt: string;
  activeDevice: { id: string; name: string; browser: string } | null;
  lastUpdatedDevice: { id: string; name: string; browser: string } | null;
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
  /** browser tabId -> tracked tab id */
  bindings: Record<string, string>;
  /** Cached remote tabs for offline-ish popup */
  cachedTabs: TrackedTab[];
  settings: PrivacySettings;
  pendingReconnect: ReconnectCandidate[];
};

export const DEFAULT_SETTINGS: PrivacySettings = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
};

export const DEFAULT_LOCAL_STATE: LocalState = {
  serverUrl: null,
  sessionToken: null,
  deviceId: null,
  deviceName: null,
  bindings: {},
  cachedTabs: [],
  settings: DEFAULT_SETTINGS,
  pendingReconnect: [],
};
