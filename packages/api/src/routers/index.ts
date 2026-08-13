import type { RouterClient } from "@orpc/server";

import { getAuthPublicConfig } from "@trackingext/env/server";

import { protectedProcedure, publicProcedure } from "../index";
import { devicesRouter } from "./devices";
import { groupsRouter } from "./groups";
import { lanSyncRouter } from "./lan-sync";
import { settingsRouter } from "./settings";
import { trackedTabsRouter } from "./tracked-tabs";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  authConfig: publicProcedure.handler(() => {
    return getAuthPublicConfig();
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  devices: devicesRouter,
  groups: groupsRouter,
  trackedTabs: trackedTabsRouter,
  settings: settingsRouter,
  lanSync: lanSyncRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
