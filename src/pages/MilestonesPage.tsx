import { useState, useMemo, useCallback } from "react";
import { useMilestones, useToggleMilestone, useCreateMilestone, useUpdateMilestone, useDeleteMilestone, type Milestone } from "@/hooks/useMilestones";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Flag, Plus, Lock, ChevronDown, ChevronRight, CalendarIcon, Check, Clock, AlertTriangle, Target } from "lucide-react";
import { format, differenceInDays, parseISO, endOfMonth, addWeeks, startOfWeek, getISOWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Sprint } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  kurs: "#E24B4A",
  aktivitet: "#D85A30",
  sprint: "#0F6E56",
  rapport: "#534AB7",
  design: "#D4537E",
  intern: "#888780",
};

const CATEGORY_BG: Record<string, string> = {
  kurs: "rgba(226, 75, 74, 0.08)",
  aktivitet: "rgba(216, 90, 48, 0.08)",
  sprint: "rgba(15, 110, 86, 0.08)",
  rapport: "rgba(83, 74, 183, 0.08)",
  design: "rgba(212, 83, 126, 0.08)",
  intern: "rgba(136, 135, 128, 0.08)",
};

const CATEGORY_LABELS: Record<string, string> = {
  kurs: "Kurs",
  aktivitet: "Aktivitet",
  sprint: "Sprint",
  rapport: "Rapport",
  design: "Design",
  intern: "Intern",
};

const CATEGORY_ORDER = ["kurs", "sprint", "aktivitet", "rapport", "design", "intern"];

function useSprints() {
  return useQuery<Sprint[]>({
    queryKey: ["sprints_milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data as Sprint[];
    },
  });
}

// ============ Metric Cards ============

