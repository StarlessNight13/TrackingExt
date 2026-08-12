import { getPairingApiClient } from "./pairing-api";

export type SignalKind = "offer" | "answer" | "ice";

export type LanSignalMessage = {
  id: string;
  fromDeviceId: string;
  kind: SignalKind;
  payload: string;
};

export async function postLanSignal(input: {
  fromDeviceId: string;
  toDeviceId: string;
  kind: SignalKind;
  payload: string;
}) {
  const api = await getPairingApiClient();
  await api.lanSync.postSignal(input);
}

export async function pollLanSignals(deviceId: string): Promise<LanSignalMessage[]> {
  const api = await getPairingApiClient();
  const rows = await api.lanSync.pollSignals({ deviceId });
  return rows.map((row) => ({
    ...row,
    kind: row.kind as SignalKind,
  }));
}
