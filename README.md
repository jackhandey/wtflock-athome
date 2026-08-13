# 🛡️ HomeWatch — Open-Source ALPR & Vehicle Intelligence Platform

[![Live App](https://img.shields.io/badge/Live%20App-wtflock--athome.lovable.app-blueviolet?style=for-the-badge)](https://wtflock-athome.lovable.app)
[![Built with React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev)
[![Supabase Backend](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-emerald?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Privacy First](https://img.shields.io/badge/Privacy-Zero%20Port%20Forwarding-green?style=for-the-badge)](https://wtflock-athome.lovable.app/settings)

> **The privacy-first, open-source Flock Safety alternative for home security camera systems.**  
> Transform standard RTSP & HTTP security cameras (Reolink, Hikvision, Amcrest, Wyze, UniFi) into a high-accuracy Automated License Plate Recognition (ALPR) and vehicle search intelligence network.

---

## 🌟 Features

### 🗺️ Interactive GIS Camera Map & Route Trajectory Replay
* **Spatial Camera Placement**: Plot cameras with latitude/longitude coordinates and directional vectors (*Ingress, Egress, Northbound, Southbound*).
* **Chronological Journey Tracking**: Trace vehicle movements across multiple cameras over time with numbered step markers and route polylines.
* **Animated Route Playback**: Interactive play/pause controller to replay vehicle trajectories with calculated time deltas (`+2 min`).

### 🔍 Flock-Style "Search Without a Plate" (Natural Language & Visual Search)
* **Natural Language Query**: Search camera footage using plain English (e.g., *"Red SUV with roof rack seen yesterday"*).
* **Vehicle Fingerprint Analysis**: AI vision extracts license plate text, issuing state (*CA, TX, NY*), plate type (*Temporary Paper Tag, Commercial*), vehicle model/generation (*Civic 2016-2021*), and visual attributes (`#roof_rack`, `#dented_bumper`, `#custom_wheels`, `#window_tint`).
* **Unidentified Vehicle Filtering**: One-click toggle to isolate un-plated or suspicious vehicles.

### 📂 Investigative Case Management & Police/Insurance PDF Export
* **Incident Dossier Folders**: Group camera detections, snapshot photos, and officer notes into structured case files (*e.g., CASE-2026-8192*).
* **Official Verification Sign-off**: Generates a clean, formatted evidence dossier with a built-in resident/officer attestation signature block.
* **One-Click PDF Export**: Printable CSS layout optimized for law enforcement reports, HOA board reviews, or insurance claims.

### 🚨 Instant Multi-Channel Alerts & Web Audio Siren Alarms
* **Multi-Platform Webhooks**: Dispatch rich real-time hotlist alerts with snapshot images to **Discord**, **Slack**, **Home Assistant**, **Ntfy.sh**, or **Pushover**.
* **In-Browser Siren Alarm**: Web Audio API synthesizer generates dual-tone emergency siren chimes live when a hotlist vehicle hits.
* **Real-time Dashboard**: Live streaming feed powered by Supabase Realtime subscriptions.

### 🛡️ Zero-Trust Privacy & Local Network Isolation
* **Zero Port Forwarding**: Camera passwords and stream credentials stay local to your home network.
* **PostgreSQL Row-Level Security (RLS)**: Enforced database policies guarantee no external user can access your cameras, map pins, or events.
* **Short-Lived Private Image URLs**: Snapshot storage URLs expire automatically after 1 hour.
* **SHA-256 Device Auth**: Device authentication keys are salted and hashed.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Home Network (Local IP)     │       │    HomeWatch Cloud Platform     │
│                                 │       │                                 │
│  [Camera 1] (RTSP/HTTP)         │       │  [Ingest API Endpoint]          │
│  [Camera 2] (RTSP/HTTP)         │       │            │                    │
│       │                         │       │            ▼                    │
│       ▼                         │       │  [AI Vision LLM (gpt-5.6)]      │
│  [HomeWatch Bridge Agent]       │       │            │                    │
│  (homewatch-bridge.mjs)         │ HTTPS │            ▼                    │
│       │                         │ POST  │  [Supabase DB with RLS]         │
│       └─────────────────────────┼──────►│            │                    │
│                                 │       │            ▼                    │
│                                 │       │  [Realtime GIS Map & Alerts]    │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Local Application Setup

```bash
# Clone the repository
git clone https://github.com/jackhandey/wtflock-athome.git
cd wtflock-athome

# Install dependencies
npm install

# Run local development server
npm run dev
```

### 2. Connect Your Home Cameras

1. Navigate to the **Cameras** tab in HomeWatch (`http://localhost:3000/cameras`).
2. Add your camera stream URLs and map coordinates.
3. Go to **Settings** (`/settings`) and click **Issue Key**.
4. Click **Download bridge script** (`homewatch-bridge.mjs`).
5. Run the bridge agent on any machine on your home network:

```bash
HOMEWATCH_KEY=hw_live_your_key_here node homewatch-bridge.mjs
```

> ⚡ **Pro-Tip for 95% API Cost Reduction**: Configure your camera's ONVIF/RTSP motion sensor or Home Assistant to push frames *only when a vehicle enters the frame* rather than polling continuous 24/7 frames.

---

## 📷 Camera Compatibility Cheat Sheet

| Brand | RTSP Stream URL Pattern | HTTP Snapshot URL Pattern |
| :--- | :--- | :--- |
| **Reolink** | `rtsp://admin:pass@192.168.1.50:554/h264Preview_01_main` | `http://192.168.1.50/cgi-bin/api.cgi?cmd=Snap&user=admin&password=pass` |
| **Amcrest / Dahua** | `rtsp://admin:pass@192.168.1.50:554/cam/realmonitor?channel=1&subtype=0` | `http://192.168.1.50/cgi-bin/snapshot.cgi?loginuse=admin&loginpas=pass` |
| **Hikvision** | `rtsp://admin:pass@192.168.1.50:554/Streaming/Channels/101` | `http://192.168.1.50/ISAPI/Streaming/channels/101/picture` |
| **Wyze / Tapo** | `rtsp://192.168.1.50:8554/front-porch` | N/A |
| **ESP32-CAM** | N/A | `http://192.168.1.50/capture` |

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS, Lucide Icons, Leaflet GIS Maps
* **Backend Framework**: TanStack Start / Nitro server handlers
* **Database & Storage**: Supabase PostgreSQL with Row Level Security (RLS) & Storage Buckets
* **AI Vision Engine**: OpenAI Vision via Lovable AI Gateway
* **Notification System**: Web Audio API, Webhooks (Discord, Slack, Home Assistant, Ntfy)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
