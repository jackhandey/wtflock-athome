import { lookup } from "node:dns/promises";

/** Server-side webhook dispatch for hotlist plate alerts with comprehensive SSRF protection. */

export type AlertWebhookPayload = {
  alertId: string;
  plate: string;
  plateState?: string | null;
  reason: string;
  cameraName: string;
  capturedAt: string;
  summary: string;
  vehicleDetails?: string;
  imageUrl?: string | null;
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "localtest.me",
]);

const BLOCKED_PATTERNS = [
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.nip\.io$/i,
  /\.sslip\.io$/i,
  /\.xip\.io$/i,
  /\.localtest\.me$/i,
];

/**
 * Checks if a given IP address belongs to a private, loopback, link-local,
 * multicast, or reserved CIDR range (RFC 1918, RFC 3927, RFC 5737, etc.).
 */
export function isPrivateIp(ip: string): boolean {
  const clean = ip
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .trim();

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  if (clean.startsWith("::ffff:")) {
    return isPrivateIp(clean.replace("::ffff:", ""));
  }

  // IPv6 checks
  if (
    clean === "::1" ||
    clean === "::" ||
    /^fe[89ab]/i.test(clean) || // Link-local (fe80::/10)
    clean.startsWith("fc") || // Unique local (fc00::/7)
    clean.startsWith("fd") || // Unique local (fc00::/7)
    clean.startsWith("ff") // Multicast (ff00::/8)
  ) {
    return true;
  }

  // IPv4 checks
  const match = clean.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (match) {
    const b0 = Number(match[1]);
    const b1 = Number(match[2]);

    if (b0 === 0) return true; // 0.0.0.0/8
    if (b0 === 10) return true; // 10.0.0.0/8 (Private)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // 100.64.0.0/10 (Carrier NAT)
    if (b0 === 127) return true; // 127.0.0.0/8 (Loopback)
    if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12 (Private)
    if (b0 === 192 && b1 === 0) return true; // 192.0.0.0/24 (IETF)
    if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16 (Private)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // 198.18.0.0/15 (Benchmark)
    if (b0 === 198 && b1 === 51) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (b0 === 203 && b1 === 0) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (b0 >= 224 && b0 <= 239) return true; // Multicast
    if (b0 >= 240) return true; // Reserved / Broadcast
    return false;
  }

  return false;
}

/**
 * Fast synchronous check for syntactic URL validity and known dangerous patterns/IPs.
 */
export function isSafeWebhookUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!hostname) return false;

    if (BLOCKED_HOSTNAMES.has(hostname)) return false;
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(hostname)) return false;
    }

    if (isPrivateIp(hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Full SSRF validator that resolves the domain via DNS to ensure no resolved IPs
 * point to private, loopback, or cloud instance metadata addresses (e.g. nip.io / DNS rebinding).
 */
export async function isSafeWebhookUrlAsync(urlStr: string): Promise<boolean> {
  if (!isSafeWebhookUrl(urlStr)) return false;

  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // If already an IP address, isSafeWebhookUrl already evaluated isPrivateIp
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":")) {
      return !isPrivateIp(hostname);
    }

    // Resolve DNS records
    const records = await lookup(hostname, { all: true });
    if (!records || records.length === 0) return false;

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return false;
      }
    }

    return true;
  } catch {
    // DNS resolution failure (NXDOMAIN / timeout)
    return false;
  }
}

export async function sendAlertWebhook(
  webhookUrl: string,
  data: AlertWebhookPayload,
): Promise<boolean> {
  if (!webhookUrl || !(await isSafeWebhookUrlAsync(webhookUrl))) return false;

  try {
    const isDiscord = webhookUrl.includes("discord.com/api/webhooks");
    const isSlack = webhookUrl.includes("hooks.slack.com");

    let body: Record<string, unknown>;

    if (isDiscord) {
      body = {
        username: "HomeWatch Alert",
        avatar_url: "https://wtflock-athome.lovable.app/favicon.ico",
        embeds: [
          {
            title: `🚨 HOTLIST ALERT: ${data.plate}${data.plateState ? ` (${data.plateState})` : ""}`,
            description: `**Reason**: ${data.reason.toUpperCase()}\n**Camera**: ${data.cameraName}\n**Vehicle**: ${data.vehicleDetails || "N/A"}\n**Summary**: ${data.summary}`,
            color: 15158332, // Red color integer
            timestamp: new Date(data.capturedAt).toISOString(),
            ...(data.imageUrl ? { image: { url: data.imageUrl } } : {}),
            footer: { text: "HomeWatch Security Intelligence" },
          },
        ],
      };
    } else if (isSlack) {
      body = {
        text: `🚨 *HOTLIST ALERT*: Plate \`${data.plate}\` detected on *${data.cameraName}*!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🚨 *HOTLIST ALERT: ${data.plate}* (${data.reason.toUpperCase()})\n*Camera*: ${data.cameraName}\n*Vehicle*: ${data.vehicleDetails || "N/A"}\n*Summary*: ${data.summary}`,
            },
          },
        ],
      };
    } else {
      // Generic JSON payload (Home Assistant / Ntfy / Pushover / Custom Webhooks)
      body = {
        event: "HOTLIST_ALERT",
        alertId: data.alertId,
        plate: data.plate,
        plateState: data.plateState ?? null,
        reason: data.reason,
        cameraName: data.cameraName,
        capturedAt: data.capturedAt,
        summary: data.summary,
        vehicleDetails: data.vehicleDetails ?? null,
        imageUrl: data.imageUrl ?? null,
      };
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    return res.ok;
  } catch (err) {
    console.error("Webhook dispatch failed:", err);
    return false;
  }
}
