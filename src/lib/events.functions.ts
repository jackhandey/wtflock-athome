import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePlate } from "@/lib/plates";

const FilterInput = z.object({
  cameraId: z.string().uuid().optional().nullable(),
  plate: z.string().max(20).optional().nullable(),
  plateState: z.string().max(10).optional().nullable(),
  plateType: z.string().max(30).optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  color: z.string().max(30).optional().nullable(),
  vehicleType: z.string().max(30).optional().nullable(),
  vehicleMake: z.string().max(30).optional().nullable(),
  vehicleModel: z.string().max(30).optional().nullable(),
  feature: z.string().max(40).optional().nullable(),
  naturalQuery: z.string().max(100).optional().nullable(),
  peopleOnly: z.boolean().optional(),
  platesOnly: z.boolean().optional(),
  noPlateOnly: z.boolean().optional(),
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
  plate_state: string | null;
  plate_type: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  unique_features: string[] | null;
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
      .select("*, cameras(name)")
      .order("captured_at", { ascending: false })
      .limit(data.limit ?? 100);

    if (data.cameraId) query = query.eq("camera_id", data.cameraId);
    if (data.from) query = query.gte("captured_at", data.from);
    if (data.to) query = query.lte("captured_at", data.to);
    if (data.color) query = query.ilike("vehicle_color", `%${data.color}%`);
    if (data.vehicleType) query = query.ilike("vehicle_type", `%${data.vehicleType}%`);
    if (data.vehicleMake) query = query.ilike("vehicle_make", `%${data.vehicleMake}%`);
    if (data.vehicleModel) query = query.ilike("vehicle_model", `%${data.vehicleModel}%`);
    if (data.plateState) query = query.ilike("plate_state", `%${data.plateState}%`);
    if (data.plateType) query = query.ilike("plate_type", `%${data.plateType}%`);
    if (data.peopleOnly) query = query.gt("person_count", 0);
    if (data.platesOnly) query = query.not("plate_normalized", "is", null);
    if (data.noPlateOnly) query = query.is("plate_normalized", null);
    if (data.feature) query = query.contains("unique_features", [data.feature]);

    if (data.plate) {
      const needle = normalizePlate(data.plate);
      if (needle) query = query.ilike("plate_normalized", `%${needle}%`);
    }

    if (data.naturalQuery) {
      const nq = data.naturalQuery.trim();
      query = query.or(
        `summary.ilike.%${nq}%,vehicle_color.ilike.%${nq}%,vehicle_make.ilike.%${nq}%,vehicle_model.ilike.%${nq}%,plate_text.ilike.%${nq}%`,
      );
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
      camera_name: (row as { cameras?: { name: string } | null }).cameras?.name ?? null,
      captured_at: row.captured_at,
      image_path: row.image_path,
      plate_text: row.plate_text,
      plate_confidence: row.plate_confidence,
      plate_state: (row as any).plate_state ?? null,
      plate_type: (row as any).plate_type ?? null,
      vehicle_color: row.vehicle_color,
      vehicle_type: row.vehicle_type,
      vehicle_make: row.vehicle_make,
      vehicle_model: (row as any).vehicle_model ?? null,
      vehicle_generation: (row as any).vehicle_generation ?? null,
      unique_features: (row as any).unique_features ?? [],
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

export const getVehicleJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plate: z.string().min(1), limit: z.number().int().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const normalized = normalizePlate(data.plate);
    if (!normalized) return { events: [], cameras: [] };

    const { data: events, error } = await context.supabase
      .from("events")
      .select("*, cameras(*)")
      .ilike("plate_normalized", `%${normalized}%`)
      .order("captured_at", { ascending: true })
      .limit(data.limit ?? 100);

    if (error) throw new Error(error.message);

    const paths = (events ?? []).map((row) => row.image_path);
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    const formattedEvents = (events ?? []).map((row, index) => {
      const cameraObj = (row as { cameras?: { id: string; name: string; latitude: number | null; longitude: number | null; facing_direction: string | null; location: string | null } | null }).cameras;
      return {
        id: row.id,
        captured_at: row.captured_at,
        plate_text: row.plate_text,
        vehicle_color: row.vehicle_color,
        vehicle_type: row.vehicle_type,
        vehicle_make: row.vehicle_make,
        summary: row.summary,
        imageUrl: signed.data?.[index]?.signedUrl ?? null,
        camera: {
          id: row.camera_id,
          name: cameraObj?.name ?? "Unknown Camera",
          latitude: cameraObj?.latitude ?? null,
          longitude: cameraObj?.longitude ?? null,
          facingDirection: cameraObj?.facing_direction ?? "Ingress",
          location: cameraObj?.location ?? null,
        },
      };
    });

    return { events: formattedEvents };
  });
