type M3ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  variant?: "filled" | "tonal" | "text";
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function M3Button({
  children,
  type = "button",
  variant = "filled",
  block = false,
  disabled = false,
  onClick,
}: M3ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`m3-btn m3-btn--${variant}${block ? " m3-btn--block" : ""}`}
    >
      {children}
    </button>
  );
}

export function M3Spinner() {
  return <span className="m3-spinner" aria-hidden />;
}
