ALTER TABLE public.user_settings
ADD COLUMN webhook_url TEXT,
ADD COLUMN webhook_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN sound_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
