CREATE TABLE public.requirements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  acceptance_criteria text,
  type text NOT NULL DEFAULT 'functional',
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'must',
  source text,
  status text NOT NULL DEFAULT 'not_started',
  linked_backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.requirements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.requirements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.requirements FOR DELETE TO authenticated USING (true);