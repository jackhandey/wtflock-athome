import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlate } from "@/lib/plates";

const WatchInput = z.object({
  rule_type: z.enum(["plate", "fingerprint"]).default("plate"),
  plate: z.string().max(20).optional().nullable(),
  label: z.string().max(80).optional().nullable(),
  reason: z.enum(["expected", "suspicious", "blocked"]),
  notes: z.string().max(500).optional().nullable(),
  is_resident: z.boolean().default(false),
  target_make: z.string().max(40).optional().nullable(),
  target_model: z.string().max(40).optional().nullable(),
  target_color: z.string().max(40).optional().nullable(),
  target_plate_type: z.string().max(40).optional().nullable(),
  target_feature: z.string().max(40).optional().nullable(),
  require_no_plate: z.boolean().default(false),
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
    if (data.rule_type === "fingerprint") {
      const hasCriteria =
        Boolean(data.target_make) ||
        Boolean(data.target_model) ||
        Boolean(data.target_color) ||
        Boolean(data.target_plate_type) ||
        Boolean(data.target_feature) ||
        data.require_no_plate;

      if (!hasCriteria) {
        throw new Error(
          "Specify at least one vehicle fingerprint criterion (make, model, color, feature, or no plate)",
        );
      }

      const { data: row, error } = await context.supabase
        .from("watchlist_plates")
        .insert({
          user_id: context.userId,
          rule_type: "fingerprint",
          plate: null,
          plate_normalized: null,
          label: data.label ?? null,
          reason: data.reason,
          notes: data.notes ?? null,
          is_resident: data.is_resident,
          target_make: data.target_make?.trim() || null,
          target_model: data.target_model?.trim() || null,
          target_color: data.target_color?.trim() || null,
          target_plate_type: data.target_plate_type?.trim() || null,
          target_feature: data.target_feature?.trim() || null,
          require_no_plate: data.require_no_plate,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    // Plate-based rule
    if (!data.plate || data.plate.trim().length < 2) {
      throw new Error("Enter a readable license plate");
    }
    const normalized = normalizePlate(data.plate);
    if (!normalized) throw new Error("Enter a valid alphanumeric license plate");

    const { data: row, error } = await context.supabase
      .from("watchlist_plates")
      .upsert(
        {
          user_id: context.userId,
          rule_type: "plate",
          plate: data.plate.toUpperCase().trim(),
          plate_normalized: normalized,
          label: data.label ?? null,
          reason: data.reason,
          notes: data.notes ?? null,
          is_resident: data.is_resident,
          target_make: null,
          target_model: null,
          target_color: null,
          target_plate_type: null,
          target_feature: null,
          require_no_plate: false,
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
    const { error } = await context.supabase.from("watchlist_plates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
