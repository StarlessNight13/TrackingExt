import type { LanTabEvent } from "./broadcast";

export const OFFSCREEN_TARGET = "lan-offscreen";
export const OFFSCREEN_PATH = "/offscreen.html";

export type OffscreenLanRequest =
  | { type: "SYNC_LAN_MANAGER" }
  | { type: "RECONNECT_LAN_PEERS" }
  | { type: "REMOVE_LAN_PEER"; deviceId: string }
  | { type: "START_LOCAL_LAN_PAIRING" }
  | { type: "JOIN_LOCAL_LAN_PAIRING"; offerToken: string }
  | { type: "COMPLETE_LOCAL_LAN_PAIRING"; answerToken: string }
  | { type: "CANCEL_LOCAL_LAN_PAIRING" }
  | { type: "BROADCAST_TAB_EVENT"; event: LanTabEvent }
  | { type: "GET_LAN_STATUS"; peerDeviceIds: string[] };

export type OffscreenLanSuccess = {
  ok: true;
  localPairingToken?: string;
  openChannelCount?: number;
  peerStatus?: Record<string, boolean>;
};

export type OffscreenLanResponse = OffscreenLanSuccess | { ok: false; error: string };

export function isOffscreenLanMessage(
  message: unknown,
): message is OffscreenLanRequest & { target: string } {
  return (
    typeof message === "object" &&
    message !== null &&
    "target" in message &&
    (message as { target?: string }).target === OFFSCREEN_TARGET &&
    "type" in message
  );
}
