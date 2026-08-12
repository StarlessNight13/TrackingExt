import { clearAuthState, getLocalState, setLocalState } from "./storage";
import type { StorageBridgeRequest, StorageBridgeResponse } from "./storage-bridge";

export async function handleStorageBridgeMessage(
  message: StorageBridgeRequest,
): Promise<StorageBridgeResponse> {
  try {
    switch (message.type) {
      case "GET_LOCAL_STATE":
        return { ok: true, state: await getLocalState() };

      case "SET_LOCAL_STATE":
        return { ok: true, state: await setLocalState(message.patch) };

      case "CLEAR_AUTH_STATE":
        await clearAuthState();
        return { ok: true, state: await getLocalState() };

      default:
        return {
          ok: false,
          error: `Unknown storage bridge message: ${(message as { type: string }).type}`,
        };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${message.type}: ${detail}` };
  }
}
