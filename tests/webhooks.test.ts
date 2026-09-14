import { describe, expect, it } from "vitest";
import { isPrivateIp, isSafeWebhookUrl, isSafeWebhookUrlAsync } from "@/lib/webhooks.server";

describe("SSRF Protection & Webhook URL Validation", () => {
  describe("isSafeWebhookUrl", () => {
    it("allows valid public HTTPS and HTTP webhooks", () => {
      expect(isSafeWebhookUrl("https://discord.com/api/webhooks/123/abc")).toBe(true);
      expect(isSafeWebhookUrl("https://hooks.slack.com/services/T00/B00/XXX")).toBe(true);
      expect(isSafeWebhookUrl("https://ntfy.sh/alerts_channel")).toBe(true);
      expect(isSafeWebhookUrl("https://api.pushover.net/1/messages.json")).toBe(true);
      expect(isSafeWebhookUrl("https://my-ha.duckdns.org/api/webhook/sample")).toBe(true);
      expect(isSafeWebhookUrl("http://example.com/webhook")).toBe(true);
      expect(isSafeWebhookUrl("https://93.184.216.34:8443/hook")).toBe(true);
    });

    it("rejects local hostnames and loopback domains", () => {
      expect(isSafeWebhookUrl("http://localhost/webhook")).toBe(false);
      expect(isSafeWebhookUrl("https://localhost:8080/")).toBe(false);
      expect(isSafeWebhookUrl("http://internal.localhost/path")).toBe(false);
      expect(isSafeWebhookUrl("http://127.0.0.1/api")).toBe(false);
      expect(isSafeWebhookUrl("http://127.0.0.2:8000/")).toBe(false);
      expect(isSafeWebhookUrl("http://0.0.0.0/")).toBe(false);
      expect(isSafeWebhookUrl("http://[::1]/")).toBe(false);
    });

    it("rejects cloud metadata link-local endpoints (AWS, GCP, Azure, DigitalOcean)", () => {
      expect(isSafeWebhookUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
      expect(isSafeWebhookUrl("http://169.254.169.254:80/computeMetadata/v1/")).toBe(false);
      expect(isSafeWebhookUrl("http://169.254.1.1/")).toBe(false);
    });

    it("rejects RFC 1918 private IPv4 addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
      // 10.0.0.0/8
      expect(isSafeWebhookUrl("http://10.0.0.1:8080/")).toBe(false);
      expect(isSafeWebhookUrl("https://10.200.5.1/webhook")).toBe(false);

      // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
      expect(isSafeWebhookUrl("http://172.16.0.1/admin")).toBe(false);
      expect(isSafeWebhookUrl("http://172.25.1.10/")).toBe(false);
      expect(isSafeWebhookUrl("http://172.31.255.254/")).toBe(false);

      // 192.168.0.0/16
      expect(isSafeWebhookUrl("http://192.168.1.1/")).toBe(false);
      expect(isSafeWebhookUrl("http://192.168.0.100:8123/api/webhook")).toBe(false);
      expect(isSafeWebhookUrl("https://192.168.10.50/alert")).toBe(false);
    });

    it("rejects non-HTTP protocols", () => {
      expect(isSafeWebhookUrl("ftp://example.com/data")).toBe(false);
      expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeWebhookUrl("gopher://127.0.0.1:6379/")).toBe(false);
      expect(isSafeWebhookUrl("javascript:alert(1)")).toBe(false);
    });

    it("rejects wildcard DNS services used to bypass SSRF filters", () => {
      expect(isSafeWebhookUrl("http://127.0.0.1.nip.io/webhook")).toBe(false);
      expect(isSafeWebhookUrl("https://customer.127.0.0.1.nip.io/api")).toBe(false);
      expect(isSafeWebhookUrl("http://10.0.0.1.sslip.io/test")).toBe(false);
      expect(isSafeWebhookUrl("http://192.168.1.1.xip.io/")).toBe(false);
      expect(isSafeWebhookUrl("http://localtest.me/")).toBe(false);
      expect(isSafeWebhookUrl("http://subdomain.localtest.me/hook")).toBe(false);
      expect(isSafeWebhookUrl("http://metadata.google.internal/computeMetadata/v1/")).toBe(false);
      expect(isSafeWebhookUrl("http://instance-data/latest/meta-data")).toBe(false);
      expect(isSafeWebhookUrl("http://cluster.local/endpoint")).toBe(false);
      expect(isSafeWebhookUrl("http://corp.internal/alert")).toBe(false);
    });

    it("rejects invalid or malformed URLs", () => {
      expect(isSafeWebhookUrl("")).toBe(false);
      expect(isSafeWebhookUrl("not-a-url")).toBe(false);
      expect(isSafeWebhookUrl("https://")).toBe(false);
      expect(isSafeWebhookUrl("://bad")).toBe(false);
    });
  });

  describe("isPrivateIp", () => {
    it("identifies private and reserved IPv4 CIDR blocks", () => {
      // Loopback
      expect(isPrivateIp("127.0.0.1")).toBe(true);
      expect(isPrivateIp("127.255.255.255")).toBe(true);

      // RFC 1918
      expect(isPrivateIp("10.0.0.1")).toBe(true);
      expect(isPrivateIp("10.254.254.254")).toBe(true);
      expect(isPrivateIp("172.16.0.1")).toBe(true);
      expect(isPrivateIp("172.31.255.255")).toBe(true);
      expect(isPrivateIp("192.168.1.1")).toBe(true);

      // Carrier NAT & Link-local
      expect(isPrivateIp("100.64.0.1")).toBe(true);
      expect(isPrivateIp("100.127.255.255")).toBe(true);
      expect(isPrivateIp("169.254.169.254")).toBe(true);

      // Test nets & Multicast / Reserved
      expect(isPrivateIp("198.18.0.1")).toBe(true);
      expect(isPrivateIp("198.51.100.1")).toBe(true);
      expect(isPrivateIp("203.0.113.1")).toBe(true);
      expect(isPrivateIp("224.0.0.1")).toBe(true);
      expect(isPrivateIp("240.0.0.1")).toBe(true);
      expect(isPrivateIp("0.0.0.0")).toBe(true);
    });

    it("identifies IPv6 loopback, link-local, and unique local addresses", () => {
      expect(isPrivateIp("::1")).toBe(true);
      expect(isPrivateIp("::")).toBe(true);
      expect(isPrivateIp("fe80::1")).toBe(true);
      expect(isPrivateIp("fc00::1")).toBe(true);
      expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
      expect(isPrivateIp("ff02::1")).toBe(true);
      expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    });

    it("allows public IPv4 and IPv6 addresses", () => {
      expect(isPrivateIp("93.184.216.34")).toBe(false);
      expect(isPrivateIp("8.8.8.8")).toBe(false);
      expect(isPrivateIp("1.1.1.1")).toBe(false);
      expect(isPrivateIp("142.250.190.46")).toBe(false);
      expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    });
  });

  describe("isSafeWebhookUrlAsync", () => {
    it("blocks private IPs and known bad patterns synchronously before DNS lookup", async () => {
      expect(await isSafeWebhookUrlAsync("http://127.0.0.1/webhook")).toBe(false);
      expect(await isSafeWebhookUrlAsync("http://169.254.169.254/meta-data")).toBe(false);
      expect(await isSafeWebhookUrlAsync("http://127.0.0.1.nip.io/webhook")).toBe(false);
      expect(await isSafeWebhookUrlAsync("http://metadata.google.internal/")).toBe(false);
      expect(await isSafeWebhookUrlAsync("http://10.0.0.1.sslip.io/")).toBe(false);
      expect(await isSafeWebhookUrlAsync("ftp://evil.com/")).toBe(false);
      expect(await isSafeWebhookUrlAsync("")).toBe(false);
    });

    it("blocks non-existent / invalid hostnames when DNS resolution fails", async () => {
      expect(
        await isSafeWebhookUrlAsync(
          "https://this-domain-definitely-does-not-exist-123456789.com/webhook",
        ),
      ).toBe(false);
    });
  });
});
