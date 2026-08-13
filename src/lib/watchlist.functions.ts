import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlate } from "@/lib/plates";

const WatchInput = z.object({
  plate: z.string().min(2).max(20),
  label: z.string().max(80).optional().nullable(),
  reason: z.enum(["expected", "suspicious", "blocked"]),
  notes: z.string().max(500).optional().nullable(),
});

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("watchlist_plates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWatchlistPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WatchInput.parse(input))
  .handler(async ({ data, context }) => {
    const normalized = normalizePlate(data.plate);
    if (!normalized) throw new Error("Enter a readable plate");
    const { data: row, error } = await context.supabase
      .from("watchlist_plates")
      .upsert(
        {
          user_id: context.userId,
          plate: data.plate.toUpperCase().trim(),
          plate_normalized: normalized,
          label: data.label ?? null,
          reason: data.reason,
          notes: data.notes ?? null,
        },
        { onConflict: "user_id,plate_normalized" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeWatchlistPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("watchlist_plates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
