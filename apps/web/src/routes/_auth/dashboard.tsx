import { Badge } from "@trackingext/ui/components/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trackingext/ui/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@trackingext/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  KeyRound,
  MonitorSmartphone,
  Puzzle,
  Shield,
} from "lucide-react";

import { DevicesPanel } from "@/components/dashboard/devices-panel";
import { ExtensionGuidePanel } from "@/components/dashboard/extension-guide-panel";
import { PrivacySettingsPanel } from "@/components/dashboard/privacy-settings-panel";
import { SessionsPanel } from "@/components/dashboard/sessions-panel";
import { TrackedTabsPanel } from "@/components/dashboard/tracked-tabs-panel";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const tabsQuery = useQuery(orpc.trackedTabs.list.queryOptions());
  const devicesQuery = useQuery(orpc.devices.list.queryOptions());

  const tabCount = tabsQuery.data?.length ?? 0;
  const deviceCount = devicesQuery.data?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {session.data?.user.name}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage synced activities, extension devices, privacy controls, and signed-in sessions from
          one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Tracked activities</CardDescription>
            <CardTitle className="text-2xl">{tabsQuery.isLoading ? "…" : tabCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Devices</CardDescription>
            <CardTitle className="text-2xl">
              {devicesQuery.isLoading ? "…" : deviceCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Signed in as</CardDescription>
            <CardTitle className="truncate text-base">{session.data?.user.email}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="tracked">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="tracked">
            <Bookmark data-icon="inline-start" />
            Tracked
            {tabCount > 0 ? <Badge variant="secondary">{tabCount}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="devices">
            <MonitorSmartphone data-icon="inline-start" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Shield data-icon="inline-start" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <KeyRound data-icon="inline-start" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="extension">
            <Puzzle data-icon="inline-start" />
            Extension
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracked" className="pt-4">
          <TrackedTabsPanel />
        </TabsContent>
        <TabsContent value="devices" className="pt-4">
          <DevicesPanel />
        </TabsContent>
        <TabsContent value="privacy" className="pt-4">
          <PrivacySettingsPanel />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <SessionsPanel />
        </TabsContent>
        <TabsContent value="extension" className="pt-4">
          <ExtensionGuidePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
