import { createDb } from "@trackingext/db";
import * as schema from "@trackingext/db/schema/auth";
import { expandLocalDevOrigins, isMatchingWebOrigin, isPrivateNetworkOrigin } from "@trackingext/env/cors-origins";
import { env, getAuthPublicConfig } from "@trackingext/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { username } from "better-auth/plugins/username";

const extensionOriginPatterns = ["chrome-extension://", "moz-extension://"];

function isTrustedOrigin(origin: string | null | undefined) {
  if (!origin) return false;
  if (isMatchingWebOrigin(origin, env.CORS_ORIGIN)) return true;
  if (env.NODE_ENV === "development" && isPrivateNetworkOrigin(origin)) return true;
  return extensionOriginPatterns.some((prefix) => origin.startsWith(prefix));
}

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    trustedOrigins: async (request) => {
      const origins = [
        ...expandLocalDevOrigins(env.CORS_ORIGIN),
        "chrome-extension://*",
        "moz-extension://*",
      ];
      if (env.NODE_ENV === "development" && request) {
        const requestOrigin = request.headers.get("origin");
        if (requestOrigin && isPrivateNetworkOrigin(requestOrigin) && !origins.includes(requestOrigin)) {
          origins.push(requestOrigin);
        }
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        if (host) {
          const proto = request.headers.get("x-forwarded-proto") ?? "http";
          const fromHost = `${proto}://${host}`;
          if (isPrivateNetworkOrigin(fromHost) && !origins.includes(fromHost)) {
            origins.push(fromHost);
          }
        }
      }
      return origins;
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: !env.ALLOW_SIGN_UP,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL:
      env.NODE_ENV === "development"
        ? {
            // Derive from the Host header so opening via LAN/Tailscale IP works
            allowedHosts: ["*"],
            fallback: env.BETTER_AUTH_URL,
            protocol: "http",
          }
        : env.BETTER_AUTH_URL,
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
