import { Button } from "@trackingext/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trackingext/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, MonitorSmartphone, Shield } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: session } = authClient.useSession();
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.92_0.03_160),transparent_45%),radial-gradient(circle_at_top_right,oklch(0.9_0.02_220),transparent_40%)] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.28_0.03_160),transparent_45%),radial-gradient(circle_at_top_right,oklch(0.25_0.02_220),transparent_40%)]" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 md:py-16">
        <section className="flex max-w-2xl flex-col gap-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Tracked tabs
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">TrackingExt</h1>
          <p className="text-lg text-muted-foreground">
            Remember what you’re doing — not just a URL. Track activities across Firefox and
            Chromium, then pick up exactly where you left off from any device on your account.
          </p>
          <div className="flex flex-wrap gap-2">
            {session ? (
              <Button size="lg" render={<Link to="/dashboard" />}>
                Go to dashboard
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <>
                <Button size="lg" render={<Link to="/login" />}>
                  Sign in
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button size="lg" variant="outline" render={<Link to="/login" />}>
                  Create account
                </Button>
              </>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            API{" "}
            {healthCheck.isLoading
              ? "checking…"
              : healthCheck.data
                ? "connected"
                : "disconnected"}
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark />
                Persistent activities
              </CardTitle>
              <CardDescription>
                A tracked tab keeps its identity while the URL changes — Chapter 10 through 13 stay
                one activity.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone />
                Cross-device sync
              </CardTitle>
              <CardDescription>
                Continue from Home PC · Firefox on Laptop · Chrome without hunting for the page.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield />
                Explicit by design
              </CardTitle>
              <CardDescription>
                Only tabs you choose to track sync. Manage privacy, devices, and sessions here.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </div>
  );
}
