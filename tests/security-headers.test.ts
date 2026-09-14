import { describe, expect, it } from "vitest";
import { attachSecurityHeaders } from "@/server";

describe("HTTP Security Headers", () => {
  it("attaches baseline security headers to JSON responses", () => {
    const original = new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const secured = attachSecurityHeaders(original);

    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(secured.headers.get("X-Frame-Options")).toBe("DENY");
    expect(secured.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(secured.headers.get("Permissions-Policy")).toContain("camera=(self)");
    expect(secured.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    // API responses should not have CSP attached
    expect(secured.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("attaches Content-Security-Policy to HTML responses", () => {
    const original = new Response("<!DOCTYPE html><html><body>HomeWatch</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    const secured = attachSecurityHeaders(original);

    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(secured.headers.get("X-Frame-Options")).toBe("DENY");
    const csp = secured.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("preserves custom security headers if already configured", () => {
    const original = new Response("custom", {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });

    const secured = attachSecurityHeaders(original);
    expect(secured.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("safely handles 204 null body responses", () => {
    const original = new Response(null, { status: 204 });
    const secured = attachSecurityHeaders(original);
    expect(secured.status).toBe(204);
    expect(secured.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
