
-- Add missing columns
ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS section_number text,
  ADD COLUMN IF NOT EXISTS parent_section text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS word_count_target integer;

-- Delete all existing data
DELETE FROM public.report_sections;

-- Seed 6 main sections
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('1', 'Presentasjon', NULL, 1, 'ikke_startet', 0, 500),
  ('2', 'Brukerdokumentasjon', NULL, 2, 'ikke_startet', 0, 1500),
  ('3', 'Produktdokumentasjon', NULL, 3, 'ikke_startet', 0, 1200),
  ('4', 'Prosessdokumentasjon', NULL, 4, 'ikke_startet', 0, 2500),
  ('5', 'Refleksjon', NULL, 5, 'ikke_startet', 0, 1500),
  ('6', 'Avslutning', NULL, 6, 'ikke_startet', 0, 300);

-- Seed subsections under Presentasjon
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('1.1', 'Om prosjektet', '1', 10, 'ikke_startet', 0, 250),
  ('1.2', 'Om teamet', '1', 11, 'ikke_startet', 0, 250);

-- Seed subsections under Brukerdokumentasjon
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('2.1', 'Applikasjonens funksjonalitet', '2', 20, 'ikke_startet', 0, 400),
  ('2.2', 'Målgruppen for applikasjonen', '2', 21, 'ikke_startet', 0, 300),
  ('2.3', 'Hvilke plattformer?', '2', 22, 'ikke_startet', 0, 300),
  ('2.4', 'Hvordan og hvor kan brukere aksessere applikasjonen?', '2', 23, 'ikke_startet', 0, 500);

-- Seed subsections under Produktdokumentasjon
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('3.1', 'Kvalitetsegenskaper ved applikasjoner', '3', 30, 'ikke_startet', 0, 600),
  ('3.2', 'Hvilke API-er', '3', 31, 'ikke_startet', 0, 600);

-- Seed subsections under Prosessdokumentasjon
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('4.1', 'Smidig utvikling og verktøy', '4', 40, 'ikke_startet', 0, 700),
  ('4.2', 'Prosjektets gang', '4', 41, 'ikke_startet', 0, 700),
  ('4.3', 'Endringer i kravspesifikasjon', '4', 42, 'ikke_startet', 0, 500),
  ('4.4', 'Planlegging og gjennomføring av testing', '4', 43, 'ikke_startet', 0, 600);

-- Seed subsections under Refleksjon
INSERT INTO public.report_sections (section_number, title, parent_section, sort_order, status, word_count_goal, word_count_target) VALUES
  ('5.1', 'Tverrfaglig samarbeid', '5', 50, 'ikke_startet', 0, 500),
  ('5.2', 'Smidig utvikling', '5', 51, 'ikke_startet', 0, 500),
  ('5.3', 'Utfordringer', '5', 52, 'ikke_startet', 0, 500);
