import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlertRow = {
  id: string;
  plate: string;
  reason: "expected" | "suspicious" | "blocked";
  created_at: string;
  acknowledged_at: string | null;
  event_id: string;
  cameraId: string | null;
  camera_name: string | null;

  capturedAt: string | null;
  imageUrl: string | null;
};

export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ openOnly: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AlertRow[]> => {
    let query = context.supabase
      .from("alerts")
      .select("*, events(camera_id, captured_at, image_path, cameras(name))")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.openOnly) query = query.is("acknowledged_at", null);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const paths = (rows ?? [])
      .map((row) => row.events?.image_path)
      .filter((path): path is string => Boolean(path));
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    const urlByPath = new Map<string, string>();
    paths.forEach((path, index) => {
      const url = signed.data?.[index]?.signedUrl;
      if (url) urlByPath.set(path, url);
    });

    return (rows ?? []).map((row) => ({
      id: row.id,
      plate: row.plate,
      reason: row.reason,
      created_at: row.created_at,
      acknowledged_at: row.acknowledged_at,
      event_id: row.event_id,
      cameraId: row.events?.camera_id ?? null,
      capturedAt: row.events?.captured_at ?? null,
      imageUrl: row.events?.image_path ? urlByPath.get(row.events.image_path) ?? null : null,
    }));
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
