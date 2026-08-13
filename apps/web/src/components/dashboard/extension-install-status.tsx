import { Alert, AlertDescription, AlertTitle } from "@trackingext/ui/components/alert";
import { Badge } from "@trackingext/ui/components/badge";
import { AlertCircle, CheckCircle2, LoaderCircle, Puzzle } from "lucide-react";

import {
  useExtensionInstallStatus,
  type ExtensionInstallStatus,
} from "@/hooks/use-extension-install-status";

function channelLabel(channel: string) {
  if (channel === "store") return "Store build";
  if (channel === "development") return "Development build";
  return "Self-hosted build";
}

function StatusBody({ state }: { state: ExtensionInstallStatus }) {
  if (state.status === "checking") {
    return (
      <Alert>
        <LoaderCircle className="animate-spin" />
        <AlertTitle>Checking this browser</AlertTitle>
        <AlertDescription>
          Looking for a TrackingExt install in the current browser…
        </AlertDescription>
      </Alert>
    );
  }

  if (state.status === "missing") {
    return (
      <Alert>
        <Puzzle />
        <AlertTitle>No extension detected in this browser</AlertTitle>
        <AlertDescription>
          Install the package below, then reload this page.{" "}
          {state.served
            ? `This dashboard is serving self-hosted package v${state.served.version}.`
            : "Package version metadata is not available yet (local builds may not publish it)."}
        </AlertDescription>
      </Alert>
    );
  }

  const { installed, served, comparison } = state;
  const isStore = installed.channel === "store";
  const isOutdated = comparison === "outdated";
  const Icon = isOutdated ? AlertCircle : CheckCircle2;

  let title = `Extension detected · v${installed.version}`;
  let description = `${channelLabel(installed.channel)}.`;

  if (served) {
    description += ` Dashboard package: v${served.version}.`;
  }

  if (isStore) {
    title = `Store extension detected · v${installed.version}`;
    description +=
      " You are on a store build. Self-hosted downloads below may be newer or different from the store listing.";
  } else if (comparison === "outdated") {
    title = `Outdated self-hosted build · v${installed.version}`;
    description += " Download the package below and reinstall to match this dashboard.";
  } else if (comparison === "ahead") {
    title = `Newer than dashboard package · v${installed.version}`;
    description += " Your install is ahead of the package served here (common in local development).";
  } else if (comparison === "up-to-date") {
    title = `Up to date · v${installed.version}`;
    description += " Matches the package this dashboard serves.";
  }

  return (
    <Alert variant={isOutdated ? "destructive" : "default"}>
      <Icon />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {title}
        <Badge variant="secondary">{channelLabel(installed.channel)}</Badge>
      </AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export function ExtensionInstallStatusCard() {
  const state = useExtensionInstallStatus();
  return <StatusBody state={state} />;
}
