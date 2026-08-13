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

export function GroupsPanel() {
  const queryClient = useQueryClient();
  const groupsQuery = useQuery(orpc.groups.list.queryOptions());
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
    ...orpc.groups.create.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      setName("");
      setNotes("");
      toast.success("Group created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    ...orpc.groups.update.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      setEditingId(null);
      toast.success("Group updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    ...orpc.groups.delete.mutationOptions(),
    onSuccess: async () => {
      await invalidate();
      toast.success("Group deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  if (groupsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (groupsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load groups</CardTitle>
          <CardDescription>{groupsQuery.error.message}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => void groupsQuery.refetch()}>
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const groups = groupsQuery.data ?? [];
  const tabs = tabsQuery.data ?? [];
  const editing = groups.find((group) => group.id === editingId) ?? null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
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
            New group
          </Button>
        </CardFooter>
      </Card>

      {groups.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanban />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>
              Create a group to organize related activities into a workspace.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <div className="card-stack">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-base">{group.name}</CardTitle>
              <CardDescription>
                {group.activityCount}{" "}
                {group.activityCount === 1 ? "activity" : "activities"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {group.notes ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{group.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
              {group.pinnedActivity ? (
                <div className="flex flex-col gap-1 border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Pin className="size-4" />
                    Next up: {group.pinnedActivity.emoji
                      ? `${group.pinnedActivity.emoji} `
                      : ""}
                    {group.pinnedActivity.name}
                  </div>
                  <a
                    href={group.pinnedActivity.currentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    {group.pinnedActivity.currentTitle ||
                      displayHostPath(group.pinnedActivity.currentUrl)}
                  </a>
                </div>
              ) : (
                <Badge variant="outline">No pinned next activity</Badge>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2.5">
              {group.pinnedActivity ? (
                <Button
                  render={
                    <a
                      href={group.pinnedActivity.currentUrl}
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
                  setEditingId(group.id);
                  setName(group.name);
                  setNotes(group.notes);
                  setPinnedId(group.pinnedTrackedTabId ?? "");
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
                      `Delete group “${group.name}”? Activities stay tracked but ungrouped.`,
                    )
                  ) {
                    deleteMutation.mutate({ id: group.id });
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
            <DialogTitle>New group</DialogTitle>
            <DialogDescription>Name a workspace and optionally add notes.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-notes">Notes</Label>
              <Textarea
                id="group-notes"
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
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>
              Update notes and choose which activity is pinned as next.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-name">Name</Label>
              <Input
                id="edit-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-notes">Notes</Label>
              <Textarea
                id="edit-group-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-pin">Pinned next activity</Label>
              <MenuSelect
                id="edit-group-pin"
                aria-label="Pinned next activity"
                value={pinnedId}
                onValueChange={setPinnedId}
                options={[
                  { value: "", label: "None" },
                  ...tabs
                    .filter((tab) => !editing || tab.groupId === editing.id || !tab.groupId)
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
