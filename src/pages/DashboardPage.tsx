import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations, type Registration, type CatalogItem } from "@/hooks/useActivityCatalog";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAllDailyUpdates } from "@/hooks/useDailyUpdates";
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
      <CardContent className="pt-5 pb-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => !isCurrentWeek && setWeekOffset(0)}
            className={`text-[11px] uppercase tracking-wider font-medium transition-colors ${
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
                className="text-[11px] text-primary hover:underline px-1"
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
        <div className="hidden sm:grid grid-cols-5 divide-x divide-border/40">
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const todayHighlight = isToday(day);
            const events = eventsByDay[dateStr] ?? [];
            const visible = events.slice(0, 4);
            const hiddenCount = events.length - 4;

            return (
              <div key={dateStr} className="px-2 first:pl-0 last:pr-0 min-w-0">
                {/* Day header */}
                <div
                  className={`text-[11px] font-medium mb-1.5 pb-1 truncate ${
                    todayHighlight
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {format(day, "EEE d.", { locale: nb })}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {visible.map((ev, i) => {
                    if (ev.type === "meeting") {
                      return (
                        <div key={ev.id + i} className={ev.status === "completed" ? "opacity-50" : ""}>
                          <Link to="/moter" className="block group">
                            <div className="bg-primary/10 text-primary rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 min-w-0">
                              {ev.status === "completed" && (
                                <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              )}
                              <span className="truncate">{ev.label}</span>
                              {ev.time && (
                                <span className="text-[10px] opacity-60 shrink-0">{ev.time}</span>
                              )}
                            </div>
                          </Link>
                          {ev.subs.map((ss: any) => (
                            <div
                              key={ss.id}
                              className={`mt-0.5 ml-1.5 rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium truncate ${
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
                          className="bg-green-50 text-green-700 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 min-w-0"
                        >
                          <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{ev.label}</span>
                        </div>
                      );
                    }
                    if (ev.type === "activity_planned") {
                      return (
                        <div
                          key={ev.id + i}
                          className="bg-amber-50 text-amber-700 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 min-w-0"
                        >
                          <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{ev.label}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {hiddenCount > 0 && (
                    <Link
                      to="/moter"
                      className="text-[10px] text-muted-foreground hover:text-foreground block"
                    >
                      +{hiddenCount} til
                    </Link>
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
                  className={`text-[11px] font-medium w-12 shrink-0 pt-0.5 ${
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
                        className={`${cls} rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium`}
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

// --- main component ---

export default function DashboardPage() {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: members } = useTeamMembers();
  const { data: activeSprint } = useActiveSprint();
  const { data: sprintItems } = useSprintItemsForSprint(activeSprint?.id);
  const { data: allUpdates } = useAllDailyUpdates();

  const now = new Date();
  const weekNum = getISOWeek(now);
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const we = endOfWeek(now, { weekStartsOn: 1 });
  const weekLabel = `Uke ${weekNum} — ${format(ws, "d.", { locale: nb })}–${format(we, "d. MMMM yyyy", { locale: nb })}`;

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

  // Build 4-week buckets for sparklines
  const weekBuckets = useMemo(() => {
    const buckets: { start: Date; end: Date }[] = [];
    for (let i = 3; i >= 0; i--) {
      const s = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const e = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      buckets.push({ start: s, end: e });
    }
    return buckets;
  }, [now]);

  // Team member sprint data + sparkline
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

  const activeItemsCount = (sprintStats?.inProgress ?? 0) + (sprintStats?.review ?? 0);
  const summaryParts: string[] = [];
  if (activeSprint) {
    summaryParts.push(`${activeSprint.name} er i gang`);
    if (activeItemsCount > 0) summaryParts.push(`${activeItemsCount} items aktive`);
    if (totalEarned > 0) summaryParts.push(`${totalEarned} av ${maxPossible} aktivitetspoeng opptjent`);
  }
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(" — ") + "." : null;

  const doneCount = sprintStats?.done ?? 0;
  const sprintPositiveLabel =
    doneCount === 0
      ? `${activeItemsCount} items i arbeid`
      : doneCount === 1
      ? "1 item levert denne sprinten"
      : `${doneCount} items levert denne sprinten`;

  return (
    <div className="space-y-8 scroll-reveal">
      {/* 1. Header + milestone badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{weekLabel}</p>
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

      {/* 2. Positive summary */}
      {summaryLine && <p className="text-sm text-muted-foreground">{summaryLine}</p>}

      {/* 3. Sprint + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sprint (3/5) */}
        <Card className="lg:col-span-3 rounded-xl border">
          <CardContent className="pt-5 space-y-3">
            {activeSprint ? (
              <>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    Nåværende sprint
                  </p>
                  <p className="text-base font-semibold text-foreground mt-0.5">
                    {activeSprint.name} —{" "}
                    {format(parseISO(activeSprint.start_date), "d.", { locale: nb })}–
                    {format(parseISO(activeSprint.end_date), "d. MMM", { locale: nb })}
                  </p>
                  {activeSprint.goal && (
                    <p className="text-sm text-muted-foreground italic mt-0.5">
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
                          <p className="text-[20px] font-medium text-foreground tabular-nums">
                            {c.count}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{c.label}</p>
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{sprintPositiveLabel}</p>
                      <Link
                        to="/sprinter"
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1 shrink-0"
                      >
                        Sprint Board <ArrowRight className="h-3 w-3" />
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
                  className="text-xs text-primary font-medium hover:underline mt-1 inline-block"
                >
                  Opprett en i Sprinter →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities (2/5) */}
        <Card className="lg:col-span-2 rounded-xl border">
          <CardContent className="pt-5 space-y-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Aktivitetspoeng
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground tabular-nums">{totalEarned}</span>
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
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              Åpne Aktiviteter <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 4. Team overview */}
      {teamData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              weeklyCounts,
            }) => {
              const maxCount = Math.max(...weeklyCounts, 1);
              const sparkW = 48;
              const sparkH = 16;
              const points = weeklyCounts.map((c, i) => {
                const x = (i / (weeklyCounts.length - 1)) * sparkW;
                const y = sparkH - (c / maxCount) * sparkH;
                return `${x},${y}`;
              });
              const hasAnyUpdates = weeklyCounts.some((c) => c > 0);

              return (
                <Link key={member.id} to={`/profil/${member.id}`} className="block">
                  <Card className="rounded-xl border hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="pt-5 pb-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <MemberAvatar member={member} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.name.split(" ")[0]}
                          </p>
                          {totalItems > 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                              {activeCount} oppgaver i sprint
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
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
                      {hasAnyUpdates && (
                        <div className="flex items-center gap-1.5">
                          <svg width={sparkW} height={sparkH} className="shrink-0" aria-hidden="true">
                            <polyline
                              points={points.join(" ")}
                              fill="none"
                              stroke="hsl(var(--primary))"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {weeklyCounts.map((c, i) => (
                              <circle
                                key={i}
                                cx={(i / (weeklyCounts.length - 1)) * sparkW}
                                cy={sparkH - (c / maxCount) * sparkH}
                                r="2"
                                fill="hsl(var(--primary))"
                              />
                            ))}
                          </svg>
                          <span className="text-[10px] text-muted-foreground">
                            {weeklyCounts[weeklyCounts.length - 1]} denne uken
                          </span>
                        </div>
                      )}
                      {latestUpdate && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          <span className="text-foreground/60">
                            {format(parseISO(latestUpdate.entry_date), "d. MMM", { locale: nb })}:
                          </span>{" "}
                          {latestUpdate.content?.slice(0, 50)}
                          {(latestUpdate.content?.length ?? 0) > 50 ? "…" : ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            }
          )}
        </div>
      )}

      {/* 5. Ukesplan */}
      <WeeklyPlan registrations={regs} catalog={cat} />

      {/* 6. Viktige frister */}
      <div className="space-y-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Viktige frister
        </p>
        {viktigeFrister
          .filter((f) => !f.passed)
          .map((f, i, arr) => {
            const badgeColor =
              f.days <= 1
                ? "bg-red-100 text-red-700"
                : f.days < 7
                ? "bg-red-100 text-red-700"
                : f.days < 14
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground";
            const dateLabel = f.dateEnd
              ? `${format(f.parsedDate, "d.", { locale: nb })}–${format(
                  parseISO(f.dateEnd),
                  "d. MMMM",
                  { locale: nb }
                )}`
              : format(f.parsedDate, "d. MMMM", { locale: nb });
            return (
              <div
                key={f.title}
                className={`flex items-center justify-between py-2.5 px-1 ${
                  i < arr.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <span className="text-[13px] text-foreground">{f.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[13px] text-muted-foreground">{dateLabel}</span>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>
                    {f.days === 0 ? "i dag" : f.days === 1 ? "i morgen" : `${f.days} dager`}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* 7. Quick links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aktiviteter", to: "/aktiviteter", sub: `${totalEarned}p opptjent` },
          { label: "Sprinter", to: "/sprinter", sub: `${sprintStats?.inProgress ?? 0} in progress` },
          { label: "Møtekalender", to: "/moter", sub: "Vis møter" },
        ].map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="rounded-xl border hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="pt-5 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-[11px] text-muted-foreground">{link.sub}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
