import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import type { AuthThemeColors } from "@/components/auth/auth-theme";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";
import { M3CircularProgress } from "@/components/auth/m3-circular-progress";
import { M3TextField } from "@/components/auth/m3-text-field";
import Loader from "@/components/loader";
import { signInWithCredentials } from "@/lib/auth-sign-in";
import { isEmail, usernameOrEmailSchema, usernameSchema } from "@/lib/auth-credentials";
import { authClient } from "@/lib/auth-client";

type SignInFormProps = {
  colors: AuthThemeColors;
  allowSignUp: boolean;
};

export default function SignInForm({ colors, allowSignUp }: SignInFormProps) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await signInWithCredentials(
        {
          loginId: value.usernameOrEmail,
          password: value.password,
          rememberMe,
          allowSignUp,
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
        usernameOrEmail: allowSignUp ? usernameOrEmailSchema : usernameSchema,
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-1"
      >
        <form.Field name="usernameOrEmail">
          {(field) => (
            <M3TextField
              id="signin-username-or-email"
              label={allowSignUp ? "Username or email" : "Username"}
              type="text"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              icon={User}
              colors={colors}
              autoComplete="username"
              error={field.state.meta.errors[0]?.message}
            />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <M3TextField
              id="signin-password"
              label="Password"
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

        <div className="flex items-center justify-between pb-4 pt-1 text-xs">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border focus:ring-0 focus:ring-offset-0"
            />
            <span className={colors.textSecondary}>Remember device</span>
          </label>

          {allowSignUp ? (
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className={`font-semibold focus:outline-none ${colors.primaryText} hover:underline`}
            >
              Forgot password?
            </button>
          ) : null}
        </div>

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
                  <span>Sign in to dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </form.Subscribe>
      </form>

      <ForgotPasswordDialog
        open={forgotOpen && allowSignUp}
        onOpenChange={setForgotOpen}
        initialEmail={
          isEmail(form.state.values.usernameOrEmail) ? form.state.values.usernameOrEmail : ""
        }
        colors={colors}
      />
    </>
  );
}
