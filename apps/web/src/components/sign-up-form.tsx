import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import type { AuthThemeColors } from "@/components/auth/auth-theme";
import { M3CircularProgress } from "@/components/auth/m3-circular-progress";
import { M3TextField } from "@/components/auth/m3-text-field";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import {
  buildRememberedUserFromSession,
  saveRememberedUser,
} from "@/lib/remembered-user";
import { usernameSchema } from "@/lib/auth-credentials";

type SignUpFormProps = {
  colors: AuthThemeColors;
};

export default function SignUpForm({ colors }: SignUpFormProps) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      username: "",
    },
    onSubmit: async ({ value }) => {
      if (!agreeTerms) {
        toast.error("Please accept the Terms of Service to continue.");
        return;
      }

      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.username,
          username: value.username,
        },
        {
          onSuccess: async () => {
            const session = await authClient.getSession();
            if (session.data?.user) {
              saveRememberedUser(
                buildRememberedUserFromSession({
                  loginId: value.username,
                  signInMethod: "username",
                  user: session.data.user,
                }),
              );
            } else {
              saveRememberedUser({
                loginId: value.username,
                signInMethod: "username",
                displayName: value.username,
                email: value.email,
                username: value.username,
              });
            }

            navigate({ to: "/dashboard" });
            toast.success("Account created successfully!");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        username: usernameSchema,
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-1"
    >
      <form.Field name="username">
        {(field) => (
          <M3TextField
            id="signup-username"
            label="Username"
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

      <form.Field name="email">
        {(field) => (
          <M3TextField
            id="signup-email"
            label="Email address"
            type="email"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            icon={Mail}
            colors={colors}
            autoComplete="email"
            error={field.state.meta.errors[0]?.message}
          />
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <M3TextField
            id="signup-password"
            label="Create password"
            type={showPassword ? "text" : "password"}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            icon={KeyRound}
            endIcon={showPassword ? EyeOff : Eye}
            onEndIconClick={() => setShowPassword((current) => !current)}
            hint="Must be at least 8 characters"
            colors={colors}
            autoComplete="new-password"
            error={field.state.meta.errors[0]?.message}
          />
        )}
      </form.Field>

      <div className="pb-4 pt-1">
        <label className="flex cursor-pointer select-none items-start gap-2.5 text-left text-xs">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 size-4 rounded border focus:ring-0"
          />
          <span className={colors.textSecondary}>
            I agree to the{" "}
            <span className={`underline ${colors.primaryText}`}>Terms of Service</span> and{" "}
            <span className={`underline ${colors.primaryText}`}>Privacy Policy</span>.
          </span>
        </label>
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
                <span>Create account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
