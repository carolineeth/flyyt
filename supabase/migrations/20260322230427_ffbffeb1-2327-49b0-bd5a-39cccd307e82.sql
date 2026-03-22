CREATE TABLE public.prosesslogg_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  added_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  category text NOT NULL DEFAULT 'annet',
  linked_registration_id uuid REFERENCES public.activity_registrations(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prosesslogg_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.prosesslogg_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.prosesslogg_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.prosesslogg_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.prosesslogg_notes FOR DELETE TO authenticated USING (true);