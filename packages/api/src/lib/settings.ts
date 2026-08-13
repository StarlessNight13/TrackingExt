import { eq } from "drizzle-orm";

import { db } from "@trackingext/db";
import { userSettings } from "@trackingext/db/schema/tracked";

import {
  DASHBOARD_THEME_VARIANTS,
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  HISTORY_RETENTION_DAYS,
  type DashboardThemeVariant,
  type HistoryRetentionDays,
} from "./settings.constants";

export {
  DASHBOARD_THEME_VARIANTS,
  DEFAULT_DASHBOARD_THEME_SEED,
  DEFAULT_DASHBOARD_THEME_VARIANT,
  HISTORY_RETENTION_DAYS,
  type DashboardThemeVariant,
  type HistoryRetentionDays,
} from "./settings.constants";

export type PrivacySettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
  dashboardThemeSeed: string;
  dashboardThemeVariant: DashboardThemeVariant;
  /** null keeps history forever */
  historyRetentionDays: HistoryRetentionDays | null;
};

const DEFAULT_SETTINGS: PrivacySettings = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
  dashboardThemeSeed: DEFAULT_DASHBOARD_THEME_SEED,
  dashboardThemeVariant: DEFAULT_DASHBOARD_THEME_VARIANT,
  historyRetentionDays: null,
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

function normalizeRetentionDays(value: number | null | undefined): HistoryRetentionDays | null {
  if (value == null) return null;
  return HISTORY_RETENTION_DAYS.find((days) => days === value) ?? null;
}

function serializeSettings(row: typeof userSettings.$inferSelect): PrivacySettings {
  return {
    recordHistory: row.recordHistory,
    stripQueryParams: row.stripQueryParams,
    stripFragments: row.stripFragments,
    excludedHosts: parseExcludedHosts(row.excludedHosts),
    dashboardThemeSeed: row.dashboardThemeSeed,
    dashboardThemeVariant:
      DASHBOARD_THEME_VARIANTS.find((variant) => variant === row.dashboardThemeVariant) ??
      DEFAULT_SETTINGS.dashboardThemeVariant,
    historyRetentionDays: normalizeRetentionDays(row.historyRetentionDays),
  };
}

export async function getOrCreateSettings(userId: string): Promise<PrivacySettings> {
  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (existing) {
    return serializeSettings(existing);
  }

  await db
    .insert(userSettings)
    .values({
      userId,
      ...DEFAULT_SETTINGS,
      excludedHosts: JSON.stringify(DEFAULT_SETTINGS.excludedHosts),
      historyRetentionDays: null,
    })
    .onConflictDoNothing();

  const created = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (!created) {
    return { ...DEFAULT_SETTINGS };
  }

  return serializeSettings(created);
}
