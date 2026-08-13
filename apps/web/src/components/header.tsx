import { Button } from "@trackingext/ui/components/button";
import { Link, useRouterState } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: session } = authClient.useSession();

  if (pathname === "/login") {
    return null;
  }
  const homeHref = session ? "/dashboard" : "/login";

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-6">
          <Link to={homeHref} className="flex items-center gap-3 text-sm font-semibold tracking-tight">
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-primary shadow-lg shadow-primary/25">
              <img src="/trackingext-icon.png" width={40} height={40} alt="" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
                Dashboard
              </span>
              <span className="text-base">TrackingExt</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-3 text-sm text-muted-foreground md:flex">
            {session ? (
              <Link
                to="/dashboard"
                className="rounded-full px-3 py-2 hover:bg-card hover:text-foreground data-[status=active]:bg-card data-[status=active]:text-foreground"
                activeOptions={{ exact: true }}
              >
                Tracked tabs
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <Button variant="outline" size="sm" render={<Link to="/dashboard" />}>
              Open tracked tabs
            </Button>
          ) : (
            <Button size="sm" render={<Link to="/login" />}>
              Sign in
            </Button>
          )}
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
