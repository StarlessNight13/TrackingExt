import { getLocalState } from "../storage";
import {
  OFFSCREEN_PATH,
  OFFSCREEN_TARGET,
  type OffscreenLanRequest,
  type OffscreenLanResponse,
  type OffscreenLanSuccess,
} from "./offscreen-protocol";

type OffscreenApi = {
  createDocument(options: { url: string; reasons: string[]; justification: string }): Promise<void>;
};

type RuntimeWithContexts = typeof browser.runtime & {
  getContexts?(filter: {
    contextTypes: string[];
    documentUrls: string[];
  }): Promise<Array<{ contextType: string }>>;
};

let creatingOffscreen: Promise<void> | null = null;

function getOffscreenApi(): OffscreenApi {
  const offscreen = (browser as typeof browser & { offscreen?: OffscreenApi }).offscreen;
  if (!offscreen) {
    throw new Error(
      "LAN sync requires a Chromium-based browser with offscreen document support (Chrome 109+, Edge, or Helium).",
    );
  }
  return offscreen;
}

export async function ensureOffscreenDocument() {
  const offscreen = getOffscreenApi();
  const url = browser.runtime.getURL(OFFSCREEN_PATH);
  const runtime = browser.runtime as RuntimeWithContexts;

  if (runtime.getContexts) {
    const contexts = await runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url],
    });
    if (contexts.length > 0) return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["WEB_RTC"],
      justification:
        "Maintain peer-to-peer LAN sync between extension instances using WebRTC data channels.",
    })
    .finally(() => {
      creatingOffscreen = null;
    });

  await creatingOffscreen;
}

export async function callOffscreenLan(request: OffscreenLanRequest): Promise<OffscreenLanSuccess> {
  await ensureOffscreenDocument();

  let response: OffscreenLanResponse | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = (await browser.runtime.sendMessage({
      ...request,
      target: OFFSCREEN_TARGET,
    })) as OffscreenLanResponse | undefined;

    if (response !== undefined) break;
    await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
  }

  if (!response) {
    throw new Error(
      `${request.type}: no response from LAN offscreen document. Reload the extension and try again.`,
    );
  }

  if (!response.ok) {
    throw new Error(response.error || `${request.type} failed`);
  }

  return response;
}

export async function syncLanManagerViaOffscreen() {
  await callOffscreenLan({ type: "SYNC_LAN_MANAGER" });
}

export async function reconnectLanPeersViaOffscreen() {
  await callOffscreenLan({ type: "RECONNECT_LAN_PEERS" });
}

export async function removeLanPeerViaOffscreen(deviceId: string) {
  await callOffscreenLan({ type: "REMOVE_LAN_PEER", deviceId });
}

export async function getLanStatusFromOffscreen(peerDeviceIds: string[]) {
  try {
    const state = await getLocalState();
    if (!state.syncModes.lan) {
      return { openChannelCount: 0, peerStatus: {} as Record<string, boolean> };
    }

    const response = await callOffscreenLan({
      type: "GET_LAN_STATUS",
      peerDeviceIds,
    });

    return {
      openChannelCount: response.openChannelCount ?? 0,
      peerStatus: response.peerStatus ?? {},
    };
  } catch {
    return {
      openChannelCount: 0,
      peerStatus: Object.fromEntries(peerDeviceIds.map((id) => [id, false])),
    };
  }
}

export function canUseWebRtcInThisContext() {
  return typeof RTCPeerConnection !== "undefined";
}
