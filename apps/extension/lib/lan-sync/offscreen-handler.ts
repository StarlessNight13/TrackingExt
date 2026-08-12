import {
  isLanPeerOnline,
  reconnectLanPeers,
  removeLanPeer,
  syncLanManager,
} from "./manager";
import { joinPairingSession, pollPairingCompletion, startPairingSession } from "./pairing";
import {
  cancelLocalPairingSession,
  completeLocalPairingSession,
  joinLocalPairingSession,
  startLocalPairingSession,
} from "./local-pairing";
import { broadcastLanTabEventDirect, getOpenLanChannelCount } from "./broadcast";
import type { OffscreenLanRequest, OffscreenLanResponse } from "./offscreen-protocol";

export async function handleOffscreenLanMessage(
  message: OffscreenLanRequest,
): Promise<OffscreenLanResponse> {
  try {
    switch (message.type) {
      case "SYNC_LAN_MANAGER":
        await syncLanManager();
        return { ok: true };

      case "RECONNECT_LAN_PEERS":
        await reconnectLanPeers();
        return { ok: true };

      case "REMOVE_LAN_PEER":
        await removeLanPeer(message.deviceId);
        return { ok: true };

      case "START_LOCAL_LAN_PAIRING": {
        const session = await startLocalPairingSession();
        return { ok: true, localPairingToken: session.offerToken };
      }

      case "JOIN_LOCAL_LAN_PAIRING": {
        const session = await joinLocalPairingSession(message.offerToken);
        return { ok: true, localPairingToken: session.answerToken };
      }

      case "COMPLETE_LOCAL_LAN_PAIRING":
        await completeLocalPairingSession(message.answerToken);
        return { ok: true };

      case "CANCEL_LOCAL_LAN_PAIRING":
        cancelLocalPairingSession();
        return { ok: true };

      case "START_LAN_PAIRING": {
        const session = await startPairingSession();
        return { ok: true, pairingCode: session.code };
      }

      case "POLL_LAN_PAIRING": {
        const result = await pollPairingCompletion(message.code);
        return { ok: true, pairingComplete: Boolean(result) };
      }

      case "JOIN_LAN_PAIRING":
        await joinPairingSession(message.code);
        return { ok: true };

      case "BROADCAST_TAB_EVENT":
        await broadcastLanTabEventDirect(message.event);
        return { ok: true };

      case "GET_LAN_STATUS":
        return {
          ok: true,
          openChannelCount: getOpenLanChannelCount(),
          peerStatus: Object.fromEntries(
            message.peerDeviceIds.map((deviceId) => [deviceId, isLanPeerOnline(deviceId)]),
          ),
        };

      default:
        return { ok: false, error: `Unknown offscreen LAN message: ${(message as { type: string }).type}` };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${message.type}: ${detail}` };
  }
}
