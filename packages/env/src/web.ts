import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // Empty / unset = use the page origin (needed when opening via host IP from another device).
    // Set an absolute URL only when the API is on a different public origin.
    VITE_SERVER_URL: z.url().optional(),
    VITE_CHROME_WEB_STORE_URL: z.url().optional(),
    VITE_FIREFOX_ADDON_URL: z.url().optional(),
    VITE_CHROMIUM_DOWNLOAD_URL: z.string().default("/downloads/trackingext-chromium.zip"),
    VITE_FIREFOX_DOWNLOAD_URL: z.string().default("/downloads/trackingext-firefox.zip"),
  },
  runtimeEnv: (import.meta as any).env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
