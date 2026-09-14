import { platesMatch } from "./plates";

export interface WatchlistRule {
  id: string;
  user_id: string;
  plate: string | null;
  plate_normalized: string | null;
  rule_type: string; // 'plate' | 'fingerprint'
  label: string | null;
  reason: "expected" | "suspicious" | "blocked";
  notes: string | null;
  is_resident?: boolean;
  target_make: string | null;
  target_model: string | null;
  target_color: string | null;
  target_plate_type: string | null;
  target_feature: string | null;
  require_no_plate?: boolean;
}

export interface DetectionMatchTarget {
  plateText: string | null;
  plateNormalized: string | null;
  plateState?: string | null;
  plateType?: string | null;
  vehicleColor?: string | null;
  vehicleType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  uniqueFeatures?: string[];
}

export interface MatchEvaluationResult {
  hit: WatchlistRule | null;
  isResident: boolean;
  matchType: "plate" | "bolo" | null;
  reason: "expected" | "suspicious" | "blocked" | null;
  label: string | null;
}

/**
 * Checks whether a single rule matches the detected vehicle telemetry.
 */
export function evaluateRule(detection: DetectionMatchTarget, rule: WatchlistRule): boolean {
  if (rule.rule_type === "fingerprint") {
    let hasCriteria = false;

    if (rule.require_no_plate) {
      hasCriteria = true;
      if (detection.plateText != null && detection.plateText.trim() !== "") {
        return false;
      }
    }

    if (rule.target_plate_type) {
      hasCriteria = true;
      if (
        !detection.plateType ||
        !detection.plateType.toLowerCase().includes(rule.target_plate_type.toLowerCase())
      ) {
        return false;
      }
    }

    if (rule.target_make) {
      hasCriteria = true;
      if (
        !detection.vehicleMake ||
        !detection.vehicleMake.toLowerCase().includes(rule.target_make.toLowerCase())
      ) {
        return false;
      }
    }

    if (rule.target_model) {
      hasCriteria = true;
      if (
        !detection.vehicleModel ||
        !detection.vehicleModel.toLowerCase().includes(rule.target_model.toLowerCase())
      ) {
        return false;
      }
    }

    if (rule.target_color) {
      hasCriteria = true;
      if (
        !detection.vehicleColor ||
        !detection.vehicleColor.toLowerCase().includes(rule.target_color.toLowerCase())
      ) {
        return false;
      }
    }

    if (rule.target_feature) {
      hasCriteria = true;
      const target = rule.target_feature.toLowerCase();
      const features = (detection.uniqueFeatures ?? []).map((f) => f.toLowerCase());
      if (!features.some((f) => f.includes(target))) {
        return false;
      }
    }

    return hasCriteria;
  }

  // Plate matching rule
  if (rule.plate_normalized && detection.plateNormalized) {
    return platesMatch(detection.plateNormalized, rule.plate_normalized);
  }

  return false;
}

/**
 * Finds the highest-priority matching rule for an event.
 * Resident whitelists take precedence to prevent false alarms.
 */
export function evaluateWatchlist(
  detection: DetectionMatchTarget,
  rules: WatchlistRule[],
): MatchEvaluationResult {
  // First check if vehicle is whitelisted as resident
  const residentHit = rules.find((r) => r.is_resident && evaluateRule(detection, r));
  if (residentHit) {
    return {
      hit: residentHit,
      isResident: true,
      matchType: residentHit.rule_type === "fingerprint" ? "bolo" : "plate",
      reason: residentHit.reason,
      label: residentHit.label,
    };
  }

  // Next check suspicious or blocked hotlist rules
  const alertHit = rules.find(
    (r) =>
      !r.is_resident &&
      (r.reason === "suspicious" || r.reason === "blocked") &&
      evaluateRule(detection, r),
  );

  if (alertHit) {
    return {
      hit: alertHit,
      isResident: false,
      matchType: alertHit.rule_type === "fingerprint" ? "bolo" : "plate",
      reason: alertHit.reason,
      label: alertHit.label,
    };
  }

  // Any remaining expected/whitelisted hits
  const expectedHit = rules.find((r) => evaluateRule(detection, r));
  if (expectedHit) {
    return {
      hit: expectedHit,
      isResident: false,
      matchType: expectedHit.rule_type === "fingerprint" ? "bolo" : "plate",
      reason: expectedHit.reason,
      label: expectedHit.label,
    };
  }

  return {
    hit: null,
    isResident: false,
    matchType: null,
    reason: null,
    label: null,
  };
}
