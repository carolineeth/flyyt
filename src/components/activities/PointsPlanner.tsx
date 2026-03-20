import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, GripVertical } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useUpdateActivity } from "@/hooks/useActivities";
import { toast } from "sonner";
import type { Activity } from "@/lib/types";

// Week date ranges for 2026
const WEEK_RANGES: Record<number, string> = {
  10: "3.–8. mars",
  11: "9.–15. mars",
  12: "16.–22. mars",
  13: "23.–29. mars",
  14: "30. mars–5. apr",
  15: "6.–12. apr",
  16: "13.–19. apr",
  17: "20.–26. apr",
  18: "27. apr–3. mai",
  19: "4.–10. mai",
};

function getCurrentWeek(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getActivityWeek(a: Activity): number | null {
  if (a.status === "completed" && a.completed_week) return a.completed_week;
  return a.planned_week ?? null;
}

interface PointsPlannerProps {
  activities: Activity[];
}

export function PointsPlanner({ activities }: PointsPlannerProps) {
  const updateActivity = useUpdateActivity();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const currentWeek = getCurrentWeek();

  // Compute per-week data
  const weekData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const week = i + 10;
      const weekActivities = activities.filter((a) => getActivityWeek(a) === week);
      const earned = weekActivities.filter((a) => a.status === "completed").reduce((s, a) => s + a.points, 0);
      const planned = weekActivities.filter((a) => a.status !== "completed").reduce((s, a) => s + a.points, 0);
      const total = earned + planned;
      return { week, activities: weekActivities, earned, planned, total, unused: Math.max(3 - total, 0) };
    });
  }, [activities]);

  const unplanned = useMemo(() => activities.filter((a) => getActivityWeek(a) === null), [activities]);

  // Warnings
  const warnings = useMemo(() => {
    const msgs: { type: "warning" | "success"; text: string }[] = [];
    const mandatoryUnplanned = activities.filter(
      (a) => a.is_mandatory && a.status !== "completed" && a.deadline_phase === "first_half" && (a.planned_week == null || a.planned_week > 14)
    );
    if (mandatoryUnplanned.length > 0) {
      msgs.push({ type: "warning", text: `⚠ Du har ${mandatoryUnplanned.length} obligatorisk${mandatoryUnplanned.length > 1 ? "e" : ""} aktivitet${mandatoryUnplanned.length > 1 ? "er" : ""} som ikke er planlagt før uke 14` });
    }
    weekData.forEach((w) => {
      if (w.total > 3) {
        msgs.push({ type: "warning", text: `⚠ Uke ${w.week} har ${w.total} aktiviteter planlagt — maks 3 gir poeng` });
      }
    });
    const allMandatory = activities.filter((a) => a.is_mandatory);
    const allDone = allMandatory.every((a) => a.status === "completed" || a.planned_week != null);
    if (allMandatory.length > 0 && allDone && mandatoryUnplanned.length === 0) {
      msgs.push({ type: "success", text: "✓ Alle obligatoriske aktiviteter er gjennomført eller planlagt" });
    }
    return msgs;
  }, [activities, weekData]);

  // Summary
  const summary = useMemo(() => {
    const earned = activities.filter((a) => a.status === "completed").reduce((s, a) => s + a.points, 0);
    const plannedNotDone = activities.filter((a) => a.status !== "completed" && a.planned_week != null).reduce((s, a) => s + a.points, 0);
    return { earned, planned: plannedNotDone, remaining: 30 - earned - plannedNotDone };
  }, [activities]);

  // Chart data
  const chartData = useMemo(() => {
    return weekData.map((w) => ({
      name: `U${w.week}`,
      Opptjent: w.earned,
      Planlagt: w.planned,
      Ubrukt: w.unused,
    }));
  }, [weekData]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, activityId: string) => {
    setDraggedId(activityId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", activityId);
  };

  const handleDrop = useCallback((e: React.DragEvent, week: number | null) => {
    e.preventDefault();
    const activityId = e.dataTransfer.getData("text/plain");
    if (!activityId) return;
    setDraggedId(null);
    updateActivity.mutate(
      { id: activityId, planned_week: week },
      { onSuccess: () => toast.success(week ? `Planlagt til uke ${week}` : "Fjernet fra planlegging") }
    );
  }, [updateActivity]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  return (
    <div className="space-y-4">
      {/* Smart warnings */}
      {warnings.map((w, i) => (
        <Alert key={i} variant={w.type === "warning" ? "destructive" : "default"} className={w.type === "success" ? "border-primary/30 bg-primary/5" : ""}>
          <div className="flex items-center gap-2">
            {w.type === "warning" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
            <AlertDescription className="text-sm">{w.text}</AlertDescription>
          </div>
        </Alert>
      ))}

      {/* Timeline + unplanned area */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Poengplanlegger — dra aktiviteter inn i ukene</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {/* Unplanned column */}
            <div
              className="shrink-0 w-36 rounded-lg border-2 border-dashed border-muted p-2 min-h-[180px] bg-muted/30"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
            >
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Uplanlagt</p>
              <div className="space-y-1">
                {unplanned.map((a) => (
                  <ActivityBlock key={a.id} activity={a} onDragStart={handleDragStart} isDragging={draggedId === a.id} />
                ))}
              </div>
            </div>

            {/* Week columns */}
            {weekData.map((w, i) => {
              const isCurrentWeek = w.week === currentWeek;
              const isDeadlineBorder = w.week === 15; // show line before week 15

              return (
                <div key={w.week} className="flex">
                  {/* Deadline line between week 14 and 15 */}
                  {isDeadlineBorder && (
                    <div className="flex flex-col items-center justify-center mx-0.5 shrink-0">
                      <div className="h-full border-l-2 border-dashed border-destructive relative">
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-medium text-destructive bg-card px-1 rounded">
                          Frist 5. apr
                        </span>
                      </div>
                    </div>
                  )}
                  <div
                    className={`shrink-0 w-28 rounded-lg border-2 p-2 min-h-[180px] transition-colors ${
                      isCurrentWeek
                        ? "border-info bg-info/5"
                        : draggedId
                        ? "border-dashed border-primary/30 bg-primary/5"
                        : "border-border bg-card"
                    }`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, w.week)}
                  >
                    <div className="text-center mb-2">
                      <p className={`text-xs font-semibold ${isCurrentWeek ? "text-info" : ""}`}>Uke {w.week}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{WEEK_RANGES[w.week]}</p>
                    </div>
                    <div className="space-y-1 mb-2">
                      {w.activities.map((a) => (
                        <ActivityBlock key={a.id} activity={a} onDragStart={handleDragStart} isDragging={draggedId === a.id} />
                      ))}
                    </div>
                    <div className={`text-center text-xs font-bold tabular-nums rounded px-1 py-0.5 ${
                      w.total > 3
                        ? "bg-destructive/15 text-destructive"
                        : w.total > 0
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}>
                      {w.total > 0 ? `${w.total}p` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <SummaryItem label="Opptjent" value={`${summary.earned}p`} color="text-primary" />
            <SummaryItem label="Planlagt (ikke fullført)" value={`${summary.planned}p`} color="text-info" />
            <SummaryItem label="Gjenstående" value={`${summary.remaining}p`} color="text-muted-foreground" />
            <SummaryItem label="Maks mulig" value="30p" color="text-foreground" />
          </div>

          {/* Stacked bar chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={24}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 5]} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="Opptjent" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Planlagt" stackId="a" fill="hsl(var(--info))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Ubrukt" stackId="a" fill="hsl(var(--muted))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function ActivityBlock({
  activity,
  onDragStart,
  isDragging,
}: {
  activity: Activity;
  onDragStart: (e: React.DragEvent, id: string) => void;
  isDragging: boolean;
}) {
  const isCompleted = activity.status === "completed";
  const isMandatoryIncomplete = activity.is_mandatory && !isCompleted;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, activity.id)}
      className={`text-[10px] leading-tight rounded px-1.5 py-1 cursor-grab active:cursor-grabbing transition-all flex items-start gap-1 ${
        isDragging ? "opacity-40 scale-95" : "opacity-100"
      } ${
        isCompleted
          ? "bg-primary/15 text-primary"
          : isMandatoryIncomplete
          ? "bg-blue-50 text-blue-700 ring-1 ring-destructive/50"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      <GripVertical className="h-3 w-3 shrink-0 mt-px opacity-40" />
      <span className="flex-1 min-w-0">
        <span className="line-clamp-2">{activity.name}</span>
        <span className="font-semibold ml-0.5">{activity.points}p</span>
      </span>
    </div>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
