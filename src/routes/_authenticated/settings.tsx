import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { listCameras } from "@/lib/cameras.functions";
import { createDeviceKey, listDeviceKeys, revokeDeviceKey } from "@/lib/keys.functions";
import { getSettings, purgeOldSnapshots, saveSettings } from "@/lib/settings.functions";
import { buildBridgeScript } from "@/lib/bridge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Bridge agent & retention — HomeWatch" },
      {
        name: "description",
        content:
          "Issue device keys, download the local bridge agent for your cameras, and control snapshot retention.",
      },
      { property: "og:title", content: "Bridge agent & retention — HomeWatch" },
      { property: "og:description", content: "Set up the local bridge agent and retention rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getSettings);
  const persist = useServerFn(saveSettings);
  const purge = useServerFn(purgeOldSnapshots);
  const fetchKeys = useServerFn(listDeviceKeys);
  const makeKey = useServerFn(createDeviceKey);
  const dropKey = useServerFn(revokeDeviceKey);
  const fetchCameras = useServerFn(listCameras);

  const [retentionDays, setRetentionDays] = useState(30);
  const [alertEmail, setAlertEmail] = useState("");
  const [keyName, setKeyName] = useState("Home bridge");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings({}) });
  const keys = useQuery({ queryKey: ["device-keys"], queryFn: () => fetchKeys({}) });
  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });

  useEffect(() => {
    if (settings.data) {
      setRetentionDays(settings.data.retention_days ?? 30);
      setAlertEmail(settings.data.alert_email ?? "");
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => persist({ data: { retentionDays, alertEmail: alertEmail || null } }),
    onSuccess: () => toast.success("Settings saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  const cleanup = useMutation({
    mutationFn: () => purge({}),
    onSuccess: (result: { deleted?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Purged ${result?.deleted ?? 0} old event(s)`);
    },
  });

  const issue = useMutation({
    mutationFn: () => makeKey({ data: { name: keyName } }),
    onSuccess: (result: { secret?: string }) => {
      setFreshSecret(result?.secret ?? null);
      queryClient.invalidateQueries({ queryKey: ["device-keys"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => dropKey({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-keys"] });
      toast.success("Key revoked");
    },
  });

  const downloadBridge = () => {
    const script = buildBridgeScript(
      (cameras.data ?? []).map((camera) => ({
        id: camera.id,
        name: camera.name,
        source_type: camera.source_type,
        url: camera.url,
        poll_interval_seconds: camera.poll_interval_seconds,
        enabled: camera.enabled,
      })),
      `${window.location.origin}/api/public/ingest`,
    );
    const blob = new Blob([script], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "homewatch-bridge.mjs";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          The bridge agent runs on your network, grabs frames and posts them here for analysis.
        </p>
      </div>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Bridge agent</CardTitle>
          <CardDescription>
            Issue a device key, then run the downloaded script with{" "}
            <code className="plate">HOMEWATCH_KEY=… node homewatch-bridge.mjs</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key name</Label>
              <Input
                id="keyName"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
              />
            </div>
            <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
              <KeyRound className="mr-1.5 h-4 w-4" />
              Issue key
            </Button>
            <Button variant="secondary" onClick={downloadBridge}>
              <Download className="mr-1.5 h-4 w-4" />
              Download bridge script
            </Button>
          </div>

          {freshSecret ? (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
              <p className="font-medium">Copy this key now — it is shown only once.</p>
              <p className="plate mt-1 break-all">{freshSecret}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {(keys.data ?? []).map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm"
              >
                <span>{key.name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{key.revoked_at ? "revoked" : "active"}</span>
                  {!key.revoked_at ? (
                    <Button variant="ghost" size="icon" onClick={() => revoke.mutate(key.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Retention</CardTitle>
          <CardDescription>Snapshots and events older than this are deleted.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="retention">Keep for (days)</Label>
            <Input
              id="retention"
              type="number"
              min={1}
              max={365}
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alertEmail">Alert email (optional)</Label>
            <Input
              id="alertEmail"
              type="email"
              value={alertEmail}
              onChange={(event) => setAlertEmail(event.target.value)}
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => cleanup.mutate()} disabled={cleanup.isPending}>
            Purge now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
