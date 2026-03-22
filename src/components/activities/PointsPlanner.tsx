import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import { useUpdateRegistration, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { toast } from "sonner";

const WEEK_RANGES: Record<number, string> = {
  10: "3.–8. mars", 11: "9.–15. mars", 12: "16.–22. mars", 13: "23.–29. mars",
  14: "30. mars–5. apr", 15: "6.–12. apr", 16: "13.–19. apr", 17: "20.–26. apr",
  18: "27. apr–3. mai", 19: "4.–10. mai",
};

function getCurrentWeek(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getRegWeek(r: Registration): number | null {
  if (r.status === "completed" && r.completed_week) return r.completed_week;
  return r.planned_week ?? null;
}

/** Calculate effective points for a week respecting the mandatory-exempt rule */
function calcWeekPoints(weekRegs: Registration[], catalog: CatalogItem[]) {
  let mandatoryPoints = 0;
  let optionalPoints = 0;
  let optionalCount = 0;
  let mandatoryEarned = 0;
  let mandatoryPlanned = 0;
  let optionalEarned = 0;
  let optionalPlanned = 0;

  weekRegs.forEach((r) => {
    const cat = catalog.find((c) => c.id === r.catalog_id);
    if (!cat) return;
    const pts = cat.points;
    const isCompleted = r.status === "completed";

    if (cat.is_mandatory) {
      mandatoryPoints += pts;
      if (isCompleted) mandatoryEarned += pts;
      else mandatoryPlanned += pts;
    } else {
      optionalCount++;
      optionalPoints += pts;
      if (isCompleted) optionalEarned += pts;
      else optionalPlanned += pts;
    }
  });

  const effectiveOptional = Math.min(optionalPoints, 3);
  const effectiveOptionalEarned = Math.min(optionalEarned, 3);
  const effectiveOptionalPlanned = Math.min(optionalPlanned, Math.max(3 - optionalEarned, 0));

  return {
    mandatoryPoints,
    optionalPoints,
    optionalCount,
    effectiveOptional,
    total: mandatoryPoints + effectiveOptional,
    mandatoryEarned,
    mandatoryPlanned,
    optionalEarned: effectiveOptionalEarned,
    optionalPlanned: effectiveOptionalPlanned,
    overLimit: optionalCount > 3,
  };
}

interface PointsPlannerProps {
  catalog: CatalogItem[];
  registrations: Registration[];
  onClickRegistration?: (reg: Registration, cat: CatalogItem) => void;
}

export function PointsPlanner({ catalog, registrations, onClickRegistration }: PointsPlannerProps) {
  const updateReg = useUpdateRegistration();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const currentWeek = getCurrentWeek();

  const weekData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const week = i + 10;
      const weekRegs = registrations.filter((r) => getRegWeek(r) === week);
      const calc = calcWeekPoints(weekRegs, catalog);
      return { week, registrations: weekRegs, ...calc };
    });
  }, [registrations, catalog]);

  const unplanned = useMemo(() => registrations.filter((r) => getRegWeek(r) === null), [registrations]);

  const handleDragStart = (e: React.DragEvent, regId: string) => {
    setDraggedId(regId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", regId);
  };

  const handleDrop = useCallback((e: React.DragEvent, week: number | null) => {
    e.preventDefault();
    const regId = e.dataTransfer.getData("text/plain");
    if (!regId) return;
    setDraggedId(null);
    updateReg.mutate(
      { id: regId, planned_week: week } as any,
      { onSuccess: () => toast.success(week ? `Planlagt til uke ${week}` : "Fjernet fra planlegging") }
    );
  }, [updateReg]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Dra aktiviteter inn i ukene</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <div
            className="shrink-0 w-36 rounded-lg border-2 border-dashed border-muted p-2 min-h-[180px] bg-muted/30"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Uplanlagt</p>
            <div className="space-y-1">
              {unplanned.map((r) => {
                const cat = catalog.find((c) => c.id === r.catalog_id);
                if (!cat) return null;
                return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} />;
              })}
            </div>
          </div>

          {weekData.map((w) => {
            const isCurrentWeek = w.week === currentWeek;
            const isDeadlineBorder = w.week === 15;
            return (
              <div key={w.week} className="flex">
                {isDeadlineBorder && (
                  <div className="flex flex-col items-center mx-1 shrink-0 relative">
                    <div className="w-0 h-full border-l-2 border-dashed border-destructive" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                      Frist 5. apr
                    </div>
                  </div>
                )}
                <div
                  className={`shrink-0 w-28 rounded-lg border-2 p-2 min-h-[180px] transition-colors ${
                    isCurrentWeek ? "border-info bg-info/5" : draggedId ? "border-dashed border-primary/30 bg-primary/5" : "border-border bg-card"
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, w.week)}
                >
                  <div className="text-center mb-2">
                    <p className={`text-xs font-semibold ${isCurrentWeek ? "text-info" : ""}`}>Uke {w.week}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight">{WEEK_RANGES[w.week]}</p>
                  </div>
                  <div className="space-y-1 mb-2">
                    {w.registrations.map((r) => {
                      const cat = catalog.find((c) => c.id === r.catalog_id);
                      if (!cat) return null;
                      return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} />;
                    })}
                  </div>
                  <div className={`text-center text-xs font-bold tabular-nums rounded px-1 py-0.5 ${
                    w.overLimit ? "bg-destructive/15 text-destructive" : w.total > 0 ? "text-primary" : "text-muted-foreground"
                  }`}>{w.total > 0 ? `${w.total}p` : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RegBlock({ reg, cat, onDragStart, isDragging, onClick }: { reg: Registration; cat: CatalogItem; onDragStart: (e: React.DragEvent, id: string) => void; isDragging: boolean; onClick?: () => void }) {
  const isCompleted = reg.status === "completed";
  const isMandatory = cat.is_mandatory;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, reg.id)}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`text-[10px] leading-tight rounded px-1.5 py-1 cursor-pointer active:cursor-grabbing transition-all flex items-start gap-1 hover:ring-1 hover:ring-primary/40 ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
      } ${isCompleted ? "bg-primary/15 text-primary" : "bg-blue-50 text-blue-700"} ${
        isMandatory ? "border-t-2 border-t-[#E07A5F]" : ""
      }`}
    >
      <GripVertical className="h-3 w-3 shrink-0 mt-px opacity-40" />
      <span className="flex-1 min-w-0">
        <span className="line-clamp-2">{cat.name}</span>
        <span className="font-semibold ml-0.5">{cat.points}p</span>
      </span>
    </div>
  );
}

export { getRegWeek, calcWeekPoints };
