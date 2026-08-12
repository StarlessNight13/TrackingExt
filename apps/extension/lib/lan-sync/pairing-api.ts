import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AppRouterClient } from "@trackingext/api/routers/index";

import { getServerUrl } from "../server-url";

export async function getPairingApiClient(): Promise<AppRouterClient> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) {
    throw new Error("Set a pairing relay URL first");
  }

  const link = new RPCLink({
    url: `${serverUrl}/rpc`,
    headers: async () => ({}),
  });

  return createORPCClient(link);
}

function generatePairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export { generatePairingCode };
