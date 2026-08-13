import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CameraInput = z.object({
  name: z.string().min(1).max(80),
  location: z.string().max(120).optional().nullable(),
  sourceType: z.enum(["snapshot", "rtsp"]),
  url: z.string().min(4).max(500),
  pollIntervalSeconds: z.number().int().min(1).max(3600),
  enabled: z.boolean(),
});

export const listCameras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cameras")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCamera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CameraInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cameras")
      .insert({
        user_id: context.userId,
        name: data.name,
        location: data.location ?? null,
        source_type: data.sourceType,
        url: data.url,
        poll_interval_seconds: data.pollIntervalSeconds,
        enabled: data.enabled,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCamera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    CameraInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      name?: string;
      location?: string | null;
      source_type?: "snapshot" | "rtsp";
      url?: string;
      poll_interval_seconds?: number;
      enabled?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.location !== undefined) patch.location = data.location;
    if (data.sourceType !== undefined) patch.source_type = data.sourceType;
    if (data.url !== undefined) patch.url = data.url;
    if (data.pollIntervalSeconds !== undefined) patch.poll_interval_seconds = data.pollIntervalSeconds;
    if (data.enabled !== undefined) patch.enabled = data.enabled;

    const { error } = await context.supabase.from("cameras").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCamera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cameras").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
