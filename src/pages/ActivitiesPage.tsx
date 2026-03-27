import { useState, useCallback } from "react";
import { useActivityCatalog, useActivityRegistrations, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { PointsPlanner } from "@/components/activities/PointsPlanner";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { CatalogView } from "@/components/activities/CatalogView";
import { RegistrationsView } from "@/components/activities/RegistrationsView";
import { RegistrationModal } from "@/components/activities/RegistrationModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useMemo } from "react";

export default function ActivitiesPage() {
  const { data: catalog, isLoading: loadingCatalog } = useActivityCatalog();
  const { data: registrations, isLoading: loadingRegs } = useActivityRegistrations();
  const [tab, setTab] = useState<"catalog" | "registrations">("catalog");

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
  const regCount = regs.filter((r) => r.status === "completed" || r.status === "in_progress").length;

  const tabs = [
    { key: "catalog" as const, label: "Katalog" },
    { key: "registrations" as const, label: "Gjennomføringer", count: regCount },
  ];

  return (
    <div className="space-y-6 scroll-reveal">
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

      {/* Progress card */}
      <div className="card-elevated p-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">Opptjent: {earned}p av 30p</span>
          <span className="text-lg font-semibold text-primary tabular-nums">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Points Planner */}
      <PointsPlanner catalog={cat} registrations={regs} onClickRegistration={handlePlannerClick} />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 px-1 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              tab === t.key
                ? "font-semibold text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full tabular-nums">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "catalog" && (
        <CatalogView catalog={cat} registrations={regs} />
      )}
      {tab === "registrations" && (
        <RegistrationsView catalog={cat} registrations={regs} />
      )}

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
