import { requireServerUrl } from "./server-url";

export type AuthConfig = {
  allowSignUp: boolean;
};

export async function getAuthConfig(): Promise<AuthConfig> {
  const serverUrl = await requireServerUrl();
  const res = await fetch(`${serverUrl}/api/auth/config`);

  if (!res.ok) {
    throw new Error("Failed to load auth configuration");
  }

  return (await res.json()) as AuthConfig;
}
