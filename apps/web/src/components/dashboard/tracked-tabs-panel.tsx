import { Badge } from "@trackingext/ui/components/badge";
import { getUrlPatternParts } from "@trackingext/api/lib/url-pattern";
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
import { Checkbox } from "@trackingext/ui/components/checkbox";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@trackingext/ui/components/input-group";
import { Label } from "@trackingext/ui/components/label";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  BookmarkX,
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  History,
  Lock,
  Pencil,
  Play,
  Search,
  Share2,
  Tags,
  Trash2,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  activityExportToJson,
  activityExportToLinks,
  activityExportToMarkdown,
  buildActivityExport,
  downloadTextFile,
  slugifyFilename,
} from "@/lib/activity-export";
import { displayHostPath, relativeTime } from "@/lib/format";
import { MenuSelect } from "@/components/menu-select";
import { orpc } from "@/utils/orpc";

type HistoryEntry = {
  id: string;
  url: string;
  title: string | null;
  visitedAt: string;
};

function formatHistoryTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function HistoryUrl({ url, comparisonUrls }: { url: string; comparisonUrls: string[] }) {
  const displayUrl = displayHostPath(url);
  const parts = getUrlPatternParts(displayUrl, comparisonUrls);

  return (
    <>
      {parts.fixedStart}
      {parts.changing ? (
        <mark className="rounded-sm bg-secondary px-0.5 text-secondary-foreground">
          {parts.changing}
        </mark>
      ) : null}
      {parts.fixedEnd}
    </>
  );
}