function MetricCards({ milestones }: { milestones: Milestone[] }) {
  const now = new Date();
  const upcoming = milestones.filter((m) => !m.is_completed && parseISO(m.date) >= now).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const daysToNext = next ? differenceInDays(parseISO(next.date), now) : null;

  const monthEnd = endOfMonth(now);
  const thisMonth = upcoming.filter((m) => parseISO(m.date) <= monthEnd).length;

  const completed = milestones.filter((m) => m.is_completed).length;
  const total = milestones.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Urgent items (< 7 days)
  const urgent = upcoming.filter((m) => differenceInDays(parseISO(m.date), now) < 7);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Next milestone - hero card */}
      <Card className={cn(
        "rounded-xl border-[0.5px] sm:col-span-2 lg:col-span-2",
        daysToNext !== null && daysToNext <= 3 && "border-red-200 bg-red-50/30",
        daysToNext !== null && daysToNext > 3 && daysToNext <= 7 && "border-amber-200 bg-amber-50/30",
      )}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Neste milepæl</p>
          </div>
          {next ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[next.category] }} />
                  <p className="text-base font-semibold truncate">{next.title}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-[18px]">
                  {format(parseISO(next.date), "EEEE d. MMMM", { locale: nb })}
                </p>
              </div>
              <div className={cn(
                "text-right shrink-0 px-3 py-1.5 rounded-lg",
                daysToNext !== null && daysToNext <= 3 ? "bg-red-100 text-red-700" :
                daysToNext !== null && daysToNext <= 7 ? "bg-amber-100 text-amber-700" :
                "bg-muted text-foreground"
              )}>
                <p className="text-2xl font-bold tabular-nums leading-none">{daysToNext}</p>
                <p className="text-[10px] mt-0.5">dager</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Alle milepæler fullført! 🎉</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[0.5px]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Denne mnd</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{thisMonth}</p>
          {urgent.length > 0 && (
            <p className="text-[11px] text-red-600 font-medium mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {urgent.length} innen 7 dager
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-[0.5px]">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <Check className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Fullført</p>
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-bold tabular-nums">{completed}</p>
            <p className="text-sm text-muted-foreground">/ {total}</p>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Swim-Lane Timeline ============

function Timeline({ milestones, sprints, onSelect }: { milestones: Milestone[]; sprints: Sprint[]; onSelect: (id: string) => void }) {
  const projectStart = new Date(2026, 2, 2);
  const projectEnd = new Date(2026, 5, 14);

  const weeks: { weekNum: number; start: Date }[] = [];
  let cursor = startOfWeek(projectStart, { weekStartsOn: 1 });
  while (cursor < projectEnd) {
    weeks.push({ weekNum: getISOWeek(cursor), start: new Date(cursor) });
    cursor = addWeeks(cursor, 1);
  }

  const totalDays = differenceInDays(projectEnd, projectStart);
  const colWidth = 220; // much wider – ~4-5 weeks visible
  const totalWidth = weeks.length * colWidth;
  const labelWidth = 90;
  const now = new Date();
  const todayFrac = Math.max(0, Math.min(1, differenceInDays(now, projectStart) / totalDays));

  const scrollToToday = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const todayPx = todayFrac * totalWidth;
    el.scrollLeft = Math.max(0, todayPx - el.clientWidth / 3);
  }, [todayFrac, totalWidth]);

  const lanes = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      label: CATEGORY_LABELS[cat],
      color: CATEGORY_COLORS[cat],
      items: milestones.filter((m) => m.category === cat),
    })).filter((l) => l.items.length > 0);
  }, [milestones]);

  const rowH = 56;

  return (
    <Card className="rounded-xl border-[0.5px] overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/60 bg-muted/30 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground mr-1">Kategorier:</p>
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
            <span className="text-xs text-muted-foreground font-medium">{CATEGORY_LABELS[cat]}</span>
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Fixed category labels */}
        <div className="shrink-0 border-r border-border/60 bg-muted/20" style={{ width: labelWidth }}>
          {/* Week header spacer */}
          <div className="h-10 border-b border-border/60" />
          {/* Sprint bar spacer */}
          <div className="h-7 border-b border-border/20 flex items-center px-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sprinter</span>
          </div>
          {/* Lane labels */}
          {lanes.map((lane) => (
            <div
              key={lane.cat}
              className="flex items-center gap-2 px-3 border-b border-border/20"
              style={{ height: rowH, backgroundColor: CATEGORY_BG[lane.cat] }}
            >
              <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: lane.color }} />
              <span className="text-xs font-semibold text-foreground/80">{lane.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable area */}
        <div ref={scrollToToday} className="overflow-x-auto flex-1">
          <div className="relative" style={{ width: totalWidth }}>
            {/* Week headers */}
            <div className="flex border-b border-border/60 h-10">
              {weeks.map((w, i) => {
                const isCurrentWeek = getISOWeek(now) === w.weekNum;
                const weekEnd = addWeeks(w.start, 1);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center justify-center border-r border-border/30",
                      isCurrentWeek && "bg-teal-50/80"
                    )}
                    style={{ width: colWidth }}
                  >
                    <span className={cn("text-xs font-bold", isCurrentWeek ? "text-teal-700" : "text-foreground")}>
                      Uke {w.weekNum}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(w.start, "d. MMM", { locale: nb })} – {format(weekEnd, "d. MMM", { locale: nb })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Sprint bars row */}
            <div className="relative h-7 border-b border-border/20">
              {sprints.map((s) => {
                const sStart = parseISO(s.start_date);
                const sEnd = parseISO(s.end_date);
                const left = (differenceInDays(sStart, projectStart) / totalDays) * totalWidth;
                const width = (differenceInDays(sEnd, sStart) / totalDays) * totalWidth;
                const isActive = s.is_active;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "absolute top-1 h-5 rounded text-[11px] font-semibold flex items-center justify-center overflow-hidden",
                      isActive ? "text-teal-800 border border-teal-300" : "text-teal-700/70"
                    )}
                    style={{
                      left: Math.max(0, left),
                      width: Math.max(40, width),
                      backgroundColor: isActive ? "rgba(15, 110, 86, 0.18)" : "rgba(15, 110, 86, 0.08)",
                    }}
                  >
                    {s.name}
                  </div>
                );
              })}
            </div>

            {/* Swim lanes */}
            {lanes.map((lane) => (
              <div
                key={lane.cat}
                className="relative border-b border-border/20"
                style={{ height: rowH, backgroundColor: CATEGORY_BG[lane.cat] }}
              >
                {/* Vertical week lines */}
                {weeks.map((_, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-r border-border/15" style={{ left: (i + 1) * colWidth }} />
                ))}

                {/* Milestone markers */}
                {lane.items.map((m) => {
                  const mDate = parseISO(m.date);
                  const left = (differenceInDays(mDate, projectStart) / totalDays) * totalWidth;
                  const isPast = m.is_completed;
                  const daysLeft = differenceInDays(mDate, now);
                  const isUrgent = !isPast && daysLeft >= 0 && daysLeft < 7;
                  return (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onSelect(m.id)}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer group",
                            isPast && "opacity-35"
                          )}
                          style={{ left: Math.max(4, left - 8) }}
                        >
                          <div className="relative shrink-0">
                            <div
                              className="w-5 h-5 rotate-45 rounded-[3px] border-2 border-white shadow-lg transition-transform group-hover:scale-125"
                              style={{ backgroundColor: lane.color }}
                            />
                            {isPast && (
                              <Check className="absolute inset-0 m-auto h-3 w-3 text-white -rotate-45" />
                            )}
                          </div>
                          <div className="flex flex-col items-start">
                            <span className={cn(
                              "text-[12px] font-semibold whitespace-nowrap leading-tight",
                              isPast ? "text-muted-foreground line-through" : "text-foreground/90"
                            )}>
                              {m.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {format(mDate, "d. MMM", { locale: nb })}
                              {!isPast && daysLeft >= 0 && (
                                <span className={cn(
                                  "ml-1.5 font-semibold",
                                  isUrgent ? "text-red-600" : "text-muted-foreground"
                                )}>
                                  · {daysLeft === 0 ? "i dag" : daysLeft === 1 ? "i morgen" : `om ${daysLeft}d`}
                                </span>
                              )}
                            </span>
                          </div>
                          {m.priority === "critical" && !isPast && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold shrink-0">!</span>
                          )}
                          {m.is_fixed && !isPast && (
                            <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs z-50">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
                          <p className="font-semibold text-sm">{m.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(mDate, "EEEE d. MMMM yyyy", { locale: nb })}
                          {m.priority === "critical" && " · 🔴 Kritisk"}
                          {m.priority === "high" && " · 🟡 Høy"}
                        </p>
                        {m.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.description}</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}

            {/* Today line */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{ left: todayFrac * totalWidth, height: 10 + 7 + lanes.length * rowH + 30 }}
            >
              <div className="w-0 h-full border-l-2 border-dashed border-teal-500/80" />
              <div className="absolute top-0 -left-[16px] bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-b-md shadow-md">
                I dag
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============ Milestone List ============

function MilestoneList({ milestones, highlightId }: { milestones: Milestone[]; highlightId: string | null }) {
  const toggle = useToggleMilestone();
  const now = new Date();
  const upcoming = milestones.filter((m) => !m.is_completed).sort((a, b) => a.date.localeCompare(b.date));
  const completed = milestones.filter((m) => m.is_completed).sort((a, b) => b.date.localeCompare(a.date));
  const [completedOpen, setCompletedOpen] = useState(false);

  // Group upcoming by month
  const months = useMemo(() => {
    const groups: Record<string, Milestone[]> = {};
    upcoming.forEach((m) => {
      const key = format(parseISO(m.date), "MMMM yyyy", { locale: nb });
      (groups[key] ??= []).push(m);
    });
    return Object.entries(groups);
  }, [upcoming]);

  const renderRow = (m: Milestone, dimmed = false) => {
    const days = differenceInDays(parseISO(m.date), now);
    const isUrgent = !dimmed && days >= 0 && days < 7;
    const isWarning = !dimmed && days >= 7 && days < 14;

    return (
      <div
        key={m.id}
        id={`ms-${m.id}`}
        className={cn(
          "flex items-center gap-3 py-3 px-3 rounded-lg transition-all",
          highlightId === m.id && "ring-2 ring-primary/30 bg-accent/40",
          isUrgent && !dimmed && "bg-red-50/50",
          dimmed && "opacity-50"
        )}
        style={{ borderLeft: `3px solid ${CATEGORY_COLORS[m.category]}` }}
      >
        <Checkbox
          checked={m.is_completed}
          onCheckedChange={(checked) => toggle.mutate({ id: m.id, is_completed: !!checked })}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm font-medium",
              dimmed && "line-through text-muted-foreground"
            )}>
              {m.title}
            </span>
            {m.is_fixed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Lock className="h-2.5 w-2.5" />
              </span>
            )}
            {m.priority === "critical" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Kritisk</span>
            )}
            {m.priority === "high" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Høy</span>
            )}
          </div>
          {m.description && (
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-muted-foreground hidden sm:inline">
            {format(parseISO(m.date), "d. MMM", { locale: nb })}
          </span>
          {!dimmed && days >= 0 && (
            <span className={cn(
              "text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums min-w-[60px] text-center",
              isUrgent ? "bg-red-100 text-red-700" :
              isWarning ? "bg-amber-100 text-amber-700" :
              "bg-muted text-muted-foreground"
            )}>
              {days === 0 ? "I dag" : days === 1 ? "I morgen" : `${days} dager`}
            </span>
          )}
          {dimmed && <Check className="h-4 w-4 text-green-500" />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {months.map(([monthLabel, items]) => (
        <div key={monthLabel}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider capitalize">{monthLabel}</h3>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground">{items.length} milepæler</span>
          </div>
          <div className="space-y-1">
            {items.map((m) => renderRow(m))}
          </div>
        </div>
      ))}

      {completed.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-2 w-full">
            {completedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Fullførte ({completed.length})</span>
            <div className="flex-1 h-px bg-border" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1">
              {completed.map((m) => renderRow(m, true))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ============ Add Modal ============

function AddMilestoneModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateMilestone();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [category, setCategory] = useState("intern");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isFixed, setIsFixed] = useState(false);

  const handleSubmit = async () => {
    if (!title || !date) return;
    await create.mutateAsync({
      title,
      date: format(date, "yyyy-MM-dd"),
      category,
      description: description || null,
      priority,
      is_fixed: isFixed,
      linked_activity_id: null,
      linked_sprint_id: null,
    });
    toast.success("Milepæl opprettet");
    setTitle(""); setDate(undefined); setCategory("intern"); setDescription(""); setPriority("normal"); setIsFixed(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Legg til milepæl</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tittel *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milepæl-tittel" />
          </div>
          <div>
            <Label className="text-xs">Dato *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !date && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {date ? format(date, "d. MMMM yyyy", { locale: nb }) : "Velg dato"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[k] }} />
                        {v}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Kritisk</SelectItem>
                  <SelectItem value="high">🟡 Høy</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Beskrivelse</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isFixed} onCheckedChange={setIsFixed} />
            <Label className="text-xs">Fast frist (kan ikke flyttes)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={!title || !date || create.isPending}>Opprett</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Main Page ============

export default function MilestonesPage() {
  const { data: milestones } = useMilestones();
  const { data: sprints } = useSprints();
  const [addOpen, setAddOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setHighlightId(id);
    const el = document.getElementById(`ms-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightId(null), 3000);
  };

  const ms = milestones ?? [];
  const sp = sprints ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flag className="h-5 w-5" /> Milepæler
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Frister og milepæler gjennom prosjektperioden</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Legg til
        </Button>
      </div>

      <MetricCards milestones={ms} />
      <Timeline milestones={ms} sprints={sp} onSelect={handleSelect} />
      <MilestoneList milestones={ms} highlightId={highlightId} />
      <AddMilestoneModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
