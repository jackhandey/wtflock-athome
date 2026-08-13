/** Server-only AI vision detection for camera frames. */

export type Detection = {
  interesting: boolean;
  plateText: string | null;
  plateConfidence: number | null;
  plateState: string | null;
  plateType: string | null;
  vehicleColor: string | null;
  vehicleType: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleGeneration: string | null;
  uniqueFeatures: string[];
  vehicleCount: number;
  personCount: number;
  summary: string;
};

const SYSTEM_PROMPT = `You are a high-accuracy security camera vehicle intelligence & ALPR system.
Analyze this camera image and report vehicle details and license plate information with high precision.

Respond ONLY with a JSON object matching this exact shape:
{
  "vehicles": [
    {
      "plate": string | null,
      "plate_confidence": number,
      "plate_state": string | null,
      "plate_type": "Standard" | "Temporary Paper Tag" | "Commercial" | "Dealer" | "Disabled" | "Other" | null,
      "color": string | null,
      "type": "sedan" | "suv" | "truck" | "van" | "pickup" | "motorcycle" | "hatchback" | "coupe" | "other" | null,
      "make": string | null,
      "model": string | null,
      "generation": string | null,
      "unique_features": string[]
    }
  ],
  "person_count": number,
  "summary": string
}

Rules:
- plate: Uppercase alphanumeric string of readable plate text (no spaces). Use null if unreadable.
- plate_confidence: float between 0.0 and 1.0. Use 0 if plate is null.
- plate_state: 2-letter state abbreviation if visible (e.g. CA, TX, NY, FL). Null if unreadable.
- plate_type: Standard, Temporary Paper Tag, Commercial, Dealer, Disabled, or Other.
- make: Manufacturer name (e.g., Honda, Ford, Toyota, Tesla, Chevrolet).
- model: Specific model name if recognizable (e.g., Civic, F-150, Camry, Model Y, Silverado).
- generation: Estimated year/generation range (e.g. "2016-2021").
- unique_features: Array of distinct visible identifiers, e.g. ["roof_rack", "bumper_sticker", "dented_bumper", "window_tint", "custom_wheels", "tow_hitch", "tool_rack"]. Use empty array [] if none.
- summary: Concise 1-sentence description (max 20 words).`;

type GatewayVehicle = {
  plate?: string | null;
  plate_confidence?: number | null;
  plate_state?: string | null;
  plate_type?: string | null;
  color?: string | null;
  type?: string | null;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  unique_features?: string[];
};

type GatewayResult = {
  vehicles?: GatewayVehicle[];
  person_count?: number;
  summary?: string;
};

const EMPTY: Detection = {
  interesting: false,
  plateText: null,
  plateConfidence: null,
  plateState: null,
  plateType: null,
  vehicleColor: null,
  vehicleType: null,
  vehicleMake: null,
  vehicleModel: null,
  vehicleGeneration: null,
  uniqueFeatures: [],
  vehicleCount: 0,
  personCount: 0,
  summary: "Nothing detected",
};

function extractJson(text: string): GatewayResult | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as GatewayResult;
  } catch {
    return null;
  }
}

/**
 * Runs plate / vehicle / person detection on a data-URL encoded frame.
 * Throws on gateway failures so the caller can surface rate limits and credit errors.
 */
export async function detectFromImage(imageDataUrl: string): Promise<Detection> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this camera frame and return the JSON object." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI detection failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed) return EMPTY;

  const vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
  const personCount = Number.isFinite(parsed.person_count) ? Number(parsed.person_count) : 0;

  const best = vehicles
    .slice()
    .sort((a, b) => Number(b.plate_confidence ?? 0) - Number(a.plate_confidence ?? 0))[0];

  const plateText = best?.plate ? String(best.plate).toUpperCase().replace(/[^A-Z0-9]/g, "") : null;

  return {
    interesting: vehicles.length > 0 || personCount > 0,
    plateText: plateText && plateText.length >= 3 ? plateText : null,
    plateConfidence: best?.plate_confidence != null ? Number(best.plate_confidence) : null,
    plateState: best?.plate_state ? String(best.plate_state).toUpperCase().slice(0, 5) : null,
    plateType: best?.plate_type ?? null,
    vehicleColor: best?.color ?? null,
    vehicleType: best?.type ?? null,
    vehicleMake: best?.make ?? null,
    vehicleModel: best?.model ?? null,
    vehicleGeneration: best?.generation ?? null,
    uniqueFeatures: Array.isArray(best?.unique_features) ? best.unique_features.map(String) : [],
    vehicleCount: vehicles.length,
    personCount,
    summary: parsed.summary ? String(parsed.summary).slice(0, 200) : EMPTY.summary,
  };
}
