import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/vision.server";

describe("Vision Gateway AI Parser", () => {
  describe("extractJson", () => {
    it("parses clean JSON objects correctly", () => {
      const input = JSON.stringify({
        vehicles: [
          {
            plate: "7SAM123",
            plate_confidence: 0.95,
            make: "Toyota",
            model: "Camry",
          },
        ],
        person_count: 1,
        summary: "Silver Toyota Camry with readable plate",
      });

      const result = extractJson(input);
      expect(result).not.toBeNull();
      expect(result?.vehicles?.[0]?.plate).toBe("7SAM123");
      expect(result?.person_count).toBe(1);
    });

    it("parses JSON wrapped in markdown code blocks", () => {
      const input = `\`\`\`json
{
  "vehicles": [{ "plate": "9XYZ000", "plate_confidence": 0.88 }],
  "person_count": 0,
  "summary": "Vehicle detected"
}
\`\`\``;

      const result = extractJson(input);
      expect(result).not.toBeNull();
      expect(result?.vehicles?.[0]?.plate).toBe("9XYZ000");
    });

    it("extracts JSON even with surrounding model conversational chatter", () => {
      const input = `Certainly! Here is the extracted vehicle telemetry:
{
  "vehicles": [{ "plate": "CALIF1", "color": "blue" }],
  "summary": "Blue sedan"
}
Let me know if you need further analysis.`;

      const result = extractJson(input);
      expect(result).not.toBeNull();
      expect(result?.vehicles?.[0]?.plate).toBe("CALIF1");
      expect(result?.summary).toBe("Blue sedan");
    });

    it("returns null when no JSON structure is present", () => {
      expect(extractJson("")).toBeNull();
      expect(extractJson("Just a plain text explanation with no braces")).toBeNull();
      expect(extractJson("Error 500: Gateway Timeout")).toBeNull();
    });

    it("returns null for syntactically invalid or truncated JSON", () => {
      expect(extractJson("{ vehicles: [ unterminated")).toBeNull();
      expect(extractJson("{ 'single_quotes': not_valid_json }")).toBeNull();
    });
  });
});
