-- Reset backlog: remove items never assigned to a sprint, and clear changelog

-- 1. Clear changelog completely (also avoids FK issues before delete)
TRUNCATE TABLE public.backlog_changelog;

-- 2. Delete backlog items that have NEVER been in any sprint
DELETE FROM public.backlog_items
WHERE id NOT IN (
  SELECT DISTINCT backlog_item_id FROM public.sprint_items
);
