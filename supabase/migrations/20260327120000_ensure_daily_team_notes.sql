-- Ensure daily_team_notes table exists (idempotent re-creation)
-- The original migration may have been skipped by the deploy pipeline.

CREATE TABLE IF NOT EXISTS public.daily_team_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_team_notes_entry_date_key UNIQUE (entry_date)
);

ALTER TABLE public.daily_team_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then recreate
DO $$
BEGIN
  DROP POLICY IF EXISTS "Team members can manage team notes" ON public.daily_team_notes;
  CREATE POLICY "Team members can manage team notes"
    ON public.daily_team_notes
    FOR ALL
    USING (true)
    WITH CHECK (true);
END $$;
