-- Add item ID arrays and recalculation timestamp to sprint_snapshots
ALTER TABLE public.sprint_snapshots ADD COLUMN IF NOT EXISTS item_ids uuid[] DEFAULT '{}';
ALTER TABLE public.sprint_snapshots ADD COLUMN IF NOT EXISTS done_item_ids uuid[] DEFAULT '{}';
ALTER TABLE public.sprint_snapshots ADD COLUMN IF NOT EXISTS recalculated_at timestamptz;
