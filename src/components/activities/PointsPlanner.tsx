import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useUpdateRegistration, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

  // Optional activities capped at 3 points per week
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
  const [showAllWeeks, setShowAllWeeks] = useState(false);
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

  const warnings = useMemo(() => {
    const msgs: { type: "warning" | "success"; text: string }[] = [];
    const mandatoryCats = catalog.filter((c) => c.is_mandatory && c.period === "first_half");
    const unplannedMandatory = mandatoryCats.filter((c) => {
      const regs = registrations.filter((r) => r.catalog_id === c.id);
      return !regs.some((r) => r.status === "completed") && !regs.some((r) => r.planned_week != null && r.planned_week <= 14);
    });
    if (unplannedMandatory.length > 0) {
      msgs.push({ type: "warning", text: `⚠ ${unplannedMandatory.length} obligatorisk${unplannedMandatory.length > 1 ? "e" : ""} aktivitet${unplannedMandatory.length > 1 ? "er" : ""} ikke planlagt før uke 14` });
    }
    weekData.forEach((w) => {
      if (w.optionalCount > 3) {
        msgs.push({ type: "warning", text: `⚠ Uke ${w.week} har ${w.optionalCount} valgfrie aktiviteter — maks 3 gir poeng` });
      }
    });
    if (mandatoryCats.length > 0 && unplannedMandatory.length === 0) {
      msgs.push({ type: "success", text: "✓ Alle obligatoriske aktiviteter er gjennomført eller planlagt" });
    }
    return msgs;
  }, [catalog, registrations, weekData]);

  const summary = useMemo(() => {
    // Group by week and calculate effective points
    const weekMap: Record<number, Registration[]> = {};
    registrations.forEach((r) => {
      const w = getRegWeek(r);
      if (w != null) {
        if (!weekMap[w]) weekMap[w] = [];
        weekMap[w].push(r);
      }
    });

    let earned = 0;
    let planned = 0;
    Object.values(weekMap).forEach((weekRegs) => {
      const calc = calcWeekPoints(weekRegs, catalog);
      earned += calc.mandatoryEarned + calc.optionalEarned;
      planned += calc.mandatoryPlanned + calc.optionalPlanned;
    });

    // Also count unplanned registrations' points (they haven't been assigned a week yet)
    const unplannedRegs = registrations.filter((r) => getRegWeek(r) === null);
    unplannedRegs.forEach((r) => {
      const cat = catalog.find((c) => c.id === r.catalog_id);
      if (!cat) return;
      if (r.status === "completed") earned += cat.points;
      else planned += cat.points;
    });

    return { earned, planned, remaining: Math.max(30 - earned - planned, 0) };
  }, [registrations, catalog]);

  const chartData = useMemo(() => weekData.map((w) => ({
    name: `U${w.week}`,
    Valgfrie: w.optionalEarned + w.optionalPlanned,
    Obligatoriske: w.mandatoryEarned + w.mandatoryPlanned,
  })), [weekData]);

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

  const warningTexts = warnings.filter((w) => w.type === "warning");
  const successTexts = warnings.filter((w) => w.type === "success");

  return (
    <div className="space-y-4">
      {/* Compact status line */}
      {(warningTexts.length > 0 || successTexts.length > 0) && (
        <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {warningTexts.map((w, i) => (
            <span key={`w${i}`} className="text-amber-500 cursor-pointer hover:underline" onClick={() => document.getElementById("points-planner-card")?.scrollIntoView({ behavior: "smooth" })}>
              {w.text}
            </span>
          ))}
          {warningTexts.length > 0 && successTexts.length > 0 && <span className="text-muted-foreground/40">·</span>}
          {successTexts.map((w, i) => (
            <span key={`s${i}`} className="text-teal-500">{w.text}</span>
          ))}
        </p>
      )}

      <div id="points-planner-card" className="card-elevated pt-6 px-6 pb-4 space-y-4" style={{ overflow: "visible" }}>
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-foreground">Poengplanlegger — dra aktiviteter inn i ukene</p>
          <span className="ml-auto bg-amber-50 text-amber-700 text-xs font-medium py-1 px-2.5 rounded-md shrink-0">Frist: 5. april</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* Unplanned column */}
          <div
            className="shrink-0 w-32 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 min-h-[140px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            <div className="py-2 px-3">
              <p className="text-xs text-muted-foreground italic">Uplanlagt</p>
            </div>
            <div className="p-2 space-y-1">
              {unplanned.map((r) => {
                const cat = catalog.find((c) => c.id === r.catalog_id);
                if (!cat) return null;
                return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} />;
              })}
            </div>
          </div>

          {weekData
            .filter((w) => showAllWeeks || w.registrations.length > 0 || w.week <= currentWeek)
            .map((w) => {
              const isCurrentWeek = w.week === currentWeek;
              return (
                <div key={w.week} className="flex shrink-0">
                  <div
                    className={`w-28 min-h-[140px] transition-colors flex flex-col ${
                      isCurrentWeek ? "ring-2 ring-primary ring-offset-1 rounded-lg" : ""
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, w.week)}
                  >
                    <div className={`py-2 px-3 rounded-t-lg text-center ${isCurrentWeek ? "bg-primary/10" : "bg-neutral-100"}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isCurrentWeek ? "text-primary" : "text-foreground"}`}>Uke {w.week}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{WEEK_RANGES[w.week]}</p>
                    </div>
                    <div className={`flex-1 p-2 border border-t-0 rounded-b-lg ${isCurrentWeek ? "bg-white border-primary/20" : "bg-white border-neutral-200"}`}>
                      <div className="space-y-1 mb-2">
                        {w.registrations.map((r) => {
                          const cat = catalog.find((c) => c.id === r.catalog_id);
                          if (!cat) return null;
                          return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} />;
                        })}
                      </div>
                      <div className={`text-center text-sm font-semibold tabular-nums ${
                        w.overLimit ? "text-red-600" : w.total > 0 ? "text-primary" : "text-muted-foreground"
                      }`}>{w.total > 0 ? `${w.total}p` : "—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Show more weeks button */}
          {!showAllWeeks && weekData.some((w) => w.registrations.length === 0 && w.week > currentWeek) && (
            <button
              onClick={() => setShowAllWeeks(true)}
              className="shrink-0 w-10 min-h-[140px] rounded-lg border border-dashed border-neutral-300 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-neutral-400 transition-colors"
            >
              <span className="text-lg font-medium">+</span>
            </button>
          )}
        </div>
      </div>

      <div className="card-elevated p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SummaryItem label="Opptjent" value={`${summary.earned}p`} color="text-primary" />
          <SummaryItem label="Planlagt" value={`${summary.planned}p`} color="text-amber-600" />
          <SummaryItem label="Gjenstående" value={`${summary.remaining}p`} color="text-muted-foreground" />
          <SummaryItem label="Maks mulig" value="30p" color="text-foreground/40" />
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={24}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 6]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} labelStyle={{ fontWeight: 600 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Valgfrie" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Obligatoriske" stackId="a" fill="#E07A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const REG_BLOCK_COLORS: Record<string, string> = {
  mandatory: "bg-amber-50 text-amber-700",
  optional: "bg-teal-50 text-teal-700",
  meeting_advisor: "bg-purple-50 text-purple-700",
  meeting_agile: "bg-blue-50 text-blue-700",
};

function getRegBlockColor(cat: CatalogItem): string {
  if (cat.is_mandatory) return REG_BLOCK_COLORS.mandatory;
  if (cat.category === "meeting_based") {
    if (cat.meeting_type === "veiledermøte") return REG_BLOCK_COLORS.meeting_advisor;
    return REG_BLOCK_COLORS.meeting_agile;
  }
  return REG_BLOCK_COLORS.optional;
}

function RegBlock({ reg, cat, onDragStart, isDragging, onClick }: { reg: Registration; cat: CatalogItem; onDragStart: (e: React.DragEvent, id: string) => void; isDragging: boolean; onClick?: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, reg.id)}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`text-xs leading-tight rounded-md px-2 py-1.5 mb-1 cursor-pointer active:cursor-grabbing transition-all flex items-start gap-1 hover:ring-1 hover:ring-primary/40 font-medium ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
      } ${getRegBlockColor(cat)}`}
    >
      <GripVertical className="h-3 w-3 shrink-0 mt-px opacity-40" />
      <span className="flex-1 min-w-0">
        <span className="line-clamp-2">{cat.name}</span>
        <span className="font-semibold ml-0.5">{cat.points}p</span>
      </span>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

export { getRegWeek, calcWeekPoints };
