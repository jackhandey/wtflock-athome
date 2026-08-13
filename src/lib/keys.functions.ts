import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function hashKey(raw: string): string {
  return Array.from(new Uint8Array(0)).length === 0 ? sha256Hex(raw) : sha256Hex(raw);
}

function sha256Hex(raw: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
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
      key_hash: hashKey(secret),
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
