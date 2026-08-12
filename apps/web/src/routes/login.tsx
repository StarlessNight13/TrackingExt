import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-10">
      <div className="mb-2 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          TrackingExt account
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          One account for the web dashboard and browser extensions.
        </p>
      </div>
      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </div>
  );
}
