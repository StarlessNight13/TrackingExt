import { z } from "zod";

import { db } from "@trackingext/db";
import { userSettings } from "@trackingext/db/schema/tracked";
import { eq } from "drizzle-orm";

import { purgeExpiredHistoryForUser } from "../lib/history-retention";
import { DASHBOARD_THEME_VARIANTS, getOrCreateSettings } from "../lib/settings";
import { protectedProcedure } from "../index";

const historyRetentionSchema = z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]);

export const settingsRouter = {
  get: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    await purgeExpiredHistoryForUser(userId);
    return getOrCreateSettings(userId);
  }),

  update: protectedProcedure
    .input(
      z.object({
        recordHistory: z.boolean().optional(),
        stripQueryParams: z.boolean().optional(),
        stripFragments: z.boolean().optional(),
        excludedHosts: z.array(z.string().min(1).max(253)).max(200).optional(),
        dashboardThemeSeed: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        dashboardThemeVariant: z.enum(DASHBOARD_THEME_VARIANTS).optional(),
        historyRetentionDays: historyRetentionSchema.optional(),
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
          ...(input.dashboardThemeSeed !== undefined
            ? { dashboardThemeSeed: input.dashboardThemeSeed }
            : {}),
          ...(input.dashboardThemeVariant !== undefined
            ? { dashboardThemeVariant: input.dashboardThemeVariant }
            : {}),
          ...(input.historyRetentionDays !== undefined
            ? { historyRetentionDays: input.historyRetentionDays }
            : {}),
        })
        .where(eq(userSettings.userId, userId));

      if (input.historyRetentionDays !== undefined) {
        await purgeExpiredHistoryForUser(userId);
      }

      return getOrCreateSettings(userId);
    }),

  purgeHistory: protectedProcedure.handler(async ({ context }) => {
    return purgeExpiredHistoryForUser(context.session.user.id);
  }),
};
