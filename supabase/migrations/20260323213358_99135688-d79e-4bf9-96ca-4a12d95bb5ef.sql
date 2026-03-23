
-- Delete changelog entries for items not in any sprint
DELETE FROM public.backlog_changelog
WHERE backlog_item_id IN (
  SELECT id FROM public.backlog_items
  WHERE id NOT IN (SELECT DISTINCT backlog_item_id FROM public.sprint_items)
);

-- Delete subtasks for items not in any sprint
DELETE FROM public.subtasks
WHERE backlog_item_id IN (
  SELECT id FROM public.backlog_items
  WHERE id NOT IN (SELECT DISTINCT backlog_item_id FROM public.sprint_items)
);

-- Delete the backlog items themselves
DELETE FROM public.backlog_items
WHERE id NOT IN (SELECT DISTINCT backlog_item_id FROM public.sprint_items);

-- Reset the item_id sequence to continue after the highest existing number
SELECT setval('public.backlog_item_seq', COALESCE(
  (SELECT MAX(NULLIF(regexp_replace(item_id, '[^0-9]', '', 'g'), '')::int) FROM public.backlog_items),
  0
));
