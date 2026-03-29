-- Add sprint planning/review workflow fields and edit changelog
-- All new columns are nullable so existing sprint records remain valid

-- Planning session fields
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS sprint_planning_notes text;
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS planning_completed_at timestamptz;
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS planning_participants text[]; -- member IDs

-- Review session fields (sprint_review_notes already exists)
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS review_completed_at timestamptz;
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS review_participants text[]; -- member IDs

-- Edit changelog: stored as JSONB array on the sprint
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS edit_changelog jsonb DEFAULT '[]'::jsonb;

-- Task completion events: stored on the snapshot
ALTER TABLE public.sprint_snapshots ADD COLUMN IF NOT EXISTS completion_events jsonb DEFAULT '[]'::jsonb;
-- Structure: [{ taskId, taskName, storyPoints, completedAt, completedBy }]

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Sprint planning/review fields added successfully';
END $$;
