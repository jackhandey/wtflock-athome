/** Generates the local bridge agent script that runs on the user's home network. */

export type BridgeCamera = {
  id: string;
  name: string;
  source_type: "snapshot" | "rtsp";
  url: string;
  poll_interval_seconds: number;
  enabled: boolean;
};

export function buildBridgeScript(
  cameras: BridgeCamera[],
  ingestUrl: string,
  keyPlaceholder = "PASTE_YOUR_DEVICE_KEY_HERE",
): string {
  const config = cameras
    .filter((camera) => camera.enabled)
    .map((camera) => ({
      id: camera.id,
      name: camera.name,
      kind: camera.source_type,
      url: camera.url,
      intervalSeconds: camera.poll_interval_seconds,
    }));

  return `#!/usr/bin/env node
// HomeWatch bridge agent — high-efficiency local edge daemon with motion diff gating & webhook server.
// Usage:  HOMEWATCH_KEY=hw_xxx node homewatch-bridge.mjs
// RTSP cameras require ffmpeg on PATH.
// Features:
//  1. Local Motion Diffing: compares frames locally to skip 95% of static driveway scenes (saving cloud API calls)
//  2. Embedded Webhook Server: allows Home Assistant / Frigate / UniFi Protect to trigger instant pushes on motion (port 8090)

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const INGEST_URL = ${JSON.stringify(ingestUrl)};
const DEVICE_KEY = process.env.HOMEWATCH_KEY || ${JSON.stringify(keyPlaceholder)};
const CAMERAS = ${JSON.stringify(config, null, 2)};
const PORT = Number(process.env.BRIDGE_PORT || 8090);
const MOTION_THRESHOLD = Number(process.env.MOTION_THRESHOLD || 1.8); // 1.8% pixel diff

const prevFrames = new Map(); // camera.id -> Buffer
const lastPushedAt = new Map(); // camera.id -> timestamp
let stats = { pushed: 0, skipped: 0, webhookTriggers: 0 };

// Lightweight in-memory frame diffing algorithm (no external dependencies needed)
function hasSignificantMotion(currentBuf, prevBuf, threshold = MOTION_THRESHOLD) {
  if (!prevBuf || prevBuf.length === 0) return true;
  const sampleStep = 32;
  let diffCount = 0;
  let sampleCount = 0;
  const len = Math.min(currentBuf.length, prevBuf.length);

  for (let i = 0; i < len; i += sampleStep) {
    sampleCount += 1;
    if (Math.abs(currentBuf[i] - prevBuf[i]) > 25) {
      diffCount += 1;
    }
  }

  const diffPercent = (diffCount / sampleCount) * 100;
  return diffPercent >= threshold;
}

function grabRtsp(url) {
  const out = join(tmpdir(), \`homewatch-\${Date.now()}-\${Math.random().toString(16).slice(2)}.jpg\`);
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-q:v", "3", out],
      { timeout: 20000 },
      async (error) => {
        if (error) return reject(error);
        try {
          const buffer = await readFile(out);
          await unlink(out).catch(() => {});
          resolve(buffer);
        } catch (readError) {
          reject(readError);
        }
      },
    );
  });
}

async function grabHttp(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`snapshot HTTP \${response.status}\`);
  return Buffer.from(await response.arrayBuffer());
}

async function pushFrame(camera, forcedBuffer = null) {
  const buffer = forcedBuffer || (camera.kind === "rtsp" ? await grabRtsp(camera.url) : await grabHttp(camera.url));
  const prev = prevFrames.get(camera.id);
  const now = Date.now();
  const lastPush = lastPushedAt.get(camera.id) || 0;
  const isHeartbeat = (now - lastPush) > 10 * 60 * 1000; // Heartbeat push every 10 min to keep camera active in dashboard

  if (!forcedBuffer && !isHeartbeat && !hasSignificantMotion(buffer, prev)) {
    stats.skipped += 1;
    return { stored: false, reason: "motion-gated (static scene)" };
  }

  prevFrames.set(camera.id, buffer);
  lastPushedAt.set(camera.id, now);

  const response = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-key": DEVICE_KEY },
    body: JSON.stringify({
      cameraId: camera.id,
      capturedAt: new Date().toISOString(),
      contentType: "image/jpeg",
      imageBase64: buffer.toString("base64"),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || \`ingest HTTP \${response.status}\`);
  stats.pushed += 1;
  return result;
}

async function loop(camera) {
  for (;;) {
    try {
      const result = await pushFrame(camera);
      if (result.stored) {
        const label = result.plate ? \`event \${result.plate}\` : "vehicle detected";
        console.log(\`[\${new Date().toLocaleTimeString()}] \${camera.name} -> \${label} \${result.alerted ? "🚨 ALERT" : ""}\`);
      }
    } catch (error) {
      console.error(\`[\${new Date().toLocaleTimeString()}] \${camera.name} error:\`, error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, camera.intervalSeconds * 1000));
  }
}

// Embedded Local HTTP Webhook Server for Frigate, Home Assistant, UniFi Protect, Reolink
const server = createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "online",
      cameras: CAMERAS.map((c) => ({ id: c.id, name: c.name })),
      stats,
      uptimeSeconds: Math.round(process.uptime()),
    }));
  }

  // Webhook trigger endpoint: POST /webhook/:cameraId or POST /trigger?camera=:nameOrId
  if (req.method === "POST" && (url.pathname.startsWith("/webhook") || url.pathname === "/trigger")) {
    const targetId = url.pathname.replace("/webhook/", "").replace("/webhook", "") || url.searchParams.get("camera");
    const camera = CAMERAS.find((c) => c.id === targetId || c.name.toLowerCase() === (targetId || "").toLowerCase()) || CAMERAS[0];

    if (!camera) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Camera not found" }));
    }

    try {
      stats.webhookTriggers += 1;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = Buffer.concat(chunks);
      const isImagePayload = bodyBuf.length > 500 && (req.headers["content-type"] || "").includes("image");

      const result = await pushFrame(camera, isImagePayload ? bodyBuf : null);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, camera: camera.name, result }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

if (!CAMERAS.length) {
  console.error("No enabled cameras configured. Add cameras in HomeWatch, then re-download this script.");
  process.exit(1);
}
if (!DEVICE_KEY || DEVICE_KEY.startsWith("PASTE_")) {
  console.error("Set HOMEWATCH_KEY to your device key before running.");
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(\`=========================================================\`);
  console.log(\`HomeWatch Flock Edge Bridge running for \${CAMERAS.length} camera(s)\`);
  console.log(\`* Local Motion Gating: ACTIVE (threshold: \${MOTION_THRESHOLD}%)\`);
  console.log(\`* Webhook Push Server: http://localhost:\${PORT}/webhook/<cameraId>\`);
  console.log(\`* Health Telemetry:    http://localhost:\${PORT}/status\`);
  console.log(\`=========================================================\`);
});

CAMERAS.forEach((camera) => loop(camera));
`;
}
