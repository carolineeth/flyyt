
CREATE TABLE public.daily_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  content text,
  category text,
  backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, entry_date)
);

ALTER TABLE public.daily_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.daily_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.daily_updates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.daily_updates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_daily_updates_updated_at
  BEFORE UPDATE ON public.daily_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
