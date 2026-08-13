import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CaseInput = z.object({
  caseNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(120),
  status: z.string().max(30).default("Open"),
  description: z.string().max(2000).optional().nullable(),
  investigatorNotes: z.string().max(5000).optional().nullable(),
});

export type CaseRow = {
  id: string;
  case_number: string;
  title: string;
  status: string;
  description: string | null;
  investigator_notes: string | null;
  created_at: string;
  updated_at: string;
  event_count?: number;
};

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cases, error } = await context.supabase
      .from("cases")
      .select("*, case_events(count)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (cases ?? []).map((c: any) => ({
      id: c.id,
      case_number: c.case_number,
      title: c.title,
      status: c.status,
      description: c.description,
      investigator_notes: c.investigator_notes,
      created_at: c.created_at,
      updated_at: c.updated_at,
      event_count: c.case_events?.[0]?.count ?? 0,
    })) as CaseRow[];
  });

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("cases")
      .insert({
        user_id: context.userId,
        case_number: data.caseNumber,
        title: data.title,
        status: data.status,
        description: data.description ?? null,
        investigator_notes: data.investigatorNotes ?? null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const updateCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    CaseInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = {};
    if (data.caseNumber !== undefined) patch.case_number = data.caseNumber;
    if (data.title !== undefined) patch.title = data.title;
    if (data.status !== undefined) patch.status = data.status;
    if (data.description !== undefined) patch.description = data.description;
    if (data.investigatorNotes !== undefined) patch.investigator_notes = data.investigatorNotes;

    const { error } = await context.supabase.from("cases").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCaseDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: caseObj, error: caseErr } = await context.supabase
      .from("cases")
      .select("*")
      .eq("id", data.id)
      .single();

    if (caseErr || !caseObj) throw new Error(caseErr?.message || "Case not found");

    const { data: caseEvents, error: eventsErr } = await context.supabase
      .from("case_events")
      .select("*, events(*, cameras(name))")
      .eq("case_id", data.id)
      .order("created_at", { ascending: true });

    if (eventsErr) throw new Error(eventsErr.message);

    const paths = (caseEvents ?? []).map((ce: any) => ce.events?.image_path).filter(Boolean);
    const signed = paths.length
      ? await context.supabase.storage.from("snapshots").createSignedUrls(paths, 3600)
      : { data: [] as { signedUrl: string }[] };

    let urlIdx = 0;
    const formattedEvents = (caseEvents ?? []).map((ce: any) => {
      const ev = ce.events;
      const imageUrl = ev?.image_path ? signed.data?.[urlIdx++]?.signedUrl ?? null : null;
      return {
        case_event_id: ce.id,
        notes: ce.notes,
        added_at: ce.created_at,
        event: {
          id: ev.id,
          camera_id: ev.camera_id,
          camera_name: ev.cameras?.name ?? "Unknown Camera",
          captured_at: ev.captured_at,
          plate_text: ev.plate_text,
          plate_state: ev.plate_state,
          plate_type: ev.plate_type,
          vehicle_color: ev.vehicle_color,
          vehicle_type: ev.vehicle_type,
          vehicle_make: ev.vehicle_make,
          vehicle_model: ev.vehicle_model,
          vehicle_generation: ev.vehicle_generation,
          unique_features: ev.unique_features ?? [],
          summary: ev.summary,
          imageUrl,
        },
      };
    });

    return {
      case: caseObj,
      events: formattedEvents,
    };
  });

export const addEventToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      caseId: z.string().uuid(),
      eventId: z.string().uuid(),
      notes: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("case_events").insert({
      case_id: data.caseId,
      event_id: data.eventId,
      notes: data.notes ?? null,
    });
    if (error && !error.message.includes("unique")) throw new Error(error.message);
    return { ok: true };
  });

export const removeEventFromCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseEventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("case_events").delete().eq("id", data.caseEventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
