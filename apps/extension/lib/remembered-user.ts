const STORAGE_KEY = "remembered-user:v1";

export type RememberedUser = {
  loginId: string;
  signInMethod: "username" | "email";
  displayName: string;
  email?: string;
  username?: string;
};

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export async function loadRememberedUser(): Promise<RememberedUser | null> {
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const raw = stored[STORAGE_KEY];
    if (!raw || typeof raw !== "object") return null;

    const parsed = raw as Partial<RememberedUser>;
    if (
      typeof parsed.loginId !== "string" ||
      (parsed.signInMethod !== "username" && parsed.signInMethod !== "email") ||
      typeof parsed.displayName !== "string"
    ) {
      return null;
    }

    return {
      loginId: parsed.loginId,
      signInMethod: parsed.signInMethod,
      displayName: parsed.displayName,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      username: typeof parsed.username === "string" ? parsed.username : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveRememberedUser(user: RememberedUser) {
  await browser.storage.local.set({ [STORAGE_KEY]: user });
}

export async function clearRememberedUser() {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function buildRememberedUserFromSession(input: {
  loginId: string;
  signInMethod: RememberedUser["signInMethod"];
  user: {
    name?: string | null;
    email?: string | null;
    username?: string | null;
    displayUsername?: string | null;
  };
}): RememberedUser {
  const displayName =
    input.user.name ??
    input.user.displayUsername ??
    input.user.username ??
    input.loginId;

  return {
    loginId: input.loginId,
    signInMethod: input.signInMethod,
    displayName,
    email: input.user.email ?? undefined,
    username: input.user.username ?? undefined,
  };
}
