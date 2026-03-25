-- Fix Sprint 1 items_by_person snapshot data.
-- The snapshot was created before the points field was properly stored,
-- and/or collaborator_ids were not correctly reflected per individual.
-- Updates to correct per-person SP values, keyed by member UUID.

DO $$
DECLARE
  v_sprint_id uuid;
  v_elias     uuid;
  v_justas    uuid;
  v_caroline  uuid;
  v_noah      uuid;
  v_orestis   uuid;
  v_charlotte uuid;
BEGIN
  SELECT id INTO v_sprint_id
    FROM public.sprints
    WHERE lower(name) = 'sprint 1'
    LIMIT 1;

  IF v_sprint_id IS NULL THEN
    RAISE NOTICE 'Sprint 1 not found — skipping';
    RETURN;
  END IF;

  SELECT id INTO v_elias     FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'elias'     LIMIT 1;
  SELECT id INTO v_justas    FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'justas'    LIMIT 1;
  SELECT id INTO v_caroline  FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'caroline'  LIMIT 1;
  SELECT id INTO v_noah      FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'noah'      LIMIT 1;
  SELECT id INTO v_orestis   FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'orestis'   LIMIT 1;
  SELECT id INTO v_charlotte FROM public.team_members WHERE lower(split_part(name,' ',1)) = 'charlotte' LIMIT 1;

  UPDATE public.sprint_snapshots
  SET items_by_person = jsonb_strip_nulls(jsonb_build_object(
    COALESCE(v_elias::text,     'elias-missing'),     '{"assigned": 2, "completed": 2, "points": 7}'::jsonb,
    COALESCE(v_justas::text,    'justas-missing'),    '{"assigned": 2, "completed": 2, "points": 3}'::jsonb,
    COALESCE(v_caroline::text,  'caroline-missing'),  '{"assigned": 1, "completed": 1, "points": 5}'::jsonb,
    COALESCE(v_noah::text,      'noah-missing'),      '{"assigned": 1, "completed": 1, "points": 5}'::jsonb,
    COALESCE(v_orestis::text,   'orestis-missing'),   '{"assigned": 1, "completed": 1, "points": 3}'::jsonb,
    COALESCE(v_charlotte::text, 'charlotte-missing'), '{"assigned": 1, "completed": 0, "points": 0}'::jsonb,
    'Alle', '{"assigned": 2, "completed": 2, "points": 6}'::jsonb
  ))
  WHERE sprint_id = v_sprint_id;

  RAISE NOTICE 'Sprint 1 snapshot updated';
END $$;
