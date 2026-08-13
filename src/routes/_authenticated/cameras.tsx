import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createCamera, deleteCamera, listCameras, updateCamera } from "@/lib/cameras.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/cameras")({
  head: () => ({
    meta: [
      { title: "Camera sources — HomeWatch" },
      {
        name: "description",
        content:
          "Register RTSP streams or HTTP snapshot URLs from your home cameras and set how often each is sampled.",
      },
      { property: "og:title", content: "Camera sources — HomeWatch" },
      { property: "og:description", content: "Manage the home cameras HomeWatch analyzes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cameras,
});

function Cameras() {
  const queryClient = useQueryClient();
  const fetchCameras = useServerFn(listCameras);
  const create = useServerFn(createCamera);
  const update = useServerFn(updateCamera);
  const remove = useServerFn(deleteCamera);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sourceType, setSourceType] = useState<"snapshot" | "rtsp">("snapshot");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(20);

  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cameras"] });

  const add = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          location: location || null,
          sourceType,
          url,
          pollIntervalSeconds: interval,
          enabled: true,
        },
      }),
    onSuccess: () => {
      setName("");
      setLocation("");
      setUrl("");
      invalidate();
      toast.success("Camera added — re-download the bridge script from Settings");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) => update({ data: vars }),
    onSuccess: invalidate,
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Camera removed");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cameras</h1>
        <p className="text-sm text-muted-foreground">
          URLs stay on your network — only the bridge agent reads them.
        </p>
      </div>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Add a camera</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              placeholder="Driveway"
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={sourceType}
              onValueChange={(value) => setSourceType(value as "snapshot" | "rtsp")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="snapshot">HTTP snapshot</SelectItem>
                <SelectItem value="rtsp">RTSP stream</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={url}
              placeholder="rtsp://user:pass@192.168.1.20/stream1"
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interval">Sample every (seconds)</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              max={3600}
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            />
          </div>
          <div className="flex items-end md:col-span-4">
            <Button onClick={() => add.mutate()} disabled={!name || !url || add.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add camera
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(cameras.data ?? []).map((camera) => (
          <Card key={camera.id} className="bg-card/70">
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <div className="flex-1">
                <p className="font-medium">{camera.name}</p>
                <p className="text-xs text-muted-foreground">
                  {camera.source_type.toUpperCase()} · every {camera.poll_interval_seconds}s ·{" "}
                  {camera.location || "no location"}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{camera.url}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`enabled-${camera.id}`} className="text-xs text-muted-foreground">
                  Enabled
                </Label>
                <Switch
                  id={`enabled-${camera.id}`}
                  checked={camera.enabled}
                  onCheckedChange={(checked) =>
                    toggle.mutate({ id: camera.id, enabled: checked })
                  }
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => destroy.mutate(camera.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {cameras.data && cameras.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
        ) : null}
      </div>
    </div>
  );
}
