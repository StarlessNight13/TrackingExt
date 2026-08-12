import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@trackingext/db";
import { device } from "@trackingext/db/schema/tracked";

import { createId } from "../lib/ids";
import { protectedProcedure } from "../index";

function serializeDevice(row: typeof device.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    browser: row.browser,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export const devicesRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const rows = await db.query.device.findMany({
      where: eq(device.userId, context.session.user.id),
      orderBy: [desc(device.lastSeenAt)],
    });
    return rows.map(serializeDevice);
  }),

  register: protectedProcedure
    .input(
      z.object({
        /** Reuse an existing local device id when re-registering. */
        id: z.string().min(1).optional(),
        name: z.string().min(1).max(120),
        browser: z.string().min(1).max(60),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const now = new Date();

      if (input.id) {
        const existing = await db.query.device.findFirst({
          where: and(eq(device.id, input.id), eq(device.userId, userId)),
        });
        if (existing) {
          const [updated] = await db
            .update(device)
            .set({
              name: input.name,
              browser: input.browser,
              lastSeenAt: now,
            })
            .where(eq(device.id, existing.id))
            .returning();
          if (!updated) {
            throw new Error("Failed to update device");
          }
          return serializeDevice(updated);
        }
      }

      const id = input.id ?? createId("dev");
      const [created] = await db
        .insert(device)
        .values({
          id,
          userId,
          name: input.name,
          browser: input.browser,
          lastSeenAt: now,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create device");
      }
      return serializeDevice(created);
    }),

  touch: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const existing = await db.query.device.findFirst({
        where: and(eq(device.id, input.id), eq(device.userId, context.session.user.id)),
      });
      if (!existing) {
        return null;
      }
      const [updated] = await db
        .update(device)
        .set({ lastSeenAt: new Date() })
        .where(eq(device.id, existing.id))
        .returning();
      if (!updated) return null;
      return serializeDevice(updated);
    }),

  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120),
      }),
    )
    .handler(async ({ context, input }) => {
      const existing = await db.query.device.findFirst({
        where: and(eq(device.id, input.id), eq(device.userId, context.session.user.id)),
      });
      if (!existing) {
        return null;
      }
      const [updated] = await db
        .update(device)
        .set({ name: input.name })
        .where(eq(device.id, existing.id))
        .returning();
      if (!updated) return null;
      return serializeDevice(updated);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await db
        .delete(device)
        .where(and(eq(device.id, input.id), eq(device.userId, context.session.user.id)));
      return { ok: true as const };
    }),
};
