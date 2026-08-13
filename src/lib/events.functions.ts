import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlate } from "@/lib/plates";

const FilterInput = z.object({
  cameraId: z.string().uuid().optional().nullable(),
  plate: z.string().max(20).optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  vehicleType: z.string().max(30).optional().nullable(),
  peopleOnly: z.boolean().optional(),
  platesOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type EventRow = {
  id: string;
  camera_id: string;
  camera_name: string | null;
  captured_at: string;
  image_path: string;
  plate_text: string | null;
  plate_confidence: number | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_count: number;
  person_count: number;
  summary: string | null;
  imageUrl: string | null;
};


export const listEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FilterInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<EventRow[]> => {
    let query = context.supabase
      .from("events")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(data.limit ?? 60);

    if (data.cameraId) query = query.eq("camera_id", data.cameraId);
    if (data.from) query = query.gte("captured_at", data.from);
    if (data.to) query = query.lte("captured_at", data.to);
    if (data.color) query = query.ilike("vehicle_color", `%${data.color}%`);
    if (data.vehicleType) query = query.ilike("vehicle_type", `%${data.vehicleType}%`);
    if (data.peopleOnly) query = query.gt("person_count", 0);
    if (data.platesOnly) query = query.not("plate_normalized", "is", null);
    if (data.plate) {
      const needle = normalizePlate(data.plate);
      if (needle) query = query.ilike("plate_normalized", `%${needle}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((row) => row.image_path);
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    return (rows ?? []).map((row, index) => ({
      id: row.id,
      camera_id: row.camera_id,
      captured_at: row.captured_at,
      image_path: row.image_path,
      plate_text: row.plate_text,
      plate_confidence: row.plate_confidence,
      vehicle_color: row.vehicle_color,
      vehicle_type: row.vehicle_type,
      vehicle_make: row.vehicle_make,
      vehicle_count: row.vehicle_count,
      person_count: row.person_count,
      summary: row.summary,
      imageUrl: signed.data?.[index]?.signedUrl ?? null,
    }));
  });

export const latestPerCamera = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("events")
      .select("id, camera_id, captured_at, image_path, plate_text, summary")
      .order("captured_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const newest = new Map<string, (typeof rows)[number]>();
    for (const row of rows ?? []) {
      if (!newest.has(row.camera_id)) newest.set(row.camera_id, row);
    }
    const entries = Array.from(newest.values());
    const signed = entries.length
      ? await context.supabase.storage
          .from("snapshots")
          .createSignedUrls(
            entries.map((entry) => entry.image_path),
            3600,
          )
      : { data: [] as { signedUrl: string }[] };

    return entries.map((entry, index) => ({
      cameraId: entry.camera_id,
      capturedAt: entry.captured_at,
      plate: entry.plate_text,
      summary: entry.summary,
      imageUrl: signed.data?.[index]?.signedUrl ?? null,
    }));
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("events")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.image_path) {
      await context.supabase.storage.from("snapshots").remove([row.image_path]);
    }
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eventStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [total, day, plates, alerts] = await Promise.all([
      context.supabase.from("events").select("id", { count: "exact", head: true }),
      context.supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("captured_at", since),
      context.supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .not("plate_normalized", "is", null),
      context.supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .is("acknowledged_at", null),
    ]);

    return {
      totalEvents: total.count ?? 0,
      eventsLast24h: day.count ?? 0,
      platesRead: plates.count ?? 0,
      openAlerts: alerts.count ?? 0,
    };
  });
