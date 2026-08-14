import { useState, useTransition } from "react";

import { sendMessage, type PopupSnapshot } from "@/lib/messaging";

import { M3Button } from "./m3-button";
import { M3TextArea } from "./m3-text-field";

export function LanPairingPanel({
  onUpdate,
  onPaired,
  onSkip,
  compact = false,
}: {
  onUpdate?: (snapshot: PopupSnapshot) => void;
  onPaired?: () => void;
  onSkip?: () => void;
  compact?: boolean;
  syncModes?: unknown;
  lanSignalingMode?: "local";
  snapshot?: PopupSnapshot | null;
}) {
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [generated, setGenerated] = useState<"offer" | "answer" | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Pairing failed");
      }
    });
  };

  const update = (snapshot?: PopupSnapshot) => {
    if (snapshot) onUpdate?.(snapshot);
  };

  return (
    <div className={compact ? "stack" : "panel stack"}>
      <p className="muted" style={{ margin: 0 }}>
        Pair directly by copying an offer and answer between devices.
      </p>
      {!generated ? (
        <>
          <M3Button
            block
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await sendMessage({ type: "START_LOCAL_LAN_PAIRING" });
                if (!res.ok || !res.localPairingToken)
                  throw new Error(res.ok ? "No offer returned" : res.error);
                setToken(res.localPairingToken);
                setGenerated("offer");
                update(res.snapshot);
              })
            }
          >
            Create pairing offer
          </M3Button>
          <M3TextArea
            label="Pairing offer"
            value={offer}
            onChange={setOffer}
            placeholder="Paste offer from other device"
          />
          <M3Button
            block
            disabled={pending || !offer.trim()}
            onClick={() =>
              run(async () => {
                const res = await sendMessage({
                  type: "JOIN_LOCAL_LAN_PAIRING",
                  offerToken: offer.trim(),
                });
                if (!res.ok || !res.localPairingToken)
                  throw new Error(res.ok ? "No answer returned" : res.error);
                setToken(res.localPairingToken);
                setGenerated("answer");
                update(res.snapshot);
              })
            }
          >
            Join offer
          </M3Button>
        </>
      ) : (
        <>
          <M3TextArea
            label={`${generated === "offer" ? "Offer" : "Answer"} token`}
            readOnly
            value={token}
          />
          <M3Button variant="text" block onClick={() => void navigator.clipboard.writeText(token)}>
            Copy {generated}
          </M3Button>
          {generated === "offer" ? (
            <>
              <M3TextArea
                label="Pairing answer"
                value={answer}
                onChange={setAnswer}
                placeholder="Paste answer from other device"
              />
              <M3Button
                block
                disabled={pending || !answer.trim()}
                onClick={() =>
                  run(async () => {
                    const res = await sendMessage({
                      type: "COMPLETE_LOCAL_LAN_PAIRING",
                      answerToken: answer.trim(),
                    });
                    if (!res.ok) throw new Error(res.error);
                    update(res.snapshot);
                    onPaired?.();
                  })
                }
              >
                Complete pairing
              </M3Button>
            </>
          ) : (
            <M3Button block onClick={onPaired}>
              Done
            </M3Button>
          )}
        </>
      )}
      {error ? <p className="error">{error}</p> : null}
      {onSkip ? (
        <M3Button variant="text" block onClick={onSkip}>
          Skip for now
        </M3Button>
      ) : null}
    </div>
  );
}
