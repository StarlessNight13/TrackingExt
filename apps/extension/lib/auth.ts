import { requireServerUrl } from "./server-url";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
  image?: string | null;
};

async function authFetch(path: string, init: RequestInit & { token?: string | null } = {}) {
  const { token, ...rest } = init;
  const serverUrl = await requireServerUrl();
  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${serverUrl}/api/auth${path}`, {
    ...rest,
    headers,
  });
  return res;
}

export async function signIn(usernameOrEmail: string, password: string) {
  const body = usernameOrEmail.includes("@")
    ? { email: usernameOrEmail, password }
    : { username: usernameOrEmail, password };
  const path = usernameOrEmail.includes("@") ? "/sign-in/email" : "/sign-in/username";
  const res = await authFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: SessionUser;
    message?: string;
    session?: { token?: string };
  };
  if (!res.ok) {
    throw new Error(data.message ?? "Sign in failed");
  }
  const token =
    res.headers.get("set-auth-token") ?? data.token ?? data.session?.token ?? null;
  if (!token) {
    throw new Error("No session token returned. Is the bearer plugin enabled?");
  }
  return { token, user: data.user };
}

export async function signUp(username: string, email: string, password: string) {
  const res = await authFetch("/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name: username, username, email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: SessionUser;
    message?: string;
    session?: { token?: string };
  };
  if (!res.ok) {
    throw new Error(data.message ?? "Sign up failed");
  }
  const token =
    res.headers.get("set-auth-token") ?? data.token ?? data.session?.token ?? null;
  if (!token) {
    // Some setups require an immediate sign-in after sign-up
    return signIn(email, password);
  }
  return { token, user: data.user };
}

export async function getSession(token: string) {
  const res = await authFetch("/get-session", {
    method: "GET",
    token,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: SessionUser; session?: { token?: string } } | null;
  if (!data?.user) return null;
  return data;
}

export async function signOut(token: string | null) {
  if (!token) return;
  await authFetch("/sign-out", { method: "POST", token }).catch(() => undefined);
}
