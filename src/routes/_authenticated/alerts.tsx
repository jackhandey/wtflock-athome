import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";

import { acknowledgeAlert, listAlerts } from "@/lib/alerts.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({
    meta: [
      { title: "Watchlist alerts — HomeWatch" },
      {
        name: "description",
        content:
          "Review and acknowledge alerts triggered when a watchlisted plate is seen by one of your cameras.",
      },
      { property: "og:title", content: "Watchlist alerts — HomeWatch" },
      { property: "og:description", content: "Alerts for watchlisted plates seen on your cameras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const queryClient = useQueryClient();
  const fetchAlerts = useServerFn(listAlerts);
  const ack = useServerFn(acknowledgeAlert);
  const [openOnly, setOpenOnly] = useState(true);

  const alerts = useQuery({
    queryKey: ["alerts", openOnly ? "open" : "all"],
    queryFn: () => fetchAlerts({ data: { openOnly } }),
    refetchInterval: 20000,
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => ack({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["event-stats"] });
      toast.success("Alert acknowledged");
    },
    onError: () => toast.error("Could not acknowledge alert"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Raised the moment a watchlisted plate matches a plate read.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpenOnly((value) => !value)}>
          {openOnly ? "Show all" : "Show unacknowledged"}
        </Button>
      </div>

      <div className="space-y-3">
        {(alerts.data ?? []).map((alert) => (
          <Card key={alert.id} className="bg-card/70">
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              {alert.imageUrl ? (
                <img
                  src={alert.imageUrl}
                  alt={`Snapshot for plate ${alert.plate}`}
                  className="h-24 w-40 rounded object-cover"
                  loading="lazy"
                />
              ) : null}
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <BellRing className="h-4 w-4 text-destructive" />
                  <span className="plate rounded bg-secondary px-2 py-0.5 text-sm">
                    {alert.plate}
                  </span>
                  <Badge variant="outline">{alert.camera_name}</Badge>
                  {alert.acknowledged_at ? (
                    <Badge variant="secondary">acknowledged</Badge>
                  ) : (
                    <Badge variant="destructive">open</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{alert.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(alert.created_at), "PP p")}
                </p>
              </div>
              {!alert.acknowledged_at ? (
                <Button
                  size="sm"
                  onClick={() => acknowledge.mutate(alert.id)}
                  disabled={acknowledge.isPending}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Acknowledge
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {alerts.data && alerts.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : null}
      </div>
    </div>
  );
}
