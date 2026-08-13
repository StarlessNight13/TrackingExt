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
import { Textarea } from "@trackingext/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderKanban, Pencil, Pin, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { displayHostPath } from "@/lib/format";
import { MenuSelect } from "@/components/menu-select";
import { orpc } from "@/utils/orpc";

export function CollectionsPanel() {
  const queryClient = useQueryClient();
  const collectionsQuery = useQuery(orpc.collections.list.queryOptions());
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions({ input: { archived: "active" } }));
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pinnedId, setPinnedId] = useState<string>("");

  const invalidate = async () => {
    await queryClient.invalidateQueries();
  };

  const createMutation = useMutation({
    ...orpc.collections.create.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      setName("");
      setNotes("");
      toast.success("Collection created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    ...orpc.collections.update.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      setEditingId(null);
      toast.success("Collection updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    ...orpc.collections.delete.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      toast.success("Collection deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  if (collectionsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (collectionsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load collections</CardTitle>
          <CardDescription>{collectionsQuery.error.message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => void collectionsQuery.refetch()}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const collections = collectionsQuery.data ?? [];
  const tabs = tabsQuery.data ?? [];
  const editing = collections.find((collection) => collection.id === editingId) ?? null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
          <CardDescription>
            Group activities into projects with notes and a pinned next activity.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            onClick={() => {
              setName("");
              setNotes("");
              setCreateOpen(true);
            }}
          >
            New collection
          </Button>
        </CardFooter>
      </Card>

      {collections.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>No collections yet</EmptyTitle>
            <EmptyDescription>
              Create a collection to organize related activities into a workspace.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <div className="card-stack">
        {collections.map((collection) => (
          <Card key={collection.id}>
            <CardHeader>
              <CardTitle className="text-base">{collection.name}</CardTitle>
              <CardDescription>
                {collection.activityCount}{" "}
                {collection.activityCount === 1 ? "activity" : "activities"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {collection.notes ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{collection.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
              {collection.pinnedActivity ? (
                <div className="flex flex-col gap-1 border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Pin className="size-4" />
                    Next up: {collection.pinnedActivity.emoji
                      ? `${collection.pinnedActivity.emoji} `
                      : ""}
                    {collection.pinnedActivity.name}
                  </div>
                  <a
                    href={collection.pinnedActivity.currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {collection.pinnedActivity.currentTitle ||
                      displayHostPath(collection.pinnedActivity.currentUrl)}
                  </a>
                </div>
              ) : (
                <Badge variant="outline">No pinned next activity</Badge>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2.5">
              {collection.pinnedActivity ? (
                <Button
                  render={
                    <a
                      href={collection.pinnedActivity.currentUrl}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLink data-icon="inline-start" />
                  Open next
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(collection.id);
                  setName(collection.name);
                  setNotes(collection.notes);
                  setPinnedId(collection.pinnedTrackedTabId ?? "");
                }}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      `Delete collection “${collection.name}”? Activities stay tracked but ungrouped.`,
                    )
                  ) {
                    deleteMutation.mutate({ id: collection.id });
                  }
                }}
              >
                <Trash2 data-icon="inline-start" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>Name a workspace and optionally add notes.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-notes">Notes</Label>
              <Textarea
                id="collection-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: name.trim(),
                  notes: notes.trim(),
                })
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>
              Update notes and choose which activity is pinned as next.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-collection-name">Name</Label>
              <Input
                id="edit-collection-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-collection-notes">Notes</Label>
              <Textarea
                id="edit-collection-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-collection-pin">Pinned next activity</Label>
              <MenuSelect
                id="edit-collection-pin"
                aria-label="Pinned next activity"
                value={pinnedId}
                onValueChange={setPinnedId}
                options={[
                  { value: "", label: "None" },
                  ...tabs
                    .filter((tab) => !editing || tab.collectionId === editing.id || !tab.collectionId)
                    .map((tab) => ({
                      value: tab.id,
                      label: `${tab.emoji ? `${tab.emoji} ` : ""}${tab.name}`,
                    })),
                  ...(editing?.pinnedActivity &&
                  !tabs.some((tab) => tab.id === editing.pinnedActivity?.id)
                    ? [
                        {
                          value: editing.pinnedActivity.id,
                          label: `${editing.pinnedActivity.emoji ? `${editing.pinnedActivity.emoji} ` : ""}${editing.pinnedActivity.name}`,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing || !name.trim() || updateMutation.isPending}
              onClick={() => {
                if (!editing) return;
                updateMutation.mutate({
                  id: editing.id,
                  name: name.trim(),
                  notes: notes.trim(),
                  pinnedTrackedTabId: pinnedId || null,
                });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
