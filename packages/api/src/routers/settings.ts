import { z } from "zod";

import { db } from "@trackingext/db";
import { userSettings } from "@trackingext/db/schema/tracked";
import { eq } from "drizzle-orm";

import { getOrCreateSettings } from "../lib/settings";
import { protectedProcedure } from "../index";

export const settingsRouter = {
  get: protectedProcedure.handler(async ({ context }) => {
    return getOrCreateSettings(context.session.user.id);
  }),

  update: protectedProcedure
    .input(
      z.object({
        recordHistory: z.boolean().optional(),
        stripQueryParams: z.boolean().optional(),
        stripFragments: z.boolean().optional(),
        excludedHosts: z.array(z.string().min(1).max(253)).max(200).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await getOrCreateSettings(userId);

      await db
        .update(userSettings)
        .set({
          ...(input.recordHistory !== undefined ? { recordHistory: input.recordHistory } : {}),
          ...(input.stripQueryParams !== undefined
            ? { stripQueryParams: input.stripQueryParams }
            : {}),
          ...(input.stripFragments !== undefined ? { stripFragments: input.stripFragments } : {}),
          ...(input.excludedHosts !== undefined
            ? { excludedHosts: JSON.stringify(input.excludedHosts) }
            : {}),
        })
        .where(eq(userSettings.userId, userId));

      return getOrCreateSettings(userId);
    }),
};
