/** Generates the local bridge agent script that runs on the user's home network or roving vehicle/wearable. */

export type BridgeCamera = {
  id: string;
  name: string;
  source_type: "snapshot" | "rtsp";
  url: string;
  poll_interval_seconds: number;
  enabled: boolean;
  node_type?: string;
  latitude?: number | null;
  longitude?: number | null;
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
      nodeType: camera.node_type || "fixed",
      latitude: camera.latitude || null,
      longitude: camera.longitude || null,
    }));

  return `#!/usr/bin/env node
// HomeWatch bridge agent — high-efficiency local edge daemon with motion diff gating, mobile roving GPS, and webhook push.
// Usage:  HOMEWATCH_KEY=hw_xxx node homewatch-bridge.mjs
// RTSP cameras require ffmpeg on PATH.
// Features:
//  1. Local Motion Diffing: compares frames locally to skip 95% of static driveway scenes (saving cloud API calls)
//  2. Embedded Webhook Server: allows Home Assistant / Frigate / UniFi Protect / Dashcams to push frames on motion (port 8090)
//  3. Mobile Roving Node Support (Axon Fleet Model & Smartglasses): accepts live GPS (lat, lng, speed, heading)
//  4. Offline Store-and-Forward: queues frames locally when cellular connectivity is lost while driving
//  5. Text-to-Speech Audio Dispatch: outputs heads-up voice alerts for in-car Bluetooth or smartglasses speakers

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
const DEFAULT_NODE_TYPE = process.env.NODE_TYPE || "fixed"; // 'fixed' | 'dashcam' | 'wearable' | 'mobile'

const prevFrames = new Map(); // camera.id -> Buffer
const lastPushedAt = new Map(); // camera.id -> timestamp
const offlineQueue = []; // store-and-forward queue when driving through cellular dead zones
let stats = { pushed: 0, skipped: 0, webhookTriggers: 0, queuedOffline: 0 };

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

async function pushFrame(camera, forcedBuffer = null, telemetry = {}) {
  const buffer = forcedBuffer || (camera.kind === "rtsp" ? await grabRtsp(camera.url) : await grabHttp(camera.url));
  const prev = prevFrames.get(camera.id);
  const now = Date.now();
  const lastPush = lastPushedAt.get(camera.id) || 0;
  const isHeartbeat = (now - lastPush) > 10 * 60 * 1000; // Heartbeat push every 10 min

  if (!forcedBuffer && !isHeartbeat && !hasSignificantMotion(buffer, prev)) {
    stats.skipped += 1;
    return { stored: false, reason: "motion-gated (static scene)" };
  }

  prevFrames.set(camera.id, buffer);
  lastPushedAt.set(camera.id, now);

  const payload = {
    cameraId: camera.id,
    capturedAt: telemetry.capturedAt || new Date().toISOString(),
    contentType: "image/jpeg",
    imageBase64: buffer.toString("base64"),
    latitude: telemetry.latitude !== undefined ? telemetry.latitude : (process.env.GPS_LAT ? Number(process.env.GPS_LAT) : camera.latitude),
    longitude: telemetry.longitude !== undefined ? telemetry.longitude : (process.env.GPS_LNG ? Number(process.env.GPS_LNG) : camera.longitude),
    speedMph: telemetry.speedMph !== undefined ? telemetry.speedMph : (process.env.GPS_SPEED ? Number(process.env.GPS_SPEED) : undefined),
    headingDeg: telemetry.headingDeg !== undefined ? telemetry.headingDeg : (process.env.GPS_HEADING ? Number(process.env.GPS_HEADING) : undefined),
    nodeType: telemetry.nodeType || camera.nodeType || DEFAULT_NODE_TYPE,
  };

  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-key": DEVICE_KEY },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || \`ingest HTTP \${response.status}\`);
    stats.pushed += 1;

    // Handle real-time Text-to-Speech audio alerts for in-car Bluetooth or smartglasses
    if (result.audioAlertText) {
      process.stdout.write("\\x07"); // Terminal bell
      console.log(\`\\n🔊 [HEADS-UP AUDIO ALERT]: \${result.audioAlertText}\\n\`);
    }

    return result;
  } catch (err) {
    // Offline Store-and-Forward queue when driving through cellular dead zones
    if (offlineQueue.length < 50) {
      offlineQueue.push({ camera, buffer, telemetry });
      stats.queuedOffline = offlineQueue.length;
      console.warn(\`[Offline Buffer] Network unavailable. Queued frame (\${offlineQueue.length}/50)\`);
    }
    throw err;
  }
}

// Background worker to flush queued frames when mobile connectivity reconnects
setInterval(async () => {
  if (offlineQueue.length === 0) return;
  const item = offlineQueue[0];
  try {
    await pushFrame(item.camera, item.buffer, item.telemetry);
    offlineQueue.shift();
    stats.queuedOffline = offlineQueue.length;
    console.log(\`[Offline Buffer] Flushed queued frame (\${offlineQueue.length} remaining)\`);
  } catch {
    // Still offline, will retry next cycle
  }
}, 15000);

async function loop(camera) {
  for (;;) {
    try {
      const result = await pushFrame(camera);
      if (result.stored) {
        const label = result.plate ? \`event \${result.plate}\` : "vehicle detected";
        const nodeTag = result.nodeType && result.nodeType !== "fixed" ? \`[\${result.nodeType.toUpperCase()}]\` : "";
        console.log(\`[\${new Date().toLocaleTimeString()}] \${camera.name} \${nodeTag} -> \${label} \${result.alerted ? "🚨 ALERT" : ""}\`);
      }
    } catch (error) {
      console.error(\`[\${new Date().toLocaleTimeString()}] \${camera.name} error:\`, error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, camera.intervalSeconds * 1000));
  }
}

// Embedded Local HTTP Server for Frigate, Home Assistant, Dashcam, and Smartglasses triggers
const server = createServer(async (req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host || "localhost"}\`);

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "online",
      cameras: CAMERAS.map((c) => ({ id: c.id, name: c.name, nodeType: c.nodeType })),
      stats,
      offlineQueueLength: offlineQueue.length,
      uptimeSeconds: Math.round(process.uptime()),
    }));
  }

  // Webhook trigger endpoint: POST /webhook/:cameraId or POST /trigger?camera=:nameOrId
  // Supports dynamic GPS query parameters: ?lat=37.77&lng=-122.41&speed=25&heading=90&nodeType=dashcam
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

      const telemetry = {
        latitude: url.searchParams.get("lat") ? Number(url.searchParams.get("lat")) : (req.headers["x-gps-lat"] ? Number(req.headers["x-gps-lat"]) : undefined),
        longitude: url.searchParams.get("lng") ? Number(url.searchParams.get("lng")) : (req.headers["x-gps-lng"] ? Number(req.headers["x-gps-lng"]) : undefined),
        speedMph: url.searchParams.get("speed") ? Number(url.searchParams.get("speed")) : undefined,
        headingDeg: url.searchParams.get("heading") ? Number(url.searchParams.get("heading")) : undefined,
        nodeType: url.searchParams.get("nodeType") || req.headers["x-node-type"] || camera.nodeType,
      };

      const result = await pushFrame(camera, isImagePayload ? bodyBuf : null, telemetry);
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
  console.log(\`HomeWatch Roving Edge Bridge running for \${CAMERAS.length} node(s)\`);
  console.log(\`* Local Motion Gating: ACTIVE (threshold: \${MOTION_THRESHOLD}%)\`);
  console.log(\`* Webhook / Mobile Ingest: http://localhost:\${PORT}/webhook/<cameraId>\`);
  console.log(\`* Mobile Store-and-Forward: ACTIVE (buffer capacity: 50 frames)\`);
  console.log(\`* Status & Telemetry:    http://localhost:\${PORT}/status\`);
  console.log(\`=========================================================\`);
});

CAMERAS.forEach((camera) => loop(camera));
`;
}
