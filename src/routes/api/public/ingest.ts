import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

import { normalizePlate, platesMatch } from "@/lib/plates";
import { detectFromImage } from "@/lib/vision.server";

const BodySchema = z.object({
  cameraId: z.string().uuid(),
  capturedAt: z.string().optional(),
  contentType: z.string().default("image/jpeg"),
  imageBase64: z.string().min(100),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawKey = request.headers.get("x-device-key")?.trim();
        if (!rawKey) return json({ error: "Missing device key" }, 401);

        let parsed;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return json({ error: "Invalid payload" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const keyHash = createHash("sha256").update(rawKey).digest("hex");

        const { data: deviceKey } = await supabaseAdmin
          .from("device_keys")
          .select("id, user_id, revoked")
          .eq("key_hash", keyHash)
          .maybeSingle();

        if (!deviceKey || deviceKey.revoked) return json({ error: "Invalid device key" }, 401);
        const userId = deviceKey.user_id;

        const { data: camera } = await supabaseAdmin
          .from("cameras")
          .select("id, user_id, enabled")
          .eq("id", parsed.cameraId)
          .maybeSingle();

        if (!camera || camera.user_id !== userId) return json({ error: "Unknown camera" }, 404);

        const capturedAt = parsed.capturedAt ?? new Date().toISOString();
        await supabaseAdmin
          .from("cameras")
          .update({ last_seen_at: capturedAt })
          .eq("id", camera.id);
        await supabaseAdmin
          .from("device_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", deviceKey.id);

        if (!camera.enabled) return json({ stored: false, reason: "camera disabled" });

        const dataUrl = `data:${parsed.contentType};base64,${parsed.imageBase64}`;

        let detection;
        try {
          detection = await detectFromImage(dataUrl);
        } catch (error) {
          console.error("detection failed", error);
          return json({ error: "Detection failed", detail: String(error) }, 502);
        }

        if (!detection.interesting) {
          return json({ stored: false, reason: "no detection", summary: detection.summary });
        }

        const bytes = Buffer.from(parsed.imageBase64, "base64");
        const extension = parsed.contentType.includes("png") ? "png" : "jpg";
        const imagePath = `${userId}/${camera.id}/${Date.now()}.${extension}`;

        const upload = await supabaseAdmin.storage
          .from("snapshots")
          .upload(imagePath, bytes, { contentType: parsed.contentType, upsert: false });

        if (upload.error) {
          console.error("upload failed", upload.error);
          return json({ error: "Upload failed" }, 500);
        }

        const plateNormalized = normalizePlate(detection.plateText);

        const { data: event, error: eventError } = await supabaseAdmin
          .from("events")
          .insert({
            user_id: userId,
            camera_id: camera.id,
            captured_at: capturedAt,
            image_path: imagePath,
            plate_text: detection.plateText,
            plate_normalized: plateNormalized || null,
            plate_confidence: detection.plateConfidence,
            plate_state: detection.plateState,
            plate_type: detection.plateType,
            vehicle_color: detection.vehicleColor,
            vehicle_type: detection.vehicleType,
            vehicle_make: detection.vehicleMake,
            vehicle_model: detection.vehicleModel,
            vehicle_generation: detection.vehicleGeneration,
            unique_features: detection.uniqueFeatures,
            vehicle_count: detection.vehicleCount,
            person_count: detection.personCount,
            summary: detection.summary,
          })
          .select("id")
          .single();

        if (eventError || !event) {
          console.error("event insert failed", eventError);
          return json({ error: "Could not store event" }, 500);
        }

        let alerted = false;
        if (plateNormalized) {
          const { data: watchlist } = await supabaseAdmin
            .from("watchlist_plates")
            .select("id, plate, plate_normalized, reason")
            .eq("user_id", userId);

          const hit = (watchlist ?? []).find((entry) =>
            platesMatch(plateNormalized, entry.plate_normalized),
          );

          if (hit) {
            const { data: newAlert } = await supabaseAdmin
              .from("alerts")
              .insert({
                user_id: userId,
                event_id: event.id,
                watchlist_id: hit.id,
                plate: detection.plateText ?? hit.plate,
                reason: hit.reason,
              })
              .select("id")
              .single();

            alerted = true;

            // Trigger instant multi-channel webhook dispatch if configured
            const { data: settings } = await supabaseAdmin
              .from("user_settings")
              .select("webhook_url, webhook_enabled")
              .eq("user_id", userId)
              .maybeSingle();

            if (settings?.webhook_url && settings?.webhook_enabled !== false && newAlert) {
              const { sendAlertWebhook } = await import("@/lib/webhooks.server");

              // Generate signed image URL if snapshot stored
              let imageUrl: string | null = null;
              if (imagePath) {
                const { data: signed } = await supabaseAdmin.storage
                  .from("snapshots")
                  .createSignedUrl(imagePath, 86400);
                imageUrl = signed?.signedUrl ?? null;
              }

              const vehicleDesc = [
                detection.vehicleColor,
                detection.vehicleMake,
                detection.vehicleModel,
                detection.vehicleType,
              ]
                .filter(Boolean)
                .join(" ");

              sendAlertWebhook(settings.webhook_url, {
                alertId: newAlert.id,
                plate: detection.plateText ?? hit.plate,
                plateState: detection.plateState,
                reason: hit.reason,
                cameraName: camera.name ?? "Home Camera",
                capturedAt: capturedAt,
                summary: detection.summary,
                vehicleDetails: vehicleDesc,
                imageUrl,
              }).catch((e) => console.error("Async webhook failed:", e));
            }
          }
        }

        return json({
          stored: true,
          eventId: event.id,
          alerted,
          plate: detection.plateText,
          summary: detection.summary,
        });
      },
    },
  },
});
