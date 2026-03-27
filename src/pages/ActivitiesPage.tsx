import { useState, useCallback } from "react";
import { useActivityCatalog, useActivityRegistrations, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { PointsPlanner } from "@/components/activities/PointsPlanner";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { CatalogView } from "@/components/activities/CatalogView";
import { RegistrationsView } from "@/components/activities/RegistrationsView";
import { RegistrationModal } from "@/components/activities/RegistrationModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useMemo } from "react";

export default function ActivitiesPage() {
  const { data: catalog, isLoading: loadingCatalog } = useActivityCatalog();
  const { data: registrations, isLoading: loadingRegs } = useActivityRegistrations();
  const [tab, setTab] = useState("catalog");

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

  const earned = calcTotalEarnedPoints(regs, cat);

  const progressPct = Math.min((earned / 30) * 100, 100);

  return (
    <div className="space-y-8 scroll-reveal">
      <PageHeader
        title="Aktivitets-tracker"
        description={
          <span className="inline-flex items-center gap-1">
            Teamaktiviteter teller 30% av prosjektkarakteren. Maks 3 valgfrie aktiviteter gir poeng per uke.
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px] text-xs">
                Grensen på 3 aktiviteter per uke gjelder kun valgfrie aktiviteter. Obligatoriske aktiviteter gir alltid poeng og teller ikke mot denne grensen.
              </TooltipContent>
            </Tooltip>
          </span>
        }
      />

      {/* Points overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Opptjent: <strong className="text-foreground">{earned}p</strong> av 30p</span>
          <span className="text-muted-foreground tabular-nums">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Points Planner */}
      <PointsPlanner catalog={cat} registrations={regs} onClickRegistration={handlePlannerClick} />

      {/* Catalog / Registrations tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="catalog">Katalog</TabsTrigger>
          <TabsTrigger value="registrations">
            Gjennomføringer
            {regs.filter((r) => r.status === "completed" || r.status === "in_progress").length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">
                {regs.filter((r) => r.status === "completed" || r.status === "in_progress").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <CatalogView catalog={cat} registrations={regs} />
        </TabsContent>
        <TabsContent value="registrations" className="mt-4">
          <RegistrationsView catalog={cat} registrations={regs} />
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
