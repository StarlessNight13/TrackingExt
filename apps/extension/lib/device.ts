import { getApiClient } from "./api";
import { getLocalState, setLocalState } from "./storage";

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "Browser";
}

function defaultDeviceName() {
  return `${detectBrowser()} on this device`;
}

export async function ensureDeviceRegistered() {
  const state = await getLocalState();
  if (!state.sessionToken) {
    throw new Error("Not signed in");
  }

  const name = state.deviceName?.trim() || defaultDeviceName();
  const api = await getApiClient();
  const registered = await api.devices.register({
    id: state.deviceId ?? undefined,
    name,
    browser: detectBrowser(),
  });

  await setLocalState({
    deviceId: registered.id,
    deviceName: registered.name,
  });

  return registered;
}

export async function renameDevice(name: string) {
  const state = await getLocalState();
  if (!state.deviceId) {
    throw new Error("Device not registered");
  }
  const api = await getApiClient();
  const updated = await api.devices.rename({ id: state.deviceId, name });
  if (updated) {
    await setLocalState({ deviceName: updated.name });
  }
  return updated;
}

export { detectBrowser, defaultDeviceName };
