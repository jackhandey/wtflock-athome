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
// HomeWatch bridge agent — run this on a machine on your home network.
// Usage:  HOMEWATCH_KEY=hw_xxx node homewatch-bridge.mjs
// RTSP cameras require ffmpeg on PATH.

import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const INGEST_URL = ${JSON.stringify(ingestUrl)};
const DEVICE_KEY = process.env.HOMEWATCH_KEY || ${JSON.stringify(keyPlaceholder)};
const CAMERAS = ${JSON.stringify(config, null, 2)};

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

async function pushFrame(camera) {
  const buffer = camera.kind === "rtsp" ? await grabRtsp(camera.url) : await grabHttp(camera.url);
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
  return result;
}

async function loop(camera) {
  for (;;) {
    try {
      const result = await pushFrame(camera);
      const label = result.stored ? \`event \${result.plate || "(no plate)"}\` : "no detection";
      console.log(new Date().toISOString(), camera.name, "->", label, result.alerted ? "ALERT" : "");
    } catch (error) {
      console.error(new Date().toISOString(), camera.name, "failed:", error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, camera.intervalSeconds * 1000));
  }
}

if (!CAMERAS.length) {
  console.error("No enabled cameras configured. Add cameras in HomeWatch, then re-download this script.");
  process.exit(1);
}
if (!DEVICE_KEY || DEVICE_KEY.startsWith("PASTE_")) {
  console.error("Set HOMEWATCH_KEY to your device key before running.");
  process.exit(1);
}

console.log(\`HomeWatch bridge starting for \${CAMERAS.length} camera(s)\`);
CAMERAS.forEach((camera) => loop(camera));
`;
}
