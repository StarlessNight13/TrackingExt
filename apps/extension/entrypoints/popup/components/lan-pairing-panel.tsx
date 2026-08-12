import { useMemo, useState, useTransition } from "react";

import { sendMessage, type PopupSnapshot } from "@/lib/messaging";
import { resolveLanSignalingMode } from "@/lib/sync-modes";
import type { LanSignalingMode, SyncModes } from "@/lib/types";

import { M3Button } from "./m3-button";

function PairingError({ message }: { message: string }) {
  return (
    <div className="panel pairing-error" role="alert">
      <strong>Pairing failed</strong>
      <p className="pairing-error__detail">{message}</p>
      <p className="muted pairing-error__hint" style={{ margin: 0, fontSize: 11 }}>
        If this keeps happening, reload the extension from your browser&apos;s extension manager and try
        again.
      </p>
    </div>
  );
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export function LanPairingPanel({
  onUpdate,
  onPaired,
  onSkip,
  compact = false,
  syncModes,
  lanSignalingMode,
  snapshot,
}: {
  onUpdate?: (snapshot: PopupSnapshot) => void;
  onPaired?: () => void;
  onSkip?: () => void;
  compact?: boolean;
  syncModes?: SyncModes;
  lanSignalingMode?: LanSignalingMode;
  snapshot?: PopupSnapshot | null;
}) {
  const mode = useMemo(
    () =>
      lanSignalingMode ??
      snapshot?.lanSignalingMode ??
      resolveLanSignalingMode(syncModes ?? snapshot?.syncModes ?? { offline: false, lan: true, server: false }),
    [lanSignalingMode, snapshot, syncModes],
  );

  if (mode === "local") {
    return (
      <LocalLanPairingPanel
        compact={compact}
        onUpdate={onUpdate}
        onPaired={onPaired}
        onSkip={onSkip}
      />
    );
  }

  return (
    <RelayLanPairingPanel
      compact={compact}
      onUpdate={onUpdate}
      onPaired={onPaired}
      onSkip={onSkip}
    />
  );
}

function LocalLanPairingPanel({
  onUpdate,
  onPaired,
  onSkip,
  compact,
}: {
  onUpdate?: (snapshot: PopupSnapshot) => void;
  onPaired?: () => void;
  onSkip?: () => void;
  compact?: boolean;
}) {
  const [role, setRole] = useState<"host" | "join" | null>(null);
  const [offerToken, setOfferToken] = useState("");
  const [answerToken, setAnswerToken] = useState("");
  const [generatedOffer, setGeneratedOffer] = useState<string | null>(null);
  const [generatedAnswer, setGeneratedAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setRole(null);
    setOfferToken("");
    setAnswerToken("");
    setGeneratedOffer(null);
    setGeneratedAnswer(null);
    setError(null);
    void sendMessage({ type: "CANCEL_LOCAL_LAN_PAIRING" });
  };

  const startHost = () => {
    setError(null);
    setRole("host");
    startTransition(async () => {
      const res = await sendMessage({ type: "START_LOCAL_LAN_PAIRING" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGeneratedOffer(res.localPairingToken ?? null);
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  const completeHost = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({
        type: "COMPLETE_LOCAL_LAN_PAIRING",
        answerToken: answerToken.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      onPaired?.();
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  const joinSession = () => {
    setError(null);
    setRole("join");
    startTransition(async () => {
      const res = await sendMessage({
        type: "JOIN_LOCAL_LAN_PAIRING",
        offerToken: offerToken.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGeneratedAnswer(res.localPairingToken ?? null);
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  return (
    <div className={compact ? "stack" : "panel auth-panel stack"}>
      {!compact ? (
        <p className="muted" style={{ margin: 0 }}>
          Pair directly with another device — no server needed. Copy the pairing token between
          browsers once; tab data syncs peer-to-peer after that.
        </p>
      ) : null}

      {!role ? (
        <>
          <M3Button block disabled={pending} onClick={startHost}>
            Start pairing on this device
          </M3Button>
          <div className="field">
            <label htmlFor="local-offer">Or paste a token from the other device</label>
            <textarea
              id="local-offer"
              rows={3}
              value={offerToken}
              onChange={(e) => setOfferToken(e.target.value)}
              placeholder="Paste pairing token…"
            />
          </div>
          <M3Button block disabled={pending || !offerToken.trim()} onClick={joinSession}>
            Join with token
          </M3Button>
        </>
      ) : null}

      {role === "host" && generatedOffer ? (
        <>
          <div className="field">
            <label htmlFor="host-offer">Copy this token to the other device</label>
            <textarea id="host-offer" rows={4} readOnly value={generatedOffer} />
          </div>
          <M3Button variant="text" block onClick={() => copyText(generatedOffer)}>
            Copy token
          </M3Button>
          <div className="field">
            <label htmlFor="host-answer">Paste the reply token from the other device</label>
            <textarea
              id="host-answer"
              rows={3}
              value={answerToken}
              onChange={(e) => setAnswerToken(e.target.value)}
              placeholder="Paste reply token…"
            />
          </div>
          <M3Button block disabled={pending || !answerToken.trim()} onClick={completeHost}>
            Finish pairing
          </M3Button>
          <M3Button variant="text" block onClick={reset}>
            Cancel
          </M3Button>
        </>
      ) : null}

      {role === "join" && generatedAnswer ? (
        <>
          <div className="field">
            <label htmlFor="join-answer">Copy this reply token back to the other device</label>
            <textarea id="join-answer" rows={4} readOnly value={generatedAnswer} />
          </div>
          <M3Button variant="text" block onClick={() => copyText(generatedAnswer)}>
            Copy reply token
          </M3Button>
          <p className="muted" style={{ margin: 0, fontSize: 11 }}>
            After the other device finishes pairing, you&apos;re connected.
          </p>
          <M3Button block onClick={() => { reset(); onPaired?.(); }}>
            Done
          </M3Button>
        </>
      ) : null}

      {error ? <PairingError message={error} /> : null}
      {onSkip ? (
        <M3Button variant="text" block onClick={onSkip}>
          Skip for now
        </M3Button>
      ) : null}
    </div>
  );
}

function RelayLanPairingPanel({
  onUpdate,
  onPaired,
  onSkip,
  compact,
}: {
  onUpdate?: (snapshot: PopupSnapshot) => void;
  onPaired?: () => void;
  onSkip?: () => void;
  compact?: boolean;
}) {
  const [pairingCode, setPairingCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const startPairing = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "START_LAN_PAIRING" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGeneratedCode(res.pairingCode ?? null);
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  const pollPairing = () => {
    if (!generatedCode) return;
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({ type: "POLL_LAN_PAIRING", code: generatedCode });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.pairingComplete) {
        setGeneratedCode(null);
        setPairingCode("");
        onPaired?.();
      }
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  const joinPairing = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendMessage({
        type: "JOIN_LAN_PAIRING",
        code: pairingCode.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPairingCode("");
      setGeneratedCode(null);
      onPaired?.();
      if (res.snapshot && onUpdate) onUpdate(res.snapshot);
    });
  };

  const reset = () => {
    setGeneratedCode(null);
    setPairingCode("");
    setError(null);
  };

  return (
    <div className={compact ? "stack" : "panel auth-panel stack"}>
      {!compact ? (
        <p className="muted" style={{ margin: 0 }}>
          Pair once with another device using a 6-digit code via your server relay. After pairing,
          tab data syncs directly between browsers.
        </p>
      ) : null}

      {!generatedCode ? (
        <>
          <M3Button block disabled={pending} onClick={startPairing}>
            Show pairing code on this device
          </M3Button>
          <div className="field">
            <label htmlFor="pair-code">Or enter code from another device</label>
            <input
              id="pair-code"
              inputMode="numeric"
              maxLength={6}
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
          </div>
          <M3Button block disabled={pending || pairingCode.length !== 6} onClick={joinPairing}>
            Join with code
          </M3Button>
        </>
      ) : (
        <>
          <div className="auth-welcome">
            <span className="auth-welcome__badge">Pairing code</span>
            <strong style={{ fontSize: "2rem", letterSpacing: "0.2em" }}>{generatedCode}</strong>
            <span className="muted">Enter this on your other device</span>
          </div>
          <M3Button block disabled={pending} onClick={pollPairing}>
            {pending ? "Waiting…" : "Other device joined — done"}
          </M3Button>
          <M3Button variant="text" block onClick={reset}>
            Cancel
          </M3Button>
        </>
      )}

      {error ? <PairingError message={error} /> : null}
      {onSkip ? (
        <M3Button variant="text" block onClick={onSkip}>
          Skip for now
        </M3Button>
      ) : null}
    </div>
  );
}
