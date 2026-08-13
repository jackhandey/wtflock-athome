import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addWatchlistPlate, listWatchlist, removeWatchlistPlate } from "@/lib/watchlist.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Reason = "expected" | "suspicious" | "blocked";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Plate watchlist — HomeWatch" },
      {
        name: "description",
        content:
          "Track plates you expect or want flagged; HomeWatch raises an alert as soon as a fuzzy match is read.",
      },
      { property: "og:title", content: "Plate watchlist — HomeWatch" },
      { property: "og:description", content: "Track plates and get alerted when they appear." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listWatchlist);
  const add = useServerFn(addWatchlistPlate);
  const remove = useServerFn(removeWatchlistPlate);

  const [plate, setPlate] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState<Reason>("suspicious");
  const [notes, setNotes] = useState("");

  const list = useQuery({ queryKey: ["watchlist"], queryFn: () => fetchList({}) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["watchlist"] });

  const create = useMutation({
    mutationFn: () =>
      add({ data: { plate, label: label || null, reason, notes: notes || null } }),
    onSuccess: () => {
      setPlate("");
      setLabel("");
      setNotes("");
      invalidate();
      toast.success("Plate added to watchlist");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Removed from watchlist");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <p className="text-sm text-muted-foreground">
          Matching tolerates one or two misread characters, so partial plates still alert.
        </p>
      </div>

      <Card className="bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Add a plate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="plate">Plate</Label>
            <Input
              id="plate"
              className="plate"
              value={plate}
              onChange={(event) => setPlate(event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              placeholder="Neighbor's truck"
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as Reason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expected">Expected</SelectItem>
                <SelectItem value="suspicious">Suspicious</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => create.mutate()} disabled={!plate || create.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(list.data ?? []).map((entry) => (
          <Card key={entry.id} className="bg-card/70">
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <span className="plate rounded bg-secondary px-2 py-1 text-sm">{entry.plate}</span>
              <div className="flex-1">
                <p className="text-sm">{entry.label || "Unlabelled"}</p>
                {entry.notes ? (
                  <p className="text-xs text-muted-foreground">{entry.notes}</p>
                ) : null}
              </div>
              <Badge variant={entry.reason === "expected" ? "secondary" : "destructive"}>
                {entry.reason}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => destroy.mutate(entry.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {list.data && list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plates on the watchlist yet.</p>
        ) : null}
      </div>
    </div>
  );
}
