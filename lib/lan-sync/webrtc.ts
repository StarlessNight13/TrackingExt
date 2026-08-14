const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export function createPeerConnection() {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export async function createOfferConnection(): Promise<{
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
  offer: RTCSessionDescriptionInit;
  waitForIceGathering: () => Promise<void>;
}> {
  const pc = createPeerConnection();
  const channel = pc.createDataChannel("trackingext-sync");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  return {
    pc,
    channel,
    offer,
    waitForIceGathering: () => waitForIceGatheringComplete(pc),
  };
}

export async function acceptOfferConnection(
  offerSdp: string,
  onChannel?: (channel: RTCDataChannel) => void,
): Promise<{
  pc: RTCPeerConnection;
  answer: RTCSessionDescriptionInit;
  waitForIceGathering: () => Promise<void>;
}> {
  const pc = createPeerConnection();
  if (onChannel) {
    attachDataChannelHandler(pc, onChannel);
  }

  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  return {
    pc,
    answer,
    waitForIceGathering: () => waitForIceGatheringComplete(pc),
  };
}

export async function finalizeAnswerConnection(pc: RTCPeerConnection, answerSdp: string) {
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
}

export function waitForIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 4000);
    pc.addEventListener(
      "icegatheringstatechange",
      () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timeout);
          resolve();
        }
      },
      { once: false },
    );
  });
}

export function wireIceCandidateHandler(
  pc: RTCPeerConnection,
  onCandidate: (candidate: RTCIceCandidate) => void,
) {
  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      onCandidate(event.candidate);
    }
  });
}

export function attachDataChannelHandler(
  pc: RTCPeerConnection,
  onChannel: (channel: RTCDataChannel) => void,
) {
  pc.addEventListener("datachannel", (event) => {
    onChannel(event.channel);
  });
}
