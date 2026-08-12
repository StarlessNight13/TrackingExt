import { Button } from "@trackingext/ui/components/button";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export function NavUser() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="mx-2 h-8 w-[calc(100%-1rem)] rounded-lg" />;
  }

  if (!session) {
    return null;
  }

  const name =
    session.user.displayUsername ?? session.user.username ?? session.user.name ?? "Account";

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          navigate({ to: "/" });
        },
      },
    });
  }

  return (
    <div className="flex items-center gap-1 px-2 py-2 group-data-[collapsible=icon]:justify-center">
      <p className="min-w-0 flex-1 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
        {name}
      </p>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleSignOut}
      >
        <LogOut />
      </Button>
    </div>
  );
}
