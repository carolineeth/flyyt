
-- activity_catalog table
CREATE TABLE public.activity_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  points integer NOT NULL DEFAULT 1,
  is_mandatory boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'one_time',
  period text NOT NULL DEFAULT 'anytime',
  period_deadline date,
  max_occurrences integer NOT NULL DEFAULT 1,
  meeting_type text,
  prosesslogg_template text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.activity_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.activity_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.activity_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.activity_catalog FOR DELETE TO authenticated USING (true);

-- Seed activity_catalog
INSERT INTO public.activity_catalog (name, description, points, is_mandatory, category, period, period_deadline, max_occurrences, meeting_type, prosesslogg_template, sort_order) VALUES
  ('Ukentlige møter med veileder', 'Gjennomfør ukentlige møter med veileder og dokumenter action points', 1, false, 'meeting_based', 'anytime', NULL, 4, 'veiledermøte', 'Action points etter møtet', 1),
  ('Smidige møter: Daily Standup', 'Gjennomfør daily standup med hele teamet', 1, false, 'meeting_based', 'anytime', NULL, 1, 'daily_standup', 'Beskriv hvordan dere gjennomførte standup', 2),
  ('Smidige møter: Sprint Planning', 'Gjennomfør sprint planning med backlog-gjennomgang og sprint goal', 1, false, 'meeting_based', 'anytime', NULL, 1, 'sprint_planning', 'Beskriv hvordan dere gjennomførte sprint planning', 3),
  ('Smidige møter: Sprint Review', 'Gjennomfør sprint review med demo og feedback', 1, false, 'meeting_based', 'anytime', NULL, 1, 'sprint_review', 'Beskriv hvordan dere gjennomførte sprint review', 4),
  ('Forelesning med JetBrains', 'Delta på og reflekter over forelesning med JetBrains', 1, true, 'one_time', 'first_half', '2026-04-05', 1, NULL, 'Hva lærte dere? Skal dere anvende noe av det?', 10),
  ('Innsiktsarbeid: intervju/spørreskjema', 'Gjennomfør brukerinnsikt gjennom intervju eller spørreskjema', 2, true, 'one_time', 'first_half', '2026-04-05', 1, NULL, 'Årsak til datainnsamlingen, metoder brukt, diskusjon av resultater', 11),
  ('Mobb-programmering (min. 1 time)', 'Gjennomfør mobb-programmering i minst 1 time med hele teamet', 2, true, 'one_time', 'first_half', '2026-04-05', 1, 'mobb_programmering', 'Legg ved bilde, lenke til kode/commit, tid per person, refleksjoner', 12),
  ('Gjennomføre workshop', 'Planlegg og gjennomfør en workshop med teamet', 2, false, 'one_time', 'first_half', '2026-04-05', 1, 'workshop', 'Formål, agenda, type workshop, kilde, refleksjoner', 13),
  ('Første retrospektiv', 'Gjennomfør det første retrospektivet (f.eks. sailboat)', 2, true, 'one_time', 'first_half', '2026-04-05', 1, 'retrospective', 'Hvordan gjennomført, verktøy brukt, hva fungerer, forbedringspunkter', 14),
  ('Demo av MVP/POC', 'Demonstrer MVP eller proof-of-concept for teamet/veileder', 2, true, 'one_time', 'first_half', '2026-04-05', 1, NULL, 'Skjermbilder, lenke til MVP-commit', 15),
  ('Arkitekturskisse og dataflyt for MVP', 'Lag en skisse av arkitekturen og dataflyt for MVP', 1, false, 'one_time', 'first_half', '2026-04-05', 1, NULL, 'Skisse over struktur og dataflyt', 16),
  ('TDD på 3 features', 'Skriv tester først for tre features', 2, false, 'one_time', 'first_half', '2026-04-05', 1, NULL, 'ViewModel-test, Repository-test, API-test, illustrasjon av TDD-prosess', 17),
  ('Egendefinert aktivitet', 'Definer og gjennomfør en egenvalgt aktivitet', 1, false, 'one_time', 'anytime', NULL, 1, NULL, 'Hva, hvorfor, hvordan', 50);

-- activity_registrations table
CREATE TABLE public.activity_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.activity_catalog(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  completed_date date,
  completed_week integer,
  occurrence_number integer NOT NULL DEFAULT 1,
  planned_week integer,
  linked_meeting_id uuid REFERENCES public.meetings(id),
  linked_sub_session_id uuid REFERENCES public.meeting_sub_sessions(id),
  timing_rationale text,
  description text,
  experiences text,
  reflections text,
  attachment_links text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.activity_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.activity_registrations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.activity_registrations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.activity_registrations FOR DELETE TO authenticated USING (true);

-- activity_registration_participants table
CREATE TABLE public.activity_registration_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.activity_registrations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  UNIQUE(registration_id, member_id)
);
ALTER TABLE public.activity_registration_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access select" ON public.activity_registration_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.activity_registration_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.activity_registration_participants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.activity_registration_participants FOR DELETE TO authenticated USING (true);
