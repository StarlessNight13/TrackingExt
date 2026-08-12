import { env } from "@trackingext/env/web";
import { Alert, AlertDescription, AlertTitle } from "@trackingext/ui/components/alert";
import { Badge } from "@trackingext/ui/components/badge";
import { buttonVariants } from "@trackingext/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@trackingext/ui/components/card";
import { cn } from "@trackingext/ui/lib/utils";
import { Download, ExternalLink, Globe, Puzzle, ShieldCheck, ShoppingBag } from "lucide-react";

const STEPS = [
  {
    title: "Build or load the extension",
    body: "From the repo run bun run dev:extension (Chromium) or bun run dev:extension:firefox, then load the unpacked build from apps/extension/.output.",
  },
  {
    title: "Sign in with this account",
    body: "Open the extension popup and use the same email/password as this dashboard. Each install registers as a device.",
  },
  {
    title: "Track an activity",
    body: "On any normal web page choose Track this tab. Navigating Chapter 10 → 11 keeps one tracked identity and syncs the latest URL here.",
  },
  {
    title: "Continue on another browser",
    body: "Open this dashboard or another extension install, then Open or Open & take over so only one device actively updates the URL.",
  },
] as const;

type BrowserCardProps = {
  title: string;
  badge: string;
  description: string;
  installHint: string;
  downloadUrl: string;
  storeUrl?: string;
  icon: React.ComponentType<{ className?: string }>;
};

function BrowserCard({
  title,
  badge,
  description,
  installHint,
  downloadUrl,
  storeUrl,
  icon: Icon,
}: BrowserCardProps) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/70 backdrop-blur">
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full border border-border">
              <Icon className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{title}</CardTitle>
              <Badge variant="secondary" className="w-fit">
                {badge}
              </Badge>
            </div>
          </div>
        </div>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-none border border-dashed border-border/80 bg-muted/30 p-3 text-sm text-muted-foreground">
          {installHint}
        </div>
        <div className="flex flex-wrap gap-2">
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "default" }), "gap-2")}
            >
              <ShoppingBag className="size-4" />
              Store page
              <ExternalLink className="size-4" />
            </a>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline" }), "gap-2 opacity-50")}>
              <ShoppingBag className="size-4" />
              Store link unavailable
            </span>
          )}
          <a
            href={downloadUrl}
            download
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <Download className="size-4" />
            Download file
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExtensionGuidePanel() {
  const chromeStoreUrl = env.VITE_CHROME_WEB_STORE_URL;
  const firefoxAddonUrl = env.VITE_FIREFOX_ADDON_URL;
  const chromiumDownloadUrl = env.VITE_CHROMIUM_DOWNLOAD_URL;
  const firefoxDownloadUrl = env.VITE_FIREFOX_DOWNLOAD_URL;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <ShieldCheck />
        <AlertTitle>Explicit tracking only</AlertTitle>
        <AlertDescription>
          The extension does not sync every open tab. Only activities you choose to track send URL
          updates to your account.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        <BrowserCard
          title="Chromium"
          badge="Chrome · Edge · Brave"
          description="Install from the Chrome Web Store when configured, or download the packaged build for a manual install."
          installHint="Default self-hosted download path: /downloads/trackingext-chromium.zip"
          storeUrl={chromeStoreUrl}
          downloadUrl={chromiumDownloadUrl}
          icon={Globe}
        />

        <BrowserCard
          title="Firefox"
          badge="Desktop"
          description="Use the Mozilla Add-ons listing when available, or download the signed/self-hosted package directly."
          installHint="Default self-hosted download path: /downloads/trackingext-firefox.zip"
          storeUrl={firefoxAddonUrl}
          downloadUrl={firefoxDownloadUrl}
          icon={Puzzle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download />
            Setup checklist
          </CardTitle>
          <CardDescription>Get from this dashboard to a synced tracked tab.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex gap-3 border border-border p-3">
              <Badge variant="outline">{index + 1}</Badge>
              <div className="flex flex-col gap-1">
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground">{step.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
