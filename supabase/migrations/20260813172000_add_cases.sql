CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  description TEXT,
  investigator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cases_own" ON public.cases FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.case_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_events TO authenticated;
GRANT ALL ON public.case_events TO service_role;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_events_own" ON public.case_events FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.cases WHERE cases.id = case_events.case_id AND cases.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases WHERE cases.id = case_events.case_id AND cases.user_id = auth.uid()));

CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
