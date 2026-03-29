-- Add quality tags to backlog items and refinement session tracking
-- All new columns are nullable — existing data unaffected

-- Quality tags on backlog items (array of strings)
ALTER TABLE public.backlog_items ADD COLUMN IF NOT EXISTS quality_tags text[] DEFAULT '{}';

-- Refinement sessions table
CREATE TABLE IF NOT EXISTS public.backlog_refinement_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  tasks_added integer DEFAULT 0,
  tasks_reestimated integer DEFAULT 0,
  tasks_reprioritized integer DEFAULT 0,
  participants text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.backlog_refinement_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage refinement sessions"
  ON public.backlog_refinement_sessions FOR ALL USING (true) WITH CHECK (true);

-- Estimation changelog on backlog items (track SP changes)
ALTER TABLE public.backlog_items ADD COLUMN IF NOT EXISTS estimate_changelog jsonb DEFAULT '[]'::jsonb;
