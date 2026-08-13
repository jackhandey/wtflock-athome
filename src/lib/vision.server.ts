/** Server-only AI vision detection for camera frames. */

export type Detection = {
  interesting: boolean;
  plateText: string | null;
  plateConfidence: number | null;
  vehicleColor: string | null;
  vehicleType: string | null;
  vehicleMake: string | null;
  vehicleCount: number;
  personCount: number;
  summary: string;
};

const SYSTEM_PROMPT = `You analyze a single still frame from a fixed home security camera.
Report only what is clearly visible. Never guess a license plate you cannot read.
Respond with JSON only, matching exactly this shape:
{"vehicles":[{"plate":string|null,"plate_confidence":number,"color":string|null,"type":string|null,"make":string|null}],"person_count":number,"summary":string}
Rules:
- plate: the characters you can read, uppercase, no spaces. null when unreadable or no plate visible.
- plate_confidence: 0 to 1, how sure you are of every character. Use 0 when plate is null.
- type: one of sedan, suv, truck, van, pickup, motorcycle, bus, other.
- summary: one short sentence describing the scene (max 15 words).
- Empty vehicles array and person_count 0 when the frame shows nothing but the static scene.`;

type GatewayVehicle = {
  plate?: string | null;
  plate_confidence?: number | null;
  color?: string | null;
  type?: string | null;
  make?: string | null;
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
  vehicleColor: null,
  vehicleType: null,
  vehicleMake: null,
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
    vehicleColor: best?.color ?? null,
    vehicleType: best?.type ?? null,
    vehicleMake: best?.make ?? null,
    vehicleCount: vehicles.length,
    personCount,
    summary: parsed.summary ? String(parsed.summary).slice(0, 200) : EMPTY.summary,
  };
}
