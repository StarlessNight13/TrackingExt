import { Badge } from "@trackingext/ui/components/badge";
import { Button } from "@trackingext/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trackingext/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@trackingext/ui/components/empty";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { parseUserAgent, relativeTime } from "@/lib/format";

type AuthSession = {
  id: string;
  token: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

async function fetchSessions(): Promise<AuthSession[]> {
  const result = await authClient.listSessions();
  if (result.error) {
    throw new Error(result.error.message || "Failed to list sessions");
  }
  return (result.data ?? []) as AuthSession[];
}

export function SessionsPanel() {
  const queryClient = useQueryClient();
  const { data: current } = authClient.useSession();
  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: fetchSessions,
  });

  const revokeOne = useMutation({
    mutationFn: async (token: string) => {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        throw new Error(result.error.message || "Failed to revoke session");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast.success("Session revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        throw new Error(result.error.message || "Failed to revoke other sessions");
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      toast.success("Other sessions revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeSessions();
      if (result.error) {
        throw new Error(result.error.message || "Failed to revoke sessions");
      }
      return result.data;
    },
    onSuccess: async () => {
      toast.success("All sessions revoked");
      window.location.href = "/login";
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (sessionsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load sessions</CardTitle>
          <CardDescription>{(sessionsQuery.error as Error).message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => void sessionsQuery.refetch()}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const sessions = sessionsQuery.data ?? [];
  const currentToken = current?.session?.token;

  if (sessions.length === 0) {
    return (
      <div className="dashboard-empty-state">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>No active sessions</EmptyTitle>
            <EmptyDescription>Sign in again from the web app or extension.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Session security</CardTitle>
          <CardDescription>
            Revoke browsers or extension installs that should no longer access your account.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={revokeOthers.isPending || sessions.length < 2}
            onClick={() => revokeOthers.mutate()}
          >
            <ShieldOff data-icon="inline-start" />
            Revoke other sessions
          </Button>
          <Button
            variant="destructive"
            disabled={revokeAll.isPending}
            onClick={() => {
              if (confirm("Revoke every session, including this one? You’ll need to sign in again.")) {
                revokeAll.mutate();
              }
            }}
          >
            Revoke all sessions
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-col gap-3">
        {sessions.map((session) => {
          const isCurrent = Boolean(currentToken && session.token === currentToken);
          return (
            <Card key={session.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <KeyRound className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <CardDescription className="uppercase tracking-[0.14em]">Session</CardDescription>
                      <CardTitle className="text-base">
                        {parseUserAgent(session.userAgent)}
                      </CardTitle>
                      <CardDescription>
                        Updated {relativeTime(session.updatedAt)} · expires{" "}
                        {new Date(session.expiresAt).toLocaleString()}
                      </CardDescription>
                    </div>
                  </div>
                  {isCurrent ? <Badge>This session</Badge> : <Badge variant="outline">Active</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>IP: {session.ipAddress || "unknown"}</span>
                <span className="truncate">User agent: {session.userAgent || "unknown"}</span>
              </CardContent>
              <CardFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revokeOne.isPending || isCurrent}
                  onClick={() => {
                    if (confirm("Revoke this session?")) {
                      revokeOne.mutate(session.token);
                    }
                  }}
                >
                  {isCurrent ? "Current session" : "Revoke"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
