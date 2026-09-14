import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Car, Eye, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";

type Reason = "expected" | "suspicious" | "blocked";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist & Visual BOLOs — HomeWatch" },
      {
        name: "description",
        content:
          "Track license plates and vehicle visual fingerprints (BOLOs) with instant alert dispatch.",
      },
      { property: "og:title", content: "Watchlist & Visual BOLOs — HomeWatch" },
      {
        property: "og:description",
        content: "Track plates and vehicle BOLOs for instant alert dispatch.",
      },
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

  const [ruleType, setRuleType] = useState<"plate" | "fingerprint">("plate");
  const [plate, setPlate] = useState("");
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState<Reason>("suspicious");
  const [notes, setNotes] = useState("");
  const [isResident, setIsResident] = useState(false);

  // Visual BOLO fields
  const [targetMake, setTargetMake] = useState("");
  const [targetModel, setTargetModel] = useState("");
  const [targetColor, setTargetColor] = useState("");
  const [targetPlateType, setTargetPlateType] = useState("");
  const [targetFeature, setTargetFeature] = useState("");
  const [requireNoPlate, setRequireNoPlate] = useState(false);

  const list = useQuery({ queryKey: ["watchlist"], queryFn: () => fetchList({}) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["watchlist"] });

  const create = useMutation({
    mutationFn: () =>
      add({
        data: {
          rule_type: ruleType,
          plate: ruleType === "plate" ? plate : null,
          label: label || null,
          reason,
          notes: notes || null,
          is_resident: isResident,
          target_make: ruleType === "fingerprint" ? targetMake || null : null,
          target_model: ruleType === "fingerprint" ? targetModel || null : null,
          target_color: ruleType === "fingerprint" ? targetColor || null : null,
          target_plate_type: ruleType === "fingerprint" ? targetPlateType || null : null,
          target_feature: ruleType === "fingerprint" ? targetFeature || null : null,
          require_no_plate: ruleType === "fingerprint" ? requireNoPlate : false,
        },
      }),
    onSuccess: () => {
      setPlate("");
      setLabel("");
      setNotes("");
      setTargetMake("");
      setTargetModel("");
      setTargetColor("");
      setTargetPlateType("");
      setTargetFeature("");
      setRequireNoPlate(false);
      setIsResident(false);
      invalidate();
      toast.success(
        ruleType === "plate" ? "Plate added to watchlist" : "Visual BOLO rule activated",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Rule removed from watchlist");
    },
  });

  const canSubmit =
    ruleType === "plate"
      ? Boolean(plate && plate.trim().length >= 2)
      : Boolean(
          targetMake ||
          targetModel ||
          targetColor ||
          targetPlateType ||
          targetFeature ||
          requireNoPlate,
        );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Watchlist & Visual BOLOs</h1>
        <p className="text-sm text-muted-foreground">
          Track specific license plates or configure Flock-style Visual BOLOs (e.g. temporary paper
          tags, plateless vehicles, or specific make/models).
        </p>
      </div>

      <Card className="bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {ruleType === "plate" ? "Add Target Plate" : "Create Visual Vehicle BOLO"}
            </CardTitle>
            <div className="flex rounded-lg bg-secondary p-1 text-xs">
              <button
                type="button"
                onClick={() => setRuleType("plate")}
                className={`rounded-md px-3 py-1 font-medium transition ${ruleType === "plate" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
              >
                License Plate Rule
              </button>
              <button
                type="button"
                onClick={() => setRuleType("fingerprint")}
                className={`rounded-md px-3 py-1 font-medium transition ${ruleType === "fingerprint" ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
              >
                Visual Fingerprint (BOLO)
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ruleType === "plate" ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="plate">Plate Text</Label>
                <Input
                  id="plate"
                  className="plate"
                  placeholder="7SAM123"
                  value={plate}
                  onChange={(event) => setPlate(event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Identifier / Label</Label>
                <Input
                  id="label"
                  value={label}
                  placeholder="Stolen Civic / Neighbor"
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Classification</Label>
                <Select value={reason} onValueChange={(value) => setReason(value as Reason)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expected">Expected / Whitelist</SelectItem>
                    <SelectItem value="suspicious">Suspicious</SelectItem>
                    <SelectItem value="blocked">Blocked / Stolen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={notes}
                  placeholder="Police report # or context"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Vehicle Make</Label>
                <Input
                  placeholder="e.g. Dodge, Honda, Ford"
                  value={targetMake}
                  onChange={(e) => setTargetMake(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Model</Label>
                <Input
                  placeholder="e.g. Charger, Civic, F-150"
                  value={targetModel}
                  onChange={(e) => setTargetModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Color</Label>
                <Input
                  placeholder="e.g. Black, Silver, Red"
                  value={targetColor}
                  onChange={(e) => setTargetColor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Plate Type Filter</Label>
                <Select value={targetPlateType} onValueChange={setTargetPlateType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Plate Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any Plate Type</SelectItem>
                    <SelectItem value="Temporary Paper Tag">Temporary Paper Tag</SelectItem>
                    <SelectItem value="Commercial">Commercial Plate</SelectItem>
                    <SelectItem value="Dealer">Dealer Tag</SelectItem>
                    <SelectItem value="Disabled">Disabled Plate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unique Feature / Alteration</Label>
                <Select value={targetFeature} onValueChange={setTargetFeature}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Feature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">None Specified</SelectItem>
                    <SelectItem value="roof_rack">Roof Rack</SelectItem>
                    <SelectItem value="bumper_sticker">Bumper Sticker</SelectItem>
                    <SelectItem value="dented_bumper">Dented Body / Bumper</SelectItem>
                    <SelectItem value="window_tint">Heavy Window Tint</SelectItem>
                    <SelectItem value="custom_wheels">Custom Wheels</SelectItem>
                    <SelectItem value="tow_hitch">Tow Hitch</SelectItem>
                    <SelectItem value="tool_rack">Tool / Ladder Rack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolo-label">BOLO Name / Reason</Label>
                <Input
                  id="bolo-label"
                  placeholder="Suspect vehicle BOLO"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-3">
            <div className="flex items-center space-x-2">
              <Switch id="is-resident" checked={isResident} onCheckedChange={setIsResident} />
              <Label htmlFor="is-resident" className="text-xs font-medium cursor-pointer">
                Resident Whitelist (Mute siren alerts & exempt from casing pass detection)
              </Label>
            </div>

            {ruleType === "fingerprint" && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="no-plate"
                  checked={requireNoPlate}
                  onCheckedChange={setRequireNoPlate}
                />
                <Label
                  htmlFor="no-plate"
                  className="text-xs font-medium cursor-pointer text-amber-500"
                >
                  Target Missing / Plateless Vehicles Only
                </Label>
              </div>
            )}

            <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {ruleType === "plate" ? "Add Target Plate" : "Activate Visual BOLO"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(list.data ?? []).map((entry) => {
          const isFingerprint = entry.rule_type === "fingerprint";
          return (
            <Card key={entry.id} className="bg-card/70">
              <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                {isFingerprint ? (
                  <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500 border border-amber-500/30">
                    <Eye className="h-3.5 w-3.5" />
                    <span>VISUAL BOLO</span>
                  </div>
                ) : (
                  <span className="plate rounded bg-secondary px-2 py-1 text-sm font-semibold">
                    {entry.plate}
                  </span>
                )}

                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{entry.label || "Unlabelled Rule"}</p>
                    {entry.is_resident && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                      >
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Resident Whitelist
                      </Badge>
                    )}
                  </div>
                  {isFingerprint ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[
                        entry.target_color,
                        entry.target_make,
                        entry.target_model,
                        entry.target_plate_type,
                        entry.target_feature ? `Alteration: ${entry.target_feature}` : null,
                        entry.require_no_plate ? "MISSING PLATE ONLY" : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Any matching fingerprint"}
                    </p>
                  ) : entry.notes ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>
                  ) : null}
                </div>

                <Badge
                  variant={
                    entry.is_resident
                      ? "secondary"
                      : entry.reason === "expected"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {entry.is_resident ? "Whitelisted" : entry.reason}
                </Badge>

                <Button variant="ghost" size="icon" onClick={() => destroy.mutate(entry.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {list.data && list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plates or visual BOLOs configured.</p>
        ) : null}
      </div>
    </div>
  );
}
