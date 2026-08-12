import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const envBoolean = z
  .string()
  .default("true")
  .transform((value) => value === "true" || value === "1");

const usernameSchema = z
  .string()
  .min(3, "DEFAULT_ADMIN_USERNAME must be at least 3 characters")
  .max(30, "DEFAULT_ADMIN_USERNAME must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_.]+$/,
    "DEFAULT_ADMIN_USERNAME can only contain letters, numbers, underscores, and periods",
  );

const passwordSchema = z
  .string()
  .min(8, "DEFAULT_ADMIN_PASSWORD must be at least 8 characters");

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    ALLOW_SIGN_UP: envBoolean,
    DEFAULT_ADMIN_USERNAME: usernameSchema.optional(),
    DEFAULT_ADMIN_PASSWORD: passwordSchema.optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

if (!process.env.SKIP_ENV_VALIDATION) {
  if (!env.ALLOW_SIGN_UP) {
    usernameSchema.parse(env.DEFAULT_ADMIN_USERNAME);
    passwordSchema.parse(env.DEFAULT_ADMIN_PASSWORD);
  }
}

export function getDefaultAdminCredentials() {
  if (!env.DEFAULT_ADMIN_USERNAME || !env.DEFAULT_ADMIN_PASSWORD) {
    return null;
  }

  return {
    username: env.DEFAULT_ADMIN_USERNAME,
    password: env.DEFAULT_ADMIN_PASSWORD,
  };
}

export function getAuthPublicConfig() {
  return {
    allowSignUp: env.ALLOW_SIGN_UP,
  };
}
