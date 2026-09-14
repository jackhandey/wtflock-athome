-- Migration: Add Mobile Roving Nodes (Dashcam / Wearable / Smartglasses / Mobile Phone) & Dynamic Telemetry
ALTER TABLE public.cameras
ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'fixed';

-- Add dynamic GPS and roving telemetry to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS speed_mph DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS heading_deg DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS node_type TEXT DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS audio_alert_text TEXT;
