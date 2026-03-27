-- Create junction table for requirement-backlog links
CREATE TABLE IF NOT EXISTS public.requirement_backlog_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id text NOT NULL,
  backlog_item_id uuid NOT NULL REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  UNIQUE (requirement_id, backlog_item_id)
);

ALTER TABLE public.requirement_backlog_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated select" ON public.requirement_backlog_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.requirement_backlog_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.requirement_backlog_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete" ON public.requirement_backlog_links FOR DELETE TO authenticated USING (true);

-- Add avatar_url to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS avatar_url text;