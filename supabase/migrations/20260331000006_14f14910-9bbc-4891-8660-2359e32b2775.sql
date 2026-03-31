CREATE TABLE public.requirement_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id text,
  change_type text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  description text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.requirement_changes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.requirement_changes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.requirement_changes FOR DELETE TO authenticated USING (true);