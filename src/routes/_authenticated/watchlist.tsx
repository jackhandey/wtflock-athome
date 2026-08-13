import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addWatchlistPlate,
  listWatchlist,
  removeWatchlistPlate,
} from "@/lib/watchlist.functions";
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
  component: Watchlist —,
});

function Watchlist —() {
  return null;
}
