import { createDb } from "@trackingext/db";
import { account, user } from "@trackingext/db/schema/auth";
import { getDefaultAdminCredentials } from "@trackingext/env/server";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

function placeholderEmail(username: string) {
  return `${username.toLowerCase()}@users.local`;
}

export async function seedDefaultAdminUser() {
  const credentials = getDefaultAdminCredentials();
  if (!credentials) {
    return { created: false as const, reason: "missing-credentials" as const };
  }

  const db = createDb();
  const normalizedUsername = credentials.username.toLowerCase();
  const displayUsername = credentials.username;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, normalizedUsername))
    .limit(1);

  if (existing) {
    return { created: false as const, reason: "already-exists" as const, userId: existing.id };
  }

  const userId = crypto.randomUUID();
  const email = placeholderEmail(normalizedUsername);
  const passwordHash = await hashPassword(credentials.password);

  await db.insert(user).values({
    id: userId,
    name: displayUsername,
    email,
    username: normalizedUsername,
    displayUsername,
    emailVerified: true,
  });

  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    accountId: userId,
    providerId: "credential",
    password: passwordHash,
  });

  return { created: true as const, userId };
}
