import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Camera as CameraIcon, CircleDot, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { listCameras } from "@/lib/cameras.functions";
import { eventStats, latestPerCamera, listEvents } from "@/lib/events.functions";
import { listAlerts } from "@/lib/alerts.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Live camera console — HomeWatch" },
      {
        name: "description",
        content:
          "Live tiles for every home camera plus a real-time feed of vehicle, plate and person detections.",
      },
      { property: "og:title", content: "Live camera console — HomeWatch" },
      { property: "og:description", content: "Real-time detections from your own home cameras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="bg-card/70">
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const fetchCameras = useServerFn(listCameras);
  const fetchLatest = useServerFn(latestPerCamera);
  const fetchEvents = useServerFn(listEvents);
  const fetchStats = useServerFn(eventStats);
  const fetchAlerts = useServerFn(listAlerts);

  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });
  const latest = useQuery({
    queryKey: ["latest-frames"],
    queryFn: () => fetchLatest({}),
    refetchInterval: 15000,
  });
  const events = useQuery({
    queryKey: ["events", "feed"],
    queryFn: () => fetchEvents({ data: { limit: 24 } }),
    refetchInterval: 15000,
  });
  const stats = useQuery({
    queryKey: ["event-stats"],
    queryFn: () => fetchStats({}),
    refetchInterval: 30000,
  });
  const alerts = useQuery({
    queryKey: ["alerts", "open"],
    queryFn: () => fetchAlerts({ data: { openOnly: true } }),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => {
        queryClient.invalidateQueries({ queryKey: ["events"] });
        queryClient.invalidateQueries({ queryKey: ["latest-frames"] });
        queryClient.invalidateQueries({ queryKey: ["event-stats"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const latestByCamera = new Map((latest.data ?? []).map((entry) => [entry.cameraId, entry]));
  const openAlerts = alerts.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Live console</h1>
        <p className="text-sm text-muted-foreground">
          Frames arrive from the bridge agent on your home network and are analyzed on the way in.
        </p>
      </div>

      {openAlerts.length > 0 ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">{openAlerts.length} unacknowledged alert(s)</span> —
              latest plate <span className="plate">{openAlerts[0]?.plate}</span>
            </p>
            <Button asChild size="sm" variant="destructive">
              <Link to="/alerts">Review</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events (24h)" value={stats.data?.eventsLast24h ?? 0} />
        <StatCard label="Plates read" value={stats.data?.platesRead ?? 0} />
        <StatCard label="Total events" value={stats.data?.totalEvents ?? 0} />
        <StatCard label="Open alerts" value={stats.data?.openAlerts ?? 0} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cameras</h2>
        {cameras.data && cameras.data.length === 0 ? (
          <Card className="bg-card/70">
            <CardContent className="flex flex-col items-start gap-3 pt-6">
              <p className="text-sm text-muted-foreground">
                No cameras yet. Add one, then download the bridge agent from Settings.
              </p>
              <Button asChild size="sm">
                <Link to="/cameras">Add a camera</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(cameras.data ?? []).map((camera) => {
              const frame = latestByCamera.get(camera.id);
              const lastSeen = camera.last_seen_at ? new Date(camera.last_seen_at) : null;
              const stale = !lastSeen || Date.now() - lastSeen.getTime() > 5 * 60 * 1000;
              return (
                <Card key={camera.id} className="overflow-hidden bg-card/70">
                  <div className="grid-scan relative aspect-video bg-muted">
                    {frame?.imageUrl ? (
                      <img
                        src={frame.imageUrl}
                        alt={`Latest detection from ${camera.name}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <CameraIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-background/80 px-2 py-1 text-xs">
                      <CircleDot
                        className={stale ? "h-3 w-3 text-muted-foreground" : "h-3 w-3 text-success"}
                      />
                      {stale ? "offline" : "reporting"}
                    </div>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{camera.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {camera.location || camera.source_type.toUpperCase()} ·{" "}
                      {lastSeen
                        ? `last frame ${formatDistanceToNow(lastSeen, { addSuffix: true })}`
                        : "no frames yet"}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm">
                    {frame?.plate ? (
                      <span className="plate rounded bg-secondary px-2 py-1 text-sm">
                        {frame.plate}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {frame?.summary ?? "Awaiting detections"}
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent detections</h2>
          <Button asChild size="sm" variant="secondary">
            <Link to="/events">Search all events</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(events.data ?? []).map((event) => (
            <Card key={event.id} className="overflow-hidden bg-card/70">
              {event.imageUrl ? (
                <img
                  src={event.imageUrl}
                  alt={event.summary ?? "Camera detection snapshot"}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <CardContent className="space-y-1.5 pt-4">
                <div className="flex items-center justify-between gap-2">
                  {event.plate_text ? (
                    <span className="plate rounded bg-secondary px-2 py-0.5 text-xs">
                      {event.plate_text}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">no plate</span>
                  )}
                  {event.person_count > 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {event.person_count}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{event.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.captured_at), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ))}
          {events.data && events.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No detections yet — once the bridge agent is running, frames with vehicles or people
              show up here.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
