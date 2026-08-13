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
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [facingDirection, setFacingDirection] = useState<string>("Ingress");

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
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          facingDirection: facingDirection || "Ingress",
        },
      }),
    onSuccess: () => {
      setName("");
      setLocation("");
      setUrl("");
      setLatitude("");
      setLongitude("");
      setFacingDirection("Ingress");
      invalidate();
      toast.success("Camera added — re-download the bridge script from Settings");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) => update({ data: vars }),
    onSuccess: invalidate,
  });

  const updateCoords = useMutation({
    mutationFn: (vars: { id: string; latitude: number | null; longitude: number | null; facingDirection: string }) =>
      update({ data: { id: vars.id, latitude: vars.latitude, longitude: vars.longitude, facingDirection: vars.facingDirection } }),
    onSuccess: () => {
      invalidate();
      toast.success("Camera location updated");
    },
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Camera removed");
    },
  });

  const [showUrlGuide, setShowUrlGuide] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cameras & GIS Coordinates</h1>
          <p className="text-sm text-muted-foreground">
            Register camera streams and configure map coordinates & directional vectors for journey tracking.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowUrlGuide((prev) => !prev)}>
          {showUrlGuide ? "Hide URL Examples" : "Camera URL Cheat Sheet"}
        </Button>
      </div>

      {/* Expandable Camera Brand URL Guide */}
      {showUrlGuide ? (
        <Card className="bg-primary/5 border border-primary/30">
          <CardHeader className="py-3 px-4 border-b border-primary/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
              Common Camera Brand URL Patterns (RTSP & Snapshot)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs font-mono">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="p-2 rounded bg-background/80 border border-border/50">
                <span className="font-bold text-foreground block">Reolink</span>
                <span className="text-muted-foreground text-[11px] block">RTSP: `rtsp://admin:pass@192.168.1.50:554/h264Preview_01_main`</span>
                <span className="text-muted-foreground text-[11px] block">HTTP: `http://192.168.1.50/cgi-bin/api.cgi?cmd=Snap&user=admin&password=pass`</span>
              </div>

              <div className="p-2 rounded bg-background/80 border border-border/50">
                <span className="font-bold text-foreground block">Amcrest / Dahua</span>
                <span className="text-muted-foreground text-[11px] block">RTSP: `rtsp://admin:pass@192.168.1.50:554/cam/realmonitor?channel=1&subtype=0`</span>
                <span className="text-muted-foreground text-[11px] block">HTTP: `http://192.168.1.50/cgi-bin/snapshot.cgi?loginuse=admin&loginpas=pass`</span>
              </div>

              <div className="p-2 rounded bg-background/80 border border-border/50">
                <span className="font-bold text-foreground block">Hikvision</span>
                <span className="text-muted-foreground text-[11px] block">RTSP: `rtsp://admin:pass@192.168.1.50:554/Streaming/Channels/101`</span>
                <span className="text-muted-foreground text-[11px] block">HTTP: `http://192.168.1.50/ISAPI/Streaming/channels/101/picture`</span>
              </div>

              <div className="p-2 rounded bg-background/80 border border-border/50">
                <span className="font-bold text-foreground block">Wyze / Tapo / ESP32-CAM</span>
                <span className="text-muted-foreground text-[11px] block">Wyze (Docker/Bridge): `rtsp://192.168.1.50:8554/front-porch`</span>
                <span className="text-muted-foreground text-[11px] block">ESP32-CAM HTTP: `http://192.168.1.50/capture`</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              * Replace `192.168.1.50`, `admin`, and `pass` with your camera's actual local IP address, username, and password.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Add a camera</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Front Gate East" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="location">Location description</Label>
            <Input
              id="location"
              value={location}
              placeholder="e.g. Main Driveway Entrance"
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
          <div className="space-y-2">
            <Label htmlFor="interval">Interval (s)</Label>
            <Input
              id="interval"
              type="number"
              min={1}
              max={3600}
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="url">Stream / Snapshot URL</Label>
            <Input
              id="url"
              value={url}
              placeholder="rtsp://user:pass@192.168.1.20/stream1"
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              placeholder="37.7749"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              placeholder="-122.4194"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Direction Vector</Label>
            <Select value={facingDirection} onValueChange={setFacingDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ingress">Ingress (Entering)</SelectItem>
                <SelectItem value="Egress">Egress (Exiting)</SelectItem>
                <SelectItem value="Northbound">Northbound</SelectItem>
                <SelectItem value="Southbound">Southbound</SelectItem>
                <SelectItem value="Eastbound">Eastbound</SelectItem>
                <SelectItem value="Westbound">Westbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end md:col-span-6 pt-2">
            <Button onClick={() => add.mutate()} disabled={!name || !url || add.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add camera with Map Location
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(cameras.data ?? []).map((camera) => (
          <Card key={camera.id} className="bg-card/70">
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{camera.name}</p>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono">
                    {camera.facing_direction || "Ingress"}
                  </span>
                  {camera.latitude && camera.longitude ? (
                    <span className="rounded bg-primary/10 text-primary px-2 py-0.5 text-xs font-mono">
                      📍 {camera.latitude.toFixed(5)}, {camera.longitude.toFixed(5)}
                    </span>
                  ) : (
                    <span className="rounded bg-destructive/10 text-destructive px-2 py-0.5 text-xs">
                      No coordinates set (will default on map)
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {camera.source_type.toUpperCase()} · every {camera.poll_interval_seconds}s ·{" "}
                  {camera.location || "no location description"}
                </p>
                <p className="break-all text-xs text-muted-foreground">{camera.url}</p>
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
