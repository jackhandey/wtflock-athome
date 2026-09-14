# 🛡️ HomeWatch — Open-Source Flock Safety Alternative for Home Cameras

[![Live App](https://img.shields.io/badge/Live%20App-wtflock--athome.lovable.app-blueviolet?style=for-the-badge)](https://wtflock-athome.lovable.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Port%20Forwarding-green?style=for-the-badge)](https://wtflock-athome.lovable.app/settings)
[![Cameras](https://img.shields.io/badge/Cameras-RTSP%20%7C%20ONVIF%20%7C%20HTTP-blue?style=for-the-badge)](#-camera--nvr-compatibility)
[![Integrations](https://img.shields.io/badge/Integrations-Frigate%20%7C%20UniFi%20%7C%20Home%20Assistant-orange?style=for-the-badge)](#-smart-edge-bridge--nvr-integrations)

> **The self-hosted, privacy-first Flock Safety alternative for homeowners, HOAs, and neighborhood watches.**  
> Transform standard consumer security cameras (Reolink, UniFi Protect, Dahua, Hikvision, Amcrest, Wyze) into a real-time Automated License Plate Recognition (ALPR) and vehicle intelligence network — **without Flock's $3,000+/year per-camera subscription or third-party law enforcement cloud sharing**.

---

## ⚡ Why HomeWatch? (Flock Safety vs. HomeWatch)

| Capability | Flock Safety™ Enterprise | HomeWatch Open-Source |
| :--- | :---: | :---: |
| **Annual Cost** | **$3,000 – $3,500 / camera / yr** | **100% Free & Open-Source (Pay only your AI API cents)** |
| **Camera Hardware** | Locked to proprietary solar/pole cameras | Any RTSP / HTTP camera (Reolink, UniFi, Dahua, Amcrest) |
| **Data Ownership & Privacy** | Stored on vendor cloud; police network access | **100% Private (Self-hosted or private Supabase with RLS)** |
| **Automated License Plate Recognition (ALPR)** | Full 50-state + missing / paper tags | Full 50-state + temporary paper tag & missing plate detection |
| **Visual BOLOs (Plateless Hotlists)** | Vehicle Fingerprint™ | Match by Make, Model, Color, and Custom Features without a plate |
| **Repeat-Pass ("Casing") Alerts** | Audio / Dispatch alerts | Automatic alert on $\ge 2$ passes in 60 mins via Discord, Slack, Ntfy |
| **Pattern-of-Life Profiling** | Resident whitelist | Automatic 30-day frequency profiling (`Resident`, `Seen 1x`, `Nx / 30d`) |
| **Accomplice / Convoy Detection** | Cross-camera correlation | Instant $\pm 60$-second multi-vehicle tandem correlation |
| **GIS Ingress/Egress Dwell Analysis** | Chokepoint tracking | Entrance/exit camera identification & neighborhood dwell-time metrics |
| **Police Evidence Dossier** | Printable CAD export | Formal PDF dossier with CAD header, photo log & Chain of Custody |
| **Smart NVR Integration** | None (closed ecosystem) | Native push server for **Frigate NVR**, **UniFi Protect**, and **Home Assistant** |

---

## 🌟 Core Features

### 🔍 1. Plateless Hotlists & Visual BOLOs (Be On the Lookout)
Target suspects even when plates are missing, stolen, obscured, or temporary paper dealer tags:
- **Vehicle Fingerprint Matching**: Match on any combination of `Make`, `Model`, `Color`, `Plate Type`, and `Distinguishing Features` (e.g., _"Silver Honda Civic with roof rack and front bumper dent"_).
- **Require No Plate Flag**: Specifically flag suspicious vehicles operating without front/rear plates.
- **Instant Hotlist Siren & Webhooks**: Triggers real-time browser Web Audio emergency siren chimes and dispatches snapshot webhooks.

### 🚨 2. Automated Repeat-Pass ("Casing" & Prowler) Alerts
Neighborhood burglaries and vehicle prowls are routinely preceded by casing runs:
- **Temporal Loop Detection**: The ingestion pipeline automatically calculates vehicle pass frequency. If an unfamiliar vehicle passes your cameras $\ge 2$ times within a 60-minute window, it is instantly tagged as `casing`.
- **Automated Dispatch**: Sends immediate priority push notifications to your neighborhood Discord, Home Assistant, or phone.

### 📊 3. Pattern-of-Life & Frequency Profiling
Cut down on alert fatigue and instantly separate normal traffic from unknown outsiders:
- **Resident Auto-Classification**: Vehicles marked as residents are highlighted in emerald (`Resident`) and bypass prowler alarms.
- **30-Day Activity Frequency**: Every capture badge shows its exact 30-day recurrence (e.g., `Seen 1x (New)`, `5x / 30d`).
- **Stranger Isolation**: One-click filter to isolate vehicles seen only once in the neighborhood.

### 👥 4. Convoy & Accomplice Tracking
Criminals often travel in pairs (a scout or chase vehicle following a stolen car):
- **Temporal Correlation Engine**: One click on any vehicle event scans all neighborhood cameras within a configurable $\pm 60$-second window.
- **Accomplice Discovery**: Uncovers trailing or leading vehicles that passed through the same corridor together.

### 🗺️ 5. GIS Map, Route Playback & Dwell-Time Telemetry
- **Interactive Neighborhood Map**: Plot cameras with GPS coordinates, field-of-view cones, and directional flow vectors (*Ingress / Egress / Northbound / Southbound*).
- **Animated Trajectory Replay**: Watch a suspect's step-by-step path through the neighborhood with calculated step deltas (`+2 min`).
- **Dwell-Time & Flow Analysis**: Automatically identifies which camera the vehicle entered from, which camera it exited, whether it was direct transit, and exactly how many minutes it dwelled inside the neighborhood.

### 📑 6. Law Enforcement CAD Evidence Dossiers
Prepare airtight evidence for police reports, HOA security meetings, or court proceedings:
- **CAD Incident Header**: Pre-formatted with CAD Incident Number, Investigating Officer, Victim Name, and Incident Date.
- **Forensic Time-Indexed Log**: Clean, print-ready evidence layout with timestamped high-resolution plate crops, overview photos, and AI metadata.
- **Chain of Custody Attestation**: Includes an official investigator sign-off block with legal attestation, signature, badge number, and date.
- **Print to PDF**: Built-in `@media print` CSS strips application UI for clean, courtroom-ready documentation.

### 🌙 7. Night-Vision & Retroreflective Plate Optimization
- **IR Glare Compensation**: Multimodal AI prompt engineering specifically tuned for overexposed, blooming infrared night-vision plates.
- **Temporary Paper Tags**: Robust recognition of dealer paper tags, out-of-state formats, and commercial markings.

---

## 🏗️ Architecture & Edge Bridge

HomeWatch keeps your camera credentials and video streams **100% inside your local network**. Zero port forwarding is required.

```
┌─────────────────────────────────────────────────────────────┐
│                 Local Home / HOA Network                    │
│                                                             │
│   [Reolink / Dahua / UniFi / Hikvision / Amcrest Cameras]    │
│                 │                             │             │
│            RTSP Stream                  HTTP Snapshot       │
│                 ▼                             ▼             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │         HomeWatch Edge Bridge Agent                 │   │
│   │           (homewatch-bridge.mjs)                    │   │
│   │                                                     │   │
│   │  • Local Motion Diff Gating (<1.8% pixel threshold) │   │
│   │  • Embedded Webhook Push Server (:8090)             │   │
│   │    Accepts direct Frigate / UniFi / HA pushes       │   │
│   │  • Zero credentials leave local network             │   │
│   └─────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                    HTTPS POST (On Motion Only)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    HomeWatch Cloud Platform                 │
│                                                             │
│   [Ingest API Endpoint] ──► [Vision ALPR Engine]            │
│                                   │                         │
│                                   ▼                         │
│                    [Supabase Database (with RLS)]           │
│                                   │                         │
│            ┌──────────────────────┴──────────────────────┐  │
│            ▼                                             ▼  │
│   [Intelligence Engine]                       [Realtime GIS Map]
│   • Visual BOLO Match                         • Ingress/Egress  │
│   • Casing Detection (60m)                    • Dwell Telemetry │
│   • Convoy Correlation (±60s)                 • Route Replay    │
│   • Resident Profiling                        • CAD Dossier PDF │
└─────────────────────────────────────────────────────────────┘
```

---

## 📷 Camera & NVR Compatibility

HomeWatch works with virtually any RTSP, ONVIF, or HTTP camera, as well as smart home NVRs:

| System / Brand | Stream / Trigger Type | Connection Pattern |
| :--- | :--- | :--- |
| **Frigate NVR** | Webhook Push (Port 8090) | `curl -X POST http://bridge-ip:8090/webhook/cam-id -F "image=@snapshot.jpg"` |
| **UniFi Protect** | RTSP or Home Assistant Push | `rtsps://192.168.1.1:7441/{token}?enableSrtp` |
| **Reolink** | RTSP or HTTP Snapshot | `rtsp://admin:pass@192.168.1.50:554/h264Preview_01_main` |
| **Dahua / Amcrest** | RTSP or HTTP Snapshot | `rtsp://admin:pass@192.168.1.50:554/cam/realmonitor?channel=1&subtype=0` |
| **Hikvision** | RTSP or ISAPI Snapshot | `rtsp://admin:pass@192.168.1.50:554/Streaming/Channels/101` |
| **Scrypted / Blue Iris** | Webhook Push or RTSP | Trigger snapshot directly into bridge endpoint |
| **Wyze / Tapo** | RTSP / Webhook | `rtsp://192.168.1.50:8554/front-street` |

---

## 🚀 Quick Start

### 1. Launch the Platform
```bash
# Clone the repository
git clone https://github.com/jackhandey/wtflock-athome.git
cd wtflock-athome

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Configure Your Cameras
1. Open the dashboard at `http://localhost:3000/cameras`.
2. Add your camera stream details, street GPS coordinates, and directional vector (*Ingress / Egress*).
3. Navigate to **Settings** (`/settings`), click **Issue Key**, and download `homewatch-bridge.mjs`.

### 3. Run the Edge Bridge
Run the lightweight bridge on any Raspberry Pi, NAS, Home Assistant server, or home computer:
```bash
HOMEWATCH_KEY=hw_live_your_key_here node homewatch-bridge.mjs
```

#### Running as a Background Service with Systemd (Linux / Raspberry Pi)
```bash
sudo tee /etc/systemd/system/homewatch-bridge.service <<EOF
[Unit]
Description=HomeWatch Edge Bridge Agent
After=network.target

[Service]
Environment=HOMEWATCH_KEY=hw_live_your_key_here
ExecStart=/usr/bin/node /opt/homewatch/homewatch-bridge.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now homewatch-bridge
```

### 4. Push Events from Frigate / Home Assistant (Optional)
If you already use Frigate or Home Assistant AI to detect cars, push directly into the bridge's local HTTP listener:
```bash
# Direct push to bridge listening on port 8090
curl -X POST http://localhost:8090/webhook/YOUR_CAMERA_ID \
  -H "Content-Type: image/jpeg" \
  --data-binary @car_snapshot.jpg
```

---

## 🔔 Alert Integrations

HomeWatch includes native support for instant alerting:
- **Discord**: Rich embeds with full vehicle photos, plate tags, and confidence scores.
- **Home Assistant**: Trigger automated gate locks, floodlights, or TTS announcements when a BOLO is sighted.
- **Ntfy.sh / Pushover**: Instant priority push notifications to iOS and Android devices.
- **Web Audio Siren**: In-browser dual-tone alarm synthesizer for dispatch desks.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS, Radix UI, Leaflet GIS
- **Backend & API**: TanStack Start / Nitro Server Functions with streaming RPC
- **Database & Storage**: Supabase PostgreSQL with Row Level Security (RLS) & Private Object Storage
- **AI Vision Engine**: OpenAI Vision / Gemini multimodal LLM via gateway
- **Edge Bridge**: Node.js, `ffmpeg`, in-memory pixel motion diffing, native HTTP listener

---

## 🔒 Security & Privacy Notice

HomeWatch was built from the ground up to protect homeowner privacy:
- **No Global Police Surveillance Network**: Data remains strictly yours. No external agencies have backdoors or federated search access to your home cameras.
- **Zero Port Forwarding**: The bridge communicates outward via TLS; you do not open any inbound ports on your home firewall.
- **Signed Private URLs**: Vehicle snapshots are stored in private buckets and rendered via short-lived signed URLs.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](file:///C:/Users/erico/Projects/wtflock-athome/LICENSE) for details.

---

<p align="center">
  <b>Keywords / Topics</b>: <i>flock safety alternative, open source alpr, diy flock camera, home license plate reader, vehicle intelligence, frigate alpr, unifi protect alpr, visual bolo, repeat pass detection, casing alert, convoy tracking, neighborhood watch camera</i>
</p>
