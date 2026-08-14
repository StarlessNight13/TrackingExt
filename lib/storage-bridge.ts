import type { LocalState } from "./types";

export const STORAGE_BRIDGE_TARGET = "storage-bridge";

export type StorageBridgeRequest =
  | { type: "GET_LOCAL_STATE" }
  | { type: "SET_LOCAL_STATE"; patch: Partial<LocalState> };

export type StorageBridgeResponse = { ok: true; state?: LocalState } | { ok: false; error: string };

export function isStorageBridgeMessage(
  message: unknown,
): message is StorageBridgeRequest & { target: string } {
  return (
    typeof message === "object" &&
    message !== null &&
    "target" in message &&
    (message as { target?: string }).target === STORAGE_BRIDGE_TARGET &&
    "type" in message
  );
}

export function canAccessLocalStorage() {
  return typeof browser !== "undefined" && browser.storage?.local !== undefined;
}

async function callStorageBridge(request: StorageBridgeRequest): Promise<StorageBridgeResponse> {
  const response = (await browser.runtime.sendMessage({
    ...request,
    target: STORAGE_BRIDGE_TARGET,
  })) as StorageBridgeResponse | undefined;

  if (!response) {
    throw new Error(`${request.type}: no response from extension background.`);
  }

  return response;
}

export async function getLocalStateViaBridge(): Promise<LocalState> {
  const response = await callStorageBridge({ type: "GET_LOCAL_STATE" });
  if (!response.ok || !response.state) {
    throw new Error(response.ok ? "Missing local state" : response.error);
  }
  return response.state;
}

export async function setLocalStateViaBridge(patch: Partial<LocalState>): Promise<LocalState> {
  const response = await callStorageBridge({ type: "SET_LOCAL_STATE", patch });
  if (!response.ok || !response.state) {
    throw new Error(response.ok ? "Missing local state" : response.error);
  }
  return response.state;
}
