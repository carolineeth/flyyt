-- Add new columns to support hierarchical report structure
ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS section_number text,
  ADD COLUMN IF NOT EXISTS parent_section text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS word_count_target integer;

-- Clear old seed data
DELETE FROM public.report_sections;

-- Seed hierarchical structure matching Overleaf document
INSERT INTO public.report_sections
  (section_number, title, parent_section, description, word_count_target, status, sort_order, word_count_goal)
VALUES
  ('1',   'Presentasjon',                    null, null,                                                                                                                                           500,  'ikke_startet', 10, 500),
  ('1.1', 'Om prosjektet',                   '1',  'Kort introduksjon. Hva gjør appen? Hvilket problem løser den?',                                                                                300,  'ikke_startet', 11, 300),
  ('1.2', 'Om teamet',                       '1',  'Studieretninger, roller i teamet. Gjerne kort om hvert medlem.',                                                                               200,  'ikke_startet', 12, 200),

  ('2',   'Brukerdokumentasjon',             null, 'Skrives for lesere med OG uten tekniske forkunnskaper.',                                                                                      1000, 'ikke_startet', 20, 1000),
  ('2.1', 'Applikasjonens funksjonalitet',   '2',  'Oversikt over funksjonalitet, viktigste skjermbilder/skisser, struktur.',                                                                     400,  'ikke_startet', 21, 400),
  ('2.2', 'Målgruppen for applikasjonen',    '2',  'Hvem er appen for? Beskriv de fem brukergruppene.',                                                                                           200,  'ikke_startet', 22, 200),
  ('2.3', 'Hvilke plattformer?',             '2',  'Android. Minimum API-nivå, testede enheter.',                                                                                                 100,  'ikke_startet', 23, 100),
  ('2.4', 'Hvordan og hvor kan brukere aksessere applikasjonen?', '2', 'Hvordan kan brukere laste ned og kjøre appen?',                                                                           100,  'ikke_startet', 24, 100),

  ('3',   'Produktdokumentasjon',            null, 'Forutsetter at leseren kjenner løsningen fra presentasjonen.',                                                                                1500, 'ikke_startet', 30, 1500),
  ('3.1', 'Kvalitetsegenskaper ved applikasjoner', '3', 'Funksjonalitet, brukskvalitet, pålitelighet. Brukerundersøkelser og evalueringsmetoder.',                                                800,  'ikke_startet', 31, 800),
  ('3.2', 'Hvilke API-er',                   '3',  'Victoria WMS, MetAlerts, Locationforecast. Hvorfor valgt, eventuelle utfordringer.',                                                          700,  'ikke_startet', 32, 700),

  ('4',   'Prosessdokumentasjon',            null, 'Teller mest! Beskriv prosessen som ledet til produktet.',                                                                                     2500, 'ikke_startet', 40, 2500),
  ('4.1', 'Smidig utvikling og verktøy',     '4',  'ScrumBan-metodikk, Flyt, Trello→Flyt-migrasjon, GitHub, Figma. Eventuelle endringer underveis.',                                             600,  'ikke_startet', 41, 600),
  ('4.2', 'Prosjektets gang',                '4',  'Overordnet oversikt over iterasjonene. IKKE dagbok-form — sprint-oppsummeringer. Bruk eksport fra Flyt.',                                     800,  'ikke_startet', 42, 800),
  ('4.3', 'Endringer i kravspesifikasjon',   '4',  'Hva ble endret og hvorfor? F.eks. brukergrupper som ble droppet/lagt til.',                                                                   400,  'ikke_startet', 43, 400),
  ('4.4', 'Planlegging og gjennomføring av testing', '4', 'Mål med testingen, testverktøy (JUnit, Espresso?), enhetstester, integrasjonstester.',                                                 700,  'ikke_startet', 44, 700),

  ('5',   'Refleksjon',                      null, null,                                                                                                                                          1000, 'ikke_startet', 50, 1000),
  ('5.1', 'Tverrfaglig samarbeid',           '5',  'Hvordan fungerte samarbeid mellom designer (Caroline) og utviklere?',                                                                         400,  'ikke_startet', 51, 400),
  ('5.2', 'Smidig utvikling',               '5',  'Fungerte ScrumBan? Effekt av sprint planning, review, retro? Bruk data fra Flyt.',                                                            400,  'ikke_startet', 52, 400),
  ('5.3', 'Utfordringer',                    '5',  'Hva var vanskelig? Teknisk, samarbeid, tidspress?',                                                                                           200,  'ikke_startet', 53, 200),

  ('6',   'Avslutning',                      null, 'Viktigste lærdom per teammedlem + ett tips til neste års studenter.',                                                                         500,  'ikke_startet', 60, 500);
