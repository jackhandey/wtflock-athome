import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { Download, Filter, Search, Sparkles, Tag } from "lucide-react";

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
      { title: "Vehicle Intelligence & Search — HomeWatch" },
      {
        name: "description",
        content:
          "Search detections with or without a license plate using natural language, state, vehicle make/model, or visual features.",
      },
      { property: "og:title", content: "Vehicle Intelligence & Search — HomeWatch" },
      { property: "og:description", content: "Flock-style natural language and multi-attribute vehicle search." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Events,
});

const ALL = "__all__";

const US_STATES = [
  "CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI",
  "NJ", "VA", "WA", "AZ", "TN", "MA", "IN", "MO", "MD", "CO",
];

const FEATURE_PRESETS = [
  "roof_rack", "bumper_sticker", "dented_bumper", "window_tint", "custom_wheels", "spare_tire", "tow_hitch", "tool_rack"
];

function Events() {
  const fetchEvents = useServerFn(listEvents);
  const fetchCameras = useServerFn(listCameras);

  const [naturalQuery, setNaturalQuery] = useState("");
  const [plate, setPlate] = useState("");
  const [plateState, setPlateState] = useState(ALL);
  const [plateType, setPlateType] = useState(ALL);
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [platesOnly, setPlatesOnly] = useState(false);
  const [noPlateOnly, setNoPlateOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [filters, setFilters] = useState<Record<string, unknown>>({ limit: 120 });

  const cameras = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });
  const events = useQuery({
    queryKey: ["events", "search", filters],
    queryFn: () => fetchEvents({ data: filters }),
  });

  const applyFilters = () => {
    setFilters({
      limit: 200,
      ...(naturalQuery.trim() ? { naturalQuery: naturalQuery.trim() } : {}),
      ...(plate.trim() ? { plate: plate.trim() } : {}),
      ...(plateState !== ALL ? { plateState } : {}),
      ...(plateType !== ALL ? { plateType } : {}),
      ...(vehicleMake.trim() ? { vehicleMake: vehicleMake.trim() } : {}),
      ...(vehicleModel.trim() ? { vehicleModel: vehicleModel.trim() } : {}),
      ...(selectedFeature ? { feature: selectedFeature } : {}),
      ...(cameraId !== ALL ? { cameraId } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(platesOnly ? { platesOnly: true } : {}),
      ...(noPlateOnly ? { noPlateOnly: true } : {}),
    });
  };

  const exportCsv = () => {
    const rows = events.data ?? [];
    const header = [
      "captured_at",
      "camera",
      "plate",
      "plate_state",
      "plate_type",
      "plate_confidence",
      "vehicle_color",
      "vehicle_make",
      "vehicle_model",
      "vehicle_generation",
      "unique_features",
      "person_count",
      "summary",
    ];
    const body = rows.map((event) =>
      [
        event.captured_at,
        event.camera_name ?? "",
        event.plate_text ?? "",
        event.plate_state ?? "",
        event.plate_type ?? "",
        event.plate_confidence ?? "",
        event.vehicle_color ?? "",
        event.vehicle_make ?? "",
        event.vehicle_model ?? "",
        event.vehicle_generation ?? "",
        (event.unique_features ?? []).join(";"),
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
    link.download = `flock-events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vehicle Search Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Flock "Search Without a Plate" — filter by visual attributes, roof racks, temp tags, state, or natural language.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!events.data?.length}>
          <Download className="mr-1.5 h-4 w-4" />
          Export Intelligence CSV
        </Button>
      </div>

      <Card className="bg-card/70 border border-border/70">
        <CardContent className="pt-6 space-y-4">
          {/* Main Natural Language Search Bar */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px] space-y-2">
              <Label htmlFor="natural-query" className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Natural Language Description Search
              </Label>
              <Input
                id="natural-query"
                value={naturalQuery}
                placeholder="e.g. Red SUV with roof rack seen yesterday"
                onChange={(e) => setNaturalQuery(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button onClick={applyFilters}>
              <Search className="mr-1.5 h-4 w-4" />
              Search Detections
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="gap-1.5"
            >
              <Filter className="h-4 w-4" />
              {showAdvanced ? "Hide Filters" : "Filter Attributes"}
            </Button>
          </div>

          {/* Feature Tags Quick Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Visual Features:
            </span>
            {FEATURE_PRESETS.map((feat) => {
              const active = selectedFeature === feat;
              return (
                <button
                  key={feat}
                  onClick={() => setSelectedFeature(active ? null : feat)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                  }`}
                >
                  #{feat.replace("_", " ")}
                </button>
              );
            })}
          </div>

          {/* Advanced Multi-Attribute Filters Grid */}
          {showAdvanced ? (
            <div className="grid gap-4 pt-4 border-t border-border/50 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="plate">Plate Text</Label>
                <Input
                  id="plate"
                  value={plate}
                  placeholder="e.g. 7BXK412"
                  className="plate"
                  onChange={(event) => setPlate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Plate State</Label>
                <Select value={plateState} onValueChange={setPlateState}>
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All States</SelectItem>
                    {US_STATES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Plate Type</Label>
                <Select value={plateType} onValueChange={setPlateType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Types</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Temporary Paper Tag">Temporary Paper Tag</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Dealer">Dealer</SelectItem>
                    <SelectItem value="Disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="make">Vehicle Make</Label>
                <Input
                  id="make"
                  value={vehicleMake}
                  placeholder="e.g. Honda, Ford, Tesla"
                  onChange={(e) => setVehicleMake(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Vehicle Model</Label>
                <Input
                  id="model"
                  value={vehicleModel}
                  placeholder="e.g. Civic, F-150, Model Y"
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Camera Source</Label>
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
                <Label htmlFor="from">From Date</Label>
                <Input
                  id="from"
                  type="datetime-local"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="to">To Date</Label>
                <Input
                  id="to"
                  type="datetime-local"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 md:col-span-4 pt-2">
                <Button
                  size="sm"
                  variant={platesOnly ? "default" : "outline"}
                  onClick={() => {
                    setPlatesOnly((val) => !val);
                    if (!platesOnly) setNoPlateOnly(false);
                  }}
                >
                  Plates Only
                </Button>
                <Button
                  size="sm"
                  variant={noPlateOnly ? "default" : "outline"}
                  onClick={() => {
                    setNoPlateOnly((val) => !val);
                    if (!noPlateOnly) setPlatesOnly(false);
                  }}
                >
                  No Plate Only (Unidentified Vehicles)
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Detections Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(events.data ?? []).map((event) => (
          <Card key={event.id} className="overflow-hidden bg-card/70 border border-border/60 flex flex-col justify-between">
            <div>
              {event.imageUrl ? (
                <div className="relative aspect-video w-full bg-slate-950">
                  <img
                    src={event.imageUrl}
                    alt={event.summary ?? "Detection snapshot"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {event.plate_state ? (
                    <div className="absolute top-2 left-2 bg-slate-900/85 text-slate-100 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                      {event.plate_state}
                    </div>
                  ) : null}
                  {event.plate_type && event.plate_type !== "Standard" ? (
                    <div className="absolute top-2 right-2 bg-amber-500/90 text-slate-950 font-sans text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                      {event.plate_type}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <CardContent className="space-y-2 pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  {event.plate_text ? (
                    <div className="flex items-center gap-1.5">
                      <span className="plate rounded bg-secondary px-2 py-0.5 text-sm font-bold">
                        {event.plate_text}
                      </span>
                      {event.plate_state ? (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          ({event.plate_state})
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs italic text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                      no plate read
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {event.camera_name}
                  </Badge>
                </div>

                <p className="font-semibold text-foreground">
                  {[event.vehicle_color, event.vehicle_make, event.vehicle_model]
                    .filter(Boolean)
                    .join(" ") || "Vehicle Detection"}
                  {event.vehicle_generation ? (
                    <span className="font-normal text-muted-foreground ml-1">
                      ({event.vehicle_generation})
                    </span>
                  ) : null}
                </p>

                {/* Unique Feature Tags */}
                {event.unique_features && event.unique_features.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {event.unique_features.map((feat) => (
                      <span
                        key={feat}
                        className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                      >
                        #{feat.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="text-muted-foreground line-clamp-2">{event.summary}</p>
              </CardContent>
            </div>

            <CardContent className="pt-0 text-[11px] text-muted-foreground border-t border-border/40 mt-3 pt-2">
              {format(new Date(event.captured_at), "PP p")}
            </CardContent>
          </Card>
        ))}
      </div>

      {events.data && events.data.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No events match your natural query or multi-attribute filters.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

