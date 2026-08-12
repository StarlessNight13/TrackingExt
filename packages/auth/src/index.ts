import { createDb } from "@trackingext/db";
import * as schema from "@trackingext/db/schema/auth";
import { env } from "@trackingext/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";

const extensionOriginPatterns = ["chrome-extension://", "moz-extension://"];

function isTrustedOrigin(origin: string | null | undefined) {
  if (!origin) return false;
  if (origin === env.CORS_ORIGIN) return true;
  return extensionOriginPatterns.some((prefix) => origin.startsWith(prefix));
}

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, "chrome-extension://*", "moz-extension://*"],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
    plugins: [bearer()],
  });
}

export const auth = createAuth();

export { isTrustedOrigin };
