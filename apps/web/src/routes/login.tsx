import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bookmark, Building2, LayoutDashboard, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { getAuthTheme } from "@/components/auth/auth-theme";
import { WelcomeBackForm } from "@/components/auth/welcome-back-form";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { clearRememberedUser, loadRememberedUser } from "@/lib/remembered-user";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }

    const authConfig = await client.authConfig().catch(() => ({ allowSignUp: true }));
    return { authConfig };
  },
});

type AuthTab = "signin" | "signup";

function LoginPage() {
  const { authConfig } = Route.useRouteContext();
  const allowSignUp = authConfig.allowSignUp;
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = getAuthTheme(isDark);
  const [activeTab, setActiveTab] = useState<AuthTab>("signin");
  const [rememberedUser] = useState(() => loadRememberedUser());
  const [useFullSignIn, setUseFullSignIn] = useState(() => !loadRememberedUser());
  const showWelcomeBack =
    rememberedUser !== null && !useFullSignIn && activeTab === "signin";

  const handleSwitchAccount = () => {
    clearRememberedUser();
    setUseFullSignIn(true);
  };

  return (
    <div
      className={`auth-page relative flex min-h-svh flex-col justify-between overflow-x-hidden transition-colors duration-300 ${colors.bg} ${colors.textPrimary}`}
    >
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-7xl items-center justify-between p-6">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-2xl p-2 shadow-md ${colors.primary} ${colors.onPrimary}`}>
            <LayoutDashboard size={20} />
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Tracking<span className={colors.primaryText}>Ext</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm transition-all ${colors.outlineVariant} ${colors.surfaceContainer} hover:opacity-90`}
        >
          {isDark ? (
            <>
              <Sun size={15} className="text-amber-400" />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <Moon size={15} className="text-indigo-600" />
              <span>Dark mode</span>
            </>
          )}
        </button>
      </header>

      <main className="z-10 flex flex-1 items-center justify-center p-4 pt-20 pb-8 sm:p-6 md:p-8">
        <div className="mx-auto w-full max-w-md">
          <div
            className={`relative rounded-[28px] border p-6 shadow-xl transition-all duration-300 sm:p-8 ${colors.surfaceContainer} ${colors.outlineVariant} ${colors.shadowColor}`}
          >
            {!showWelcomeBack ? (
              <div className="mb-6 text-center">
                <div
                  className={`mb-3 inline-flex items-center justify-center rounded-2xl p-3 ${colors.primaryContainer} ${colors.onPrimaryContainer}`}
                >
                  <Building2 size={24} />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Dashboard access</h2>
                <p className={`mt-1 text-xs ${colors.textSecondary}`}>
                  {allowSignUp
                    ? "Sign in to sync tracked tabs across your dashboard and browser extension"
                    : "Sign in with your admin username to open the tracked tabs dashboard"}
                </p>
              </div>
            ) : null}

            {allowSignUp && !showWelcomeBack ? (
              <div
                className={`relative mb-6 flex rounded-full border p-1.5 ${colors.surfaceContainerHigh} ${colors.outlineVariant}`}
              >
                <div
                  className={`absolute top-1.5 bottom-1.5 rounded-full transition-all duration-300 ease-out ${colors.primary}`}
                  style={{
                    left: activeTab === "signin" ? "0.375rem" : "calc(50% + 0.1875rem)",
                    width: "calc(50% - 0.5625rem)",
                  }}
                />

                <button
                  type="button"
                  onClick={() => setActiveTab("signin")}
                  className={`relative z-10 flex-1 rounded-full py-2.5 text-center text-xs font-bold transition-colors duration-200 ${
                    activeTab === "signin" ? colors.onPrimary : colors.textSecondary
                  }`}
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className={`relative z-10 flex-1 rounded-full py-2.5 text-center text-xs font-bold transition-colors duration-200 ${
                    activeTab === "signup" ? colors.onPrimary : colors.textSecondary
                  }`}
                >
                  Create account
                </button>
              </div>
            ) : null}

            {allowSignUp && activeTab === "signup" ? (
              <SignUpForm colors={colors} />
            ) : showWelcomeBack && rememberedUser ? (
              <WelcomeBackForm
                colors={colors}
                user={rememberedUser}
                allowSignUp={allowSignUp}
                onSwitchAccount={handleSwitchAccount}
              />
            ) : (
              <SignInForm colors={colors} allowSignUp={allowSignUp} />
            )}

            <div
              className={`mt-6 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${colors.outlineVariant} ${colors.surfaceContainerLow}`}
            >
              <Bookmark size={14} className={colors.primaryText} />
              <p className={colors.textSecondary}>
                {allowSignUp
                  ? "One account works for the web dashboard and every extension install."
                  : "Account registration is disabled on this server."}
              </p>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
