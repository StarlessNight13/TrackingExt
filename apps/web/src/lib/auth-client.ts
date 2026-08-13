import { env } from "@trackingext/env/web";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

import { getServerUrl } from "@/lib/server-url";

export const authClient = createAuthClient({
  // better-auth derives its route-matching base from this URL's path, so the
  // public auth path must equal the server-side mount (/api/auth everywhere)
  baseURL: new URL("/api/auth", getServerUrl(env.VITE_SERVER_URL)).toString(),
  plugins: [usernameClient()],
});
