import { eq } from "drizzle-orm";

import { db } from "@trackingext/db";
import { userSettings } from "@trackingext/db/schema/tracked";

import {
  DASHBOARD_THEME_VARIANTS,
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  type DashboardThemeVariant,
} from "./settings.constants";

export {
  DASHBOARD_THEME_VARIANTS,
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  type DashboardThemeVariant,
} from "./settings.constants";

export type PrivacySettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
  dashboardThemeSeed: string;
  dashboardThemeVariant: DashboardThemeVariant;
};

const DEFAULT_SETTINGS: PrivacySettings = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
  dashboardThemeSeed: DEFAULT_DASHBOARD_THEME_SEED,
  dashboardThemeVariant: DEFAULT_DASHBOARD_THEME_VARIANT,
};

export function parseExcludedHosts(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h): h is string => typeof h === "string");
  } catch {
    return [];
  }
}

export async function getOrCreateSettings(userId: string): Promise<PrivacySettings> {
  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (existing) {
    return {
      recordHistory: existing.recordHistory,
      stripQueryParams: existing.stripQueryParams,
      stripFragments: existing.stripFragments,
      excludedHosts: parseExcludedHosts(existing.excludedHosts),
      dashboardThemeSeed: existing.dashboardThemeSeed,
      dashboardThemeVariant:
        DASHBOARD_THEME_VARIANTS.find((variant) => variant === existing.dashboardThemeVariant) ??
        DEFAULT_SETTINGS.dashboardThemeVariant,
    };
  }

  await db
    .insert(userSettings)
    .values({
      userId,
      ...DEFAULT_SETTINGS,
      excludedHosts: JSON.stringify(DEFAULT_SETTINGS.excludedHosts),
    })
    .onConflictDoNothing();

  const created = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (!created) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    recordHistory: created.recordHistory,
    stripQueryParams: created.stripQueryParams,
    stripFragments: created.stripFragments,
    excludedHosts: parseExcludedHosts(created.excludedHosts),
    dashboardThemeSeed: created.dashboardThemeSeed,
    dashboardThemeVariant:
      DASHBOARD_THEME_VARIANTS.find((variant) => variant === created.dashboardThemeVariant) ??
      DEFAULT_SETTINGS.dashboardThemeVariant,
  };
}
