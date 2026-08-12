import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { devicesRouter } from "./devices";
import { settingsRouter } from "./settings";
import { trackedTabsRouter } from "./tracked-tabs";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  devices: devicesRouter,
  trackedTabs: trackedTabsRouter,
  settings: settingsRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
