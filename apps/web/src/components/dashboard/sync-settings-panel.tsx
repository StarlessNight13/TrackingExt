import { Alert, AlertDescription, AlertTitle } from "@trackingext/ui/components/alert";
import { Badge } from "@trackingext/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trackingext/ui/components/card";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Cloud, HardDrive, Link2, Radio, Wifi } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

const SYNC_MODES = [
  {
    id: "offline",
    title: "Offline",
    icon: HardDrive,
    description: "Tracked tabs stay on the browser where you created them. No account required.",
  },
  {
    id: "lan",
    title: "Same-network (LAN)",
    icon: Wifi,
    description:
      "Extensions on your local network sync directly via WebRTC. Pair once with a 6-digit code using this server as a relay.",
  },
  {
    id: "server",
    title: "Server",
    icon: Cloud,
    description:
      "Tabs sync to your account and appear on this dashboard. Combine with LAN or Offline in the extension.",
  },
] as const;

export function SyncSettingsPanel() {
  const devicesQuery = useQuery(orpc.devices.list.queryOptions());
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions());

  if (devicesQuery.isLoading || tabsQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const devices = devicesQuery.data ?? [];
  const tabs = tabsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Radio />
        <AlertTitle>Sync is configured in the extension</AlertTitle>
        <AlertDescription>
          Choose Offline, LAN, and/or Server sync during extension setup or in extension settings.
          This dashboard shows server-synced devices and tracked tabs when Server mode is enabled.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-3">
        {SYNC_MODES.map((mode) => (
          <Card key={mode.id} className="border-border/70 bg-card/70">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <mode.icon className="size-4" />
                </span>
                <CardTitle className="text-base">{mode.title}</CardTitle>
              </div>
              <CardDescription className="text-sm leading-relaxed">{mode.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="size-4" />
            Server sync status
          </CardTitle>
          <CardDescription>
            Devices signed in to this account with Server mode enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{devices.length} registered device(s)</Badge>
            <Badge variant="secondary">{tabs.length} tracked tab(s)</Badge>
          </div>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices yet. Install the extension, enable Server sync, and sign in with this
              account.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{device.name}</span>
                  <span className="text-muted-foreground">{device.browser}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/dashboard/devices"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Link2 className="size-4" />
            Manage devices
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="size-4" />
            LAN sync
          </CardTitle>
          <CardDescription>
            LAN pairing and peer connections are managed inside each extension install — not from
            this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Enable LAN sync in extension settings on both browsers.</li>
            <li>Use the same server URL as the pairing relay on both devices.</li>
            <li>Pair once with a 6-digit code, then tabs sync over your local network.</li>
            <li>Extensions reconnect automatically after restarts using the server relay.</li>
            <li>Tab history syncs between paired extensions on reconnect.</li>
            <li>Use Sync now in the extension to pull server data, reconnect LAN, and promote local tabs.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
