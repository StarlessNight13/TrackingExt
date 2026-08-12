import { createDb } from "@trackingext/db";
import * as schema from "@trackingext/db/schema/auth";
import { expandLocalDevOrigins, isMatchingWebOrigin } from "@trackingext/env/cors-origins";
import { env, getAuthPublicConfig } from "@trackingext/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { username } from "better-auth/plugins/username";

const extensionOriginPatterns = ["chrome-extension://", "moz-extension://"];

function isTrustedOrigin(origin: string | null | undefined) {
  if (!origin) return false;
  if (isMatchingWebOrigin(origin, env.CORS_ORIGIN)) return true;
  return extensionOriginPatterns.some((prefix) => origin.startsWith(prefix));
}

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    trustedOrigins: [...expandLocalDevOrigins(env.CORS_ORIGIN), "chrome-extension://*", "moz-extension://*"],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !env.ALLOW_SIGN_UP,
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
    plugins: [bearer(), username()],
  });
}

export const auth = createAuth();

export { getAuthPublicConfig, isTrustedOrigin };
export { seedDefaultAdminUser } from "./seed-default-user";
