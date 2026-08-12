import { useState } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";

import type { AuthThemeColors } from "./auth-theme";

type M3TextFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  icon?: LucideIcon;
  endIcon?: LucideIcon;
  onEndIconClick?: () => void;
  error?: string;
  hint?: string;
  colors: AuthThemeColors;
  autoComplete?: string;
};

export function M3TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  icon: Icon,
  endIcon: EndIcon,
  onEndIconClick,
  error,
  hint,
  colors,
  autoComplete,
}: M3TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || value.length > 0;

  return (
    <div className="relative mb-5 w-full">
      <div
        className={`relative flex items-center rounded-[12px] border transition-all duration-200 ${
          error
            ? "border-red-500 text-red-500 focus-within:ring-2 focus-within:ring-red-500/30"
            : isFocused
              ? `${colors.focusBorder} ring-2 ${colors.focusRing}`
              : `${colors.inputBorder} ${colors.inputBorderHover}`
        } ${colors.surfaceContainerLow}`}
      >
        {Icon ? (
          <div className={`pl-4 ${isFocused ? colors.primaryText : colors.textSecondary}`}>
            <Icon size={20} />
          </div>
        ) : null}

        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          className={`w-full rounded-[12px] bg-transparent px-4 py-3.5 text-sm font-medium focus:outline-none ${colors.textPrimary}`}
          placeholder=" "
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute transition-all duration-200 ease-out ${
            isFloating
              ? `-top-2.5 left-3 rounded px-1.5 text-xs font-semibold ${colors.labelBg} ${
                  error ? "text-red-500" : isFocused ? colors.primaryText : colors.textSecondary
                }`
              : `top-3.5 text-sm ${colors.textSecondary} ${Icon ? "left-11" : "left-4"}`
          }`}
        >
          {label}
        </label>

        {EndIcon ? (
          <button
            type="button"
            onClick={onEndIconClick}
            className={`pr-4 transition-colors focus:outline-none ${colors.textSecondary}`}
            tabIndex={-1}
            aria-label="Toggle password visibility"
          >
            <EndIcon size={20} />
          </button>
        ) : null}
      </div>

      {hint || error ? (
        <div className="mt-1 flex items-center gap-1 px-3">
          {error ? <AlertCircle size={12} className="shrink-0 text-red-500" /> : null}
          <p className={`text-xs ${error ? "font-medium text-red-500" : colors.textSecondary}`}>
            {error ?? hint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
