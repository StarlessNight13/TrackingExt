import { useState } from "react";
import { KeyRound, Mail, X } from "lucide-react";
import { toast } from "sonner";

import type { AuthThemeColors } from "./auth-theme";
import { M3CircularProgress } from "./m3-circular-progress";
import { M3TextField } from "./m3-text-field";

type ForgotPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail: string;
  colors: AuthThemeColors;
};

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  initialEmail,
  colors,
}: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your registered email address.");
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onOpenChange(false);
      toast.info("Password reset is not configured yet. Contact your administrator.");
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md space-y-4 rounded-[28px] border p-6 shadow-2xl ${colors.surfaceContainer} ${colors.outlineVariant}`}
        role="dialog"
        aria-modal
        aria-labelledby="forgot-password-title"
      >
        <div className="flex items-center justify-between">
          <div className={`rounded-2xl p-2.5 ${colors.primaryContainer} ${colors.onPrimaryContainer}`}>
            <KeyRound size={22} />
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`rounded-full p-1.5 ${colors.textSecondary} transition-colors hover:opacity-80`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <h3 id="forgot-password-title" className={`text-xl font-bold ${colors.textPrimary}`}>
          Reset password
        </h3>
        <p className={`text-xs ${colors.textSecondary}`}>
          Enter your account email. We will send a secure recovery link when password reset is
          enabled.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <M3TextField
            id="reset-email"
            label="Registered email"
            type="email"
            value={email}
            onChange={setEmail}
            icon={Mail}
            colors={colors}
            autoComplete="email"
          />

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={`rounded-full px-5 py-2.5 text-xs font-semibold ${colors.textSecondary} transition-colors hover:opacity-80`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold shadow-sm transition-all hover:shadow-md ${colors.primary} ${colors.onPrimary}`}
            >
              {isSending ? <M3CircularProgress size={16} /> : "Send reset link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
