import { HISTORY_RETENTION_DAYS } from "@/lib/settings-constants";
import type { PrivacySettings } from "@/lib/types";

const RETENTION_OPTIONS: Array<{ label: string; value: PrivacySettings["historyRetentionDays"] }> = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "Forever", value: null },
];

export function HistoryRetentionPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PrivacySettings["historyRetentionDays"];
  onChange: (value: PrivacySettings["historyRetentionDays"]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="provider-choice" role="group" aria-label="History retention">
        <span className="provider-choice__label">Keep history for</span>
        {RETENTION_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`provider-choice__option${value === option.value ? " provider-choice__option--selected" : ""}`}
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 11 }}>
        Older navigation history is deleted automatically. Forever keeps all history until you clear it.
        Allowed values: {HISTORY_RETENTION_DAYS.join(", ")} days, or forever.
      </p>
    </div>
  );
}
