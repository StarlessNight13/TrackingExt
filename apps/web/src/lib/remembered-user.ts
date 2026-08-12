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

export function loadRememberedUser(): RememberedUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RememberedUser>;
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

export function saveRememberedUser(user: RememberedUser) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        loginId: user.loginId,
        signInMethod: user.signInMethod,
        displayName: user.displayName,
        email: user.email,
        username: user.username,
      }),
    );
  } catch {
    // Private browsing or disabled storage.
  }
}

export function clearRememberedUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
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
