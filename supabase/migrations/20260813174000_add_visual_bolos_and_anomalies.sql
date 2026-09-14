-- Migration: Add Visual BOLOs, Resident Whitelisting, and Anomaly Alert fields
ALTER TABLE public.watchlist_plates
ALTER COLUMN plate DROP NOT NULL,
ALTER COLUMN plate_normalized DROP NOT NULL;

ALTER TABLE public.watchlist_plates
ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'plate',
ADD COLUMN IF NOT EXISTS target_make TEXT,
ADD COLUMN IF NOT EXISTS target_model TEXT,
ADD COLUMN IF NOT EXISTS target_color TEXT,
ADD COLUMN IF NOT EXISTS target_plate_type TEXT,
ADD COLUMN IF NOT EXISTS target_feature TEXT,
ADD COLUMN IF NOT EXISTS require_no_plate BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_resident BOOLEAN NOT NULL DEFAULT false;

-- Enhance alerts table for casing/anomaly alerts and BOLO notes
ALTER TABLE public.alerts
ADD COLUMN IF NOT EXISTS alert_type TEXT NOT NULL DEFAULT 'watchlist',
ADD COLUMN IF NOT EXISTS notes TEXT;
