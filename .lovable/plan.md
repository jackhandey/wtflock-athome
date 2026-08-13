# HomeWatch — a Flock-style system for your own cameras

A private, single-user version of the plate-reader/alerting idea, running against your home cameras.

## How the pieces fit

Browsers can't open RTSP streams, and your cameras sit behind your router — so the system has two halves:

```text
[Your cameras] --RTSP/HTTP snapshot--> [Local bridge agent on your network]
                                              | HTTPS POST (device key)
                                              v
                                    [HomeWatch Cloud: events DB + images]
                                              ^
                                              | login
                                        [Web dashboard]
```

The bridge is a small script you run on a machine at home (Mac mini, NAS, Raspberry Pi). It grabs a still from each camera every few seconds, sends it up, and the cloud side runs AI detection on it.

## What gets built

**1. Cameras**
Add a camera with name, location, snapshot URL or RTSP URL, and polling interval. Credentials stored as secrets, never shown back in the UI. Enable/disable per camera.

**2. AI detection pipeline**
Each uploaded frame goes to a vision model that returns: vehicles (make guess, color, body type), license plate text + confidence, and people count. Frames with nothing of interest are discarded so storage stays small; frames with a detection become an event with its snapshot saved.

**3. Live dashboard**
Grid of camera tiles showing the latest frame plus a live-updating event feed. Tiles show "last seen X ago" and go stale/offline when the bridge stops reporting.

**4. Watchlist + alerts**
Add plates (with notes and a reason: expected, suspicious, blocked) or mark a plate from any event. When a watchlisted plate is detected, an alert is raised: banner in the dashboard, alert inbox with acknowledge, plus optional email. Fuzzy matching so a one-character OCR miss still hits.

**5. Search & export**
Filter events by date range, camera, plate (partial), vehicle color/type, or person-detected. Download a single snapshot, or export a filtered set as a zip plus a CSV log with timestamps and camera names.

**6. Auth**
Single account login on Lovable Cloud, all data private to you. Everything sits behind login except the bridge's upload endpoint, which authenticates with a per-device key you generate in settings.

## Technical notes

- Lovable Cloud (Postgres + storage + auth) gets enabled: tables for `cameras`, `events`, `detections`, `watchlist_plates`, `alerts`, `device_keys`; RLS scoped to your user id; snapshots in a private storage bucket with signed URLs.
- Detection runs server-side through Lovable AI (Gemini vision) on the uploaded frame — real detection, not mocks. Plate text is normalized (O/0, I/1) before watchlist matching.
- Frame ingest is a public API route under `/api/public/ingest` that verifies the device key HMAC before accepting anything; all other logic uses server functions.
- The bridge agent ships as a downloadable Node script generated from your camera config: it uses ffmpeg for RTSP grabs and plain fetch for HTTP snapshot cameras. It's the one piece that runs outside Lovable, on your home network.
- Retention setting (e.g. keep 30 days) with a scheduled cleanup so storage doesn't grow forever.

## Order of work

1. Cloud + auth + schema
2. Camera management and device keys
3. Ingest endpoint + AI detection + event storage
4. Dashboard and event feed
5. Watchlist and alerts
6. Search and export
7. Bridge agent script + setup instructions

## Honest limits

Plate accuracy depends heavily on camera placement — a general vision model reads clear, near, well-lit plates well and struggles with angled/fast/night shots. Expect to tune camera position. If accuracy matters a lot later, a dedicated ALPR service can slot in behind the same pipeline.
