import { adoptLanPairedConnection } from "./manager";
import { savePairedLanDevice } from "./paired-devices";
import { acceptOfferConnection, createOfferConnection, finalizeAnswerConnection } from "./webrtc";
import { ensureLocalDeviceId, getEffectiveDeviceName } from "../local-device";
import { detectBrowser } from "../device";

export type LocalPairingPayload = {
  v: 1;
  kind: "offer" | "answer";
  deviceId: string;
  deviceName: string;
  browser: string;
  sdp: string;
};

let pendingHost: {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  peerDeviceId: string;
  peerDeviceName: string;
} | null = null;

function encodePayload(payload: LocalPairingPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(token: string): LocalPairingPayload {
  const normalized = token.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as LocalPairingPayload;
  if (parsed.v !== 1 || !parsed.sdp || !parsed.deviceId) {
    throw new Error("Invalid pairing payload");
  }
  return parsed;
}

export async function startLocalPairingSession(): Promise<{ offerToken: string }> {
  const deviceId = await ensureLocalDeviceId();
  const deviceName = await getEffectiveDeviceName();
  const browser = detectBrowser();
  const { pc, channel, waitForIceGathering } = await createOfferConnection();
  await waitForIceGathering();

  const offerSdp = pc.localDescription?.sdp;
  if (!offerSdp) throw new Error("Failed to create local pairing offer");

  pendingHost = { pc, channel, peerDeviceId: deviceId, peerDeviceName: deviceName };

  return {
    offerToken: encodePayload({
      v: 1,
      kind: "offer",
      deviceId,
      deviceName,
      browser,
      sdp: offerSdp,
    }),
  };
}

export async function joinLocalPairingSession(
  offerToken: string,
): Promise<{ answerToken: string }> {
  const deviceId = await ensureLocalDeviceId();
  const deviceName = await getEffectiveDeviceName();
  const browser = detectBrowser();
  const offer = decodePayload(offerToken);
  if (offer.kind !== "offer") throw new Error("Expected a pairing offer");

  let incomingChannel: RTCDataChannel | undefined;
  const { pc, waitForIceGathering } = await acceptOfferConnection(offer.sdp, (channel) => {
    incomingChannel = channel;
  });

  await waitForIceGathering();
  const answerSdp = pc.localDescription?.sdp;
  if (!answerSdp) throw new Error("Failed to create local pairing answer");

  await savePairedLanDevice({
    deviceId: offer.deviceId,
    deviceName: offer.deviceName,
    browser: offer.browser,
    pairedAt: new Date().toISOString(),
  });

  adoptLanPairedConnection(offer.deviceId, pc, incomingChannel);

  return {
    answerToken: encodePayload({
      v: 1,
      kind: "answer",
      deviceId,
      deviceName,
      browser,
      sdp: answerSdp,
    }),
  };
}

export async function completeLocalPairingSession(answerToken: string) {
  const host = pendingHost;
  if (!host) throw new Error("No local pairing session in progress");

  const answer = decodePayload(answerToken);
  if (answer.kind !== "answer") throw new Error("Expected a pairing answer");

  await finalizeAnswerConnection(host.pc, answer.sdp);
  pendingHost = null;

  await savePairedLanDevice({
    deviceId: answer.deviceId,
    deviceName: answer.deviceName,
    browser: answer.browser,
    pairedAt: new Date().toISOString(),
  });

  adoptLanPairedConnection(answer.deviceId, host.pc, host.channel);
}

export function cancelLocalPairingSession() {
  if (pendingHost) {
    pendingHost.pc.close();
    pendingHost = null;
  }
}
