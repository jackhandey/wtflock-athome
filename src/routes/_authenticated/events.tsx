import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";

import { listCameras } from "@/lib/cameras.functions";
import { listEvents } from "@/lib/events.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Event history & plate search — HomeWatch" },
      {
        name: "description",
        content:
          "Search every recorded detection by plate, camera and date range, then export the results as CSV.",
      },
      { property: "og:title", content: "Event history & plate search — HomeWatch" },
      { property: "og:description", content: "Search and export your camera detection history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Events,
});

const ALL = "__all__";

function Events() {
  const fetchEvents = useServerFn(listEvents);
  const fetchCameras = useServerFn(listCameras);

  const [plate, setPlate] = useState("");
  const [cameraId, setCameraId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [platesOnly, setPlatesOnly] = useState(false);
  const [filters, setFilters] = useState<Record<string, unknown>>({ limit: 100 });

  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });
  const events = useQuery({
    queryKey: ["events", "search", filters],
    queryFn: () => fetchEvents({ data: filters }),
  });

  const applyFilters = () => {
    setFilters({
      limit: 200,
      ...(plate.trim() ? { plate: plate.trim() } : {}),
      ...(cameraId !== ALL ? { cameraId } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(platesOnly ? { platesOnly: true } : {}),
    });
  };

  const exportCsv = () => {
    const rows = events.data ?? [];
    const header = [
      "captured_at",
      "camera",
      "plate",
      "plate_confidence",
      "vehicle_type",
      "vehicle_make",
      "vehicle_color",
      "person_count",
      "summary",
    ];
    const body = rows.map((event) =>
      [
        event.captured_at,
        event.camera_name ?? "",
        event.plate_text ?? "",
        event.plate_confidence ?? "",
        event.vehicle_type ?? "",
        event.vehicle_make ?? "",
        event.vehicle_color ?? "",
        event.person_count,
        (event.summary ?? "").replace(/"/g, '""'),
      ]
        .map((value) => `"${String(value)}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homewatch-events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Event history</h1>
          <p className="text-sm text-muted-foreground">
            Fuzzy plate search — partial reads like <span className="plate">7BX•4</span> still match.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!events.data?.length}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="bg-card/70">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="plate">Plate</Label>
            <Input
              id="plate"
              value={plate}
              placeholder="e.g. 7BXK412"
              className="plate"
              onChange={(event) => setPlate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Camera</Label>
            <Select value={cameraId} onValueChange={setCameraId}>
              <SelectTrigger>
                <SelectValue placeholder="All cameras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All cameras</SelectItem>
                {(cameras.data ?? []).map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={applyFilters}>
              <Search className="mr-1.5 h-4 w-4" />
              Search
            </Button>
            <Button
              variant={platesOnly ? "default" : "outline"}
              onClick={() => setPlatesOnly((value) => !value)}
            >
              Plates only
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(events.data ?? []).map((event) => (
          <Card key={event.id} className="overflow-hidden bg-card/70">
            {event.imageUrl ? (
              <img
                src={event.imageUrl}
                alt={event.summary ?? "Detection snapshot"}
                className="aspect-video w-full object-cover"
                loading="lazy"
              />
            ) : null}
            <CardContent className="space-y-1.5 pt-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                {event.plate_text ? (
                  <span className="plate rounded bg-secondary px-2 py-0.5 text-sm">
                    {event.plate_text}
                  </span>
                ) : (
                  <span className="text-muted-foreground">no plate</span>
                )}
                <Badge variant="outline">{event.camera_name}</Badge>
              </div>
              <p className="text-muted-foreground">
                {[event.vehicle_color, event.vehicle_make, event.vehicle_type]
                  .filter(Boolean)
                  .join(" ") || event.summary}
              </p>
              <p className="text-muted-foreground">
                {format(new Date(event.captured_at), "PP p")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {events.data && events.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events match these filters.</p>
      ) : null}
    </div>
  );
}
