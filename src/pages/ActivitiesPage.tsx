import { useState } from "react";
import { useActivityCatalog, useActivityRegistrations } from "@/hooks/useActivityCatalog";
import { PointsPlanner } from "@/components/activities/PointsPlanner";
import { CatalogView } from "@/components/activities/CatalogView";
import { RegistrationsView } from "@/components/activities/RegistrationsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export default function ActivitiesPage() {
  const { data: catalog, isLoading: loadingCatalog } = useActivityCatalog();
  const { data: registrations, isLoading: loadingRegs } = useActivityRegistrations();
  const [tab, setTab] = useState("catalog");

  if (loadingCatalog || loadingRegs) {
    return <div className="p-8 text-muted-foreground">Laster aktiviteter...</div>;
  }

  const cat = catalog || [];
  const regs = registrations || [];

  // Summary
  const earned = regs
    .filter((r) => r.status === "completed")
    .reduce((s, r) => {
      const c = cat.find((c) => c.id === r.catalog_id);
      return s + (c?.points ?? 0);
    }, 0);
  const progressPct = Math.min((earned / 30) * 100, 100);

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Aktivitets-tracker"
        description="Teamaktiviteter teller 30% av prosjektkarakteren. Maks 3 aktiviteter gir poeng per uke."
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
      <PointsPlanner catalog={cat} registrations={regs} />

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
    </div>
  );
}
