import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateWatchlist, type WatchlistRule } from "@/lib/matching";

describe("Watchlist & Visual BOLO Matching Engine", () => {
  const baseRule: WatchlistRule = {
    id: "r1",
    user_id: "u1",
    plate: "7SAM123",
    plate_normalized: "75AM123",
    rule_type: "plate",
    label: "Stolen Honda",
    reason: "suspicious",
    notes: "Reported stolen in area",
    is_resident: false,
    target_make: null,
    target_model: null,
    target_color: null,
    target_plate_type: null,
    target_feature: null,
    require_no_plate: false,
  };

  it("evaluates plate match rules with OCR normalization", () => {
    const detection = {
      plateText: "7SAM123",
      plateNormalized: "75AM123",
    };
    expect(evaluateRule(detection, baseRule)).toBe(true);

    const nonMatch = {
      plateText: "4XYZ999",
      plateNormalized: "4XYZ999",
    };
    expect(evaluateRule(nonMatch, baseRule)).toBe(false);
  });

  it("matches visual BOLO criteria on make and model", () => {
    const boloRule: WatchlistRule = {
      ...baseRule,
      plate: null,
      plate_normalized: null,
      rule_type: "fingerprint",
      target_make: "Dodge",
      target_model: "Charger",
      target_color: "Black",
    };

    const match = {
      plateText: null,
      plateNormalized: null,
      vehicleMake: "Dodge",
      vehicleModel: "Charger",
      vehicleColor: "Gloss Black",
    };
    expect(evaluateRule(match, boloRule)).toBe(true);

    const wrongColor = {
      plateText: null,
      plateNormalized: null,
      vehicleMake: "Dodge",
      vehicleModel: "Charger",
      vehicleColor: "White",
    };
    expect(evaluateRule(wrongColor, boloRule)).toBe(false);
  });

  it("matches visual BOLO for temporary paper tags", () => {
    const tempTagRule: WatchlistRule = {
      ...baseRule,
      plate: null,
      plate_normalized: null,
      rule_type: "fingerprint",
      target_plate_type: "Temporary Paper Tag",
    };

    const match = {
      plateText: "T123456",
      plateNormalized: "T123456",
      plateType: "Temporary Paper Tag",
    };
    expect(evaluateRule(match, tempTagRule)).toBe(true);

    const standardPlate = {
      plateText: "8XYZ999",
      plateNormalized: "8XYZ999",
      plateType: "Standard",
    };
    expect(evaluateRule(standardPlate, tempTagRule)).toBe(false);
  });

  it("matches visual BOLO for missing/plateless vehicles", () => {
    const noPlateRule: WatchlistRule = {
      ...baseRule,
      plate: null,
      plate_normalized: null,
      rule_type: "fingerprint",
      require_no_plate: true,
      target_color: "Red",
    };

    expect(
      evaluateRule(
        {
          plateText: null,
          plateNormalized: null,
          vehicleColor: "Red",
        },
        noPlateRule,
      ),
    ).toBe(true);

    expect(
      evaluateRule(
        {
          plateText: "5ABC123",
          plateNormalized: "5A8C123",
          vehicleColor: "Red",
        },
        noPlateRule,
      ),
    ).toBe(false);
  });

  it("matches visual BOLO on unique alterations like roof racks or tinted windows", () => {
    const featureRule: WatchlistRule = {
      ...baseRule,
      plate: null,
      plate_normalized: null,
      rule_type: "fingerprint",
      target_feature: "roof_rack",
    };

    expect(
      evaluateRule(
        {
          plateText: null,
          plateNormalized: null,
          uniqueFeatures: ["window_tint", "roof_rack"],
        },
        featureRule,
      ),
    ).toBe(true);

    expect(
      evaluateRule(
        {
          plateText: null,
          plateNormalized: null,
          uniqueFeatures: ["tow_hitch"],
        },
        featureRule,
      ),
    ).toBe(false);
  });

  it("prioritizes resident whitelisting over general alerts", () => {
    const residentRule: WatchlistRule = {
      ...baseRule,
      id: "res-1",
      plate: "7SAM123",
      plate_normalized: "75AM123",
      is_resident: true,
      reason: "expected",
      label: "Neighbor Camry",
    };

    const suspiciousBolo: WatchlistRule = {
      ...baseRule,
      id: "bolo-1",
      plate: null,
      plate_normalized: null,
      rule_type: "fingerprint",
      target_make: "Toyota",
      target_model: "Camry",
      reason: "suspicious",
    };

    const detection = {
      plateText: "7SAM123",
      plateNormalized: "75AM123",
      vehicleMake: "Toyota",
      vehicleModel: "Camry",
    };

    const result = evaluateWatchlist(detection, [suspiciousBolo, residentRule]);
    expect(result.isResident).toBe(true);
    expect(result.hit?.id).toBe("res-1");
  });
});
