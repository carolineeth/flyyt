-- Create epics table for centralized epic management
CREATE TABLE IF NOT EXISTS public.epics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0F6E56',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.epics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can manage epics" ON public.epics FOR ALL USING (true) WITH CHECK (true);

-- Add epic_id reference to backlog_items (nullable — existing items keep working)
ALTER TABLE public.backlog_items ADD COLUMN IF NOT EXISTS epic_id uuid REFERENCES public.epics(id) ON DELETE SET NULL;

-- Migrate existing epic text values into the epics table and set epic_id
DO $$
DECLARE
  epic_name text;
  epic_uuid uuid;
BEGIN
  FOR epic_name IN
    SELECT DISTINCT epic FROM public.backlog_items WHERE epic IS NOT NULL AND epic != ''
  LOOP
    INSERT INTO public.epics (name) VALUES (epic_name) RETURNING id INTO epic_uuid;
    UPDATE public.backlog_items SET epic_id = epic_uuid WHERE epic = epic_name;
  END LOOP;
  RAISE NOTICE 'Migrated existing epics to epics table';
END $$;
