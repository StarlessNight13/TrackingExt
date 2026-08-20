import {
  isPeerConnected,
  registerLanChannel,
  sendLanSnapshot,
  unregisterLanChannel,
} from "./broadcast";
import { removePairedLanDevice } from "./paired-devices";

const connections = new Map<string, RTCPeerConnection>();

export function adoptLanPairedConnection(
  peerDeviceId: string,
  pc: RTCPeerConnection,
  channel?: RTCDataChannel,
) {
  connections.get(peerDeviceId)?.close();
  connections.set(peerDeviceId, pc);

  const clearConnection = () => {
    if (connections.get(peerDeviceId) !== pc) return;
    connections.delete(peerDeviceId);
    unregisterLanChannel(peerDeviceId, channel);
  };

  if (channel) {
    registerLanChannel(peerDeviceId, channel);
    if (channel.readyState === "open") void sendLanSnapshot(channel);
    else channel.addEventListener("open", () => void sendLanSnapshot(channel));
    channel.addEventListener("close", clearConnection, { once: true });
  }

  pc.addEventListener("connectionstatechange", () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      clearConnection();
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
