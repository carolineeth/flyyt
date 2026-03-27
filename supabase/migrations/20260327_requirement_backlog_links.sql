-- ============================================================
-- STEG 1: Create junction table (ADDITIVE — no existing tables changed)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.requirement_backlog_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id text REFERENCES public.requirements(id) ON DELETE CASCADE,
  backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(requirement_id, backlog_item_id)
);

ALTER TABLE public.requirement_backlog_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read requirement_backlog_links"
  ON public.requirement_backlog_links FOR SELECT USING (true);
CREATE POLICY "Team members can insert requirement_backlog_links"
  ON public.requirement_backlog_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Team members can delete requirement_backlog_links"
  ON public.requirement_backlog_links FOR DELETE USING (true);

-- ============================================================
-- STEG 2: Copy existing links (ADDITIVE — original data preserved)
-- ============================================================

INSERT INTO public.requirement_backlog_links (requirement_id, backlog_item_id)
SELECT id, linked_backlog_item_id FROM public.requirements
WHERE linked_backlog_item_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verification: log counts so they appear in migration output
DO $$
DECLARE
  v_req_count int;
  v_backlog_count int;
  v_link_count int;
  v_old_link_count int;
BEGIN
  SELECT count(*) INTO v_req_count FROM public.requirements;
  SELECT count(*) INTO v_backlog_count FROM public.backlog_items;
  SELECT count(*) INTO v_link_count FROM public.requirement_backlog_links;
  SELECT count(*) INTO v_old_link_count FROM public.requirements WHERE linked_backlog_item_id IS NOT NULL;

  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'requirements rows: %', v_req_count;
  RAISE NOTICE 'backlog_items rows: %', v_backlog_count;
  RAISE NOTICE 'requirement_backlog_links rows: % (should equal old links: %)', v_link_count, v_old_link_count;
  RAISE NOTICE 'linked_backlog_item_id still populated: % rows', v_old_link_count;
  RAISE NOTICE '=== END VERIFICATION ===';
END $$;

-- ============================================================
-- STEG 3: Add user_story column to backlog_items (ADDITIVE)
-- ============================================================

ALTER TABLE public.backlog_items ADD COLUMN IF NOT EXISTS user_story text;
