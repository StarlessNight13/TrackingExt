export const DASHBOARD_THEME_VARIANTS = [
  "TONAL_SPOT",
  "EXPRESSIVE",
  "FIDELITY",
  "VIBRANT",
  "NEUTRAL",
  "MONOCHROME",
  "CONTENT",
  "RAINBOW",
  "FRUIT_SALAD",
] as const;
export type DashboardThemeVariant = (typeof DASHBOARD_THEME_VARIANTS)[number];
export const DEFAULT_DASHBOARD_THEME_SEED = "#6750A4";
export const DEFAULT_DASHBOARD_THEME_VARIANT: DashboardThemeVariant = "TONAL_SPOT";
export const HISTORY_RETENTION_DAYS = [7, 30, 90] as const;
export const STALE_ACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
export const OFFLINE_DEVICE_MS = 24 * 60 * 60 * 1000;
