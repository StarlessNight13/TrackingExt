import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url(),
    VITE_CHROME_WEB_STORE_URL: z.url().optional(),
    VITE_FIREFOX_ADDON_URL: z.url().optional(),
    VITE_CHROMIUM_DOWNLOAD_URL: z.string().default("/downloads/trackingext-chromium.zip"),
    VITE_FIREFOX_DOWNLOAD_URL: z.string().default("/downloads/trackingext-firefox.zip"),
  },
  runtimeEnv: (import.meta as any).env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
