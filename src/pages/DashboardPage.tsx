import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations, type Registration, type CatalogItem } from "@/hooks/useActivityCatalog";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAllDailyUpdates, useCurrentMember } from "@/hooks/useDailyUpdates";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { ArrowRight, ChevronLeft, ChevronRight, Check, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  format,
  getISOWeek,
  startOfWeek,
  endOfWeek,
  differenceInDays,
  parseISO,
  isToday,
  isTomorrow,
  isBefore,
  startOfDay,
  subWeeks,
  isWithinInterval,
  addWeeks,
  addDays,
} from "date-fns";
import { nb } from "date-fns/locale";
import type { Sprint, BacklogItem, SprintItem } from "@/lib/types";

// --- data hooks ---

function useActiveSprint() {
  return useQuery<Sprint | null>({
    queryKey: ["active_sprint_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useSprintItemsForSprint(sprintId: string | undefined) {
  return useQuery<(SprintItem & { backlog_item: BacklogItem })[]>({
    queryKey: ["sprint_items_dash", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items")
        .select("*, backlog_item:backlog_items(*)")
        .eq("sprint_id", sprintId!)
        .order("column_order");
      if (error) throw error;
      return data as any;
    },
  });
}

function useWeekMeetings(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["week_meetings_dash", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, meeting_date, status, recurring_meeting_id, type")
        .gte("meeting_date", weekStart)
        .lte("meeting_date", weekEnd)
        .order("meeting_date");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useRecurringMeetings() {
  return useQuery({
    queryKey: ["recurring_meetings_dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_meetings").select("*").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useSubSessionsForMeetings(meetingIds: string[]) {
  return useQuery({
    queryKey: ["sub_sessions_week_dash", meetingIds],
    enabled: meetingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("meeting_sub_sessions" as any)
        .select("id, meeting_id, type, sort_order")
        .in("meeting_id", meetingIds)
        .order("sort_order") as any);
      if (error) throw error;
      return (data ?? []) as { id: string; meeting_id: string; type: string; sort_order: number }[];
    },
  });
}

// --- WeeklyPlan sub-component ---

const SUB_SESSION_COLORS: Record<string, string> = {
  sprint_planning: "bg-blue-50 text-blue-700",
  sprint_review: "bg-teal-50 text-teal-700",
  retrospective: "bg-red-50 text-red-600",
  advisor: "bg-purple-50 text-purple-700",
  veiledermøte: "bg-purple-50 text-purple-700",
  daily_standup: "bg-gray-100 text-gray-600",
  mobb_programmering: "bg-orange-50 text-orange-700",
  workshop: "bg-yellow-50 text-yellow-700",
};

const SUB_SESSION_LABELS: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retro",
  advisor: "Veiledermøte",
  veiledermøte: "Veiledermøte",
  daily_standup: "Standup",
  mobb_programmering: "Mobprog.",
  workshop: "Workshop",
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  standup: "Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retro",
  advisor: "Veiledermøte",
  other: "Møte",
};

function WeeklyPlan({
  registrations,
  catalog,
}: {
  registrations: Registration[];
  catalog: CatalogItem[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const baseDate = useMemo(() => addWeeks(new Date(), weekOffset), [weekOffset]);
  const weekStart = useMemo(() => startOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);
  const weekEnd = useMemo(() => endOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);
  const weekNum = getISOWeek(baseDate);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  const { data: weekMeetings = [] } = useWeekMeetings(weekStartStr, weekEndStr);
  const { data: recurringMeetings = [] } = useRecurringMeetings();
  const meetingIds = useMemo(() => weekMeetings.map((m) => m.id), [weekMeetings]);
  const { data: subSessions = [] } = useSubSessionsForMeetings(meetingIds);

  // Mon–Fri only
  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Build events per day
  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach((d) => {
      map[format(d, "yyyy-MM-dd")] = [];
    });

    // 1. Meetings
    weekMeetings.forEach((m) => {
      const dateStr = m.meeting_date;
      if (!map[dateStr]) return;
      const recurring = recurringMeetings.find((r: any) => r.id === m.recurring_meeting_id);
      const label = recurring?.label ?? MEETING_TYPE_LABELS[m.type] ?? "Møte";
      const time = recurring?.start_time?.slice(0, 5) ?? null;
      const subs = subSessions.filter((ss) => ss.meeting_id === m.id);
      map[dateStr].push({ type: "meeting", id: m.id, label, time, status: m.status, subs });
    });

    // 2. Completed activities this week (by completed_date)
    registrations.forEach((r) => {
      if (r.status !== "completed" || !r.completed_date) return;
      const dateStr = r.completed_date;
      if (!map[dateStr]) return;
      const cat = catalog.find((c) => c.id === r.catalog_id);
      if (!cat) return;
      map[dateStr].push({ type: "activity_done", id: r.id, label: cat.name });
    });

    // 3. Planned activities this week (not completed) — placed on Monday
    const mondayStr = format(weekStart, "yyyy-MM-dd");
    registrations.forEach((r) => {
      if (r.status === "completed") return;
      if (r.planned_week !== weekNum) return;
      const cat = catalog.find((c) => c.id === r.catalog_id);
      if (!cat || !map[mondayStr]) return;
      map[mondayStr].push({ type: "activity_planned", id: r.id, label: cat.name });
    });

    return map;
  }, [days, weekMeetings, subSessions, registrations, catalog, recurringMeetings, weekNum, weekStart]);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = `Uke ${weekNum} — ${format(weekStart, "d.", { locale: nb })}–${format(weekEnd, "d. MMMM", { locale: nb })}`;

  return (
    <Card className="rounded-xl border">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => !isCurrentWeek && setWeekOffset(0)}
            className={`text-xs uppercase tracking-wider font-medium transition-colors ${
              isCurrentWeek
                ? "text-muted-foreground cursor-default"
                : "text-primary cursor-pointer hover:underline"
            }`}
          >
            {isCurrentWeek ? "Denne uken" : weekLabel}
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Forrige uke"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-primary hover:underline px-1"
              >
                i dag
              </button>
            )}
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Neste uke"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Desktop: 5 columns */}
        <div className="hidden sm:grid grid-cols-5 divide-x divide-border/40 min-h-[200px]">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const todayHighlight = isToday(day);
            const events = eventsByDay[dateStr] ?? [];
            const maxVisible = expandedDay === dateStr ? events.length : 3;
            const visible = events.slice(0, maxVisible);
            const hiddenCount = events.length - maxVisible;

            return (
              <div key={dateStr} className={`px-2.5 first:pl-0 last:pr-0 min-w-0 ${todayHighlight ? "bg-primary/[0.03] -mx-px px-[11px]" : ""}`}>
                {/* Day header */}
                <div
                  className={`text-sm font-medium mb-2 pb-1.5 truncate ${
                    todayHighlight
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {format(day, "EEE d.", { locale: nb })}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {visible.map((ev, i) => {
                    if (ev.type === "meeting") {
                      return (
                        <div key={ev.id + i} className={ev.status === "completed" ? "opacity-50" : ""}>
                          <Link to="/moter" className="block group">
                            <div className="bg-primary/10 text-primary rounded-md px-2.5 py-1.5 text-sm font-medium flex items-center gap-1 min-w-0">
                              {ev.status === "completed" && (
                                <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                              )}
                              <span className="truncate">{ev.label}</span>
                              {ev.time && (
                                <span className="text-xs opacity-60 shrink-0">{ev.time}</span>
                              )}
                            </div>
                          </Link>
                          {ev.subs.map((ss: any) => (
                            <div
                              key={ss.id}
                              className={`mt-0.5 ml-2 rounded-md px-2 py-1 text-xs font-medium truncate ${
                                SUB_SESSION_COLORS[ss.type] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {SUB_SESSION_LABELS[ss.type] ?? ss.type}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (ev.type === "activity_done") {
                      return (
                        <div
                          key={ev.id + i}
                          className="bg-green-50 text-green-700 rounded-md px-2.5 py-1.5 text-sm font-medium flex items-center gap-1 min-w-0"
                        >
                          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{ev.label}</span>
                        </div>
                      );
                    }
                    if (ev.type === "activity_planned") {
                      return (
                        <div
                          key={ev.id + i}
                          className="bg-amber-50 text-amber-700 rounded-md px-2.5 py-1.5 text-sm font-medium flex items-center gap-1 min-w-0"
                        >
                          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{ev.label}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => setExpandedDay(dateStr)}
                      className="text-xs text-muted-foreground hover:text-foreground block"
                    >
                      +{hiddenCount} til
                    </button>
                  )}
                  {expandedDay === dateStr && events.length > 3 && (
                    <button
                      onClick={() => setExpandedDay(null)}
                      className="text-xs text-muted-foreground hover:text-foreground block"
                    >
                      Vis færre
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical list — only days with events */}
        <div className="sm:hidden space-y-2">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const todayHighlight = isToday(day);
            const events = eventsByDay[dateStr] ?? [];
            if (events.length === 0) return null;

            return (
              <div key={dateStr} className="flex gap-3 items-start">
                <div
                  className={`text-xs font-medium w-12 shrink-0 pt-0.5 ${
                    todayHighlight ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "EEE d.", { locale: nb })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {events.map((ev, i) => {
                    const cls =
                      ev.type === "meeting"
                        ? "bg-primary/10 text-primary"
                        : ev.type === "activity_done"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700";
                    return (
                      <span
                        key={i}
                        className={`${cls} rounded-md px-2 py-1 text-xs font-medium`}
                      >
                        {ev.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {days.every((d) => (eventsByDay[format(d, "yyyy-MM-dd")] ?? []).length === 0) && (
            <p className="text-xs text-muted-foreground">Ingen hendelser denne uken</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- greeting helper ---

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "God morgen";
  if (hour < 17) return "God ettermiddag";
  return "God kveld";
}

// --- main component ---

export default function DashboardPage() {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: members } = useTeamMembers();
  const { data: activeSprint } = useActiveSprint();
  const { data: sprintItems } = useSprintItemsForSprint(activeSprint?.id);
  const { data: allUpdates } = useAllDailyUpdates();
  const { currentMember } = useCurrentMember();

  const now = new Date();
  const weekNum = getISOWeek(now);
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const weekLabel = `Uke ${weekNum} — ${format(ws, "d.", { locale: nb })}–${format(we, "d. MMMM yyyy", { locale: nb })}`;

  const firstName = currentMember?.name?.split(" ")[0] ?? "";

  // Hardcoded important deadlines
  const viktigeFrister = useMemo(() => {
    const items = [
      { title: "Frist aktiviteter – Del 1", date: "2026-04-05" },
      { title: "Frist aktiviteter – Del 2", date: "2026-05-10" },
      { title: "Innlevering av prosjektarbeid", date: "2026-05-15" },
      { title: "Skriftlig eksamen", date: "2026-05-29" },
      { title: "Muntlige presentasjoner", date: "2026-06-01", dateEnd: "2026-06-12" },
    ];
    const today = startOfDay(now);
    return items
      .map((f) => {
        const d = parseISO(f.date);
        const days = differenceInDays(d, today);
        const passed = isBefore(d, today);
        return { ...f, parsedDate: d, days, passed };
      })
      .sort((a, b) => (a.passed === b.passed ? a.days - b.days : a.passed ? 1 : -1));
  }, [now]);

  const nextDeadline = viktigeFrister.find((f) => !f.passed);
  const nextDeadlineDate = nextDeadline?.parsedDate ?? null;
  const isUrgentDeadline = nextDeadlineDate
    ? isToday(nextDeadlineDate) || isTomorrow(nextDeadlineDate)
    : false;

  const regs = registrations ?? [];
  const cat = catalog ?? [];
  const totalEarned = calcTotalEarnedPoints(regs, cat);
  const maxPossible = 30;
  const mandatoryRemaining = cat.filter(
    (c) => c.is_mandatory && !regs.some((r) => r.catalog_id === c.id && r.status === "completed")
  );

  // Sprint stats
  const sprintStats = useMemo(() => {
    if (!sprintItems) return null;
    const todo = sprintItems.filter((i) => i.column_name === "todo");
    const inProgress = sprintItems.filter((i) => i.column_name === "in_progress");
    const review = sprintItems.filter((i) => i.column_name === "review");
    const done = sprintItems.filter((i) => i.column_name === "done");
    const totalSp = sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const doneSp = done.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const todoSp = todo.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const ipSp = inProgress.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const reviewSp = review.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    return {
      todo: todo.length,
      inProgress: inProgress.length,
      review: review.length,
      done: done.length,
      total: sprintItems.length,
      totalSp,
      doneSp,
      todoSp,
      ipSp,
      reviewSp,
    };
  }, [sprintItems]);

  // Build 4-week buckets for sparklines (kept for data — sparklines hidden per spec)
  const weekBuckets = useMemo(() => {
    const buckets: { start: Date; end: Date }[] = [];
    for (let i = 3; i >= 0; i--) {
      const s = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const e = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      buckets.push({ start: s, end: e });
    }
    return buckets;
  }, [now]);

  // Team member sprint data
  const teamData = useMemo(() => {
    if (!members || !sprintItems) return [];
    return members.map((m) => {
      const myItems = sprintItems.filter((si) => ((si.backlog_item as any)?.collaborator_ids ?? []).includes(m.id));
      const active = myItems.filter((si) => si.column_name !== "done");
      const todo = myItems
        .filter((si) => si.column_name === "todo")
        .reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const ip = myItems
        .filter((si) => si.column_name === "in_progress")
        .reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const rv = myItems
        .filter((si) => si.column_name === "review")
        .reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const dn = myItems
        .filter((si) => si.column_name === "done")
        .reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const totalSp = todo + ip + rv + dn;
      const memberUpdates = allUpdates?.filter((u) => u.member_id === m.id) ?? [];
      const latest = memberUpdates.length ? memberUpdates[memberUpdates.length - 1] : null;

      const weeklyCounts = weekBuckets.map((b) =>
        memberUpdates.filter((u) => {
          const d = parseISO(u.entry_date);
          return isWithinInterval(d, { start: b.start, end: b.end });
        }).length
      );

      return {
        member: m,
        activeCount: active.length,
        totalItems: myItems.length,
        todo,
        ip,
        rv,
        dn,
        totalSp,
        latestUpdate: latest,
        weeklyCounts,
      };
    });
  }, [members, sprintItems, allUpdates, weekBuckets]);

  return (
    <div className="space-y-8 scroll-reveal">
      {/* 1. Greeting + deadline badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
        </div>
        {nextDeadline && nextDeadlineDate && (
          <div
            className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
              isUrgentDeadline
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Neste: {nextDeadline.title} —{" "}
            {format(nextDeadlineDate, "EEE d. MMMM", { locale: nb })}
          </div>
        )}
      </div>

      {/* 2. Sprint + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sprint (3/5) */}
        <Card className="lg:col-span-3 rounded-xl border-l-4 border-l-teal-500">
          <CardContent className="p-5 space-y-4">
            {activeSprint ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                    Nåværende sprint
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {activeSprint.name} —{" "}
                    {format(parseISO(activeSprint.start_date), "d.", { locale: nb })}–
                    {format(parseISO(activeSprint.end_date), "d. MMM", { locale: nb })}
                  </p>
                  {activeSprint.goal && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {activeSprint.goal}
                    </p>
                  )}
                </div>
                {sprintStats && (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "To Do", count: sprintStats.todo, color: "bg-gray-400" },
                        { label: "In Progress", count: sprintStats.inProgress, color: "bg-blue-500" },
                        { label: "Review", count: sprintStats.review, color: "bg-amber-500" },
                        { label: "Done", count: sprintStats.done, color: "bg-green-500" },
                      ].map((c) => (
                        <div key={c.label} className="text-center">
                          <p className="text-3xl font-bold text-foreground tabular-nums">
                            {c.count}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      {sprintStats.totalSp > 0 && (
                        <>
                          <div
                            className="bg-gray-400 origin-left animate-grow-bar"
                            style={{
                              width: `${(sprintStats.todoSp / sprintStats.totalSp) * 100}%`,
                              animationDuration: "0.8s",
                            }}
                          />
                          <div
                            className="bg-blue-500 origin-left animate-grow-bar"
                            style={{
                              width: `${(sprintStats.ipSp / sprintStats.totalSp) * 100}%`,
                              animationDuration: "0.8s",
                              animationDelay: "0.1s",
                              animationFillMode: "both",
                            }}
                          />
                          <div
                            className="bg-amber-500 origin-left animate-grow-bar"
                            style={{
                              width: `${(sprintStats.reviewSp / sprintStats.totalSp) * 100}%`,
                              animationDuration: "0.8s",
                              animationDelay: "0.2s",
                              animationFillMode: "both",
                            }}
                          />
                          <div
                            className="bg-green-500 origin-left animate-grow-bar"
                            style={{
                              width: `${(sprintStats.doneSp / sprintStats.totalSp) * 100}%`,
                              animationDuration: "0.8s",
                              animationDelay: "0.3s",
                              animationFillMode: "both",
                            }}
                          />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-end">
                      <Link
                        to="/sprinter"
                        className="text-sm text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
                      >
                        Sprint Board <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Ingen aktiv sprint</p>
                <Link
                  to="/sprinter"
                  className="text-sm text-primary font-medium hover:underline mt-1 inline-block"
                >
                  Opprett en i Sprinter →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities (2/5) */}
        <Card className="lg:col-span-2 rounded-xl border">
          <CardContent className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Aktivitetspoeng
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-foreground tabular-nums">{totalEarned}</span>
              <span className="text-sm text-muted-foreground">/ {maxPossible} poeng</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${Math.min((totalEarned / maxPossible) * 100, 100)}%` }}
              />
            </div>
            <div className="flex gap-4">
              {mandatoryRemaining.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {mandatoryRemaining.length} obligatoriske gjenstår
                </p>
              )}
            </div>
            <Link
              to="/aktiviteter"
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              Åpne Aktiviteter <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 3. Team overview — 2 columns */}
      {teamData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teamData.map(
            ({
              member,
              activeCount,
              totalItems,
              todo,
              ip,
              rv,
              dn,
              totalSp,
              latestUpdate,
            }) => (
              <Link key={member.id} to={`/profil/${member.id}`} className="block">
                <Card className="rounded-xl border hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={member} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {member.name.split(" ")[0]}
                        </p>
                        {totalItems > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {activeCount} oppgaver i sprint
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Ingen tildelte oppgaver
                          </p>
                        )}
                      </div>
                    </div>
                    {totalSp > 0 && (
                      <div className="h-1 rounded-full bg-muted overflow-hidden flex">
                        <div className="bg-gray-400" style={{ width: `${(todo / totalSp) * 100}%` }} />
                        <div className="bg-blue-500" style={{ width: `${(ip / totalSp) * 100}%` }} />
                        <div className="bg-amber-500" style={{ width: `${(rv / totalSp) * 100}%` }} />
                        <div className="bg-green-500" style={{ width: `${(dn / totalSp) * 100}%` }} />
                      </div>
                    )}
                    {/* Sparkline hidden — data still available */}
                    {latestUpdate && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        <span className="text-foreground/60">
                          {format(parseISO(latestUpdate.entry_date), "d. MMM", { locale: nb })}:
                        </span>{" "}
                        {latestUpdate.content}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          )}
        </div>
      )}

      {/* 4. Ukesplan */}
      <WeeklyPlan registrations={regs} catalog={cat} />

      {/* 5. Viktige frister */}
      <Card className="rounded-xl border">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Viktige frister
          </p>
          {viktigeFrister
            .filter((f) => !f.passed)
            .map((f, i, arr) => {
              const dateLabel = f.dateEnd
                ? `${format(f.parsedDate, "d.", { locale: nb })}–${format(
                    parseISO(f.dateEnd),
                    "d. MMMM",
                    { locale: nb }
                  )}`
                : format(f.parsedDate, "d. MMMM", { locale: nb });
              const countdownClass =
                f.days < 7
                  ? "text-red-600 font-bold"
                  : f.days < 14
                  ? "text-amber-600 font-medium"
                  : "text-muted-foreground";
              return (
                <div
                  key={f.title}
                  className={`flex items-center justify-between py-3 ${
                    i < arr.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <span className="text-sm text-foreground">{f.title}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-muted-foreground">{dateLabel}</span>
                    <span className={`text-sm ${countdownClass}`}>
                      {f.days === 0 ? "i dag" : f.days === 1 ? "i morgen" : `${f.days} dager`}
                    </span>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Hurtiglenker fjernet — tilgjengelig via sidebar */}
    </div>
  );
}
