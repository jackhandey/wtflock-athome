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

export async function sendAlertWebhook(webhookUrl: string, data: AlertWebhookPayload): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith("http")) return false;

  try {
    const isDiscord = webhookUrl.includes("discord.com/api/webhooks");
    const isSlack = webhookUrl.includes("hooks.slack.com");

    let body: any;

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
    });

    return res.ok;
  } catch (err) {
    console.error("Webhook dispatch failed:", err);
    return false;
  }
}
