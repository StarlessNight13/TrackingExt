type M3SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function M3Switch({
  checked,
  onChange,
  id,
  disabled = false,
  "aria-label": ariaLabel,
}: M3SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`m3-switch${checked ? " m3-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="m3-switch__track" aria-hidden>
        <span className="m3-switch__thumb" />
      </span>
    </button>
  );
}

type M3SwitchRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function M3SwitchRow({ title, description, checked, onChange, id }: M3SwitchRowProps) {
  const switchId = id ?? title.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="m3-switch-row">
      <label htmlFor={switchId} className="m3-switch-row__label">
        <strong>{title}</strong>
        {description ? <span className="muted">{description}</span> : null}
      </label>
      <M3Switch
        id={switchId}
        checked={checked}
        onChange={onChange}
        aria-label={title}
      />
    </div>
  );
}
