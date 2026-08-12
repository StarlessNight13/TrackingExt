import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { db } from "@trackingext/db";
import { device, trackedTab, trackedTabHistory } from "@trackingext/db/schema/tracked";

import { createId } from "../lib/ids";
import { getOrCreateSettings } from "../lib/settings";
import { protectedProcedure } from "../index";

function serializeDevice(row: typeof device.$inferSelect | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    browser: row.browser,
  };
}

function serializeTab(
  row: typeof trackedTab.$inferSelect & {
    activeDevice?: typeof device.$inferSelect | null;
    lastUpdatedDevice?: typeof device.$inferSelect | null;
  },
) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    currentUrl: row.currentUrl,
    currentTitle: row.currentTitle,
    activeDeviceId: row.activeDeviceId,
    lastUpdatedDeviceId: row.lastUpdatedDeviceId,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    activeDevice: serializeDevice(row.activeDevice),
    lastUpdatedDevice: serializeDevice(row.lastUpdatedDevice),
  };
}

async function requireOwnedTab(userId: string, tabId: string) {
  const tab = await db.query.trackedTab.findFirst({
    where: and(eq(trackedTab.id, tabId), eq(trackedTab.userId, userId)),
    with: {
      activeDevice: true,
      lastUpdatedDevice: true,
    },
  });
  if (!tab) {
    throw new ORPCError("NOT_FOUND", { message: "Tracked tab not found" });
  }
  return tab;
}

async function requireOwnedDevice(userId: string, deviceId: string) {
  const row = await db.query.device.findFirst({
    where: and(eq(device.id, deviceId), eq(device.userId, userId)),
  });
  if (!row) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown device" });
  }
  return row;
}

export const trackedTabsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const rows = await db.query.trackedTab.findMany({
      where: eq(trackedTab.userId, context.session.user.id),
      with: {
        activeDevice: true,
        lastUpdatedDevice: true,
      },
      orderBy: [desc(trackedTab.lastUpdatedAt)],
    });
    return rows.map(serializeTab);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const tab = await requireOwnedTab(context.session.user.id, input.id);
      return serializeTab(tab);
    }),

  create: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().min(1),
        name: z.string().min(1).max(120),
        emoji: z.string().max(8).optional(),
        url: z.string().url(),
        title: z.string().max(500).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await requireOwnedDevice(userId, input.deviceId);

      const settings = await getOrCreateSettings(userId);
      const host = new URL(input.url).hostname;
      if (settings.excludedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        throw new ORPCError("BAD_REQUEST", {
          message: "This website is excluded from tracking",
        });
      }

      const now = new Date();
      const id = createId("tab");
      await db.insert(trackedTab).values({
        id,
        userId,
        name: input.name,
        emoji: input.emoji ?? null,
        currentUrl: input.url,
        currentTitle: input.title ?? null,
        activeDeviceId: input.deviceId,
        lastUpdatedDeviceId: input.deviceId,
        lastUpdatedAt: now,
      });

      if (settings.recordHistory) {
        await db.insert(trackedTabHistory).values({
          id: createId("hist"),
          trackedTabId: id,
          url: input.url,
          title: input.title ?? null,
          visitedAt: now,
        });
      }

      await db.update(device).set({ lastSeenAt: now }).where(eq(device.id, input.deviceId));

      const tab = await requireOwnedTab(userId, id);
      return serializeTab(tab);
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120),
        emoji: z.string().max(8).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireOwnedTab(context.session.user.id, input.id);
      await db
        .update(trackedTab)
        .set({
          name: input.name,
          ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
        })
        .where(eq(trackedTab.id, input.id));
      const tab = await requireOwnedTab(context.session.user.id, input.id);
      return serializeTab(tab);
    }),

  /**
   * Push a URL/title update from the active device.
   * Rejects if another device currently owns the tracked tab (use takeOver).
   */
  updateLocation: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        deviceId: z.string().min(1),
        url: z.string().url(),
        title: z.string().max(500).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const tab = await requireOwnedTab(userId, input.id);
      await requireOwnedDevice(userId, input.deviceId);

      if (tab.activeDeviceId && tab.activeDeviceId !== input.deviceId) {
        throw new ORPCError("CONFLICT", {
          message: "Another device is actively updating this tracked tab",
          data: {
            activeDevice: serializeDevice(tab.activeDevice),
          },
        });
      }

      const settings = await getOrCreateSettings(userId);
      const host = new URL(input.url).hostname;
      if (settings.excludedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        return {
          skipped: true as const,
          reason: "excluded" as const,
          tab: serializeTab(tab),
        };
      }

      const now = new Date();
      const urlChanged = tab.currentUrl !== input.url;

      await db
        .update(trackedTab)
        .set({
          currentUrl: input.url,
          currentTitle: input.title ?? tab.currentTitle,
          activeDeviceId: input.deviceId,
          lastUpdatedDeviceId: input.deviceId,
          lastUpdatedAt: now,
        })
        .where(eq(trackedTab.id, input.id));

      if (settings.recordHistory && urlChanged) {
        await db.insert(trackedTabHistory).values({
          id: createId("hist"),
          trackedTabId: input.id,
          url: input.url,
          title: input.title ?? null,
          visitedAt: now,
        });
      }

      await db.update(device).set({ lastSeenAt: now }).where(eq(device.id, input.deviceId));

      const updated = await requireOwnedTab(userId, input.id);
      return {
        skipped: false as const,
        tab: serializeTab(updated),
      };
    }),

  takeOver: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        deviceId: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await requireOwnedTab(userId, input.id);
      await requireOwnedDevice(userId, input.deviceId);

      const now = new Date();
      await db
        .update(trackedTab)
        .set({
          activeDeviceId: input.deviceId,
          lastUpdatedDeviceId: input.deviceId,
          lastUpdatedAt: now,
        })
        .where(eq(trackedTab.id, input.id));

      await db.update(device).set({ lastSeenAt: now }).where(eq(device.id, input.deviceId));

      const tab = await requireOwnedTab(userId, input.id);
      return serializeTab(tab);
    }),

  release: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        deviceId: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const tab = await requireOwnedTab(userId, input.id);
      if (tab.activeDeviceId === input.deviceId) {
        await db
          .update(trackedTab)
          .set({ activeDeviceId: null })
          .where(eq(trackedTab.id, input.id));
      }
      const updated = await requireOwnedTab(userId, input.id);
      return serializeTab(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await db
        .delete(trackedTab)
        .where(
          and(eq(trackedTab.id, input.id), eq(trackedTab.userId, context.session.user.id)),
        );
      return { ok: true as const };
    }),

  history: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireOwnedTab(context.session.user.id, input.id);
      const rows = await db.query.trackedTabHistory.findMany({
        where: eq(trackedTabHistory.trackedTabId, input.id),
        orderBy: [desc(trackedTabHistory.visitedAt)],
        limit: input.limit,
      });
      return rows.map((row) => ({
        id: row.id,
        url: row.url,
        title: row.title,
        visitedAt: row.visitedAt.toISOString(),
      }));
    }),

  clearHistory: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await requireOwnedTab(context.session.user.id, input.id);
      await db.delete(trackedTabHistory).where(eq(trackedTabHistory.trackedTabId, input.id));
      return { ok: true as const };
    }),
};
