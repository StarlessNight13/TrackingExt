import { detectBrowser, defaultDeviceName } from "./device";
import { getLocalState, setLocalState } from "./storage";

export async function ensureLocalDeviceId(): Promise<string> {
  const state = await getLocalState();
  if (state.localDeviceId) return state.localDeviceId;

  const localDeviceId = crypto.randomUUID();
  await setLocalState({ localDeviceId });
  return localDeviceId;
}

export async function getEffectiveDeviceId(): Promise<string> {
  const state = await getLocalState();
  if (state.deviceId) return state.deviceId;
  if (state.localDeviceId) return state.localDeviceId;
  return ensureLocalDeviceId();
}

export async function getEffectiveDeviceName(): Promise<string> {
  const state = await getLocalState();
  return state.deviceName?.trim() || defaultDeviceName();
}

export function buildLocalDeviceRef(deviceId: string, deviceName: string) {
  return {
    id: deviceId,
    name: deviceName,
    browser: detectBrowser(),
  };
}
