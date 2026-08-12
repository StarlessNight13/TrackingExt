import { eq } from "drizzle-orm";

import { db } from "@trackingext/db";
import { userSettings } from "@trackingext/db/schema/tracked";

export type PrivacySettings = {
  recordHistory: boolean;
  stripQueryParams: boolean;
  stripFragments: boolean;
  excludedHosts: string[];
};

const DEFAULT_SETTINGS: PrivacySettings = {
  recordHistory: true,
  stripQueryParams: false,
  stripFragments: true,
  excludedHosts: [],
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
  };
}
