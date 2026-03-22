
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  date date NOT NULL,
  category text NOT NULL DEFAULT 'intern',
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  is_fixed boolean NOT NULL DEFAULT true,
  priority text NOT NULL DEFAULT 'normal',
  linked_activity_id uuid REFERENCES public.activity_catalog(id) ON DELETE SET NULL,
  linked_sprint_id uuid REFERENCES public.sprints(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access select" ON public.milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.milestones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.milestones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.milestones FOR DELETE TO authenticated USING (true);
