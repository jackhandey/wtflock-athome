ALTER TABLE public.cameras
ADD COLUMN latitude NUMERIC(10, 7),
ADD COLUMN longitude NUMERIC(10, 7),
ADD COLUMN facing_direction TEXT DEFAULT 'Ingress';
