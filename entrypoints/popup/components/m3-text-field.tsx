import { useId, useState, type ReactNode, type SelectHTMLAttributes } from "react";

type FieldProps = {
  id?: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  icon?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  endAction?: {
    label: string;
    onClick: () => void;
    icon: ReactNode;
  };
};

type M3TextFieldProps = FieldProps & {
  type?: string;
  autoComplete?: string;
};

type M3TextAreaProps = FieldProps & { rows?: number };

export function M3TextField({
  id: idProp,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  autoComplete,
  icon,
  endAction,
  placeholder,
  disabled,
  readOnly,
  autoFocus,
}: M3TextFieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [focused, setFocused] = useState(false);
  const floating = focused || value.length > 0;

  return (
    <div className={`m3-field${error ? " m3-field--error" : ""}`}>
      <div className={`m3-field__control${focused ? " m3-field__control--focused" : ""}`}>
        {icon ? (
          <span className="m3-field__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          className="m3-field__input"
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder ?? " "}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />
        <label
          htmlFor={id}
          className={`m3-field__label${floating ? " m3-field__label--floating" : ""}${icon ? " m3-field__label--with-icon" : ""}`}
        >
          {label}
        </label>
        {endAction ? (
          <button
            type="button"
            className="m3-field__action"
            aria-label={endAction.label}
            onClick={endAction.onClick}
            tabIndex={-1}
          >
            {endAction.icon}
          </button>
        ) : null}
      </div>
      {error ? <p className="m3-field__error">{error}</p> : null}
    </div>
  );
}

export function M3TextArea({
  id: idProp,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  disabled,
  readOnly,
  autoFocus,
  rows = 3,
}: M3TextAreaProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [focused, setFocused] = useState(false);
  const floating = focused || value.length > 0;

  return (
    <div className={`m3-field${error ? " m3-field--error" : ""}`}>
      <div
        className={`m3-field__control m3-field__control--textarea${focused ? " m3-field__control--focused" : ""}`}
      >
        <textarea
          id={id}
          className="m3-field__input m3-field__textarea"
          value={value}
          rows={rows}
          placeholder={placeholder ?? " "}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          onChange={(event) => onChange?.(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
        />
        <label
          htmlFor={id}
          className={`m3-field__label${floating ? " m3-field__label--floating" : ""}`}
        >
          {label}
        </label>
      </div>
      {error ? <p className="m3-field__error">{error}</p> : null}
    </div>
  );
}

export function M3Select({
  id: idProp,
  label,
  children,
  ...props
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  return (
    <div className="m3-field">
      <div className="m3-field__control">
        <select id={id} className="m3-field__input m3-field__select" {...props}>
          {children}
        </select>
        <label htmlFor={id} className="m3-field__label m3-field__label--floating">
          {label}
        </label>
      </div>
    </div>
  );
}

function IconUser() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export { IconEye, IconLock, IconUser };
