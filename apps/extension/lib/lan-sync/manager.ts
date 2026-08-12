import { ensureLocalDeviceId } from "../local-device";
import { getLocalState } from "../storage";
import { usesServerRelayForLan } from "../sync-modes";
import { listPairedLanDevices, removePairedLanDevice } from "./paired-devices";
import {
  isPeerConnected,
  registerLanChannel,
  sendLanSnapshot,
  unregisterLanChannel,
} from "./broadcast";
import { pollLanSignals, postLanSignal, type LanSignalMessage } from "./signaling";
import {
  acceptOfferConnection,
  attachDataChannelHandler,
  createOfferConnection,
  finalizeAnswerConnection,
  waitForIceGatheringComplete,
  wireIceCandidateHandler,
} from "./webrtc";

const POLL_INTERVAL_MS = 2500;
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;

function shouldInitiate(localDeviceId: string, peerDeviceId: string) {
  return localDeviceId.localeCompare(peerDeviceId) < 0;
}

function isConnectionActive(pc: RTCPeerConnection) {
  return pc.connectionState === "connected" || pc.connectionState === "connecting";
}

class LanSyncManager {
  private connections = new Map<string, RTCPeerConnection>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = new Map<string, number>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = false;
  private handlingSignals = false;

  private async usesServerRelay() {
    const state = await getLocalState();
    return usesServerRelayForLan(state.syncModes, state.lanSignalingMode, state.serverUrl);
  }

  async start() {
    if (this.running) {
      if (await this.usesServerRelay()) {
        await this.ensurePeerConnections();
      }
      return;
    }

    const state = await getLocalState();
    if (!state.syncModes.lan || !state.onboardingComplete) {
      return;
    }
    if (state.lanSignalingMode === "server-relay" && !state.serverUrl) {
      return;
    }

    this.running = true;
    if (await this.usesServerRelay()) {
      await this.ensurePeerConnections();
      this.pollTimer = setInterval(() => {
        void this.pollSignals();
      }, POLL_INTERVAL_MS);
      void this.pollSignals();
    }
  }

  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.reconnectAttempts.clear();

