import { describe, expect, it } from "vitest";
import { editDistance, normalizePlate, platesMatch } from "@/lib/plates";

describe("Plate Processing & Matching", () => {
  describe("normalizePlate", () => {
    it("returns empty string for null, undefined, or empty values", () => {
      expect(normalizePlate(null)).toBe("");
      expect(normalizePlate(undefined)).toBe("");
      expect(normalizePlate("")).toBe("");
    });

    it("uppercases letters and strips punctuation and whitespace", () => {
      expect(normalizePlate("ahk-123")).toBe("AHK123");
      expect(normalizePlate(" 7xyz 890 ")).toBe("7XY2890"); // Z folds to 2
      expect(normalizePlate("CA • 4SAM123")).toBe("CA45AM123"); // S folds to 5
    });

    it("substitutes common OCR confusions with canonical digits", () => {
      // O, Q, D -> 0
      expect(normalizePlate("OQD")).toBe("000");
      // I, L -> 1
      expect(normalizePlate("IL")).toBe("11");
      // Z -> 2
      expect(normalizePlate("Z")).toBe("2");
      // S -> 5
      expect(normalizePlate("S")).toBe("5");
      // B -> 8
      expect(normalizePlate("B")).toBe("8");
      // G -> 6
      expect(normalizePlate("G")).toBe("6");
    });

    it("preserves unconfusable alphanumeric characters", () => {
      expect(normalizePlate("4TRK987")).toBe("4TRK987");
      expect(normalizePlate("7KPM444")).toBe("7KPM444");
    });
  });

  describe("editDistance", () => {
    it("returns 0 for identical strings", () => {
      expect(editDistance("ABC", "ABC")).toBe(0);
      expect(editDistance("", "")).toBe(0);
    });

    it("handles one or both strings being empty", () => {
      expect(editDistance("", "ABC")).toBe(3);
      expect(editDistance("ABCD", "")).toBe(4);
    });

    it("computes single-operation differences correctly", () => {
      expect(editDistance("CAT", "BAT")).toBe(1); // substitution
      expect(editDistance("CAT", "CATS")).toBe(1); // insertion
      expect(editDistance("CATS", "CAT")).toBe(1); // deletion
    });

    it("computes multi-character differences correctly", () => {
      expect(editDistance("KITTEN", "SITTING")).toBe(3);
      expect(editDistance("7XYZ123", "8XYZ999")).toBe(4);
    });
  });

  describe("platesMatch", () => {
    it("returns false if either plate is empty or null", () => {
      expect(platesMatch("", "ABC1234")).toBe(false);
      expect(platesMatch("ABC1234", "")).toBe(false);
    });

    it("returns true for exact matches regardless of plate length", () => {
      expect(platesMatch("ABC123", "ABC123")).toBe(true);
      expect(platesMatch("7X", "7X")).toBe(true);
      expect(platesMatch("GOV1", "GOV1")).toBe(true);
    });

    it("returns false when length difference is greater than 1", () => {
      expect(platesMatch("ABC", "ABCDE")).toBe(false);
      expect(platesMatch("7SAM123", "7SAM")).toBe(false);
    });

    it("allows single-character OCR variance for plates with length >= 5", () => {
      expect(platesMatch("7SAM123", "7SAM124")).toBe(true); // 1 substitution
      expect(platesMatch("8ABC12", "8ABC123")).toBe(true); // 1 insertion
      expect(platesMatch("8ABC123", "8ABC12")).toBe(true); // 1 deletion
    });

    it("strictly requires exact matches for short plates (< 5 chars) to prevent false alarms", () => {
      // Short plates should not trigger fuzzy match even if edit distance is 1
      expect(platesMatch("1234", "1235")).toBe(false);
      expect(platesMatch("ABC", "ABD")).toBe(false);
      expect(platesMatch("TAG1", "TAG2")).toBe(false);
      // But identical short plates still match
      expect(platesMatch("1234", "1234")).toBe(true);
      expect(platesMatch("USA1", "USA1")).toBe(true);
    });
  });
});
