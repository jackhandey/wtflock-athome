import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bell, Download, KeyRound, Send, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { listCameras } from "@/lib/cameras.functions";
import { createDeviceKey, listDeviceKeys, revokeDeviceKey } from "@/lib/keys.functions";
import { getSettings, purgeOldSnapshots, saveSettings, testWebhook } from "@/lib/settings.functions";
import { buildBridgeScript } from "@/lib/bridge";
import { playAlertSirenSound } from "@/lib/audio-alarm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  const triggerTestWebhook = useServerFn(testWebhook);

  const [retentionDays, setRetentionDays] = useState(30);
  const [alertEmail, setAlertEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);

  const [keyName, setKeyName] = useState("Home bridge");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const settings = useQuery({ queryKey: ["settings"], queryFn: () => fetchSettings({}) });
  const keys = useQuery({ queryKey: ["device-keys"], queryFn: () => fetchKeys({}) });
  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });

  useEffect(() => {
    if (settings.data) {
      setRetentionDays(settings.data.retention_days ?? 30);
      setAlertEmail(settings.data.alert_email ?? "");
      setWebhookUrl(settings.data.webhook_url ?? "");
      setWebhookEnabled(settings.data.webhook_enabled !== false);
      setSoundAlertsEnabled(settings.data.sound_alerts_enabled !== false);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      persist({
        data: {
          retentionDays,
          alertEmail: alertEmail || null,
          webhookUrl: webhookUrl || null,
          webhookEnabled,
          soundAlertsEnabled,
        },
      }),
    onSuccess: () => toast.success("Settings saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  const runTestWebhook = useMutation({
    mutationFn: () => triggerTestWebhook({ data: { webhookUrl } }),
    onSuccess: () => toast.success("Test alert payload sent successfully!"),
    onError: (error: Error) => toast.error(error.message),
  });

  const cleanup = useMutation({
    mutationFn: () => purge({}),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Purged ${result?.removed ?? 0} old event(s)`);
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
        <h1 className="text-2xl font-semibold">Settings & Setup Guide</h1>
        <p className="text-sm text-muted-foreground">
          Configure bridge security keys, camera streams, multi-channel alert webhooks, and retention rules.
        </p>
      </div>

      {/* Visual Step-by-Step Setup Guide Card */}
      <Card className="bg-primary/5 border border-primary/30">
        <CardHeader className="py-4 px-6 border-b border-primary/20">
          <CardTitle className="text-base flex items-center gap-2 text-primary">
            🚀 How to Connect Your Home Cameras (3-Step Setup)
          </CardTitle>
          <CardDescription>
            HomeWatch uses a lightweight local bridge script so your camera stream credentials never leave your home network.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 text-xs">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-background/60">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">1</span>
                Add Camera Streams
              </div>
              <p className="text-muted-foreground">
                Go to the <strong className="text-foreground">Cameras</strong> tab and add your RTSP or HTTP snapshot URLs and GIS map coordinates.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-background/60">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">2</span>
                Issue Security Key
              </div>
              <p className="text-muted-foreground">
                Click <strong className="text-foreground">Issue Key</strong> below and copy your private device authentication key.
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-lg border border-border/60 bg-background/60">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">3</span>
                Run Local Bridge Agent
              </div>
              <p className="text-muted-foreground">
                Download the bridge script and run it on any PC, Mac, Raspberry Pi, or server on your local home network.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-amber-950/30 border border-amber-500/40 p-3 space-y-1">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
              ⚡ Pro-Tip: Motion Triggers vs. Continuous Polling (Cuts Costs by 95%)
            </span>
            <p className="text-amber-200/80 text-[11px]">
              Instead of fetching 1 frame every 10 seconds 24/7, configure your camera's ONVIF/RTSP motion sensor or Home Assistant to push frames <strong>only when a vehicle enters the frame</strong>. This cuts AI API costs by 95% and captures fast-moving vehicles the exact second they arrive!
            </p>
          </div>

          <div className="rounded-md bg-slate-950 p-3 font-mono text-[11px] text-slate-200 border border-slate-800 space-y-1">
            <p className="text-slate-400"># Run this in your terminal on any computer on your home network:</p>
            <p className="text-emerald-400">HOMEWATCH_KEY=your_key_here node homewatch-bridge.mjs</p>
            <p className="text-slate-500 text-[10px] pt-1">
              * Requires Node.js v18+. RTSP streams require `ffmpeg` installed on system PATH.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook & Instant Alerting Section */}
      <Card className="bg-card/70 border border-border/70">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Instant Multi-Channel Alerts & Siren Chimes
          </CardTitle>
          <CardDescription>
            Dispatch real-time hotlist alerts to Discord, Slack, Ntfy, Home Assistant, or Pushover, and enable in-browser siren chimes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="webhookUrl">Webhook URL (Discord / Slack / Home Assistant / Ntfy)</Label>
              <div className="flex gap-2">
                <Input
                  id="webhookUrl"
                  placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="font-mono text-xs flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => runTestWebhook.mutate()}
                  disabled={!webhookUrl || runTestWebhook.isPending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Test Webhook
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="secondary" className="text-[10px]">Discord</Badge>
                <Badge variant="secondary" className="text-[10px]">Slack</Badge>
                <Badge variant="secondary" className="text-[10px]">Home Assistant</Badge>
                <Badge variant="secondary" className="text-[10px]">Ntfy.sh</Badge>
                <Badge variant="secondary" className="text-[10px]">Generic JSON POST</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Enable Webhook Dispatch</Label>
                <p className="text-[11px] text-muted-foreground">Post rich alerts when hotlist plates hit.</p>
              </div>
              <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">In-Browser Sound Chime</Label>
                <p className="text-[11px] text-muted-foreground">Play an alert chime tone when active.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={playAlertSirenSound} title="Test Siren Audio">
                  <Volume2 className="h-4 w-4 text-primary" />
                </Button>
                <Switch checked={soundAlertsEnabled} onCheckedChange={setSoundAlertsEnabled} />
              </div>
            </div>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save Notification Settings
          </Button>
        </CardContent>
      </Card>

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
                  <span>{key.revoked ? "revoked" : "active"}</span>
                  {!key.revoked ? (
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

      {/* Privacy & Security Guarantees Card */}
      <Card className="bg-emerald-950/20 border border-emerald-500/30">
        <CardHeader className="py-4 px-6 border-b border-emerald-500/20">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
            🛡️ Privacy & Zero-Trust Security Guarantees
          </CardTitle>
          <CardDescription className="text-emerald-300/80">
            HomeWatch is engineered from the ground up to prioritize user privacy and home network security.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-background/70 space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                🔒 Zero Inbound Access / No Port Forwarding
              </span>
              <p className="text-muted-foreground text-[11px]">
                Your home cameras and RTSP passwords stay local to your home network. HomeWatch never requires opening router ports or exposing your home IP.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/20 bg-background/70 space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                🛡️ Enforced Row Level Security (RLS)
              </span>
              <p className="text-muted-foreground text-[11px]">
                Database security policies isolate your camera data at the database level. No other user can query or view your cameras, map pins, or events.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/20 bg-background/70 space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                🔑 SHA-256 Hashed Device Auth
              </span>
              <p className="text-muted-foreground text-[11px]">
                Device keys are stored as salted SHA-256 hashes. Raw keys are never stored in plaintext and can be revoked instantly.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-emerald-500/20 bg-background/70 space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                ⏱️ Short-Lived Signed Image URLs & Auto-Purge
              </span>
              <p className="text-muted-foreground text-[11px]">
                Snapshot image URLs expire automatically after 1 hour. Old footage is permanently erased automatically based on your retention policy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Retention & Purge</CardTitle>
          <CardDescription>Snapshots and events older than this are permanently deleted.</CardDescription>
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
            Save Retention Settings
          </Button>
          <Button variant="secondary" onClick={() => cleanup.mutate()} disabled={cleanup.isPending}>
            Purge now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
