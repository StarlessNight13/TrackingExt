import type { PairedLanDevice } from "../types";
import { getLocalState, setLocalState } from "../storage";

export async function listPairedLanDevices(): Promise<PairedLanDevice[]> {
  const state = await getLocalState();
  return state.pairedLanDevices;
}

export async function savePairedLanDevice(device: PairedLanDevice) {
  const state = await getLocalState();
  const existing = state.pairedLanDevices.filter((d) => d.deviceId !== device.deviceId);
  await setLocalState({
    pairedLanDevices: [{ ...device, pairedAt: new Date().toISOString() }, ...existing],
  });
}

export async function removePairedLanDevice(deviceId: string) {
  const state = await getLocalState();
  await setLocalState({
    pairedLanDevices: state.pairedLanDevices.filter((d) => d.deviceId !== deviceId),
  });
}

export async function isLanPairingComplete() {
  const devices = await listPairedLanDevices();
  return devices.length > 0;
}
