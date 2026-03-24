CREATE TABLE public.requirements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  acceptance_criteria text,
  type text NOT NULL DEFAULT 'functional',
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'must',
  source text,
  status text NOT NULL DEFAULT 'not_started',
  linked_backlog_item_id uuid REFERENCES public.backlog_items(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access select" ON public.requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated full access insert" ON public.requirements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated full access update" ON public.requirements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access delete" ON public.requirements FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON public.requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Funksjonelle krav
INSERT INTO public.requirements (id, title, description, acceptance_criteria, type, category, priority, source, status, sort_order) VALUES
('FK-01','Vis temperaturkartlag','Applikasjonen skal vise temperatur som et kartlag på kartet.','Temperaturlaget vises som synlig kartlag, kan slås av/på','functional','Værkart','must','Case 4','not_started',100),
('FK-02','Vis nedbørskartlag','Applikasjonen skal vise nedbør som et kartlag på kartet.','Nedbørslaget tilgjengelig som valgbart kartlag','functional','Værkart','must','Case 4','not_started',101),
('FK-03','Vis vindkartlag','Applikasjonen skal vise vind som et kartlag på kartet.','Vindlaget viser vindstyrke og retning','functional','Værkart','must','Case 4','not_started',102),
('FK-04','Bytte mellom kartlag','Bruker skal kunne velge aktivt kartlag via et kontrollpanel.','Kontrollpanel lar bruker velge ett kartlag om gangen','functional','Værkart','must','Case 4','not_started',103),
('FK-05','Riktig modell per region','Applikasjonen skal bruke MEPS for Norden, AROME for Arktis og EC for resten.','MEPS for Norden, AROME for Arktis, EC for resten','functional','Værkart','must','Case 4','not_started',104),
('FK-06','Tidslinje-kontroll','Applikasjonen skal ha en slider eller tidskontroll for navigasjon i tid.','Slider eller tidskontroll tilgjengelig','functional','Tidslinje','must','Case 4','not_started',110),
('FK-07','10 dagers tidshorisont','Bruker skal kunne navigere opptil 10 dager frem i tid.','Bruker kan navigere opptil 10 dager frem','functional','Tidslinje','must','Case 4','not_started',111),
('FK-08','Animasjon av kartlag','Applikasjonen skal kunne animere kartlag gjennom tidssteg.','Avspillingsfunksjon animerer kartlag gjennom tidssteg','functional','Tidslinje','should','Case 4','not_started',112),
('FK-09','Farevarsler som polygoner','Farevarsler skal vises som fargede polygon-områder på kartet.','Farevarsler vises som fargede områder på kartet','functional','Farevarsler','must','Case 4','not_started',120),
('FK-10','MeteoAlarm-integrasjon','Applikasjonen skal hente europeiske farevarsler fra MeteoAlarm.','Europeiske farevarsler fra MeteoAlarm','functional','Farevarsler','should','Case 4','not_started',121),
('FK-11','MetAlerts som fallback','Norske farevarsler fra MetAlerts skal brukes som fallback.','Norske farevarsler fra MetAlerts som fallback','functional','Farevarsler','must','Case 4','not_started',122),
('FK-12','Farevarsel-detaljer ved trykk','Trykk på farevarsel-polygon skal vise type fare og gyldighetsperiode.','Trykk på polygon viser type fare og gyldighetsperiode','functional','Farevarsler','should','Case 4','not_started',123),
('FK-13','Punktdata ved kartklikk','Trykk på kartet skal vise et informasjonspanel med lokalt værvarsel.','Trykk på kart viser informasjonspanel med værvarsel','functional','Punktdata','should','Case 4','not_started',130),
('FK-14','Farevarsel i punktdata','Aktive farevarsler for valgt punkt skal vises i informasjonspanelet.','Aktive farevarsler vises i punktinformasjonspanelet','functional','Punktdata','should','Case 4','not_started',131),
('FK-15','Kartsøk på stedsnavn','Bruker skal kunne søke på stedsnavn og kartet sentreres til valgt sted.','Bruker kan søke stedsnavn og kartet sentreres','functional','Punktdata','could','Case 4','not_started',132),
('FK-16','Sanntids lyndata','Applikasjonen skal vise lynobservasjoner fra Frost i nær sanntid.','Lynobservasjoner fra Frost i nær sanntid','functional','Tillegg','could','Case 4','not_started',140),
('FK-17','Historiske lynnedslag','Historiske lyndata skal kunne filtreres på tidsperiode.','Historiske lyndata filtrerbare på tidsperiode','functional','Tillegg','could','Case 4','not_started',141),
('FK-18','Historiske observasjoner','Historiske observasjoner skal kunne søkes for valgt sted.','Historiske observasjoner søkbare for valgt sted','functional','Tillegg','could','Case 4','not_started',142);

-- Seed: Ikke-funksjonelle krav
INSERT INTO public.requirements (id, title, description, acceptance_criteria, type, category, priority, source, status, sort_order) VALUES
('NFK-01','Kotlin som språk','All kode skal skrives i Kotlin.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',200),
('NFK-02','Jetpack Compose for UI','Brukergrensesnittet skal implementeres med Jetpack Compose.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',201),
('NFK-03','MVVM og UDF-arkitektur','Applikasjonen skal følge MVVM-arkitektur med Unidirectional Data Flow.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',202),
('NFK-04','Logisk mappestruktur','Prosjektet skal ha en logisk og konsistent mappestruktur.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',203),
('NFK-05','Engelsk kode','All kode, kommentarer og variabelnavn skal være på engelsk.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',204),
('NFK-06','Kodelesbarhet og dokumentasjon','Koden skal være lesbar og dokumentert med KDoc der det er hensiktsmessig.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',205),
('NFK-07','GitHub versjonskontroll','All kode skal versjonsstyres i GitHub med meningsfulle commit-meldinger.',null,'non_functional','Arkitektur','must','Produktkrav','not_started',206),
('NFK-08','Ingen krasj på valgt API-level','Applikasjonen skal ikke krasje på det valgte minimum API-nivået.',null,'non_functional','Robusthet','must','Produktkrav','not_started',210),
('NFK-09','Feilhåndtering ved nettverksfeil','Applikasjonen skal håndtere nettverksfeil med passende feilmeldinger til bruker.',null,'non_functional','Robusthet','must','Produktkrav','not_started',211),
('NFK-10','Asynkrone API-kall','Alle nettverkskall skal være asynkrone og ikke blokkere UI-tråden.',null,'non_functional','Robusthet','must','Produktkrav','not_started',212),
('NFK-11','IFI Proxy for API-kall','API-kall mot eksterne tjenester skal gå via IFI-proxyen.',null,'non_functional','Robusthet','must','Produktkrav','not_started',213),
('NFK-12','Android Activity Lifecycle','Applikasjonen skal håndtere Android Activity Lifecycle korrekt.',null,'non_functional','Robusthet','must','Produktkrav','not_started',214),
('NFK-13','Minimere IDE-advarsler','Koden skal ha minimalt med IDE-advarsler.',null,'non_functional','Robusthet','should','Produktkrav','not_started',215),
('NFK-14','Minimum 10 enhetstester','Prosjektet skal inneholde minimum 10 enhetstester.',null,'non_functional','Testing','must','Produktkrav','not_started',220),
('NFK-15','Responsivt layout','Brukergrensesnittet skal fungere godt på ulike skjermstørrelser.',null,'non_functional','Tilgjengelighet','must','Produktkrav','not_started',230),
('NFK-16','WCAG 2.1-hensyn','Applikasjonen skal ta hensyn til WCAG 2.1-retningslinjer der det er mulig.',null,'non_functional','Tilgjengelighet','must','Produktkrav','not_started',231);

-- Seed: Dokumentasjonskrav
INSERT INTO public.requirements (id, title, description, acceptance_criteria, type, category, priority, source, status, sort_order) VALUES
('DK-01','README.md','Prosjektet skal ha en README.md med instruksjoner for oppsett og kjøring.',null,'documentation','Dokumentasjon','must','Produktkrav','not_started',300),
('DK-02','ARCHITECTURE.md','Prosjektet skal dokumentere arkitekturvalg i en ARCHITECTURE.md.',null,'documentation','Dokumentasjon','must','Produktkrav','not_started',301),
('DK-03','MODELING.md','Prosjektet skal dokumentere modellering og UML-diagrammer i en MODELING.md.',null,'documentation','Dokumentasjon','must','Produktkrav','not_started',302);
