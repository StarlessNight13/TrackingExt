import { and, asc, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { db } from "@trackingext/db";
import { collection, trackedTab } from "@trackingext/db/schema/tracked";

import { createId } from "../lib/ids";
import { protectedProcedure } from "../index";

function serializeGroup(
  row: typeof collection.$inferSelect,
  activityCount: number,
  pinned?: {
    id: string;
    name: string;
    emoji: string | null;
    currentUrl: string;
    currentTitle: string | null;
  } | null,
) {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    pinnedTrackedTabId: row.pinnedTrackedTabId,
    pinnedActivity: pinned ?? null,
    activityCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireOwnedGroup(userId: string, groupId: string) {
  const row = await db.query.collection.findFirst({
    where: and(eq(collection.id, groupId), eq(collection.userId, userId)),
  });
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Group not found" });
  }
  return row;
}

async function loadPinnedActivity(userId: string, pinnedId: string | null) {
  if (!pinnedId) return null;
  const tab = await db.query.trackedTab.findFirst({
    where: and(eq(trackedTab.id, pinnedId), eq(trackedTab.userId, userId)),
    columns: {
      id: true,
      name: true,
      emoji: true,
      currentUrl: true,
      currentTitle: true,
    },
  });
  return tab ?? null;
}

export const groupsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const rows = await db.query.collection.findMany({
      where: eq(collection.userId, userId),
      orderBy: [asc(collection.name)],
    });
    if (rows.length === 0) return [];

    const counts = await db.query.trackedTab.findMany({
      where: and(
        eq(trackedTab.userId, userId),
        inArray(
          trackedTab.collectionId,
          rows.map((row) => row.id),
        ),
      ),
      columns: { id: true, collectionId: true },
    });
    const countByGroup = new Map<string, number>();
    for (const tab of counts) {
      if (!tab.collectionId) continue;
      countByGroup.set(tab.collectionId, (countByGroup.get(tab.collectionId) ?? 0) + 1);
    }

    return Promise.all(
      rows.map(async (row) =>
        serializeGroup(
          row,
          countByGroup.get(row.id) ?? 0,
          await loadPinnedActivity(userId, row.pinnedTrackedTabId),
        ),
      ),
    );
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        notes: z.string().max(4000).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const id = createId("grp");
      await db.insert(collection).values({
        id,
        userId,
        name: input.name,
        notes: input.notes ?? "",
      });
      const row = await requireOwnedGroup(userId, id);
      return serializeGroup(row, 0, null);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        notes: z.string().max(4000).optional(),
        pinnedTrackedTabId: z.string().min(1).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await requireOwnedGroup(userId, input.id);

      if (input.pinnedTrackedTabId) {
        const tab = await db.query.trackedTab.findFirst({
          where: and(eq(trackedTab.id, input.pinnedTrackedTabId), eq(trackedTab.userId, userId)),
        });
        if (!tab) {
          throw new ORPCError("BAD_REQUEST", { message: "Pinned activity not found" });
        }
        if (tab.collectionId !== input.id) {
          await db
            .update(trackedTab)
            .set({ collectionId: input.id })
            .where(eq(trackedTab.id, tab.id));
        }
      }

      await db
        .update(collection)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.pinnedTrackedTabId !== undefined
            ? { pinnedTrackedTabId: input.pinnedTrackedTabId }
            : {}),
        })
        .where(eq(collection.id, input.id));

      const row = await requireOwnedGroup(userId, input.id);
      const countRows = await db.query.trackedTab.findMany({
        where: and(eq(trackedTab.userId, userId), eq(trackedTab.collectionId, input.id)),
        columns: { id: true },
      });
      return serializeGroup(
        row,
        countRows.length,
        await loadPinnedActivity(userId, row.pinnedTrackedTabId),
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await requireOwnedGroup(userId, input.id);
      await db
        .update(trackedTab)
        .set({ collectionId: null })
        .where(and(eq(trackedTab.userId, userId), eq(trackedTab.collectionId, input.id)));
      await db
        .delete(collection)
        .where(and(eq(collection.id, input.id), eq(collection.userId, userId)));
      return { ok: true as const };
    }),
};
