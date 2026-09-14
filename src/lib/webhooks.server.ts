/** Server-side webhook dispatch for hotlist plate alerts. */

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

export function isSafeWebhookUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    // Normalize hostname: lowercase and strip IPv6 enclosing brackets
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "::"
    ) {
      return false;
    }

    // IPv6 link-local and unique-local
    if (
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc00:") ||
      hostname.startsWith("fd00:")
    ) {
      return false;
    }

    if (hostname === "169.254.169.254" || hostname.startsWith("169.254.")) {
      return false;
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const b0 = Number(ipv4Match[1]);
      const b1 = Number(ipv4Match[2]);
      if (b0 === 10) return false;
      if (b0 === 192 && b1 === 168) return false;
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return false;
      if (b0 === 127) return false;
      if (b0 === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function sendAlertWebhook(
  webhookUrl: string,
  data: AlertWebhookPayload,
): Promise<boolean> {
  if (!webhookUrl || !isSafeWebhookUrl(webhookUrl)) return false;

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
