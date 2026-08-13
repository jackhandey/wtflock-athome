import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { user_id: context.userId, retention_days: 30, alert_email: null };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        retentionDays: z.number().int().min(1).max(365),
        alertEmail: z.string().email().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_settings").upsert({
      user_id: context.userId,
      retention_days: data.retentionDays,
      alert_email: data.alertEmail ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const purgeOldSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: settings } = await context.supabase
      .from("user_settings")
      .select("retention_days")
      .eq("user_id", context.userId)
      .maybeSingle();
    const days = settings?.retention_days ?? 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: stale } = await context.supabase
      .from("events")
      .select("id, image_path")
      .lt("captured_at", cutoff);

    if (!stale || stale.length === 0) return { removed: 0 };

    await context.supabase.storage.from("snapshots").remove(stale.map((row) => row.image_path));
    const { error } = await context.supabase
      .from("events")
      .delete()
      .in(
        "id",
        stale.map((row) => row.id),
      );
    if (error) throw new Error(error.message);
    return { removed: stale.length };
  });
