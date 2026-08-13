import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Camera, ScanLine, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HomeWatch — Plate Reading for Your Own Cameras" },
      {
        name: "description",
        content:
          "Home Flock enables home camera system integration with Flock's security features.",
      },
      { property: "og:title", content: "HomeWatch — Plate Reading for Your Own Cameras" },
      {
        property: "og:description",
        content:
          "Home Flock enables home camera system integration with Flock's security features.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ScanLine,
    title: "Plate reads on every frame",
    body: "Vehicle make, color, type, person count and plate text extracted from each sampled frame.",
  },
  {
    icon: BellRing,
    title: "Watchlist alerts",
    body: "Fuzzy matching catches partial or misread plates and raises an alert instantly.",
  },
  {
    icon: Camera,
    title: "Your cameras, your network",
    body: "A local bridge agent pulls frames from RTSP or snapshot URLs — credentials never leave home.",
  },
];

function Landing() {
  return (
    <main className="grid-scan min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-24">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="plate text-sm font-semibold">HOMEWATCH</span>
        </div>
        <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Plate reading and watchlist alerting for the cameras you already own.
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Point HomeWatch at your driveway and gate cameras. Every sampled frame is analyzed for
          vehicles, plates and people, logged with a snapshot, and matched against your own
          watchlist.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Open the console</Link>
          </Button>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-border/70 bg-card/60 p-5">
              <feature.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{feature.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
