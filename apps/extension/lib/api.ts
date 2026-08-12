import type { AppRouterClient } from "@trackingext/api/routers/index";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import { getLocalState } from "./storage";
import { requireServerUrl } from "./server-url";

export async function getApiClient(token?: string | null): Promise<AppRouterClient> {
  const serverUrl = await requireServerUrl();
  const link = new RPCLink({
    url: `${serverUrl}/rpc`,
    headers: async () => {
      const state = token !== undefined ? { sessionToken: token } : await getLocalState();
      if (!state.sessionToken) return {};
      return { Authorization: `Bearer ${state.sessionToken}` };
    },
  });
  return createORPCClient(link);
}
