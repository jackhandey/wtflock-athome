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
    return data ?? {
      user_id: context.userId,
      retention_days: 30,
      alert_email: null,
      webhook_url: null,
      webhook_enabled: true,
      sound_alerts_enabled: true,
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        retentionDays: z.number().int().min(1).max(365),
        alertEmail: z.string().email().max(200).optional().nullable(),
        webhookUrl: z.string().url().max(500).optional().nullable().or(z.literal("")),
        webhookEnabled: z.boolean().optional(),
        soundAlertsEnabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_settings").upsert({
      user_id: context.userId,
      retention_days: data.retentionDays,
      alert_email: data.alertEmail ?? null,
      webhook_url: data.webhookUrl ? data.webhookUrl : null,
      webhook_enabled: data.webhookEnabled ?? true,
      sound_alerts_enabled: data.soundAlertsEnabled ?? true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ webhookUrl: z.string().url().max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { sendAlertWebhook } = await import("@/lib/webhooks.server");
    const ok = await sendAlertWebhook(data.webhookUrl, {
      alertId: "test-alert-id",
      plate: "7BXK412",
      plateState: "CA",
      reason: "suspicious",
      cameraName: "Front Driveway Camera",
      capturedAt: new Date().toISOString(),
      summary: "TEST ALERT: Red Pickup Truck detected on hotlist.",
      vehicleDetails: "Red Ford F-150 Pickup",
    });
    if (!ok) throw new Error("Webhook delivery failed. Please check the URL.");
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
