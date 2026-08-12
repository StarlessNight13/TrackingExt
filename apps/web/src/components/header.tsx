import { Button } from "@trackingext/ui/components/button";
import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            TrackingExt
          </Link>
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link
              to="/"
              className="hover:text-foreground data-[status=active]:text-foreground"
              activeOptions={{ exact: true }}
            >
              Home
            </Link>
            {session ? (
              <Link
                to="/dashboard"
                className="hover:text-foreground data-[status=active]:text-foreground"
              >
                Dashboard
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {session ? (
            <Button variant="outline" size="sm" render={<Link to="/dashboard" />}>
              Open dashboard
            </Button>
          ) : null}
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
