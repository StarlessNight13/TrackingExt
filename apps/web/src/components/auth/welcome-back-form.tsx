import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import type { AuthThemeColors } from "@/components/auth/auth-theme";
import { M3CircularProgress } from "@/components/auth/m3-circular-progress";
import { M3TextField } from "@/components/auth/m3-text-field";
import Loader from "@/components/loader";
import { signInWithCredentials } from "@/lib/auth-sign-in";
import { authClient } from "@/lib/auth-client";
import { getInitials, type RememberedUser } from "@/lib/remembered-user";

type WelcomeBackFormProps = {
  colors: AuthThemeColors;
  user: RememberedUser;
  allowSignUp: boolean;
  onSwitchAccount: () => void;
};

export function WelcomeBackForm({
  colors,
  user,
  allowSignUp,
  onSwitchAccount,
}: WelcomeBackFormProps) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe] = useState(true);

  const form = useForm({
    defaultValues: {
      password: "",
    },
    onSubmit: async ({ value }) => {
      await signInWithCredentials(
        {
          loginId: user.loginId,
          password: value.password,
          rememberMe,
          allowSignUp,
          signInMethod: user.signInMethod,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Welcome back!");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  const subtitle = [user.email, user.username?.toUpperCase()].filter(Boolean).join(" • ");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${colors.outlineVariant} ${colors.surfaceContainerLow} ${colors.textSecondary}`}
        >
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Welcome back
        </span>

        <div className="relative">
          <div
            className={`flex size-24 items-center justify-center rounded-full bg-[#0B1220] text-2xl font-semibold tracking-wide text-white ring-4 ring-[#0061A4]/25 ring-offset-4 ring-offset-transparent dark:ring-[#9ECAFF]/30`}
          >
            {getInitials(user.displayName)}
          </div>
          <span
            className={`absolute -right-1 bottom-1 flex size-8 items-center justify-center rounded-full border-2 border-white shadow-sm dark:border-[#1E2025] ${colors.primary} ${colors.onPrimary}`}
          >
            <Lock className="size-3.5" />
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className={`text-xl font-semibold tracking-tight ${colors.textPrimary}`}>
            {user.displayName}
          </h2>
          {subtitle ? (
            <p className={`text-xs uppercase tracking-[0.12em] ${colors.textSecondary}`}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <form.Field name="password">
        {(field) => (
          <M3TextField
            id="welcome-back-password"
            label="Enter password"
            type={showPassword ? "text" : "password"}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            icon={Lock}
            endIcon={showPassword ? EyeOff : Eye}
            onEndIconClick={() => setShowPassword((current) => !current)}
            colors={colors}
            autoComplete="current-password"
            error={field.state.meta.errors[0]?.message}
          />
        )}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 ${colors.primary} ${colors.onPrimary} ${colors.primaryHover}`}
          >
            {isSubmitting ? (
              <M3CircularProgress size={18} />
            ) : (
              <>
                <span>Unlock dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </form.Subscribe>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSwitchAccount}
          className={`inline-flex items-center gap-1 text-xs font-semibold ${colors.primaryText} hover:underline`}
        >
          Switch account
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </form>
  );
}
