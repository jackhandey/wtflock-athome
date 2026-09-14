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
  seen_count_30d: number;
  is_resident: boolean;
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
      const sanitized = data.naturalQuery.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ");
      const pattern = `"%${sanitized}%"`;
      query = query.or(
        `summary.ilike.${pattern},vehicle_color.ilike.${pattern},vehicle_make.ilike.${pattern},vehicle_model.ilike.${pattern},plate_text.ilike.${pattern}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Batch compute 30-day frequency & resident whitelist flags
    const distinctPlates = Array.from(
      new Set((rows ?? []).map((r) => r.plate_normalized).filter(Boolean)),
    ) as string[];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const frequencyMap = new Map<string, number>();

    const [freqResult, residentResult] = await Promise.all([
      distinctPlates.length
        ? context.supabase
            .from("events")
            .select("plate_normalized")
            .in("plate_normalized", distinctPlates)
            .gte("captured_at", thirtyDaysAgo)
        : Promise.resolve({ data: [] }),
      distinctPlates.length
        ? context.supabase
            .from("watchlist_plates")
            .select("plate_normalized")
            .eq("is_resident", true)
            .in("plate_normalized", distinctPlates)
        : Promise.resolve({ data: [] }),
    ]);

    for (const r of freqResult.data ?? []) {
      if (r.plate_normalized) {
        frequencyMap.set(r.plate_normalized, (frequencyMap.get(r.plate_normalized) ?? 0) + 1);
      }
    }

    const residentSet = new Set(
      (residentResult.data ?? []).map((r) => r.plate_normalized).filter(Boolean),
    );

    const paths = (rows ?? []).map((row) => row.image_path);
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    return (rows ?? []).map((row, index) => {
      const plateNorm = row.plate_normalized;
      const seenCount = plateNorm ? (frequencyMap.get(plateNorm) ?? 1) : 1;
      const isResident = Boolean(plateNorm && residentSet.has(plateNorm));

      return {
        id: row.id,
        camera_id: row.camera_id,
        camera_name: (row as { cameras?: { name: string } | null }).cameras?.name ?? null,
        captured_at: row.captured_at,
        image_path: row.image_path,
        plate_text: row.plate_text,
        plate_confidence: row.plate_confidence,
        plate_state: row.plate_state ?? null,
        plate_type: row.plate_type ?? null,
        vehicle_color: row.vehicle_color,
        vehicle_type: row.vehicle_type,
        vehicle_make: row.vehicle_make,
        vehicle_model: row.vehicle_model ?? null,
        vehicle_generation: row.vehicle_generation ?? null,
        unique_features: row.unique_features ?? [],
        vehicle_count: row.vehicle_count,
        person_count: row.person_count,
        summary: row.summary,
        imageUrl: signed.data?.[index]?.signedUrl ?? null,
        seen_count_30d: seenCount,
        is_resident: isResident,
      };
    });
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
      ? await context.supabase.storage.from("snapshots").createSignedUrls(
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
    const defaultFlow = {
      totalPasses: 0,
      dwellMinutes: null as number | null,
      entryCamera: null as string | null,
      exitCamera: null as string | null,
      isTransit: false,
      firstSeen: null as string | null,
      lastSeen: null as string | null,
    };
    const normalized = normalizePlate(data.plate);
    if (!normalized) return { events: [], flow: defaultFlow };

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
      const cameraObj = row.cameras;
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

    const first = formattedEvents[0];
    const last = formattedEvents[formattedEvents.length - 1];
    let dwellMinutes: number | null = null;
    if (first && last && first.id !== last.id) {
      const ms = new Date(last.captured_at).getTime() - new Date(first.captured_at).getTime();
      dwellMinutes = Math.max(0, Math.round(ms / 60000));
    }

    const flow = {
      totalPasses: formattedEvents.length,
      dwellMinutes,
      entryCamera: first?.camera.name ?? null,
      exitCamera: last?.camera.name ?? null,
      isTransit: Boolean(first && last && first.camera.id !== last.camera.id),
      firstSeen: first?.captured_at ?? null,
      lastSeen: last?.captured_at ?? null,
    };

    return { events: formattedEvents, flow };
  });

export const getConvoyVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      eventId: z.string().uuid(),
      windowSeconds: z.number().int().min(5).max(300).default(60),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: targetEvent, error: targetErr } = await context.supabase
      .from("events")
      .select("id, captured_at, camera_id")
      .eq("id", data.eventId)
      .single();

    if (targetErr || !targetEvent) throw new Error("Reference event not found");

    const targetTime = new Date(targetEvent.captured_at).getTime();
    const minTime = new Date(targetTime - data.windowSeconds * 1000).toISOString();
    const maxTime = new Date(targetTime + data.windowSeconds * 1000).toISOString();

    const { data: rawConvoy, error } = await context.supabase
      .from("events")
      .select("*, cameras(name)")
      .neq("id", data.eventId)
      .gte("captured_at", minTime)
      .lte("captured_at", maxTime)
      .order("captured_at", { ascending: true })
      .limit(30);

    if (error) throw new Error(error.message);

    const paths = (rawConvoy ?? []).map((r) => r.image_path);
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    return (rawConvoy ?? []).map((row, index) => {
      const deltaSeconds = Math.round((new Date(row.captured_at).getTime() - targetTime) / 1000);
      const absDelta = Math.abs(deltaSeconds);
      const deltaLabel =
        deltaSeconds === 0
          ? "Same second"
          : `${absDelta}s ${deltaSeconds > 0 ? "after" : "before"}`;

      return {
        id: row.id,
        camera_id: row.camera_id,
        camera_name:
          (row as { cameras?: { name: string } | null }).cameras?.name ?? "Unknown Camera",
        captured_at: row.captured_at,
        deltaSeconds,
        deltaLabel,
        plate_text: row.plate_text,
        plate_state: row.plate_state,
        plate_type: row.plate_type,
        vehicle_make: row.vehicle_make,
        vehicle_model: row.vehicle_model,
        vehicle_color: row.vehicle_color,
        vehicle_type: row.vehicle_type,
        unique_features: row.unique_features ?? [],
        summary: row.summary,
        imageUrl: signed.data?.[index]?.signedUrl ?? null,
      };
    });
  });