export function TrackedTabsPanel() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"active" | "archived">("active");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions({ input: { archived: view } }));
  const collectionsQuery = useQuery(orpc.collections.list.queryOptions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCollectionId, setEditCollectionId] = useState<string>("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [historyTabId, setHistoryTabId] = useState<string | null>(null);
  const [exportTabId, setExportTabId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveCollectionId, setBulkMoveCollectionId] = useState<string>("");
  const [bulkTags, setBulkTags] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());

  const renameMutation = useMutation({
    ...orpc.trackedTabs.rename.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setEditingId(null);
      toast.success("Tracked tab renamed");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    ...orpc.trackedTabs.delete.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Tracking stopped");
    },
    onError: (error) => toast.error(error.message),
  });

  const archiveMutation = useMutation({
    ...orpc.trackedTabs.archive.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Activity archived");
    },
    onError: (error) => toast.error(error.message),
  });

  const restoreMutation = useMutation({
    ...orpc.trackedTabs.restore.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Activity restored");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkArchiveMutation = useMutation({
    ...orpc.trackedTabs.bulkArchive.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSelectedIds(new Set());
      toast.success("Activities archived");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkDeleteMutation = useMutation({
    ...orpc.trackedTabs.bulkDelete.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSelectedIds(new Set());
      toast.success("Activities deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkTagMutation = useMutation({
    ...orpc.trackedTabs.bulkTag.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSelectedIds(new Set());
      setBulkTagsOpen(false);
      setBulkTags("");
      toast.success("Tags added");
    },
    onError: (error) => toast.error(error.message),
  });

  const bulkMoveMutation = useMutation({
    ...orpc.trackedTabs.bulkMove.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSelectedIds(new Set());
      setBulkMoveOpen(false);
      setBulkMoveCollectionId("");
      toast.success("Activities moved");
    },
    onError: (error) => toast.error(error.message),
  });

  const releaseMutation = useMutation({
    ...orpc.trackedTabs.release.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Ownership released");
    },
    onError: (error) => toast.error(error.message),
  });

  const historyQuery = useQuery({
    ...orpc.trackedTabs.history.queryOptions({ input: { id: historyTabId ?? "" } }),
    enabled: Boolean(historyTabId),
  });

  const exportHistoryQuery = useQuery({
    ...orpc.trackedTabs.history.queryOptions({
      input: { id: exportTabId ?? "", limit: 200 },
    }),
    enabled: Boolean(exportTabId),
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

  const historyEntries = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    const entries = (historyQuery.data as HistoryEntry[] | undefined) ?? [];
    return query
      ? entries.filter((entry) =>
          `${entry.title ?? ""} ${entry.url}`.toLocaleLowerCase().includes(query),
        )
      : entries;
  }, [historyQuery.data, historySearch]);
  const historyUrls = useMemo(
    () =>
      ((historyQuery.data as HistoryEntry[] | undefined) ?? []).map((entry) =>
        displayHostPath(entry.url),
      ),
    [historyQuery.data],
  );

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

  const tabs = (tabsQuery.data ?? []).filter((tab) => {
    if (collectionFilter === "none" && tab.collectionId) return false;
    if (
      collectionFilter !== "all" &&
      collectionFilter !== "none" &&
      tab.collectionId !== collectionFilter
    ) {
      return false;
    }
    if (!deferredSearch) return true;
    const searchable = [
      tab.name,
      tab.currentTitle ?? "",
      tab.currentUrl,
      tab.collection?.name ?? "",
      ...tab.tags,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(deferredSearch);
  });
  const unhealthyCount = tabs.filter((tab) => tab.health.issues.length > 0).length;
  const collections = collectionsQuery.data ?? [];
  const selectedVisibleIds = tabs.filter((tab) => selectedIds.has(tab.id)).map((tab) => tab.id);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <>
      <Card variant="filled" className="activity-toolbar">
        <CardContent className="activity-toolbar__content flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="activity-toolbar__search-field flex-1">
              <label className="activity-toolbar__search-label" htmlFor="activity-search">
                Search activities
              </label>
              <InputGroup className="activity-toolbar__search h-14">
                <InputGroupInput
                  id="activity-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Sites, activities, or tags"
                  className="h-14 px-2 text-sm"
                />
                <InputGroupAddon align="inline-start" className="pl-4">
                  <Search className="size-5" aria-hidden="true" />
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="lg"
                className="activity-toolbar__view-toggle min-w-28"
                aria-pressed={view === "archived"}
                onClick={() => setView((current) => (current === "active" ? "archived" : "active"))}
              >
                {view === "active" ? "Active" : "Archived"}
              </Button>
            </div>
          </div>
          <div className="activity-toolbar__collections" role="tablist" aria-label="Filter by collection">
              <Button
                variant="ghost"
                size="lg"
                role="tab"
                className="activity-toolbar__collection-chip"
                aria-selected={collectionFilter === "all"}
                data-active={collectionFilter === "all" || undefined}
                onClick={() => setCollectionFilter("all")}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="lg"
                role="tab"
                className="activity-toolbar__collection-chip"
                aria-selected={collectionFilter === "none"}
                data-active={collectionFilter === "none" || undefined}
                onClick={() => setCollectionFilter("none")}
              >
                Ungrouped
              </Button>
              {collections.map((collection) => (
                <Button
                  key={collection.id}
                  variant="ghost"
                  size="lg"
                  role="tab"
                  className="activity-toolbar__collection-chip"
                  aria-selected={collectionFilter === collection.id}
                  data-active={collectionFilter === collection.id || undefined}
                  onClick={() => setCollectionFilter(collection.id)}
                >
                  {collection.name}
                </Button>
              ))}
          </div>
        </CardContent>
      </Card>
      {unhealthyCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4" />
              {unhealthyCount} activit{unhealthyCount === 1 ? "y needs" : "ies need"} attention
            </CardTitle>
            <CardDescription>
              Stale activities and offline owners show recovery actions on each card.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      {selectedVisibleIds.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-6">
            <p className="mr-auto text-sm font-medium">{selectedVisibleIds.length} selected</p>
            {view === "active" ? (
              <Button
                variant="outline"
                disabled={bulkArchiveMutation.isPending}
                onClick={() => bulkArchiveMutation.mutate({ ids: selectedVisibleIds })}
              >
                <Archive data-icon="inline-start" />
                Archive
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setBulkTagsOpen(true)}>
              <Tags data-icon="inline-start" />
              Tag
            </Button>
            <Button variant="outline" onClick={() => setBulkMoveOpen(true)}>
              <FolderInput data-icon="inline-start" />
              Move
            </Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Delete ${selectedVisibleIds.length} selected activities and their history?`,
                  )
                ) {
                  bulkDeleteMutation.mutate({ ids: selectedVisibleIds });
                }
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {tabs.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">{search ? <Search /> : <BookmarkX />}</EmptyMedia>
            <EmptyTitle>
              {search
                ? "No matching activities"
                : view === "archived"
                  ? "No archived activities"
                  : "No tracked activities yet"}
            </EmptyTitle>
            <EmptyDescription>
              {search
                ? "Try a different search or switch activity views."
                : view === "archived"
                  ? "Archived activities remain here until you are ready to restore them."
                  : "Open the browser extension, visit a page, and choose Track this tab."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <div className="card-stack">
        {tabs.map((tab) => (
          <Card key={tab.id}>
            <CardHeader className="gap-2">
              <div className="col-start-1 flex min-w-0 items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(tab.id)}
                  onCheckedChange={(checked) => toggleSelected(tab.id, checked === true)}
                  aria-label={`Select ${tab.name}`}
                />
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  {tab.emoji ? (
                    <span className="text-lg">{tab.emoji}</span>
                  ) : (
                    <Bookmark className="size-5" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <CardDescription className="uppercase tracking-[0.14em]">
                    Tracked activity
                  </CardDescription>
                  <CardTitle className="truncate text-base">{tab.name}</CardTitle>
                  <CardDescription className="truncate">
                    {tab.currentTitle || displayHostPath(tab.currentUrl)}
                  </CardDescription>
                  {tab.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tab.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tab.collection ? <Badge variant="secondary">{tab.collection.name}</Badge> : null}
                    {tab.isPrivate ? (
                      <Badge variant="outline">
                        <Lock className="size-3" />
                        Private
                      </Badge>
                    ) : null}
                    {tab.health.stale ? <Badge variant="destructive">Stale</Badge> : null}
                    {tab.health.ownerOffline ? (
                      <Badge variant="destructive">Owner offline</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <CardAction>
                {tab.activeDevice ? (
                  <Badge
                    variant={tab.health.ownerOffline ? "destructive" : "secondary"}
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
              {tab.health.ownershipConflict ? (
                <p className="text-sm text-destructive">
                  Ownership is stuck on an offline device. Release it so another device can take over.
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2.5">
              <Button render={<a href={tab.currentUrl} target="_blank" rel="noreferrer" />}>
                <ExternalLink data-icon="inline-start" />
                Open
              </Button>
              {tab.health.ownershipConflict ? (
                <Button
                  variant="secondary"
                  disabled={releaseMutation.isPending}
                  onClick={() => releaseMutation.mutate({ id: tab.id })}
                >
                  <Unplug data-icon="inline-start" />
                  Release ownership
                </Button>
              ) : null}
              {tab.health.stale && view === "active" ? (
                <Button
                  variant="outline"
                  disabled={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate({ id: tab.id })}
                >
                  <Archive data-icon="inline-start" />
                  Archive stale
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(tab.id);
                  setEditName(tab.name);
                  setEditTags(tab.tags.join(", "));
                  setEditCollectionId(tab.collectionId ?? "");
                  setEditPrivate(tab.isPrivate);
                }}
              >
                <Pencil data-icon="inline-start" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setHistoryTabId(tab.id)}>
                <History data-icon="inline-start" />
                History
              </Button>
              <Button variant="outline" onClick={() => setExportTabId(tab.id)}>
                <Share2 data-icon="inline-start" />
                Export
              </Button>
              {view === "active" ? (
                <Button
                  variant="outline"
                  disabled={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate({ id: tab.id })}
                >
                  <Archive data-icon="inline-start" />
                  Archive
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate({ id: tab.id })}
                >
                  <ArchiveRestore data-icon="inline-start" />
                  Restore
                </Button>
              )}
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
            <DialogTitle>Edit activity</DialogTitle>
            <DialogDescription>
              Update the name, tags, collection, and private mode for this activity.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracked-name">Name</Label>
              <Input
                id="tracked-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracked-tags">Tags</Label>
              <Input
                id="tracked-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="research, work"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tracked-collection">Collection</Label>
              <MenuSelect
                id="tracked-collection"
                aria-label="Collection"
                value={editCollectionId}
                onValueChange={setEditCollectionId}
                options={[
                  { value: "", label: "Ungrouped" },
                  ...collections.map((collection) => ({
                    value: collection.id,
                    label: collection.name,
                  })),
                ]}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={editPrivate}
                onCheckedChange={(checked) => setEditPrivate(checked === true)}
              />
              Private mode (no navigation history)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || renameMutation.isPending || !editingId}
              onClick={() => {
                if (!editingId) return;
                renameMutation.mutate({
                  id: editingId,
                  name: editName.trim(),
                  tags: editTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  collectionId: editCollectionId || null,
                  isPrivate: editPrivate,
                });
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
          <Input
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Search this activity’s history"
            aria-label="Search activity history"
          />
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {historyQuery.isLoading ? <Skeleton className="h-20 w-full" /> : null}
            {historyEntries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2 border border-border px-3 py-2">
                <span className="font-medium">{entry.title || displayHostPath(entry.url)}</span>
                <span className="text-muted-foreground">
                  <HistoryUrl url={entry.url} comparisonUrls={historyUrls} /> ·{" "}
                  {formatHistoryTime(entry.visitedAt)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    render={<a href={entry.url} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    render={<a href={entry.url} target="_blank" rel="noreferrer" />}
                  >
                    <Play data-icon="inline-start" />
                    Resume here
                  </Button>
                </div>
              </div>
            ))}
            {!historyQuery.isLoading && historyEntries.length === 0 ? (
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

      <Dialog open={bulkTagsOpen} onOpenChange={setBulkTagsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tags to selected activities</DialogTitle>
            <DialogDescription>
              Use commas to separate tags. Existing tags will be kept.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={bulkTags}
            onChange={(event) => setBulkTags(event.target.value)}
            placeholder="research, later"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setBulkTagsOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!bulkTags.trim() || bulkTagMutation.isPending}
              onClick={() =>
                bulkTagMutation.mutate({
                  ids: selectedVisibleIds,
                  tags: bulkTags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  mode: "add",
                })
              }
            >
              Add tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move selected activities</DialogTitle>
            <DialogDescription>
              Assign the selected activities to a collection, or leave them ungrouped.
            </DialogDescription>
          </DialogHeader>
          <MenuSelect
            aria-label="Destination collection"
            value={bulkMoveCollectionId}
            onValueChange={setBulkMoveCollectionId}
            options={[
              { value: "", label: "Ungrouped" },
              ...collections.map((collection) => ({
                value: collection.id,
                label: collection.name,
              })),
            ]}
          />
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setBulkMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={bulkMoveMutation.isPending || selectedVisibleIds.length === 0}
              onClick={() =>
                bulkMoveMutation.mutate({
                  ids: selectedVisibleIds,
                  collectionId: bulkMoveCollectionId || null,
                })
              }
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(exportTabId)} onOpenChange={(open) => !open && setExportTabId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export activity</DialogTitle>
            <DialogDescription>
              Download or copy this activity as JSON, Markdown, or a plain list of links.
            </DialogDescription>
          </DialogHeader>
          {exportHistoryQuery.isLoading ? <Skeleton className="h-16 w-full" /> : null}
          <div className="flex flex-col gap-2">
            {(
              [
                {
                  id: "json",
                  label: "JSON",
                  extension: "json",
                  mime: "application/json",
                  build: activityExportToJson,
                },
                {
                  id: "markdown",
                  label: "Markdown",
                  extension: "md",
                  mime: "text/markdown",
                  build: activityExportToMarkdown,
                },
                {
                  id: "links",
                  label: "Links",
                  extension: "txt",
                  mime: "text/plain",
                  build: activityExportToLinks,
                },
              ] as const
            ).map((format) => (
              <div
                key={format.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2"
              >
                <span className="font-medium">{format.label}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!exportTabId || exportHistoryQuery.isLoading}
                    onClick={async () => {
                      const tab = (tabsQuery.data ?? []).find((item) => item.id === exportTabId);
                      if (!tab) return;
                      const payload = buildActivityExport(
                        tab,
                        (exportHistoryQuery.data as HistoryEntry[] | undefined) ?? [],
                      );
                      const text = format.build(payload);
                      try {
                        await navigator.clipboard.writeText(text);
                        toast.success(`${format.label} copied`);
                      } catch {
                        toast.error("Could not copy to clipboard");
                      }
                    }}
                  >
                    <Copy data-icon="inline-start" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    disabled={!exportTabId || exportHistoryQuery.isLoading}
                    onClick={() => {
                      const tab = (tabsQuery.data ?? []).find((item) => item.id === exportTabId);
                      if (!tab) return;
                      const payload = buildActivityExport(
                        tab,
                        (exportHistoryQuery.data as HistoryEntry[] | undefined) ?? [],
                      );
                      downloadTextFile(
                        `${slugifyFilename(tab.name)}.${format.extension}`,
                        format.build(payload),
                        format.mime,
                      );
                      toast.success(`${format.label} downloaded`);
                    }}
                  >
                    <Download data-icon="inline-start" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-primary" onClick={() => setExportTabId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
