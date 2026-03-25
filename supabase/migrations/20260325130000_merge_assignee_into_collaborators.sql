-- Merge assignee_id into collaborator_ids for all backlog items where:
-- - assignee_id is set
-- - assignee_id is not already in the collaborator_ids array
UPDATE public.backlog_items
SET collaborator_ids = array_append(COALESCE(collaborator_ids, '{}'), assignee_id)
WHERE assignee_id IS NOT NULL
  AND (
    collaborator_ids IS NULL
    OR NOT (collaborator_ids @> ARRAY[assignee_id])
  );
