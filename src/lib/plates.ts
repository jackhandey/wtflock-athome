/** Plate helpers shared by client and server. Pure, browser-safe. */

const CONFUSIONS: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  B: "8",
  G: "6",
};

/** Uppercase, strip non-alphanumerics, and fold OCR-confusable glyphs to digits. */
export function normalizePlate(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned
    .split("")
    .map((char) => CONFUSIONS[char] ?? char)
    .join("");
}

/** Levenshtein distance, capped work for short plate strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((row[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/** True when two normalized plates are the same or off by a single OCR slip. */
export function platesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (Math.min(a.length, b.length) < 4) return false;
  return editDistance(a, b) <= 1;
}
