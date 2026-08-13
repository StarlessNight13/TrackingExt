import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@trackingext/db";
import { trackedTab, trackedTabHistory } from "@trackingext/db/schema/tracked";

import { getOrCreateSettings } from "./settings";

export async function purgeExpiredHistoryForUser(userId: string) {
  const settings = await getOrCreateSettings(userId);
  if (settings.historyRetentionDays == null) {
    return { deleted: 0 };
  }

  const cutoff = new Date(Date.now() - settings.historyRetentionDays * 24 * 60 * 60 * 1000);
  const tabs = await db.query.trackedTab.findMany({
    where: eq(trackedTab.userId, userId),
    columns: { id: true },
  });
  if (tabs.length === 0) return { deleted: 0 };

  const result = await db
    .delete(trackedTabHistory)
    .where(
      and(
        inArray(
          trackedTabHistory.trackedTabId,
          tabs.map((tab) => tab.id),
        ),
        lt(trackedTabHistory.visitedAt, cutoff),
      ),
    )
    .run();

  return { deleted: Number(result.rowsAffected ?? 0) };
}
