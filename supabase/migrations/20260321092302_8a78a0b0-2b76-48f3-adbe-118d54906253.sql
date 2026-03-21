
-- Add new fields to sprints table
ALTER TABLE public.sprints
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN sprint_review_notes text,
  ADD COLUMN reflection text,
  ADD COLUMN notes text;

-- Create sprint_snapshots table
CREATE TABLE public.sprint_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  completed_points integer NOT NULL DEFAULT 0,
  items_by_type jsonb DEFAULT '{}',
  items_by_person jsonb DEFAULT '{}',
  completed_item_titles text[] DEFAULT '{}',
  incomplete_item_titles text[] DEFAULT '{}',
  daily_burndown jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sprint_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated select" ON public.sprint_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.sprint_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.sprint_snapshots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.sprint_snapshots FOR DELETE TO authenticated USING (true);

-- Create sprint_daily_stats table
CREATE TABLE public.sprint_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
  date date NOT NULL,
  remaining_points integer NOT NULL DEFAULT 0,
  completed_points integer NOT NULL DEFAULT 0,
  UNIQUE(sprint_id, date)
);

ALTER TABLE public.sprint_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated select" ON public.sprint_daily_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.sprint_daily_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.sprint_daily_stats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.sprint_daily_stats FOR DELETE TO authenticated USING (true);
