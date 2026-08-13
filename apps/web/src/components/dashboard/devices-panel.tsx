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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { relativeTime } from "@/lib/format";
import { orpc } from "@/utils/orpc";
import { OFFLINE_DEVICE_MS } from "@trackingext/api/lib/settings.constants";

export function DevicesPanel() {
  const queryClient = useQueryClient();
  const devicesQuery = useQuery(orpc.devices.list.queryOptions());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const renameMutation = useMutation({
    ...orpc.devices.rename.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.devices.list.queryKey() });
      setEditingId(null);
      toast.success("Device renamed");
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    ...orpc.devices.remove.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.devices.list.queryKey() });
      await queryClient.invalidateQueries({ queryKey: orpc.trackedTabs.list.queryKey() });
      toast.success("Device removed");
    },
    onError: (error) => toast.error(error.message),
  });

  if (devicesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (devicesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load devices</CardTitle>
          <CardDescription>{devicesQuery.error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const devices = devicesQuery.data ?? [];

  if (devices.length === 0) {
    return (
      <div className="dashboard-empty-state">
        <Empty className="max-w-lg border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorSmartphone />
            </EmptyMedia>
            <EmptyTitle>No extension devices yet</EmptyTitle>
            <EmptyDescription>
              Install the extension and sign in. Each browser installation registers as a device such
              as “Home PC · Firefox” or “Laptop · Chrome”.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {devices.map((device) => {
          const offline = Date.now() - new Date(device.lastSeenAt).getTime() > OFFLINE_DEVICE_MS;
          return (
          <Card key={device.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <MonitorSmartphone className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <CardDescription className="uppercase tracking-[0.14em]">Registered device</CardDescription>
                    <CardTitle className="text-base">{device.name}</CardTitle>
                    <CardDescription>Last seen {relativeTime(device.lastSeenAt)}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{device.browser}</Badge>
                  <Badge variant={offline ? "destructive" : "outline"}>
                    {offline ? "Offline" : "Online"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Registered {new Date(device.createdAt).toLocaleString()}
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingId(device.id);
                  setEditName(device.name);
                }}
              >
                <Pencil data-icon="inline-start" />
                Rename
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={removeMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      `Remove “${device.name}”? Tracked tabs stay, but this installation must re-register.`,
                    )
                  ) {
                    removeMutation.mutate({ id: device.id });
                  }
                }}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            </CardFooter>
          </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(editingId)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename device</DialogTitle>
            <DialogDescription>
              Use a label you’ll recognize, like “Work PC · Firefox”.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-name">Name</Label>
            <Input
              id="device-name"
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
    </>
  );
}
