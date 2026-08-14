import {
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  type DashboardThemeVariant,
} from "./settings-constants";
import { Variant, applyTheme, generateTheme, resolveColorMode } from "material-shadcn";

const MATERIAL_RADIUS = "1rem";

export function normalizeDashboardVariant(variant: string): Variant {
  if (variant in Variant) {
    return Variant[variant as keyof typeof Variant];
  }
  return Variant.TONAL_SPOT;
}

export function resolveDashboardThemeSettings(settings?: {
  dashboardThemeSeed?: string;
  dashboardThemeVariant?: string;
}) {
  return {
    seed: settings?.dashboardThemeSeed ?? DEFAULT_DASHBOARD_THEME_SEED,
    variant:
      (settings?.dashboardThemeVariant as DashboardThemeVariant | undefined) ??
      DEFAULT_DASHBOARD_THEME_VARIANT,
  };
}

export function applyDashboardTheme(
  element: HTMLElement,
  settings?: {
    dashboardThemeSeed?: string;
    dashboardThemeVariant?: string;
  },
) {
  const { seed, variant } = resolveDashboardThemeSettings(settings);
  const theme = generateTheme({
    seed,
    variant: normalizeDashboardVariant(variant),
  });
  const dark = resolveColorMode("system");
  applyTheme(element, theme, dark);
  element.style.setProperty("--radius", MATERIAL_RADIUS);
}

export function subscribeDashboardTheme(
  element: HTMLElement,
  settings?: {
    dashboardThemeSeed?: string;
    dashboardThemeVariant?: string;
  },
) {
  const apply = () => applyDashboardTheme(element, settings);
  apply();

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}
