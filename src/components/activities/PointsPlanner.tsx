import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useUpdateRegistration, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { calculateActivityPoints, VIOLATION_MESSAGES, type PointsRuleViolation } from "@/lib/activityPoints";

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

  // === Single source of truth: the rule engine ===
  // Earned: only counts status="completed" registrations
  const pointsResult = useMemo(
    () => calculateActivityPoints(registrations, catalog),
    [registrations, catalog],
  );

  // Planned: re-run engine treating not-completed (with planned_week) as completed
  const plannedResult = useMemo(
    () => calculateActivityPoints(registrations, catalog, { includePlanned: true }),
    [registrations, catalog],
  );

  const violationsByRegId = useMemo(() => {
    const map = new Map<string, PointsRuleViolation[]>();
    for (const r of pointsResult.perRegistration) {
      if (r.violations.length > 0) map.set(r.registrationId, r.violations);
    }
    return map;
  }, [pointsResult]);

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
    const mandatoryCats = catalog.filter((c) => c.is_mandatory && (c.period === "first_half" || c.period === "second_half"));
    const unplannedMandatory = mandatoryCats.filter((c) => {
      const regs = registrations.filter((r) => r.catalog_id === c.id);
      return !regs.some((r) => r.status === "completed") && !regs.some((r) => r.planned_week != null);
    });
    if (unplannedMandatory.length > 0) {
      msgs.push({ type: "warning", text: `⚠ ${unplannedMandatory.length} obligatorisk${unplannedMandatory.length > 1 ? "e" : ""} aktivitet${unplannedMandatory.length > 1 ? "er" : ""} ikke planlagt` });
    }

    // Group disqualified registrations per week per violation reason
    const perWeekViolations = new Map<number, Map<PointsRuleViolation, number>>();
    for (const r of pointsResult.perRegistration) {
      if (r.countedTowardTotal) continue;
      const w = r.completedWeek;
      if (w == null) continue;
      // Skip "not_completed" — those aren't user errors, just not done yet
      const real = r.violations.filter((v) => v !== "not_completed" && v !== "invalid_week");
      if (real.length === 0) continue;
      // Use the most specific violation (first one)
      const primary = real[0];
      if (!perWeekViolations.has(w)) perWeekViolations.set(w, new Map());
      const m = perWeekViolations.get(w)!;
      m.set(primary, (m.get(primary) ?? 0) + 1);
    }
    const sortedWeeks = [...perWeekViolations.keys()].sort((a, b) => a - b);
    for (const w of sortedWeeks) {
      const reasons = perWeekViolations.get(w)!;
      for (const [reason, count] of reasons) {
        const noun = count === 1 ? "aktivitet" : "aktiviteter";
        msgs.push({
          type: "warning",
          text: `⚠ Uke ${w}: ${count} ${noun} gir 0p — ${VIOLATION_MESSAGES[reason].toLowerCase()}`,
        });
      }
    }

    if (mandatoryCats.length > 0 && unplannedMandatory.length === 0) {
      msgs.push({ type: "success", text: "✓ Alle obligatoriske aktiviteter er gjennomført eller planlagt" });
    }
    return msgs;
  }, [catalog, registrations, pointsResult]);

  const summary = useMemo(() => {
    // Earned = engine result (kappet på 30, alle regler anvendt)
    const earned = pointsResult.totalEarned;
    // Planned = additional points planned activities would yield, after rules + cap
    const planned = Math.max(0, Math.min(plannedResult.totalEarned - earned, 30 - earned));
    const remaining = Math.max(0, 30 - earned - planned);
    return {
      earned,
      planned,
      remaining,
      totalBeforeCap: pointsResult.totalBeforeCap,
    };
  }, [pointsResult, plannedResult]);

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

  const visibleWeeks = weekData.filter((w) => showAllWeeks || w.registrations.length > 0 || w.week <= currentWeek);
  const hiddenWeekCount = weekData.length - visibleWeeks.length;

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const currentEl = el.querySelector(`[data-week="${currentWeek}"]`) as HTMLElement | null;
    if (currentEl) currentEl.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [currentWeek]);

  function getWeekWidth(count: number): string {
    if (count === 0) return "w-[140px]";
    if (count <= 2) return "w-[200px]";
    if (count <= 4) return "w-[240px]";
    return "w-[280px]";
  }

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

      <div id="points-planner-card" className="card-elevated p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-foreground">Poengplanlegger</p>
          <span className="ml-auto bg-amber-50 text-amber-700 text-xs font-medium py-1 px-2.5 rounded-md shrink-0">Frist: 5. april</span>
        </div>

        {/* Unplanned drop zone — full width above timeline */}
        <div
          className={`rounded-xl border border-dashed min-h-[48px] p-3 transition-colors ${
            draggedId ? "border-primary/40 bg-primary/5" : "border-neutral-300 bg-neutral-50"
          }`}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, null)}
        >
          {unplanned.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {unplanned.map((r) => {
                const cat = catalog.find((c) => c.id === r.catalog_id);
                if (!cat) return null;
                return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} />;
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-1">
              {draggedId ? "Slipp her for å fjerne fra uke" : "Uplanlagte aktiviteter vises her"}
            </p>
          )}
        </div>

        {/* Week navigation pills */}
        <div className="flex gap-1 flex-wrap">
          {visibleWeeks.map((w) => (
            <button
              key={w.week}
              onClick={() => {
                const el = scrollRef.current?.querySelector(`[data-week="${w.week}"]`) as HTMLElement | null;
                el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
              }}
              className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                w.week === currentWeek
                  ? "bg-primary text-primary-foreground"
                  : w.registrations.length > 0
                  ? "bg-muted text-foreground hover:bg-muted/80"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {w.week}
            </button>
          ))}
          {hiddenWeekCount > 0 && !showAllWeeks && (
            <button onClick={() => setShowAllWeeks(true)} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1">
              +{hiddenWeekCount} uker
            </button>
          )}
        </div>

        {/* Timeline — horizontal scroll */}
        <div className="relative">
          <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth">
            {visibleWeeks.map((w) => {
              const isCurrentWeek = w.week === currentWeek;
              const isEmpty = w.registrations.length === 0;
              const widthClass = getWeekWidth(w.registrations.length);
              return (
                <div
                  key={w.week}
                  data-week={w.week}
                  className={`shrink-0 ${widthClass} snap-start rounded-xl border transition-all flex flex-col ${
                    isCurrentWeek
                      ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                      : draggedId
                      ? "border-dashed border-primary/40 bg-primary/[0.02]"
                      : "border-neutral-200"
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, w.week)}
                >
                  {/* Week header */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${isCurrentWeek ? "bg-primary/[0.06]" : "bg-neutral-50"}`}>
                    <div>
                      <p className={`text-sm font-bold uppercase ${isCurrentWeek ? "text-primary" : "text-foreground"}`}>Uke {w.week}</p>
                      <p className="text-xs text-muted-foreground">{WEEK_RANGES[w.week]}</p>
                    </div>
                    {w.total > 0 && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        w.overLimit ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-700"
                      }`}>{w.total}p</span>
                    )}
                  </div>

                  {/* Week body */}
                  <div className="flex-1 p-3 space-y-2">
                    {w.registrations.map((r) => {
                      const cat = catalog.find((c) => c.id === r.catalog_id);
                      if (!cat) return null;
                      return <RegBlock key={r.id} reg={r} cat={cat} onDragStart={handleDragStart} isDragging={draggedId === r.id} onClick={() => onClickRegistration?.(r, cat)} violations={violationsByRegId.get(r.id)} />;
                    })}
                    {isEmpty && (
                      <p className="text-xs text-muted-foreground text-center py-4">—</p>
                    )}
                  </div>
                </div>
              );
            })}

            {hiddenWeekCount > 0 && !showAllWeeks && (
              <button
                onClick={() => setShowAllWeeks(true)}
                className="shrink-0 w-[100px] snap-start rounded-xl border border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-neutral-400 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="text-xs font-medium">+{hiddenWeekCount} uker</span>
              </button>
            )}
          </div>
          {/* Right fade indicator */}
          <div className="absolute top-0 right-0 bottom-3 w-8 bg-gradient-to-l from-white pointer-events-none rounded-r-xl" />
        </div>
      </div>

      {/* Summary + Chart */}
      <div className="card-elevated p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <SummaryItem label="Opptjent" value={`${summary.earned}p`} color="text-primary" />
          <SummaryItem label="Planlagt" value={`${summary.planned}p`} color="text-amber-600" />
          <SummaryItem label="Gjenstående" value={`${summary.remaining}p`} color="text-muted-foreground" />
          <SummaryItem label="Maks mulig" value={`${catalog.reduce((s, c) => s + c.points * c.max_occurrences, 0)}p`} color="text-foreground/40" />
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

const REG_BLOCK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  mandatory: { bg: "bg-amber-50", text: "text-amber-700", border: "border-l-amber-400" },
  optional: { bg: "bg-teal-50", text: "text-teal-700", border: "border-l-teal-400" },
  meeting_advisor: { bg: "bg-purple-50", text: "text-purple-700", border: "border-l-purple-400" },
  meeting_agile: { bg: "bg-blue-50", text: "text-blue-700", border: "border-l-blue-400" },
};

function getRegBlockStyle(cat: CatalogItem) {
  if (cat.is_mandatory) return REG_BLOCK_STYLES.mandatory;
  if (cat.category === "meeting_based") {
    if (cat.meeting_type === "veiledermøte") return REG_BLOCK_STYLES.meeting_advisor;
    return REG_BLOCK_STYLES.meeting_agile;
  }
  return REG_BLOCK_STYLES.optional;
}

function RegBlock({ reg, cat, onDragStart, isDragging, onClick, violations }: { reg: Registration; cat: CatalogItem; onDragStart: (e: React.DragEvent, id: string) => void; isDragging: boolean; onClick?: () => void; violations?: PointsRuleViolation[] }) {
  const style = getRegBlockStyle(cat);
  // Only show "no points" styling if registration is completed but earned 0 points
  const isDisqualified = reg.status === "completed" && violations && violations.length > 0 &&
    !violations.includes("not_completed") && !violations.includes("invalid_week");
  const block = (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, reg.id)}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`text-sm leading-snug rounded-lg py-2 px-3 cursor-pointer active:cursor-grabbing transition-all flex items-center gap-2 hover:ring-1 hover:ring-primary/30 border-l-[3px] ${style.bg} ${style.text} ${style.border} ${
        isDragging ? "opacity-40 scale-95" : isDisqualified ? "opacity-50" : "opacity-100"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-30" />
      <span className={`flex-1 min-w-0 font-medium truncate ${isDisqualified ? "line-through" : ""}`}>{cat.name}</span>
      <span className="text-xs font-medium opacity-70 shrink-0">{isDisqualified ? "0p" : `${cat.points}p`}</span>
    </div>
  );
  if (!violations || violations.length === 0) return block;
  return (
    <UITooltip>
      <TooltipTrigger asChild>{block}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {violations.map((v) => VIOLATION_MESSAGES[v]).join(" · ")}
      </TooltipContent>
    </UITooltip>
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
