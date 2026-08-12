import { Badge } from "@trackingext/ui/components/badge";
import { Button } from "@trackingext/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trackingext/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trackingext/ui/components/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@trackingext/ui/components/empty";
import { Input } from "@trackingext/ui/components/input";
import { Label } from "@trackingext/ui/components/label";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkX, ExternalLink, History, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { displayHostPath, relativeTime } from "@/lib/format";
import { orpc } from "@/utils/orpc";

type HistoryEntry = {
  id: string;
  url: string;
  title: string | null;
  visitedAt: string;
};

export function TrackedTabsPanel() {
  const queryClient = useQueryClient();
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [historyTabId, setHistoryTabId] = useState<string | null>(null);

  const renameMutation = useMutation({
    ...orpc.trackedTabs.rename.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.trackedTabs.list.queryKey() });
      setEditingId(null);
      toast.success("Tracked tab renamed");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    ...orpc.trackedTabs.delete.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.trackedTabs.list.queryKey() });
      toast.success("Tracking stopped");
    },
    onError: (error) => toast.error(error.message),
  });

  const historyQuery = useQuery({
    ...orpc.trackedTabs.history.queryOptions({ input: { id: historyTabId ?? "" } }),
    enabled: Boolean(historyTabId),
  });

  const clearHistoryMutation = useMutation({
    ...orpc.trackedTabs.clearHistory.mutationOptions(),
    onSuccess: async () => {
      if (historyTabId) {
        await queryClient.invalidateQueries({
          queryKey: orpc.trackedTabs.history.queryKey({ input: { id: historyTabId } }),
        });
      }
      toast.success("History cleared");
    },
    onError: (error) => toast.error(error.message),
  });

  if (tabsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (tabsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load tracked tabs</CardTitle>
          <CardDescription>{tabsQuery.error.message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => void tabsQuery.refetch()}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const tabs = tabsQuery.data ?? [];

  if (tabs.length === 0) {
    return (
      <div className="dashboard-empty-state">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkX />
            </EmptyMedia>
            <EmptyTitle>No tracked activities yet</EmptyTitle>
            <EmptyDescription>
              Open the browser extension, visit a page, and choose Track this tab. Synced activities
              will show up here across every device on your account.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {tabs.map((tab) => (
          <Card key={tab.id}>
            <CardHeader className="gap-2">
              <div className="col-start-1 flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  {tab.emoji ? <span className="text-lg">{tab.emoji}</span> : <Bookmark className="size-5" />}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <CardDescription className="uppercase tracking-[0.14em]">Tracked activity</CardDescription>
                  <CardTitle className="truncate text-base">{tab.name}</CardTitle>
                  <CardDescription className="truncate">
                    {tab.currentTitle || displayHostPath(tab.currentUrl)}
                  </CardDescription>
                </div>
              </div>
              <CardAction>
                {tab.activeDevice ? (
                  <Badge
                    variant="secondary"
                    className="max-w-[11rem]"
                    title={`Active · ${tab.activeDevice.name}`}
                  >
                    <span className="truncate">Active · {tab.activeDevice.name}</span>
                  </Badge>
                ) : (
                  <Badge variant="outline">Idle</Badge>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <a
                href={tab.currentUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {displayHostPath(tab.currentUrl)}
              </a>
              <p className="text-sm text-muted-foreground">
                Last updated from {tab.lastUpdatedDevice?.name ?? "unknown device"} ·{" "}
                {relativeTime(tab.lastUpdatedAt)}
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2.5">
              <Button render={<a href={tab.currentUrl} target="_blank" rel="noreferrer" />}>
                <ExternalLink data-icon="inline-start" />
                Open
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(tab.id);
                  setEditName(tab.name);
                }}
              >
                <Pencil data-icon="inline-start" />
                Rename
              </Button>
              <Button variant="outline" onClick={() => setHistoryTabId(tab.id)}>
                <History data-icon="inline-start" />
                History
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (confirm(`Stop tracking “${tab.name}”? This deletes its synced history.`)) {
                    deleteMutation.mutate({ id: tab.id });
                  }
                }}
              >
                <Trash2 data-icon="inline-start" />
                Stop tracking
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(editingId)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename tracked tab</DialogTitle>
            <DialogDescription>
              Give this activity a name you’ll recognize across devices.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tracked-name">Name</Label>
            <Input
              id="tracked-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || renameMutation.isPending || !editingId}
              onClick={() => {
                if (!editingId) return;
                renameMutation.mutate({ id: editingId, name: editName.trim() });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyTabId)} onOpenChange={(open) => !open && setHistoryTabId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Activity history</DialogTitle>
            <DialogDescription>
              Locations visited while this tab was tracked. Only explicit tracking is stored.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {historyQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}
            {(historyQuery.data as HistoryEntry[] | undefined)?.map((entry) => (
              <a
                key={entry.id}
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-0.5 border border-border px-3 py-2 hover:bg-muted"
              >
                <span className="font-medium">{entry.title || displayHostPath(entry.url)}</span>
                <span className="text-muted-foreground">
                  {displayHostPath(entry.url)} · {relativeTime(entry.visitedAt)}
                </span>
              </a>
            ))}
            {!historyQuery.isLoading && (historyQuery.data?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No history recorded for this activity.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!historyTabId || clearHistoryMutation.isPending}
              onClick={() => {
                if (!historyTabId) return;
                clearHistoryMutation.mutate({ id: historyTabId });
              }}
            >
              Clear history
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
