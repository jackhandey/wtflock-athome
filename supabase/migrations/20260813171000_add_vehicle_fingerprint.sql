ALTER TABLE public.events
ADD COLUMN plate_state TEXT,
ADD COLUMN plate_type TEXT,
ADD COLUMN vehicle_model TEXT,
ADD COLUMN vehicle_generation TEXT,
ADD COLUMN unique_features TEXT[] DEFAULT '{}';
