-- Endringslogg for kravspesifikasjonen
CREATE TABLE public.requirement_changes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id text REFERENCES public.requirements(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  -- 'created' | 'updated' | 'deleted' | 'priority_changed' |
  -- 'status_changed' | 'added_to_backlog' | 'removed_from_backlog'
  field_changed text,
  old_value text,
  new_value text,
  description text,
  changed_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.requirement_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read" ON public.requirement_changes
  FOR SELECT USING (
    auth.uid() IN (
      SELECT auth_user_id FROM public.team_members WHERE auth_user_id IS NOT NULL
    )
  );

CREATE POLICY "Team members can insert" ON public.requirement_changes
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT auth_user_id FROM public.team_members WHERE auth_user_id IS NOT NULL
    )
  );

-- Index for common queries
CREATE INDEX requirement_changes_requirement_id_idx ON public.requirement_changes (requirement_id);
CREATE INDEX requirement_changes_created_at_idx ON public.requirement_changes (created_at DESC);
