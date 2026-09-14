import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit.server";

describe("Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("permits requests within the defined threshold", () => {
    const res1 = checkRateLimit("dev-1", 5, 10_000);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(4);
    expect(res1.limit).toBe(5);

    const res2 = checkRateLimit("dev-1", 5, 10_000);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(3);
  });

  it("blocks requests once the threshold limit is reached", () => {
    const limit = 3;
    const windowMs = 5000;

    for (let i = 0; i < limit; i += 1) {
      const res = checkRateLimit("dev-2", limit, windowMs);
      expect(res.success).toBe(true);
    }

    // Next request should be blocked
    const blocked = checkRateLimit("dev-2", limit, windowMs);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetInMs).toBeGreaterThan(0);
    expect(blocked.resetInMs).toBeLessThanOrEqual(windowMs);
  });

  it("isolates rate limits between distinct keys", () => {
    // Fill quota for key A
    for (let i = 0; i < 2; i += 1) {
      checkRateLimit("device-A", 2, 5000);
    }
    const blockedA = checkRateLimit("device-A", 2, 5000);
    expect(blockedA.success).toBe(false);

    // Key B should remain completely unblocked
    const resB = checkRateLimit("device-B", 2, 5000);
    expect(resB.success).toBe(true);
    expect(resB.remaining).toBe(1);
  });

  it("resets limits when resetRateLimits is called", () => {
    for (let i = 0; i < 2; i += 1) {
      checkRateLimit("device-reset", 2, 5000);
    }
    expect(checkRateLimit("device-reset", 2, 5000).success).toBe(false);

    resetRateLimits();

    const afterReset = checkRateLimit("device-reset", 2, 5000);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });
});
