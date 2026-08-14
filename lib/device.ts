import { ensureLocalDeviceId } from "./local-device";
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

export async function renameDevice(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Device name is required");

  const state = await getLocalState();
  await ensureLocalDeviceId();
  await setLocalState({ deviceName: trimmed });
  return { id: state.deviceId ?? state.localDeviceId, name: trimmed };
}

export { detectBrowser, defaultDeviceName };
