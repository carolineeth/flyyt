
CREATE TABLE public.backlog_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE CASCADE NOT NULL,
  change_type text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES public.team_members(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.backlog_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.backlog_changelog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.backlog_changelog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.backlog_changelog FOR DELETE TO authenticated USING (true);
