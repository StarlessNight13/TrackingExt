export type WorkspaceSettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
  dashboardThemeSeed: string;
  dashboardThemeVariant: string;
  historyRetentionDays: 7 | 30 | 90 | null;
  revision: number;
};

export const DEFAULT_SETTINGS: Omit<WorkspaceSettings, "revision"> = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
  dashboardThemeSeed: "#6750A4",
  dashboardThemeVariant: "TONAL_SPOT",
  historyRetentionDays: null,
};
