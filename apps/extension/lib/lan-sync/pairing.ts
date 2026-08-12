import { adoptLanPairedConnection, syncLanManager } from "./manager";
import { getPairingApiClient } from "./pairing-api";
import { savePairedLanDevice } from "./paired-devices";
import {
  acceptOfferConnection,
  attachDataChannelHandler,
  createOfferConnection,
  finalizeAnswerConnection,
} from "./webrtc";
import { ensureLocalDeviceId, getEffectiveDeviceName } from "../local-device";
import { detectBrowser } from "../device";

let pendingInitiator: { pc: RTCPeerConnection; channel: RTCDataChannel } | null = null;

export async function startPairingSession(): Promise<{ code: string; expiresAt: string }> {
  const deviceId = await ensureLocalDeviceId();
  const deviceName = await getEffectiveDeviceName();
  const { pc, channel, waitForIceGathering } = await createOfferConnection();
  await waitForIceGathering();

  const offerSdp = pc.localDescription?.sdp;
  if (!offerSdp) throw new Error("Failed to create pairing offer");

  pendingInitiator = { pc, channel };

  const api = await getPairingApiClient();
  return api.lanSync.createPairing({
    initiatorDeviceId: deviceId,
    initiatorDeviceName: deviceName,
    offerSdp,
  });
}

export async function pollPairingCompletion(code: string) {
  const deviceId = await ensureLocalDeviceId();
  const api = await getPairingApiClient();
  const answer = await api.lanSync.pollPairingAnswer({ code, initiatorDeviceId: deviceId });
  if (!answer) return null;

  const pending = pendingInitiator;
  if (!pending) throw new Error("Pairing connection lost");

  await finalizeAnswerConnection(pending.pc, answer.answerSdp);
  pendingInitiator = null;

  await savePairedLanDevice({
    deviceId: answer.joinerDeviceId,
    deviceName: answer.joinerDeviceName,
    browser: detectBrowser(),
    pairedAt: new Date().toISOString(),
  });

  adoptLanPairedConnection(answer.joinerDeviceId, pending.pc, pending.channel);
  await syncLanManager();

  return answer;
}

export async function joinPairingSession(code: string) {
  const deviceId = await ensureLocalDeviceId();
  const deviceName = await getEffectiveDeviceName();
  const api = await getPairingApiClient();

  const session = await api.lanSync.getPairing({ code });
  if (!session) throw new Error("Invalid or expired pairing code");

  let incomingChannel: RTCDataChannel | undefined;
  const { pc, waitForIceGathering } = await acceptOfferConnection(session.offerSdp, (channel) => {
    incomingChannel = channel;
  });

  await waitForIceGathering();
  const answerSdp = pc.localDescription?.sdp;
  if (!answerSdp) throw new Error("Failed to create pairing answer");

  await api.lanSync.completePairing({
    code,
    joinerDeviceId: deviceId,
    joinerDeviceName: deviceName,
    answerSdp,
  });

  await savePairedLanDevice({
    deviceId: session.initiatorDeviceId,
    deviceName: session.initiatorDeviceName,
    pairedAt: new Date().toISOString(),
  });

  adoptLanPairedConnection(session.initiatorDeviceId, pc, incomingChannel);
  await syncLanManager();

  return session;
}