    for (const [peerId, pc] of this.connections) {
      unregisterLanChannel(peerId);
      pc.close();
    }
    this.connections.clear();
  }

  async reconnectAll() {
    const state = await getLocalState();
    if (!state.syncModes.lan) return;
    if (!(await this.usesServerRelay())) return;

    const localDeviceId = await ensureLocalDeviceId();
    const peers = await listPairedLanDevices();

    for (const peer of peers) {
      this.clearReconnectTimer(peer.deviceId);
      const pc = this.connections.get(peer.deviceId);
      if (pc) {
        unregisterLanChannel(peer.deviceId);
        pc.close();
        this.connections.delete(peer.deviceId);
      }
      if (shouldInitiate(localDeviceId, peer.deviceId)) {
        await this.connectToPeer(peer.deviceId);
      }
    }
  }

  adoptPairedConnection(peerDeviceId: string, pc: RTCPeerConnection, channel?: RTCDataChannel) {
    this.connections.set(peerDeviceId, pc);
    this.wireConnection(peerDeviceId, pc);
    if (channel) {
      this.registerChannel(peerDeviceId, channel);
    }
  }

  private registerChannel(peerDeviceId: string, channel: RTCDataChannel) {
    registerLanChannel(peerDeviceId, channel);
    if (channel.readyState === "open") {
      this.reconnectAttempts.delete(peerDeviceId);
      void sendLanSnapshot(channel);
      return;
    }
    channel.addEventListener("open", () => {
      this.reconnectAttempts.delete(peerDeviceId);
      void sendLanSnapshot(channel);
    });
  }

  private async ensurePeerConnections() {
    const localDeviceId = await ensureLocalDeviceId();
    const peers = await listPairedLanDevices();

    for (const peer of peers) {
      if (isPeerConnected(peer.deviceId)) continue;

      const existing = this.connections.get(peer.deviceId);
      if (existing && isConnectionActive(existing)) continue;

      if (shouldInitiate(localDeviceId, peer.deviceId)) {
        await this.connectToPeer(peer.deviceId);
      }
    }
  }

  private async pollSignals() {
    if (!this.running || this.handlingSignals) return;

    this.handlingSignals = true;
    try {
      const deviceId = await ensureLocalDeviceId();
      const signals = await pollLanSignals(deviceId);
      for (const signal of signals) {
        await this.handleSignal(signal);
      }
    } catch {
      // relay may be temporarily unavailable
    } finally {
      this.handlingSignals = false;
    }
  }

  private async handleSignal(signal: LanSignalMessage) {
    switch (signal.kind) {
      case "offer":
        await this.handleOffer(signal.fromDeviceId, signal.payload);
        break;
      case "answer":
        await this.handleAnswer(signal.fromDeviceId, signal.payload);
        break;
      case "ice":
        await this.handleIce(signal.fromDeviceId, signal.payload);
        break;
    }
  }

  private async connectToPeer(peerDeviceId: string) {
    const localDeviceId = await ensureLocalDeviceId();
    const existing = this.connections.get(peerDeviceId);
    if (existing) {
      if (isConnectionActive(existing)) return;
      unregisterLanChannel(peerDeviceId);
      existing.close();
      this.connections.delete(peerDeviceId);
    }

    const { pc, channel, waitForIceGathering } = await createOfferConnection();
    this.connections.set(peerDeviceId, pc);
    this.wireConnection(peerDeviceId, pc);
    this.registerChannel(peerDeviceId, channel);

    await waitForIceGathering();
    const offerSdp = pc.localDescription?.sdp;
    if (!offerSdp) return;

    await postLanSignal({
      fromDeviceId: localDeviceId,
      toDeviceId: peerDeviceId,
      kind: "offer",
      payload: offerSdp,
    });
  }

  private async handleOffer(peerDeviceId: string, offerSdp: string) {
    const localDeviceId = await ensureLocalDeviceId();

    if (shouldInitiate(localDeviceId, peerDeviceId)) {
      return;
    }

    const existing = this.connections.get(peerDeviceId);
    if (existing && isConnectionActive(existing)) {
      return;
    }

    if (existing) {
      unregisterLanChannel(peerDeviceId);
      existing.close();
    }

    const { pc, waitForIceGathering } = await acceptOfferConnection(offerSdp, (channel) => {
      this.registerChannel(peerDeviceId, channel);
    });
    this.connections.set(peerDeviceId, pc);
    this.wireConnection(peerDeviceId, pc);

    await waitForIceGathering();
    const answerSdp = pc.localDescription?.sdp;
    if (!answerSdp) return;

    await postLanSignal({
      fromDeviceId: localDeviceId,
      toDeviceId: peerDeviceId,
      kind: "answer",
      payload: answerSdp,
    });
  }

  private async handleAnswer(peerDeviceId: string, answerSdp: string) {
    const pc = this.connections.get(peerDeviceId);
    if (!pc || pc.signalingState !== "have-local-offer") return;

    await finalizeAnswerConnection(pc, answerSdp);
    this.reconnectAttempts.delete(peerDeviceId);
  }

  private async handleIce(peerDeviceId: string, payload: string) {
    const pc = this.connections.get(peerDeviceId);
    if (!pc) return;

    try {
      const candidate = JSON.parse(payload) as RTCIceCandidateInit;
      await pc.addIceCandidate(candidate);
    } catch {
      // ignore malformed ICE payloads
    }
  }

  private wireConnection(peerDeviceId: string, pc: RTCPeerConnection) {
    attachDataChannelHandler(pc, (channel) => {
      this.registerChannel(peerDeviceId, channel);
    });

    wireIceCandidateHandler(pc, (candidate) => {
      void this.usesServerRelay().then((relay) => {
        if (!relay) return;
        void ensureLocalDeviceId().then((localDeviceId) =>
          postLanSignal({
            fromDeviceId: localDeviceId,
            toDeviceId: peerDeviceId,
            kind: "ice",
            payload: JSON.stringify(candidate.toJSON()),
          }),
        );
      });
    });

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "connected") {
        this.reconnectAttempts.delete(peerDeviceId);
        return;
      }

      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        unregisterLanChannel(peerDeviceId);
        void this.usesServerRelay().then((relay) => {
          if (relay && this.running) {
            this.scheduleReconnect(peerDeviceId);
          }
        });
      }
    });
  }

  private scheduleReconnect(peerDeviceId: string) {
    if (this.reconnectTimers.has(peerDeviceId)) return;

    const attempts = this.reconnectAttempts.get(peerDeviceId) ?? 0;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempts, RECONNECT_MAX_MS);
    this.reconnectAttempts.set(peerDeviceId, attempts + 1);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(peerDeviceId);
      void this.ensurePeerConnections();
    }, delay);
    this.reconnectTimers.set(peerDeviceId, timer);
  }

  private clearReconnectTimer(peerDeviceId: string) {
    const timer = this.reconnectTimers.get(peerDeviceId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerDeviceId);
    }
    this.reconnectAttempts.delete(peerDeviceId);
  }

  dropPeer(peerDeviceId: string) {
    this.clearReconnectTimer(peerDeviceId);
    const pc = this.connections.get(peerDeviceId);
    if (pc) {
      unregisterLanChannel(peerDeviceId);
      pc.close();
      this.connections.delete(peerDeviceId);
    }
  }
}

let manager: LanSyncManager | null = null;

function getManager() {
  if (!manager) {
    manager = new LanSyncManager();
  }
  return manager;
}

function canRunLanManager(state: Awaited<ReturnType<typeof getLocalState>>) {
  if (!state.syncModes.lan || !state.onboardingComplete) return false;
  if (state.lanSignalingMode === "local") return true;
  return Boolean(state.serverUrl);
}

export async function syncLanManager() {
  const state = await getLocalState();
  const lanManager = getManager();
  if (canRunLanManager(state)) {
    await lanManager.start();
  } else {
    await lanManager.stop();
  }
}

export async function reconnectLanPeers() {
  await getManager().reconnectAll();
}

export function adoptLanPairedConnection(
  peerDeviceId: string,
  pc: RTCPeerConnection,
  channel?: RTCDataChannel,
) {
  getManager().adoptPairedConnection(peerDeviceId, pc, channel);
}

export function isLanPeerOnline(peerDeviceId: string) {
  return isPeerConnected(peerDeviceId);
}

export async function removeLanPeer(peerDeviceId: string) {
  getManager().dropPeer(peerDeviceId);
  await removePairedLanDevice(peerDeviceId);
}
