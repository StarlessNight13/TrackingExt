import { Button } from "@trackingext/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trackingext/ui/components/dropdown-menu";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className={compact ? "size-8 rounded-full" : "h-8 w-24"} />;
  }

  if (!session) {
    return null;
  }

  const label =
    session.user.displayUsername ?? session.user.username ?? session.user.name ?? "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={compact ? "shrink-0" : "min-w-0 flex-1 truncate"}
            aria-label={label}
          />
        }
      >
        {compact ? (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary/15 text-[0.65rem] font-semibold uppercase">
            {initial}
          </span>
        ) : (
          label
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({ to: "/" });
                  },
                },
              });
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
