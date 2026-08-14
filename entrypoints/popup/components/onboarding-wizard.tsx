import { useState, useTransition } from "react";

import { defaultDeviceName } from "@/lib/device";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { supportedSyncModes, supportsLanSync } from "@/lib/browser-capabilities";

import { M3Button } from "./m3-button";
import { M3SwitchRow } from "./m3-switch";
import { M3TextField } from "./m3-text-field";

export function OnboardingWizard({
  snapshot,
  onDone,
}: {
  snapshot: PopupSnapshot | null;
  onDone: (snapshot: PopupSnapshot) => void;
}) {
  const [lan, setLan] = useState(Boolean(snapshot?.syncModes.lan && supportsLanSync));
  const [deviceName, setDeviceName] = useState(snapshot?.deviceName ?? defaultDeviceName());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const finish = () =>
    startTransition(async () => {
      const syncModes = supportedSyncModes({ offline: true, lan, online: false });
      const res = await sendMessage({
        type: "COMPLETE_ONBOARDING",
        syncModes,
        deviceName,
      });
      if (!res.ok) return setError(res.error);
      if (res.snapshot) onDone(res.snapshot);
    });

  return (
    <div className="stack">
      <div className="brand">
        <h1>TabTether</h1>
        <span className="meta">Setup</span>
      </div>
      <p className="muted">
        Tethered activities stay local unless you connect a cloud database later.
      </p>
      {supportsLanSync ? (
        <M3SwitchRow title="Direct LAN sync" checked={lan} onChange={setLan} />
      ) : null}
      <M3TextField
        id="device-name"
        label="Device name"
        value={deviceName}
        onChange={setDeviceName}
      />
      {error ? <p className="error">{error}</p> : null}
      <M3Button block disabled={pending || !deviceName.trim()} onClick={finish}>
        {pending ? "Saving…" : "Get started"}
      </M3Button>
    </div>
  );
}
