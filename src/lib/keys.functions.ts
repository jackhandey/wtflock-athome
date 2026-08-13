import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hashKey(raw: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(raw).digest("hex");
}


export const listDeviceKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("device_keys")
      .select("id, name, key_prefix, revoked, last_used_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const secret = `hw_${Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;

    const { error } = await context.supabase.from("device_keys").insert({
      user_id: context.userId,
      name: data.name,
      key_hash: await hashKey(secret),
      key_prefix: secret.slice(0, 10),
    });
    if (error) throw new Error(error.message);

    // Returned once — it is never retrievable again.
    return { secret };
  });

export const revokeDeviceKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_keys")
      .update({ revoked: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
