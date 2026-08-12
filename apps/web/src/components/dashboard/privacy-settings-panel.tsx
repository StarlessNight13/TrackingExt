import { Alert, AlertDescription, AlertTitle } from "@trackingext/ui/components/alert";
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
import { Label } from "@trackingext/ui/components/label";
import { Skeleton } from "@trackingext/ui/components/skeleton";
import { Switch } from "@trackingext/ui/components/switch";
import { Textarea } from "@trackingext/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Palette, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DASHBOARD_THEME_VARIANTS } from "@trackingext/api/lib/settings.constants";
import { orpc } from "@/utils/orpc";

const THEME_SWATCHES = [
  "#6750A4",
  "#386A20",
  "#00639A",
  "#8E4E00",
  "#B3261E",
  "#5B5BD6",
] as const;

const VARIANT_LABELS: Record<(typeof DASHBOARD_THEME_VARIANTS)[number], string> = {
  TONAL_SPOT: "Tonal spot",
  EXPRESSIVE: "Expressive",
  FIDELITY: "Fidelity",
  VIBRANT: "Vibrant",
  NEUTRAL: "Neutral",
  MONOCHROME: "Monochrome",
  CONTENT: "Content",
  RAINBOW: "Rainbow",
  FRUIT_SALAD: "Fruit salad",
};

export function PrivacySettingsPanel() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(orpc.settings.get.queryOptions());
  const [excludedText, setExcludedText] = useState("");
  const [themeSeed, setThemeSeed] = useState("#6750A4");
  const [themeVariant, setThemeVariant] =
    useState<(typeof DASHBOARD_THEME_VARIANTS)[number]>("TONAL_SPOT");

  useEffect(() => {
    if (settingsQuery.data) {
      setExcludedText(settingsQuery.data.excludedHosts.join("\n"));
      setThemeSeed(settingsQuery.data.dashboardThemeSeed);
      setThemeVariant(settingsQuery.data.dashboardThemeVariant);
    }
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    ...orpc.settings.update.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orpc.settings.get.queryKey() });
      toast.success("Privacy settings saved");
    },
    onError: (error) => toast.error(error.message),
  });

  if (settingsQuery.isLoading || !settingsQuery.data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const settings = settingsQuery.data;

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Shield />
        <AlertTitle>Only tracked tabs sync</AlertTitle>
        <AlertDescription>
          TrackingExt never records general browsing. URL data is sent only after you explicitly track a
          tab. Auth-related query parameters are always stripped.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard theme</CardTitle>
          <CardDescription>
            Material-based tone preferences saved to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dashboard-theme-seed">Seed color</Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative size-12 overflow-hidden rounded-full border border-border">
                <input
                  id="dashboard-theme-seed"
                  type="color"
                  value={themeSeed}
                  onChange={(e) => setThemeSeed(e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {THEME_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Use ${swatch} as dashboard theme color`}
                    onClick={() => setThemeSeed(swatch)}
                    className="size-8 rounded-full border border-border"
                    style={{ backgroundColor: swatch }}
                  >
                    <span className="sr-only">{swatch}</span>
                  </button>
                ))}
              </div>
              <Badge variant="secondary">
                <Palette data-icon="inline-start" />
                {themeSeed.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Label>Theme variant</Label>
            <div className="flex flex-wrap gap-2">
              {DASHBOARD_THEME_VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  type="button"
                  variant={themeVariant === variant ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setThemeVariant(variant)}
                >
                  {VARIANT_LABELS[variant]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                dashboardThemeSeed: themeSeed,
                dashboardThemeVariant: themeVariant,
              })
            }
          >
            Save dashboard theme
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync preferences</CardTitle>
          <CardDescription>Control what gets stored for tracked activities.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="record-history">Record navigation history</Label>
              <p className="text-muted-foreground">
                Keep previous URLs for each tracked activity.
              </p>
            </div>
            <Switch
              id="record-history"
              checked={settings.recordHistory}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ recordHistory: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="store-query">Store URL query parameters</Label>
              <p className="text-muted-foreground">
                When off, all query strings are removed before sync.
              </p>
            </div>
            <Switch
              id="store-query"
              checked={!settings.stripQueryParams}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ stripQueryParams: !checked })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="store-hash">Store URL fragments (#…)</Label>
              <p className="text-muted-foreground">Usually safe to leave off for cleaner URLs.</p>
            </div>
            <Switch
              id="store-hash"
              checked={!settings.stripFragments}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ stripFragments: !checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excluded websites</CardTitle>
          <CardDescription>
            Hostnames that should never be tracked, one per line (for example mail.google.com).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={excludedText}
            onChange={(e) => setExcludedText(e.target.value)}
            rows={6}
            placeholder={"mail.google.com\nbank.example"}
          />
        </CardContent>
        <CardFooter>
          <Button
            disabled={updateMutation.isPending}
            onClick={() => {
              const hosts = excludedText
                .split(/[\n,]/)
                .map((h) => h.trim())
                .filter(Boolean);
              updateMutation.mutate({ excludedHosts: hosts });
            }}
          >
            Save exclusions
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
