CREATE TABLE IF NOT EXISTS public.daily_team_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date date NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_team_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can manage team notes"
  ON public.daily_team_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);