/** Client-safe theme constants — no server or database imports. */

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
