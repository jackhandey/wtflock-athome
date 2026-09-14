import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";

import { normalizePlate, platesMatch } from "@/lib/plates";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { detectFromImage } from "@/lib/vision.server";

const BodySchema = z.object({
  cameraId: z.string().uuid(),
  capturedAt: z.string().optional(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  imageBase64: z.string().min(100).max(10_000_000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  speedMph: z.number().min(0).max(200).optional(),
  headingDeg: z.number().min(0).max(360).optional(),
  nodeType: z.enum(["fixed", "dashcam", "wearable", "mobile"]).optional(),
});

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
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

        const rateLimit = checkRateLimit(`device:${deviceKey.id}`, 60, 60_000);
        if (!rateLimit.success) {
          const retryAfter = Math.ceil(rateLimit.resetInMs / 1000);
          return json(
            {
              error: "Rate limit exceeded. Maximum 60 requests per minute.",
              retryAfterSeconds: retryAfter,
            },
            429,
            {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(rateLimit.limit),
              "X-RateLimit-Remaining": "0",
            },
          );
        }

        const userId = deviceKey.user_id;

        const { data: camera } = await supabaseAdmin
          .from("cameras")
          .select("id, user_id, enabled, name, node_type")
          .eq("id", parsed.cameraId)
          .maybeSingle();

        if (!camera || camera.user_id !== userId) return json({ error: "Unknown camera" }, 404);

        const capturedAt = parsed.capturedAt ?? new Date().toISOString();
        const cameraUpdate: { last_seen_at: string; latitude?: number; longitude?: number } = {
          last_seen_at: capturedAt,
        };
        if (parsed.latitude !== undefined) cameraUpdate.latitude = parsed.latitude;
        if (parsed.longitude !== undefined) cameraUpdate.longitude = parsed.longitude;

        await supabaseAdmin.from("cameras").update(cameraUpdate).eq("id", camera.id);
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
            latitude: parsed.latitude ?? null,
            longitude: parsed.longitude ?? null,
            speed_mph: parsed.speedMph ?? null,
            heading_deg: parsed.headingDeg ?? null,
            node_type: parsed.nodeType ?? camera.node_type ?? "fixed",
          })
          .select("id")
          .single();

        if (eventError || !event) {
          console.error("event insert failed", eventError);
          return json({ error: "Could not store event" }, 500);
        }

        let alerted = false;

        const { data: watchlist } = await supabaseAdmin
          .from("watchlist_plates")
          .select("*")
          .eq("user_id", userId);

        const { evaluateWatchlist } = await import("@/lib/matching");
        const matchResult = evaluateWatchlist(
          {
            plateText: detection.plateText,
            plateNormalized,
            plateState: detection.plateState,
            plateType: detection.plateType,
            vehicleColor: detection.vehicleColor,
            vehicleType: detection.vehicleType,
            vehicleMake: detection.vehicleMake,
            vehicleModel: detection.vehicleModel,
            uniqueFeatures: detection.uniqueFeatures,
          },
          (watchlist as import("@/lib/matching").WatchlistRule[]) ?? [],
        );

        let newAlert: { id: string } | null = null;
        let alertReason = "suspicious";
        let audioAlertText: string | null = null;

        // If explicitly whitelisted as resident, skip all alarm dispatches
        if (!matchResult.isResident) {
          // 1. Check for Watchlist or Visual BOLO Hit
          if (
            matchResult.hit &&
            (matchResult.reason === "suspicious" || matchResult.reason === "blocked")
          ) {
            const alertPlate = detection.plateText ?? matchResult.hit.plate ?? "(NO PLATE)";
            const alertNotes =
              matchResult.matchType === "bolo"
                ? `Visual BOLO: ${matchResult.label || matchResult.hit.notes || "Matching vehicle fingerprint"}`
                : (matchResult.hit.notes ??
                  `Watchlist Hit: ${matchResult.label || "Target plate match"}`);

            const { data: createdAlert } = await supabaseAdmin
              .from("alerts")
              .insert({
                user_id: userId,
                event_id: event.id,
                watchlist_id: matchResult.hit.id,
                plate: alertPlate,
                reason: matchResult.reason,
                alert_type: matchResult.matchType === "bolo" ? "bolo" : "watchlist",
                notes: alertNotes,
              })
              .select("id")
              .single();

            newAlert = createdAlert;
            alerted = true;
            alertReason = matchResult.reason;
          }

          // 2. Automated Repeat Pass / Casing Detection (The Prowler Anomaly)
          if (!alerted && plateNormalized) {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count: passCount } = await supabaseAdmin
              .from("events")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("plate_normalized", plateNormalized)
              .gte("captured_at", oneHourAgo);

            if (passCount && passCount >= 2) {
              const alertPlate = detection.plateText ?? plateNormalized;
              const { data: createdAlert } = await supabaseAdmin
                .from("alerts")
                .insert({
                  user_id: userId,
                  event_id: event.id,
                  plate: alertPlate,
                  reason: "suspicious",
                  alert_type: "casing",
                  notes: `Automated Casing Anomaly: Vehicle passed cameras ${passCount + 1} times in under 60 minutes`,
                })
                .select("id")
                .single();

              newAlert = createdAlert;
              alerted = true;
              alertReason = "casing";
            }
          }

          // 3. Dispatch Webhook & Save Wearable Audio TTS Text
          if (newAlert) {
            const vehicleDesc = [
              detection.vehicleColor,
              detection.vehicleMake,
              detection.vehicleModel,
            ]
              .filter(Boolean)
              .join(" ");

            audioAlertText =
              alertReason === "casing"
                ? `Warning: Casing alert. ${vehicleDesc || "Vehicle"} with plate ${detection.plateText ?? "unknown"} sighted multiple times.`
                : `Alert: Watchlist target. ${detection.plateText ? `Plate ${detection.plateText}. ` : ""}${vehicleDesc || "Suspect vehicle"}.`;

            await supabaseAdmin
              .from("events")
              .update({ audio_alert_text: audioAlertText })
              .eq("id", event.id);

            const { data: settings } = await supabaseAdmin
              .from("user_settings")
              .select("webhook_url, webhook_enabled")
              .eq("user_id", userId)
              .maybeSingle();

            if (settings?.webhook_url && settings?.webhook_enabled !== false) {
              const { sendAlertWebhook } = await import("@/lib/webhooks.server");

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
                plate: detection.plateText ?? "(NO PLATE)",
                plateState: detection.plateState,
                reason: alertReason,
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
          alertReason: alerted ? alertReason : undefined,
          audioAlertText: audioAlertText ?? undefined,
          plate: detection.plateText,
          summary: detection.summary,
          nodeType: parsed.nodeType ?? camera.node_type ?? "fixed",
          latitude: parsed.latitude ?? null,
          longitude: parsed.longitude ?? null,
        });
      },
    },
  },
});
