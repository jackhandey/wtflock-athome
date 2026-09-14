# 🛡️ HomeWatch — Open-Source Flock Safety & Axon Fleet Alternative for Home Cameras

[![Live App](https://img.shields.io/badge/Live%20App-wtflock--athome.lovable.app-blueviolet?style=for-the-badge)](https://wtflock-athome.lovable.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Port%20Forwarding-green?style=for-the-badge)](https://wtflock-athome.lovable.app/settings)
[![Cameras](https://img.shields.io/badge/Cameras-Fixed%20%7C%20Dashcams%20%7C%20Smartglasses-blue?style=for-the-badge)](#-camera-dashcam--wearable-compatibility)
[![Integrations](https://img.shields.io/badge/Integrations-Frigate%20%7C%20UniFi%20%7C%20Home%20Assistant-orange?style=for-the-badge)](#-architecture--edge-bridge)

> **The self-hosted, privacy-first Flock Safety & Axon Fleet alternative for homeowners, HOAs, and neighborhood watches.**  
> Transform standard consumer security cameras, vehicle dashcams, and wearable smartglasses into a real-time Automated License Plate Recognition (ALPR) and vehicle intelligence mesh — **without recurring enterprise subscriptions or third-party law enforcement cloud sharing**.

---

## ⚡ Why HomeWatch? (Flock Safety & Axon Fleet vs. HomeWatch)

| Capability                                     |         Flock Safety™ / Axon Fleet 3          |                          HomeWatch Open-Source                           |
| :--------------------------------------------- | :-------------------------------------------: | :----------------------------------------------------------------------: |
| **Annual Cost**                                |       **$3,000 – $5,000 / camera / yr**       |         **100% Free & Open-Source (Pay only your AI API cents)**         |
| **Fixed Camera Hardware**                      |      Locked to vendor solar/pole cameras      |         Any RTSP / HTTP camera (Reolink, UniFi, Dahua, Amcrest)          |
| **Mobile Roving Nodes (Cruisers)**             |   Axon Fleet 3 proprietary in-car hardware    |           Any vehicle dashcam, USB camera, or smartphone mount           |
| **Wearable Surveillance**                      |           Expensive police bodycams           |       Consumer smartglasses (Ray-Ban Meta, Vuzix, Even Realities)        |
| **Data Ownership & Privacy**                   | Stored on vendor cloud; police network access |       **100% Private (Self-hosted or private Supabase with RLS)**        |
| **Automated License Plate Recognition (ALPR)** |        50-state + missing / paper tags        |     50-state + temporary paper dealer tags & missing plate detection     |
| **Visual BOLOs (Plateless Hotlists)**          |             Vehicle Fingerprint™              |     Match by Make, Model, Color, and Custom Features without a plate     |
| **Repeat-Pass ("Casing") Alerts**              |            Dispatch center alerts             |  Automatic alert on $\ge 2$ passes in 60 mins via Discord, Slack, Ntfy   |
| **Pattern-of-Life Profiling**                  |              Resident whitelist               | Automatic 30-day frequency profiling (`Resident`, `Seen 1x`, `Nx / 30d`) |
| **Accomplice / Convoy Detection**              |           Cross-camera correlation            |         Instant $\pm 60$-second multi-vehicle tandem correlation         |
| **Heads-Up Audio Alert (TTS)**                 |          In-car MDT terminal alerts           |    Real-time Text-to-Speech voice alerts for car Bluetooth or glasses    |
| **Offline Dead Zone Support**                  |             In-vehicle hub buffer             |     Offline store-and-forward queue (resilient to mobile dead zones)     |
| **Police Evidence Dossier**                    |             Printable CAD export              |     Formal PDF dossier with CAD header, photo log & Chain of Custody     |

---

## 🌟 Core Features

### 🚗 1. Mobile Roving Nodes & Dashcams (The Axon Fleet 3 Model)

Just like Axon Fleet 3 turns police cruisers into roving surveillance nodes, HomeWatch turns any vehicle into a mobile ALPR patrol scanner:

- **Windshield Dashcam / Phone Integration**: Mount a dashcam, USB webcam, or smartphone to your windshield. As you drive, it continuously samples traffic, stamps precision GPS coordinates (`latitude`, `longitude`, `speed_mph`, `heading_deg`), and uploads hits.
- **Offline Store-and-Forward Queue**: Driving through rural areas or cellular dead zones? The edge bridge automatically buffers up to 50 frames locally in memory and flushes them to the cloud the moment 5G/LTE reconnects.
- **In-Cabin Bluetooth Voice Dispatch**: When a flagged plate or suspect vehicle is sighted, HomeWatch triggers an immediate Text-to-Speech audio prompt over your car speakers (_"Warning: Stolen vehicle alert — Black Honda Civic ahead"_).

### 👓 2. Wearable Smartglasses (Ray-Ban Meta & AR Waveguides)

Turn your daily walk, bike ride, or dog walk into an active neighborhood security sweep:

- **POV Pedestrian Scanning**: Wear your Ray-Ban Meta or AR smartglasses (Vuzix, Even Realities, Rokid). Point-of-view camera frames stream to your tethered phone, attaching your walking GPS coordinates.
- **Open-Ear Audio Whispers**: When you glance at a parked car or passing vehicle that has an active neighborhood BOLO or casing alert, a private voice prompt whispers directly into your glasses temple speaker (_"Alert: Silver Elantra ahead was reported casing homes 2 days ago"_).
- **Multi-Node Mesh Correlation**: An event captured by your smartglasses seamlessly links with stationary home cameras on the GIS map.

### 🔍 3. Plateless Hotlists & Visual BOLOs (Be On the Lookout)

Target suspects even when plates are missing, stolen, obscured, or dealer paper tags:

- **Vehicle Fingerprint Matching**: Match on any combination of `Make`, `Model`, `Color`, `Plate Type`, and `Distinguishing Features` (e.g., _"Silver Honda Civic with roof rack and front bumper dent"_).
- **Require No Plate Flag**: Specifically flag suspicious vehicles operating without front/rear plates.
- **Instant Hotlist Siren & Webhooks**: Triggers real-time browser Web Audio emergency siren chimes and dispatches snapshot webhooks.

### 🚨 4. Automated Repeat-Pass ("Casing" & Prowler) Alerts

Neighborhood burglaries and vehicle prowls are routinely preceded by casing loops:

- **Temporal Loop Detection**: The ingestion pipeline automatically calculates pass recurrence. If an unfamiliar vehicle passes your neighborhood cameras $\ge 2$ times within 60 minutes, it is instantly tagged as `casing`.
- **Automated Dispatch**: Sends immediate priority push notifications to your neighborhood Discord, Home Assistant, or phone.

### 📊 5. Pattern-of-Life & Frequency Profiling

Cut down on alert fatigue and instantly separate normal neighborhood traffic from unknown outsiders:

- **Resident Auto-Classification**: Vehicles marked as residents are highlighted in emerald (`Resident`) and bypass prowler alarms.
- **30-Day Activity Frequency**: Every capture badge shows its exact 30-day recurrence (e.g., `Seen 1x (New)`, `5x / 30d`).
- **Stranger Isolation**: One-click filter to isolate vehicles seen only once in the neighborhood.

### 👥 6. Convoy & Accomplice Tracking

Criminals often travel in pairs (a lookout or chase vehicle following a stolen car):

- **Temporal Correlation Engine**: One click on any vehicle event scans all neighborhood cameras within a configurable $\pm 60$-second window.
- **Accomplice Discovery**: Uncovers trailing or leading vehicles that passed through the corridor together.

### 🗺️ 7. Dynamic GIS Map, Route Replay & Dwell Telemetry

- **Unified Fixed + Mobile Map**: Plots fixed cameras alongside moving dashcams (`🚗`), smartglasses (`👓`), and mobile phones (`📱`).
- **Animated Trajectory Replay**: Watch a suspect's step-by-step path through the neighborhood with calculated step deltas (`+2 min`) and vehicle speed/heading.
- **Dwell-Time & Flow Analysis**: Identifies entry and exit chokepoints, whether travel was transit, and how many minutes the vehicle dwelled in the area.

### 📑 8. Law Enforcement CAD Evidence Dossiers

Prepare airtight evidence for police reports, HOA security meetings, or court proceedings:

- **CAD Incident Header**: Pre-formatted with CAD Incident Number, Investigating Officer, Victim Name, and Incident Date.
- **Forensic Time-Indexed Log**: Clean, print-ready evidence layout with timestamped high-resolution plate crops, overview photos, and AI metadata.
- **Chain of Custody Attestation**: Includes an official investigator sign-off block with legal attestation, signature, badge number, and date.
- **Print to PDF**: Built-in `@media print` CSS strips application UI for clean, courtroom-ready documentation.

---

## 🏗️ Architecture & Decentralized Mesh

```
┌─────────────────────────────────────────────────────────────┐
│                 Surveillance Sensor Nodes                   │
│                                                             │
│   [Fixed Cameras]       [Vehicle Dashcams]   [Smartglasses] │
│    Porch / Mailbox        Windshield Mount    Ray-Ban / AR  │
│          │                       │                 │        │
│          ▼                       ▼                 ▼        │
│   ┌─────────────────────────────────────────────────────┐   │
│   │         HomeWatch Edge Bridge Agent                 │   │
│   │           (homewatch-bridge.mjs)                    │   │
│   │                                                     │   │
│   │  • Local Motion Diff Gating (<1.8% threshold)       │   │
│   │  • Dynamic GPS Ingestion (lat, lng, speed, heading) │   │
│   │  • Offline Store-and-Forward Buffer (50 frames)     │   │
│   │  • Embedded Webhook Push Server (:8090)             │   │
│   └─────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                    HTTPS POST (Motion Only)
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
│   • Visual BOLO Match                         • Fixed & Mobile  │
│   • Casing Detection (60m)                    • Dwell Telemetry │
│   • Convoy Correlation (±60s)                 • Route Replay    │
│   • TTS Voice Generation                      • CAD Dossier PDF │
└─────────────────────────────────────────────────────────────┘
```

---

## 📷 Camera, Dashcam & Wearable Compatibility

| Hardware Type         | Supported Systems                                     | Integration Mode                                         |
| :-------------------- | :---------------------------------------------------- | :------------------------------------------------------- |
| **Fixed IP Cameras**  | Reolink, Dahua, Hikvision, Amcrest, UniFi, Wyze       | RTSP Stream or HTTP Snapshot via bridge                  |
| **Smart Home NVRs**   | Frigate NVR, UniFi Protect, Home Assistant, Scrypted  | Webhook Push on motion directly to port `8090`           |
| **Vehicle Dashcams**  | BlackVue, VIOFO, 70mai, USB UVC webcams               | RTSP Wi-Fi or USB frame capture with GPS query params    |
| **Smartglasses / AR** | Ray-Ban Meta, Vuzix Blade 2, Even Realities G1, Rokid | Tethered smartphone companion app with GPS and TTS audio |
| **Mobile Phones**     | iOS Safari / Android Chrome PWA                       | Windshield mount with HTML5 Camera & Geolocation API     |

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

### 2. Configure Your Surveillance Nodes

1. Open the dashboard at `http://localhost:3000/cameras`.
2. Register your fixed cameras, dashcams, or wearable smartglasses.
3. Select the appropriate **Node Type** (`Fixed`, `Dashcam`, `Wearable`, `Mobile`).
4. Navigate to **Settings** (`/settings`), click **Issue Key**, and download `homewatch-bridge.mjs`.

### 3. Run the Edge Bridge

#### Stationary Home Network Mode

```bash
HOMEWATCH_KEY=hw_live_your_key_here node homewatch-bridge.mjs
```

#### Vehicle Dashcam (Cruiser Mode with USB GPS)

```bash
# In-car bridge with live GPS coordinates
HOMEWATCH_KEY=hw_live_your_key_here \
GPS_LAT=37.7749 GPS_LNG=-122.4194 GPS_SPEED=35 GPS_HEADING=180 \
NODE_TYPE=dashcam \
node homewatch-bridge.mjs
```

#### Webhook Ingest with Live GPS (Dashcams & Smartglasses)

```bash
# Push frame with dynamic GPS telemetry
curl -X POST "http://localhost:8090/webhook/YOUR_CAMERA_ID?lat=37.7749&lng=-122.4194&speed=25&heading=90&nodeType=wearable" \
  -H "Content-Type: image/jpeg" \
  --data-binary @glasses_capture.jpg
```

---

## 🔔 Alert Integrations & Heads-Up Voice Dispatch

- **Car Bluetooth & Smartglasses (TTS)**: In-cabin voice synthesis warns you of suspect vehicles hands-free.
- **Discord & Slack**: Rich embeds with full vehicle photos, plate tags, and confidence scores.
- **Home Assistant**: Trigger automated gate locks, floodlights, or TTS announcements when a BOLO is sighted.
- **Ntfy.sh / Pushover**: Instant priority push notifications to iOS and Android devices.
- **Web Audio Siren**: In-browser dual-tone alarm synthesizer for dispatch desks.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS, Radix UI, Leaflet GIS
- **Backend & API**: TanStack Start / Nitro Server Functions with streaming RPC
- **Database & Storage**: Supabase PostgreSQL with Row Level Security (RLS) & Private Object Storage
- **AI Vision Engine**: OpenAI Vision / Gemini multimodal LLM via gateway
- **Edge Bridge**: Node.js, `ffmpeg`, in-memory pixel motion diffing, offline store-and-forward queue, local HTTP push server

---

## 🔒 Security & Privacy Notice

HomeWatch was built from the ground up to protect homeowner and community privacy:

- **Zero Global Surveillance Sharing**: Data remains strictly yours. No external agencies or vendors have backdoors or federated access to your camera feeds.
- **Zero Port Forwarding**: The bridge communicates outward via TLS; you do not open any inbound ports on your home or mobile firewall.
- **Signed Private URLs**: Vehicle snapshots are stored in private buckets and rendered via short-lived signed URLs.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](file:///C:/Users/erico/Projects/wtflock-athome/LICENSE) for details.

---

<p align="center">
  <b>Keywords / Topics</b>: <i>flock safety alternative, axon fleet 3 alternative, open source alpr, diy flock camera, dashcam alpr, smartglasses alpr, ray ban meta alpr, wearable alpr, mobile alpr, home license plate reader, vehicle intelligence, frigate alpr, unifi protect alpr, visual bolo, repeat pass casing alert, convoy tracking, neighborhood watch camera</i>
</p>
