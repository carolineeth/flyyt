
CREATE TABLE public.report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  assignee_id uuid REFERENCES public.team_members(id),
  status text NOT NULL DEFAULT 'not_started',
  word_count_goal integer NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access select" ON public.report_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.report_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.report_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.report_sections FOR DELETE TO authenticated USING (true);

INSERT INTO public.report_sections (title, word_count_goal, notes, sort_order) VALUES
  ('Presentasjon og sammendrag', 500, NULL, 1),
  ('Brukerdokumentasjon', 1000, 'Skjermbilder trengs', 2),
  ('Kravspesifikasjon (backlog, user stories)', 1000, NULL, 3),
  ('Modellering (UML-diagrammer)', 800, 'Lenke til diagrammer i Git', 4),
  ('Produktdokumentasjon (arkitektur, APIer)', 1500, NULL, 5),
  ('Testdokumentasjon', 800, NULL, 6),
  ('Prosessdokumentasjon', 2000, 'Tyngst vektet!', 7),
  ('Refleksjon (tverrfaglig, smidig)', 800, NULL, 8),
  ('Avslutning (per-person)', 500, NULL, 9);
