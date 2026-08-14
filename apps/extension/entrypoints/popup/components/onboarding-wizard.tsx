import { useEffect, useMemo, useState, useTransition } from "react";

import { defaultDeviceName } from "@/lib/device";
import {
  getOnboardingStepLabel,
  getOnboardingSteps,
  isValidSyncModes,
  resolveLanSignalingMode,
  type OnboardingStepId,
} from "@/lib/sync-modes";
import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { normalizeServerUrl } from "@/lib/server-url";
import type { SyncModes } from "@/lib/types";
import { supportedSyncModes, supportsLanSync } from "@/lib/browser-capabilities";

import { AuthPanel } from "./auth-panel";
import { LanPairingPanel } from "./lan-pairing-panel";
import { M3Button } from "./m3-button";
import { M3SwitchRow } from "./m3-switch";

function resolveInitialStepIndex(snapshot: PopupSnapshot | null, modes: SyncModes): number {
  const lanSignalingMode = resolveLanSignalingMode(modes);
  const pipeline = getOnboardingSteps(modes, lanSignalingMode);
  if (!snapshot) return 0;

  if (modes.server && snapshot.deviceName && snapshot.serverUrl && !snapshot.authenticated) {
    const authIndex = pipeline.indexOf("auth");
    if (authIndex >= 0) return authIndex;
  }

  if (snapshot.serverUrl && modes.server) {
    const serverIndex = pipeline.indexOf("server");
    if (serverIndex >= 0) {
      const nextIndex = serverIndex + 1;
      if (nextIndex < pipeline.length) return nextIndex;
    }
  }

  return 0;
}

