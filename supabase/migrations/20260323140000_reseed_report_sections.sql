-- Full reset: drop all existing report_sections data and reseed correctly

DELETE FROM public.report_sections;

-- Reset sequence if any
-- (section IDs are UUIDs, no sequence to reset)

-- 6 main sections (parent_section = NULL)
INSERT INTO public.report_sections
  (section_number, title, parent_section, description, word_count_target, word_count_goal, status, sort_order)
VALUES
  ('1', 'Presentasjon',        NULL, NULL,                                                                       500,  500,  'ikke_startet', 10),
  ('2', 'Brukerdokumentasjon', NULL, 'Skrives for lesere med OG uten tekniske forkunnskaper.',                  1000, 1000, 'ikke_startet', 20),
  ('3', 'Produktdokumentasjon',NULL, 'Forutsetter at leseren kjenner løsningen fra presentasjonen.',            1500, 1500, 'ikke_startet', 30),
  ('4', 'Prosessdokumentasjon',NULL, 'Teller mest! Beskriv prosessen som ledet til produktet.',                 2500, 2500, 'ikke_startet', 40),
  ('5', 'Refleksjon',          NULL, NULL,                                                                      1000, 1000, 'ikke_startet', 50),
  ('6', 'Avslutning',          NULL, 'Viktigste lærdom per teammedlem + ett tips til neste års studenter.',      500,  500, 'ikke_startet', 60);

-- 15 subsections
INSERT INTO public.report_sections
  (section_number, title, parent_section, description, word_count_target, word_count_goal, status, sort_order)
VALUES
  -- Under Presentasjon
  ('1.1', 'Om prosjektet',         '1', 'Kort introduksjon. Hva gjør appen? Hvilket problem løser den?',                                                                  300, 300, 'ikke_startet', 11),
  ('1.2', 'Om teamet',             '1', 'Studieretninger, roller i teamet. Gjerne kort om hvert medlem.',                                                                  200, 200, 'ikke_startet', 12),

  -- Under Brukerdokumentasjon
  ('2.1', 'Applikasjonens funksjonalitet',                    '2', 'Oversikt over funksjonalitet, viktigste skjermbilder/skisser, struktur.',                             400, 400, 'ikke_startet', 21),
  ('2.2', 'Målgruppen for applikasjonen',                     '2', 'Hvem er appen for? Beskriv de fem brukergruppene.',                                                   200, 200, 'ikke_startet', 22),
  ('2.3', 'Hvilke plattformer?',                              '2', 'Android. Minimum API-nivå, testede enheter.',                                                          100, 100, 'ikke_startet', 23),
  ('2.4', 'Hvordan og hvor kan brukere aksessere applikasjonen?', '2', 'Hvordan kan brukere laste ned og kjøre appen?',                                                   100, 100, 'ikke_startet', 24),

  -- Under Produktdokumentasjon
  ('3.1', 'Kvalitetsegenskaper ved applikasjoner', '3', 'Funksjonalitet, brukskvalitet, pålitelighet. Brukerundersøkelser og evalueringsmetoder.',                        800, 800, 'ikke_startet', 31),
  ('3.2', 'Hvilke API-er',                         '3', 'Victoria WMS, MetAlerts, Locationforecast. Hvorfor valgt, eventuelle utfordringer.',                            700, 700, 'ikke_startet', 32),

  -- Under Prosessdokumentasjon
  ('4.1', 'Smidig utvikling og verktøy',            '4', 'ScrumBan-metodikk, Flyt, Trello→Flyt-migrasjon, GitHub, Figma. Eventuelle endringer underveis.',               600, 600, 'ikke_startet', 41),
  ('4.2', 'Prosjektets gang',                       '4', 'Overordnet oversikt over iterasjonene. IKKE dagbok-form — sprint-oppsummeringer. Bruk eksport fra Flyt.',      800, 800, 'ikke_startet', 42),
  ('4.3', 'Endringer i kravspesifikasjon',          '4', 'Hva ble endret og hvorfor? F.eks. brukergrupper som ble droppet/lagt til.',                                    400, 400, 'ikke_startet', 43),
  ('4.4', 'Planlegging og gjennomføring av testing','4', 'Mål med testingen, testverktøy (JUnit, Espresso?), enhetstester, integrasjonstester.',                         700, 700, 'ikke_startet', 44),

  -- Under Refleksjon
  ('5.1', 'Tverrfaglig samarbeid', '5', 'Hvordan fungerte samarbeid mellom designer (Caroline) og utviklere?',                                                            400, 400, 'ikke_startet', 51),
  ('5.2', 'Smidig utvikling',      '5', 'Fungerte ScrumBan? Effekt av sprint planning, review, retro? Bruk data fra Flyt.',                                               400, 400, 'ikke_startet', 52),
  ('5.3', 'Utfordringer',          '5', 'Hva var vanskelig? Teknisk, samarbeid, tidspress?',                                                                              200, 200, 'ikke_startet', 53);

-- Verify: must be exactly 21 rows
DO $$
DECLARE
  row_count integer;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.report_sections;
  IF row_count != 21 THEN
    RAISE EXCEPTION 'Expected 21 rows in report_sections, got %', row_count;
  END IF;
END $$;
