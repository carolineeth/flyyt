import { useState, useMemo, useRef, useCallback } from "react";
import { useMilestones, useToggleMilestone, useCreateMilestone, type Milestone } from "@/hooks/useMilestones";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { Flag, Plus, Lock, ChevronDown, ChevronRight, CalendarIcon, Check } from "lucide-react";
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, addWeeks, startOfWeek, getISOWeek } from "date-fns";
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

const CATEGORY_LABELS: Record<string, string> = {
  kurs: "Kurs",
  aktivitet: "Aktivitet",
  sprint: "Sprint",
  rapport: "Rapport",
  design: "Design",
  intern: "Intern",
};

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

// --- Metric Cards ---

function MetricCards({ milestones }: { milestones: Milestone[] }) {
  const now = new Date();
  const upcoming = milestones.filter((m) => !m.is_completed).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const daysToNext = next ? differenceInDays(parseISO(next.date), now) : null;

  const monthEnd = endOfMonth(now);
  const thisMonth = upcoming.filter((m) => parseISO(m.date) <= monthEnd).length;

  const completed = milestones.filter((m) => m.is_completed).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card className="rounded-xl border-[0.5px]">
        <CardContent className="pt-4 pb-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Neste milepæl</p>
          {next ? (
            <>
              <p className="text-sm font-medium mt-1 truncate">{next.title}</p>
              <p className={cn("text-xs font-medium mt-0.5", daysToNext !== null && daysToNext < 3 ? "text-red-600" : daysToNext !== null && daysToNext < 7 ? "text-amber-600" : "text-green-600")}>
                Om {daysToNext} dager
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Ingen kommende</p>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-xl border-[0.5px]">
        <CardContent className="pt-4 pb-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Denne måneden</p>
          <p className="text-2xl font-bold mt-1">{thisMonth}</p>
          <p className="text-xs text-muted-foreground">kommende milepæler</p>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-[0.5px]">
        <CardContent className="pt-4 pb-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Fullført</p>
          <p className="text-2xl font-bold mt-1">{completed} <span className="text-sm font-normal text-muted-foreground">av {milestones.length}</span></p>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Timeline ---

function Timeline({ milestones, sprints, onSelect }: { milestones: Milestone[]; sprints: Sprint[]; onSelect: (id: string) => void }) {
  const projectStart = new Date(2026, 2, 2); // week 10 start (Mon March 2)
  const projectEnd = new Date(2026, 5, 14); // June 14

  const weeks: { weekNum: number; start: Date; end: Date }[] = [];
  let cursor = startOfWeek(projectStart, { weekStartsOn: 1 });
  while (cursor < projectEnd) {
    const wEnd = new Date(cursor);
    wEnd.setDate(wEnd.getDate() + 6);
    weeks.push({ weekNum: getISOWeek(cursor), start: new Date(cursor), end: wEnd });
    cursor = addWeeks(cursor, 1);
  }

  const totalDays = differenceInDays(projectEnd, projectStart);
  const colWidth = 80;
  const totalWidth = weeks.length * colWidth;
  const now = new Date();
  const todayOffset = Math.max(0, Math.min(1, differenceInDays(now, projectStart) / totalDays));

  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to today on mount
  const scrollToToday = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    (scrollRef as any).current = el;
    const todayPx = todayOffset * totalWidth;
    el.scrollLeft = Math.max(0, todayPx - el.clientWidth / 2);
  }, [todayOffset, totalWidth]);

  return (
    <Card className="rounded-xl border-[0.5px] overflow-hidden">
      <div ref={scrollToToday} className="overflow-x-auto" style={{ minHeight: 160 }}>
        <div className="relative" style={{ width: totalWidth, minHeight: 160 }}>
          {/* Week columns */}
          <div className="flex border-b border-border">
            {weeks.map((w, i) => (
              <div key={i} className="flex-shrink-0 text-center border-r border-border/40 py-1.5" style={{ width: colWidth }}>
                <p className="text-[10px] font-medium text-foreground">U{w.weekNum}</p>
                <p className="text-[9px] text-muted-foreground">{format(w.start, "d.M")}</p>
              </div>
            ))}
          </div>

          {/* Sprint bars */}
          <div className="relative h-5 mt-1">
            {sprints.map((s) => {
              const sStart = parseISO(s.start_date);
              const sEnd = parseISO(s.end_date);
              const left = (differenceInDays(sStart, projectStart) / totalDays) * totalWidth;
              const width = (differenceInDays(sEnd, sStart) / totalDays) * totalWidth;
              return (
                <div
                  key={s.id}
                  className="absolute top-0 h-5 rounded text-[9px] font-medium flex items-center justify-center text-teal-800 overflow-hidden"
                  style={{ left: Math.max(0, left), width: Math.max(20, width), backgroundColor: "rgba(15, 110, 86, 0.15)" }}
                >
                  {s.name}
                </div>
              );
            })}
          </div>

          {/* Milestone markers */}
          <div className="relative h-16 mt-1">
            {milestones.map((m) => {
              const mDate = parseISO(m.date);
              const left = (differenceInDays(mDate, projectStart) / totalDays) * totalWidth;
              const color = CATEGORY_COLORS[m.category] ?? "#888";
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelect(m.id)}
                      className="absolute cursor-pointer"
                      style={{ left: left - 6, top: 8 }}
                    >
                      <div
                        className={cn("w-3 h-3 rotate-45 border-2 border-white shadow-sm", m.is_completed && "opacity-40")}
                        style={{ backgroundColor: color }}
                      />
                      {m.is_completed && (
                        <Check className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-green-600" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="font-medium text-xs">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground">{format(mDate, "d. MMMM yyyy", { locale: nb })} · {CATEGORY_LABELS[m.category]}</p>
                    {m.description && <p className="text-[10px] text-muted-foreground mt-1">{m.description}</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Today line */}
          <div
            className="absolute top-0 bottom-0 border-l border-dashed"
            style={{ left: todayOffset * totalWidth, borderColor: "#0F6E56" }}
          >
            <div className="absolute -top-0 -left-2.5 bg-teal-600 text-white text-[8px] px-1 rounded-b">I dag</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// --- Countdown badge ---

function CountdownBadge({ date }: { date: string }) {
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0) return null;
  const color = days < 7 ? "bg-red-100 text-red-700" : days < 14 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground";
  return <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", color)}>Om {days} dager</span>;
}

// --- Milestone List ---

function MilestoneList({ milestones, highlightId }: { milestones: Milestone[]; highlightId: string | null }) {
  const toggle = useToggleMilestone();
  const upcoming = milestones.filter((m) => !m.is_completed).sort((a, b) => a.date.localeCompare(b.date));
  const completed = milestones.filter((m) => m.is_completed).sort((a, b) => b.date.localeCompare(a.date));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [completedOpen, setCompletedOpen] = useState(false);

  const toggleDesc = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Group upcoming by month
  const months = useMemo(() => {
    const groups: Record<string, Milestone[]> = {};
    upcoming.forEach((m) => {
      const key = format(parseISO(m.date), "MMMM yyyy", { locale: nb });
      (groups[key] ??= []).push(m);
    });
    return Object.entries(groups);
  }, [upcoming]);

  const renderRow = (m: Milestone, dimmed = false) => (
    <div
      key={m.id}
      id={`ms-${m.id}`}
      className={cn(
        "flex items-start gap-3 py-3 px-2 border-b border-border/40 transition-colors",
        highlightId === m.id && "bg-accent/40 rounded-lg",
        dimmed && "opacity-50"
      )}
    >
      <Checkbox
        checked={m.is_completed}
        onCheckedChange={(checked) => toggle.mutate({ id: m.id, is_completed: !!checked })}
        className="mt-0.5"
      />
      <div
        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: CATEGORY_COLORS[m.category] }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => toggleDesc(m.id)} className={cn("text-[13px] font-medium text-left", dimmed && "line-through text-muted-foreground")}>
            {m.title}
          </button>
          {m.is_fixed && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          {m.priority === "critical" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Kritisk</span>}
          {m.priority === "high" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Høy</span>}
        </div>
        <p className="text-[13px] text-muted-foreground">{format(parseISO(m.date), "d. MMMM yyyy", { locale: nb })}</p>
        {expandedIds.has(m.id) && m.description && (
          <p className="text-[12px] text-muted-foreground mt-1">{m.description}</p>
        )}
      </div>
      {!m.is_completed && <CountdownBadge date={m.date} />}
      {m.is_completed && <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
    </div>
  );

  return (
    <div className="space-y-4">
      {months.map(([monthLabel, items]) => (
        <div key={monthLabel}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 capitalize">{monthLabel}</p>
          {items.map((m) => renderRow(m))}
        </div>
      ))}

      {completed.length > 0 && (
        <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2">
            {completedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Fullførte ({completed.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            {completed.map((m) => renderRow(m, true))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// --- Add Modal ---

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
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioritet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Kritisk</SelectItem>
                  <SelectItem value="high">Høy</SelectItem>
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

// --- Main Page ---

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
