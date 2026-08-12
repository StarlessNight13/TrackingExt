import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    VITE_SERVER_URL:
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SERVER_URL ??
      "http://localhost:3000",
  },
  emptyStringAsUndefined: true,
});
