import { useState, useCallback, useMemo, useEffect } from "react";
import { useActivityCatalog, useActivityRegistrations, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { PointsPlanner, getRegWeek, calcWeekPoints } from "@/components/activities/PointsPlanner";
import { CatalogView } from "@/components/activities/CatalogView";
import { RegistrationsView } from "@/components/activities/RegistrationsView";
import { RegistrationModal } from "@/components/activities/RegistrationModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ChevronRight } from "lucide-react";

export default function ActivitiesPage() {
  const { data: catalog, isLoading: loadingCatalog } = useActivityCatalog();
  const { data: registrations, isLoading: loadingRegs } = useActivityRegistrations();

  // Default to registrations tab
  const [tab, setTab] = useState("registrations");

  // Planner collapsed state, persisted in localStorage
  const [plannerOpen, setPlannerOpen] = useState(() => {
    try { return localStorage.getItem("activities-planner-open") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("activities-planner-open", String(plannerOpen)); } catch {}
  }, [plannerOpen]);

  // Modal state for planner clicks
  const [plannerModalOpen, setPlannerModalOpen] = useState(false);
  const [plannerCatalog, setPlannerCatalog] = useState<CatalogItem | null>(null);
  const [plannerReg, setPlannerReg] = useState<Registration | null>(null);

  const handlePlannerClick = useCallback((reg: Registration, cat: CatalogItem) => {
    setPlannerCatalog(cat);
    setPlannerReg(reg);
    setPlannerModalOpen(true);
  }, []);

  if (loadingCatalog || loadingRegs) {
    return <div className="p-8 text-muted-foreground">Laster aktiviteter...</div>;
  }

  const cat = catalog || [];
  const regs = registrations || [];

  // Calculate earned & planned using mandatory-exempt logic
  const weekMap: Record<number, Registration[]> = {};
  regs.forEach((r) => {
    const w = getRegWeek(r);
    if (w != null) {
      if (!weekMap[w]) weekMap[w] = [];
      weekMap[w].push(r);
    }
  });

  let earned = 0;
  let planned = 0;
  Object.values(weekMap).forEach((weekRegs) => {
    const calc = calcWeekPoints(weekRegs, cat);
    earned += calc.mandatoryEarned + calc.optionalEarned;
    planned += calc.mandatoryPlanned + calc.optionalPlanned;
  });
  const remaining = Math.max(30 - earned - planned, 0);

  const progressPct = Math.min((earned / 30) * 100, 100);

  // Status line info
  const mandatoryCats = cat.filter((c) => c.is_mandatory && c.period === "first_half");
  const mandatoryRemaining = mandatoryCats.filter((c) => {
    const catRegs = regs.filter((r) => r.catalog_id === c.id);
    return !catRegs.some((r) => r.status === "completed");
  }).length;

  const weeksOverLimit = Object.entries(weekMap).filter(([, weekRegs]) => {
    const optionalCount = weekRegs.filter((r) => {
      const c = cat.find((ci) => ci.id === r.catalog_id);
      return c && !c.is_mandatory;
    }).length;
    return optionalCount > 3;
  }).length;

  // Registrations count + missing details
  const activeRegs = regs.filter((r) => r.status === "completed" || r.status === "in_progress");
  const missingDetails = activeRegs.filter((r) => !(r.timing_rationale && r.description && r.experiences && r.reflections)).length;

  const statusParts: string[] = [];
  if (mandatoryRemaining > 0) statusParts.push(`${mandatoryRemaining} obligatoriske gjenstår`);
  if (weeksOverLimit > 0) statusParts.push(`${weeksOverLimit} uke${weeksOverLimit > 1 ? "r" : ""} med for mange valgfrie`);

  return (
    <div className="space-y-4 scroll-reveal">
      <PageHeader
        title="Aktivitets-tracker"
        description={
          <span className="inline-flex items-center gap-1">
            Teamaktiviteter teller 30% av prosjektkarakteren.
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                Maks 3 valgfrie aktiviteter gir poeng per uke. Obligatoriske er unntatt denne grensen.
              </TooltipContent>
            </Tooltip>
          </span>
        }
      />

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Opptjent: <strong className="text-foreground">{earned}p</strong> av 30p</span>
          <span className="text-muted-foreground tabular-nums">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />

        {/* Compact status line */}
        {statusParts.length > 0 && (
          <p className="text-xs text-muted-foreground">{statusParts.join(" · ")}</p>
        )}

        {/* Compact metric line */}
        <p className="text-[13px]">
          <span className="text-primary font-medium">{earned}p opptjent</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-info font-medium">{planned}p planlagt</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">{remaining}p gjenstår</span>
        </p>
      </div>

      {/* Collapsible Planner */}
      <div>
        <button
          onClick={() => setPlannerOpen(!plannerOpen)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-medium"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${plannerOpen ? "rotate-90" : ""}`} />
          Poengplanlegger
        </button>
        {plannerOpen && (
          <div className="mt-3 animate-fade-in">
            <PointsPlanner catalog={cat} registrations={regs} onClickRegistration={handlePlannerClick} />
          </div>
        )}
      </div>

      {/* Catalog / Registrations tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registrations">
            Gjennomføringer
            {activeRegs.length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
                {activeRegs.length}
              </span>
            )}
            {missingDetails > 0 && (
              <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
                {missingDetails} mangler
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog">Katalog</TabsTrigger>
        </TabsList>
        <TabsContent value="registrations" className="mt-4">
          <RegistrationsView catalog={cat} registrations={regs} />
        </TabsContent>
        <TabsContent value="catalog" className="mt-4">
          <CatalogView catalog={cat} registrations={regs} />
        </TabsContent>
      </Tabs>

      {/* Modal for planner clicks */}
      {plannerCatalog && (
        <RegistrationModal
          open={plannerModalOpen}
          onOpenChange={setPlannerModalOpen}
          catalogItem={plannerCatalog}
          registration={plannerReg}
          allRegistrations={regs}
        />
      )}
    </div>
  );
}