export function OnboardingWizard({
  snapshot,
  onDone,
}: {
  snapshot: PopupSnapshot | null;
  onDone: (snapshot: PopupSnapshot) => void;
}) {
  const [syncModes, setSyncModes] = useState<SyncModes>(
    supportedSyncModes(snapshot?.syncModes ?? { offline: true, lan: false, server: false }),
  );
  const [stepIndex, setStepIndex] = useState(() => resolveInitialStepIndex(snapshot, syncModes));
  const [liveSnapshot, setLiveSnapshot] = useState(snapshot);
  const [serverUrl, setServerUrl] = useState(snapshot?.serverUrl ?? "");
  const [deviceName, setDeviceName] = useState(snapshot?.deviceName ?? defaultDeviceName());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lanSignalingMode = useMemo(() => resolveLanSignalingMode(syncModes), [syncModes]);
  const pipeline = useMemo(
    () => getOnboardingSteps(syncModes, lanSignalingMode),
    [syncModes, lanSignalingMode],
  );

  useEffect(() => {
    setStepIndex((index) => Math.min(index, Math.max(pipeline.length - 1, 0)));
  }, [pipeline]);

  const safeStepIndex = Math.min(stepIndex, Math.max(pipeline.length - 1, 0));
  const currentStep: OnboardingStepId = pipeline[safeStepIndex] ?? "modes";
  const isFirstStep = stepIndex === 0;

  const goNext = () => {
    setError(null);
    setStepIndex((index) => Math.min(index + 1, pipeline.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const toggleMode = (key: keyof SyncModes) => {
    setSyncModes((current) => ({ ...current, [key]: !current[key] }));
  };

  const continueFromModes = () => {
    setError(null);
    if (!isValidSyncModes(syncModes)) {
      setError("Select at least one sync mode.");
      return;
    }
    goNext();
  };

  const saveServerUrl = () => {
    setError(null);
    startTransition(async () => {
      try {
        const normalized = normalizeServerUrl(serverUrl);
        const res = await sendMessage({ type: "SET_SERVER_URL", serverUrl: normalized });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.snapshot) setLiveSnapshot(res.snapshot);
        goNext();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid endpoint");
      }
    });
  };

  const finishDeviceStep = () => {
    setError(null);
    startTransition(async () => {
      const needsAuth = syncModes.server;
      const res = await sendMessage({
        type: "COMPLETE_ONBOARDING",
        syncModes,
        deviceName: deviceName.trim() || defaultDeviceName(),
        markComplete: !needsAuth,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.snapshot) setLiveSnapshot(res.snapshot);
      if (needsAuth) {
        goNext();
        return;
      }
      if (res.snapshot) onDone(res.snapshot);
    });
  };

  const finishAuth = (nextSnapshot: PopupSnapshot) => {
    startTransition(async () => {
      const res = await sendMessage({ type: "FINISH_ONBOARDING" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(res.snapshot ?? nextSnapshot);
    });
  };

  const serverHelpText =
    syncModes.server && syncModes.lan
      ? "Enter your TrackingExt server URL. LAN pairing can also use it as a relay."
      : syncModes.server
        ? "Enter your TrackingExt server URL, then sign in on the next step."
        : "Enter your relay server URL for 6-digit LAN pairing.";

  const pairingHelpText =
    lanSignalingMode === "local"
      ? "Copy a pairing token between devices once. No server required — tab data syncs directly afterward."
      : "Use a 6-digit code via your server relay for one-time pairing.";

  const deviceHelpText =
    syncModes.lan || syncModes.server
      ? "Name this browser so you can recognize it in LAN and server sync."
      : "Optional label for this browser. Tracked tabs stay on this device only.";

  const authSnapshot = liveSnapshot ?? snapshot;

  return (
    <div className="stack">
      <div className="brand">
        <h1>TrackingExt</h1>
        <span className="meta">Setup · {getOnboardingStepLabel(currentStep, syncModes)}</span>
      </div>

      <p className="muted onboarding-progress" style={{ margin: 0, fontSize: 11 }}>
        Step {safeStepIndex + 1} of {pipeline.length}
      </p>

      {currentStep === "modes" ? (
        <div className="panel auth-panel stack">
          <p className="muted" style={{ margin: 0 }}>
            Choose how tracked tabs sync. Only the steps you need appear next.
          </p>
          <M3SwitchRow
            title="Offline"
            description="Keep tabs on this browser only"
            checked={syncModes.offline}
            onChange={() => toggleMode("offline")}
            id="mode-offline"
          />
          {supportsLanSync ? (
            <M3SwitchRow
              title="Same-network (LAN)"
              description="Sync with nearby extensions via WebRTC"
              checked={syncModes.lan}
              onChange={() => toggleMode("lan")}
              id="mode-lan"
            />
          ) : null}
          <M3SwitchRow
            title="Server"
            description="Cloud sync, dashboard, and sign-in"
            checked={syncModes.server}
            onChange={() => toggleMode("server")}
            id="mode-server"
          />
          {!isValidSyncModes(syncModes) ? (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Pick at least one mode to continue.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>
              Up next:{" "}
              {getOnboardingSteps(syncModes, lanSignalingMode)
                .slice(1)
                .map((step) => getOnboardingStepLabel(step, syncModes).toLowerCase())
                .join(" → ")}
            </p>
          )}
          {error ? <p className="error">{error}</p> : null}
          <M3Button block onClick={continueFromModes}>
            Continue
          </M3Button>
        </div>
      ) : null}

      {currentStep === "server" ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            {serverHelpText}
          </p>
          <div className="field">
            <label htmlFor="server-url">
              {syncModes.server ? "Server URL" : "Relay URL"}
            </label>
            <input
              id="server-url"
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server.example.com"
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="row wrap">
            {!isFirstStep ? (
              <M3Button variant="text" onClick={goBack}>
                Back
              </M3Button>
            ) : null}
            <M3Button block disabled={pending || !serverUrl.trim()} onClick={saveServerUrl}>
              {pending ? "Saving…" : "Continue"}
            </M3Button>
          </div>
        </div>
      ) : null}

      {currentStep === "pairing" ? (
        <div className="stack">
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            {pairingHelpText}
          </p>
          <LanPairingPanel
            syncModes={syncModes}
            lanSignalingMode={lanSignalingMode}
            onUpdate={setLiveSnapshot}
            onPaired={goNext}
            onSkip={goNext}
          />
          {!isFirstStep ? (
            <M3Button variant="text" block onClick={goBack}>
              Back
            </M3Button>
          ) : null}
        </div>
      ) : null}

      {currentStep === "device" ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0 }}>
            {deviceHelpText}
          </p>
          <div className="field">
            <label htmlFor="device-name">Device name</label>
            <input
              id="device-name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="row wrap">
            {!isFirstStep ? (
              <M3Button variant="text" onClick={goBack}>
                Back
              </M3Button>
            ) : null}
            <M3Button block disabled={pending} onClick={finishDeviceStep}>
              {pending ? "Saving…" : syncModes.server ? "Continue to sign in" : "Get started"}
            </M3Button>
          </div>
        </div>
      ) : null}

      {currentStep === "auth" && syncModes.server && authSnapshot?.serverUrl ? (
        <div className="stack">
          <AuthPanel snapshot={authSnapshot} onDone={finishAuth} embedded />
          {!isFirstStep ? (
            <M3Button variant="text" block onClick={goBack}>
              Back
            </M3Button>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </div>
      ) : null}

      {currentStep === "auth" && syncModes.server && !authSnapshot?.serverUrl ? (
        <div className="panel stack">
          <p className="error" style={{ margin: 0 }}>
            Set a server URL before signing in.
          </p>
          <M3Button block onClick={goBack}>
            Back
          </M3Button>
        </div>
      ) : null}
    </div>
  );
}
