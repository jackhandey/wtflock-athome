import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Camera as CameraIcon,
  Clock,
  Compass,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";

import { listCameras } from "@/lib/cameras.functions";
import { getVehicleJourney, listEvents } from "@/lib/events.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "GIS Map & Vehicle Journey — HomeWatch" },
      {
        name: "description",
        content:
          "Interactive camera location map and chronological vehicle journey route tracking across cameras.",
      },
      { property: "og:title", content: "GIS Map & Vehicle Journey — HomeWatch" },
      { property: "og:description", content: "Trace vehicle paths across home cameras on an interactive map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapView,
});

// Default center (San Francisco / suburban fallback if no camera coordinates set)
const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

function MapView() {
  const fetchCameras = useServerFn(listCameras);
  const fetchRecentEvents = useServerFn(listEvents);
  const fetchJourney = useServerFn(getVehicleJourney);

  const [plateQuery, setPlateQuery] = useState("");
  const [activePlate, setActivePlate] = useState<string | null>(null);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const camerasQuery = useQuery({ queryKey: ["cameras"], queryFn: () => fetchCameras({}) });
  const recentEventsQuery = useQuery({
    queryKey: ["events", "map-recent"],
    queryFn: () => fetchRecentEvents({ data: { limit: 40, platesOnly: true } }),
  });

  const journeyQuery = useQuery({
    queryKey: ["journey", activePlate],
    queryFn: () => (activePlate ? fetchJourney({ data: { plate: activePlate } }) : Promise.resolve({ events: [] })),
    enabled: Boolean(activePlate),
  });

  // Extract unique recent plates for quick selection pills
  const recentPlates = Array.from(
    new Set((recentEventsQuery.data ?? []).map((e) => e.plate_text).filter(Boolean)),
  ).slice(0, 8);

  const journeyEvents = journeyQuery.data?.events ?? [];

  // Initialize Leaflet Map
  useEffect(() => {
    let leafletMap: any = null;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Load Leaflet CSS dynamically if not present
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Import leaflet dynamically
      const L = await import("leaflet");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      leafletMap = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(DEFAULT_CENTER, 14);

      // CartoDB Dark Matter tile layer for sleek dark theme
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(leafletMap);

      layerGroupRef.current = L.layerGroup().addTo(leafletMap);
      mapInstanceRef.current = leafletMap;
    }

    initMap();

    return () => {
      if (leafletMap) leafletMap.remove();
    };
  }, []);

  // Update map markers, polyline routes, and view bounds when cameras or journey data change
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    import("leaflet").then((L) => {
      const group = layerGroupRef.current;
      group.clearLayers();

      const cameras = camerasQuery.data ?? [];
      const latLngs: [number, number][] = [];

      // Map camera IDs to locations (or generate offset coordinates if null)
      const cameraCoordsMap = new Map<string, [number, number]>();

      cameras.forEach((camera, idx) => {
        let lat = camera.latitude;
        let lng = camera.longitude;

        // Fallback offset if coordinates not set so cameras don't overlap
        if (lat == null || lng == null) {
          lat = DEFAULT_CENTER[0] + (idx - (cameras.length - 1) / 2) * 0.005;
          lng = DEFAULT_CENTER[1] + (idx % 2 === 0 ? 0.003 : -0.003);
        }

        const pos: [number, number] = [lat, lng];
        cameraCoordsMap.set(camera.id, pos);
        latLngs.push(pos);

        // Custom HTML Marker for Camera
        const customIcon = L.divIcon({
          className: "custom-camera-pin",
          html: `<div style="
            background: #0f172a;
            border: 2px solid ${camera.enabled ? "#22c55e" : "#64748b"};
            color: #f8fafc;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>📷 ${camera.name}</span>
            <span style="font-size: 9px; opacity: 0.7; background: #334155; padding: 1px 4px; border-radius: 4px;">
              ${camera.facing_direction || "Ingress"}
            </span>
          </div>`,
          iconSize: [120, 30],
          iconAnchor: [60, 15],
        });

        const marker = L.marker(pos, { icon: customIcon }).addTo(group);
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #0f172a;">
            <strong>${camera.name}</strong><br/>
            <small>${camera.location || "No description"}</small><br/>
            <small>Vector: <strong>${camera.facing_direction || "Ingress"}</strong></small>
          </div>
        `);
      });

      // Draw Journey Path if active plate and journey events exist
      if (journeyEvents.length > 0) {
        const routePoints: [number, number][] = [];

        journeyEvents.forEach((event, index) => {
          let pos = cameraCoordsMap.get(event.camera.id);
          if (!pos && event.camera.latitude && event.camera.longitude) {
            pos = [event.camera.latitude, event.camera.longitude];
          }
          if (pos) {
            routePoints.push(pos);

            const isSelected = selectedEventIndex === index;

            // Journey Step Marker
            const stepIcon = L.divIcon({
              className: "journey-step-pin",
              html: `<div style="
                background: ${isSelected ? "#ef4444" : "#3b82f6"};
                color: #ffffff;
                border: 2px solid #ffffff;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 700;
                box-shadow: 0 0 10px ${isSelected ? "rgba(239, 68, 68, 0.8)" : "rgba(59, 130, 246, 0.6)"};
                transform: ${isSelected ? "scale(1.25)" : "scale(1)"};
                transition: transform 0.2s ease;
              ">
                ${index + 1}
              </div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });

            const stepMarker = L.marker(pos, { icon: stepIcon }).addTo(group);
            stepMarker.bindPopup(`
              <div style="font-family: sans-serif; color: #0f172a; max-width: 200px;">
                <strong>Step ${index + 1}: ${event.camera.name}</strong><br/>
                <small>Plate: <strong>${event.plate_text}</strong></small><br/>
                <small>Time: ${format(new Date(event.captured_at), "PP p")}</small>
                ${event.imageUrl ? `<img src="${event.imageUrl}" style="width:100%; border-radius:4px; margin-top:4px;" />` : ""}
              </div>
            `);
          }
        });

        // Polyline connecting the journey points
        if (routePoints.length >= 2) {
          const polyline = L.polyline(routePoints, {
            color: "#3b82f6",
            weight: 4,
            opacity: 0.8,
            dashArray: "8, 8",
          }).addTo(group);

          mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
        } else if (routePoints.length === 1) {
          mapInstanceRef.current.setView(routePoints[0], 16);
        }
      } else if (latLngs.length > 0) {
        const bounds = L.latLngBounds(latLngs);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    });
  }, [camerasQuery.data, journeyEvents, selectedEventIndex]);

  // Journey Replay Animation Loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && journeyEvents.length > 0) {
      interval = setInterval(() => {
        setSelectedEventIndex((prev) => {
          if (prev === null || prev >= journeyEvents.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      }, 2500);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, journeyEvents.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (plateQuery.trim()) {
      setActivePlate(plateQuery.trim().toUpperCase());
      setSelectedEventIndex(0);
      setIsPlaying(false);
    }
  };

  const selectPlate = (plate: string) => {
    setPlateQuery(plate);
    setActivePlate(plate);
    setSelectedEventIndex(0);
    setIsPlaying(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">GIS Map & Vehicle Journey</h1>
          <p className="text-sm text-muted-foreground">
            Track vehicle movements chronologically across home cameras with directional vectors and time deltas.
          </p>
        </div>
      </div>

      {/* Search & Quick Selection Bar */}
      <Card className="bg-card/70">
        <CardContent className="pt-6 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px] space-y-2">
              <Label htmlFor="map-plate-search">Vehicle License Plate</Label>
              <Input
                id="map-plate-search"
                placeholder="Enter plate (e.g. 7BXK412)"
                value={plateQuery}
                onChange={(e) => setPlateQuery(e.target.value)}
                className="plate text-base uppercase"
              />
            </div>
            <Button type="submit" disabled={!plateQuery.trim()}>
              <Search className="mr-1.5 h-4 w-4" />
              Trace Route
            </Button>
            {activePlate ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setActivePlate(null);
                  setPlateQuery("");
                  setSelectedEventIndex(null);
                  setIsPlaying(false);
                }}
              >
                Clear Route
              </Button>
            ) : null}
          </form>

          {/* Quick Select Recent Plates */}
          {recentPlates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Recent detections:
              </span>
              {recentPlates.map((plate) => (
                <button
                  key={plate}
                  onClick={() => selectPlate(plate!)}
                  className={`plate rounded px-2.5 py-1 text-xs transition-colors ${
                    activePlate === plate
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                >
                  {plate}
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Main Grid: Map & Journey Timeline Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left 2 Columns: GIS Leaflet Map Container */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="overflow-hidden border border-border/80 bg-card/70">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Neighborhood Spatial Map
              </CardTitle>
              {activePlate ? (
                <Badge variant="secondary" className="plate">
                  Tracking: {activePlate}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {(camerasQuery.data ?? []).length} camera(s) active
                </span>
              )}
            </CardHeader>
            <div className="relative aspect-[16/10] w-full bg-slate-950">
              <div ref={mapContainerRef} className="h-full w-full z-10" />

              {/* Replay Overlay Bar if journey active */}
              {journeyEvents.length > 0 ? (
                <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/90 px-4 py-2.5 backdrop-blur shadow-xl">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isPlaying ? "destructive" : "default"}
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause Replay
                        </>
                      ) : (
                        <>
                          <Play className="mr-1.5 h-3.5 w-3.5" /> Replay Journey
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedEventIndex(0);
                        setIsPlaying(false);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Step {selectedEventIndex !== null ? selectedEventIndex + 1 : 1} of {journeyEvents.length}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        {/* Right Column: Step-by-Step Vehicle Journey Timeline */}
        <div className="space-y-4">
          <Card className="bg-card/70">
            <CardHeader className="py-3 px-4 border-b border-border/50">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Vehicle Journey Path</span>
                {journeyEvents.length > 0 ? (
                  <Badge variant="outline">{journeyEvents.length} detections</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {!activePlate ? (
                <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
                  <Compass className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p>Enter a license plate or select a recent detection to reconstruct its route across your home cameras.</p>
                </div>
              ) : journeyQuery.isPending ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tracing journey across cameras...</p>
              ) : journeyEvents.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground space-y-2">
                  <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/60" />
                  <p>No detection history found for plate <span className="plate">{activePlate}</span>.</p>
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/70">
                  {journeyEvents.map((event, index) => {
                    const isSelected = selectedEventIndex === index;
                    const prevEvent = index > 0 ? journeyEvents[index - 1] : null;

                    // Calculate time delta between legs
                    let timeDeltaText: string | null = null;
                    if (prevEvent) {
                      const diffMs =
                        new Date(event.captured_at).getTime() -
                        new Date(prevEvent.captured_at).getTime();
                      const mins = Math.round(diffMs / (60 * 1000));
                      timeDeltaText = mins > 0 ? `+${mins} min` : "<1 min";
                    }

                    return (
                      <div
                        key={event.id}
                        onClick={() => {
                          setSelectedEventIndex(index);
                          setIsPlaying(false);
                        }}
                        className={`relative flex gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary"
                            : "border-border/60 bg-background/50 hover:bg-secondary/40"
                        }`}
                      >
                        {/* Step Number Badge */}
                        <div
                          className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>

                        {/* Event Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground flex items-center gap-1">
                              <CameraIcon className="h-3.5 w-3.5 text-primary" />
                              {event.camera.name}
                            </span>
                            {timeDeltaText ? (
                              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <ArrowRight className="h-2.5 w-2.5" /> {timeDeltaText}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Vector: {event.camera.facingDirection}</span>
                            <span>{format(new Date(event.captured_at), "p")}</span>
                          </div>

                          {event.imageUrl ? (
                            <img
                              src={event.imageUrl}
                              alt={event.summary || "Detection"}
                              className="mt-1 aspect-video w-full rounded object-cover border border-border/40"
                              loading="lazy"
                            />
                          ) : null}

                          <p className="text-[11px] text-muted-foreground line-clamp-2 pt-0.5">
                            {[event.vehicle_color, event.vehicle_make, event.vehicle_type]
                              .filter(Boolean)
                              .join(" ") || event.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
