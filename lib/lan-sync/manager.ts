import {
  isPeerConnected,
  registerLanChannel,
  sendLanSnapshot,
  unregisterLanChannel,
} from "./broadcast";
import { removePairedLanDevice } from "./paired-devices";

const connections = new Map<string, RTCPeerConnection>();

export async function syncLanManager() {}
export async function reconnectLanPeers() {}

export function adoptLanPairedConnection(
  peerDeviceId: string,
  pc: RTCPeerConnection,
  channel?: RTCDataChannel,
) {
  connections.set(peerDeviceId, pc);
  if (!channel) return;
  registerLanChannel(peerDeviceId, channel);
  if (channel.readyState === "open") void sendLanSnapshot(channel);
  else channel.addEventListener("open", () => void sendLanSnapshot(channel));
  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      unregisterLanChannel(peerDeviceId);
    }
  });
}

export function isLanPeerOnline(peerDeviceId: string) {
  return isPeerConnected(peerDeviceId);
}

export async function removeLanPeer(peerDeviceId: string) {
  unregisterLanChannel(peerDeviceId);
  connections.get(peerDeviceId)?.close();
  connections.delete(peerDeviceId);
  await removePairedLanDevice(peerDeviceId);
}
