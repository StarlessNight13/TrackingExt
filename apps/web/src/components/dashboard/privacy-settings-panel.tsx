import { Alert, AlertDescription, AlertTitle } from "@trackingext/ui/components/alert";
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
import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/utils/orpc";

export function PrivacySettingsPanel() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(orpc.settings.get.queryOptions());
  const [excludedText, setExcludedText] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setExcludedText(settingsQuery.data.excludedHosts.join("\n"));
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
