-- Add second-half team activities to the activity catalog
INSERT INTO public.activity_catalog
  (name, description, points, is_mandatory, category, period, period_deadline, max_occurrences, meeting_type, prosesslogg_template, sort_order)
VALUES
  -- Obligatoriske — andre halvdel
  ('Andre retrospektiv', NULL, 2, true, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 20),
  ('Identifisering av code smells og refaktorering', 'Aktiviteten er spesifisert i nettskjema: https://nettskjema.no/a/604082 — legg ved kvittering i prosessloggen.', 3, true, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 21),
  ('Datainnsamling: brukertesting', NULL, 2, true, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 22),
  -- Valgfrie — andre halvdel
  ('Enriching the backlog with quality tags', 'Aktiviteten er spesifisert i nettskjema: https://nettskjema.no/a/610541 — legg ved kvittering i prosessloggen.', 2, false, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 30),
  ('Par-programmering', NULL, 1, false, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 31),
  ('Datainnsamling: geriljatesting', NULL, 2, false, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 32),
  ('Backlog Refinement', NULL, 1, false, 'one_time', 'second_half', '2026-05-10', 1, NULL, NULL, 33)
ON CONFLICT DO NOTHING;
