import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations } from "@/hooks/useActivityCatalog";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAllDailyUpdates } from "@/hooks/useDailyUpdates";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format, getISOWeek, startOfWeek, endOfWeek, differenceInDays, parseISO, isToday, isTomorrow, isBefore, startOfDay, subWeeks, isWithinInterval } from "date-fns";
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

function useUpcomingMeetings() {
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["upcoming_meetings_dash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, meeting_date, leader_id, notetaker_id, status, recurring_meeting_id, type")
        .gte("meeting_date", today)
        .eq("status", "upcoming")
        .order("meeting_date")
        .limit(3);
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

function useMeetingAgendaItems(meetingIds: string[]) {
  return useQuery({
    queryKey: ["meeting_agenda_items_dash", meetingIds],
    enabled: meetingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agenda_items")
        .select("meeting_id")
        .in("meeting_id", meetingIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// --- component ---

export default function DashboardPage() {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: members } = useTeamMembers();
  const { data: activeSprint } = useActiveSprint();
  const { data: sprintItems } = useSprintItemsForSprint(activeSprint?.id);
  const { data: upcomingMeetings } = useUpcomingMeetings();
  const { data: recurringMeetings } = useRecurringMeetings();
  const { data: allUpdates } = useAllDailyUpdates();

  const meetingIds = useMemo(() => upcomingMeetings?.map((m) => m.id) ?? [], [upcomingMeetings]);
  const { data: agendaItems } = useMeetingAgendaItems(meetingIds);

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

  // Next upcoming deadline for header badge
  const nextDeadline = viktigeFrister.find((f) => !f.passed);
  const nextDeadlineDate = nextDeadline?.parsedDate ?? null;
  const isUrgentDeadline = nextDeadlineDate ? (isToday(nextDeadlineDate) || isTomorrow(nextDeadlineDate)) : false;
  const regs = registrations ?? [];
  const cat = catalog ?? [];
  const totalEarned = calcTotalEarnedPoints(regs, cat);
  const maxPossible = 30;
  const mandatoryRemaining = cat.filter((c) => c.is_mandatory && !regs.some((r) => r.catalog_id === c.id && r.status === "completed"));

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
    return { todo: todo.length, inProgress: inProgress.length, review: review.length, done: done.length, total: sprintItems.length, totalSp, doneSp, todoSp, ipSp, reviewSp };
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
      const myItems = sprintItems.filter((si) => si.backlog_item?.assignee_id === m.id);
      const active = myItems.filter((si) => si.column_name !== "done");
      const todo = myItems.filter((si) => si.column_name === "todo").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const ip = myItems.filter((si) => si.column_name === "in_progress").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const rv = myItems.filter((si) => si.column_name === "review").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const dn = myItems.filter((si) => si.column_name === "done").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const totalSp = todo + ip + rv + dn;
      const memberUpdates = allUpdates?.filter((u) => u.member_id === m.id) ?? [];
      const latest = memberUpdates.length ? memberUpdates[memberUpdates.length - 1] : null;

      // Sparkline: count updates per week bucket
      const weeklyCounts = weekBuckets.map((b) =>
        memberUpdates.filter((u) => {
          const d = parseISO(u.entry_date);
          return isWithinInterval(d, { start: b.start, end: b.end });
        }).length
      );

      return { member: m, activeCount: active.length, totalItems: myItems.length, todo, ip, rv, dn, totalSp, latestUpdate: latest, weeklyCounts };
    });
  }, [members, sprintItems, allUpdates, weekBuckets]);

  // Upcoming meetings enriched
  const enrichedMeetings = useMemo(() => {
    if (!upcomingMeetings || !members || !recurringMeetings) return [];
    return upcomingMeetings.slice(0, 2).map((m) => {
      const recurring = recurringMeetings.find((r) => r.id === m.recurring_meeting_id);
      const leader = members.find((mem) => mem.id === m.leader_id);
      const notetaker = members.find((mem) => mem.id === m.notetaker_id);
      const agendaCount = agendaItems?.filter((a) => a.meeting_id === m.id).length ?? 0;
      return { ...m, recurring, leader, notetaker, agendaCount };
    });
  }, [upcomingMeetings, members, recurringMeetings, agendaItems]);

  // Positive summary line
  const activeItemsCount = (sprintStats?.inProgress ?? 0) + (sprintStats?.review ?? 0);
  const summaryParts: string[] = [];
  if (activeSprint) {
    summaryParts.push(`${activeSprint.name} er i gang`);
    if (activeItemsCount > 0) summaryParts.push(`${activeItemsCount} items aktive`);
    if (totalEarned > 0) summaryParts.push(`${totalEarned} av ${maxPossible} aktivitetspoeng opptjent`);
  }
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(" — ") + "." : null;

  // Sprint positive framing
  const doneCount = sprintStats?.done ?? 0;
  const sprintPositiveLabel = doneCount === 0
    ? `${activeItemsCount} items i arbeid`
    : doneCount === 1
    ? "1 item levert denne sprinten"
    : `${doneCount} items levert denne sprinten`;



  return (
    <div className="space-y-5 scroll-reveal">
      {/* 1. Header + milestone badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{weekLabel}</p>
        </div>
        {nextDeadline && nextDeadlineDate && (
          <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
            isUrgentDeadline
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-muted text-muted-foreground"
          }`}>
            Neste: {nextDeadline.title} — {format(nextDeadlineDate, "EEE d. MMMM", { locale: nb })}
          </div>
        )}
      </div>

      {/* 2. Positive summary */}
      {summaryLine && (
        <p className="text-sm text-muted-foreground">{summaryLine}</p>
      )}

      {/* 3. Sprint + Activities (most prominent) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sprint (3/5) */}
        <Card className="lg:col-span-3 rounded-xl border-[0.5px]">
          <CardContent className="pt-5 space-y-3">
            {activeSprint ? (
              <>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Nåværende sprint</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">{activeSprint.name} — {format(parseISO(activeSprint.start_date), "d.", { locale: nb })}–{format(parseISO(activeSprint.end_date), "d. MMM", { locale: nb })}</p>
                  {activeSprint.goal && <p className="text-sm text-muted-foreground italic mt-0.5">{activeSprint.goal}</p>}
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
                          <p className="text-[20px] font-medium text-foreground tabular-nums">{c.count}</p>
                          <p className="text-[11px] text-muted-foreground">{c.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Stacked progress bar */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      {sprintStats.totalSp > 0 && (
                        <>
                          <div className="bg-gray-400 origin-left animate-grow-bar" style={{ width: `${(sprintStats.todoSp / sprintStats.totalSp) * 100}%`, animationDuration: '0.8s' }} />
                          <div className="bg-blue-500 origin-left animate-grow-bar" style={{ width: `${(sprintStats.ipSp / sprintStats.totalSp) * 100}%`, animationDuration: '0.8s', animationDelay: '0.1s', animationFillMode: 'both' }} />
                          <div className="bg-amber-500 origin-left animate-grow-bar" style={{ width: `${(sprintStats.reviewSp / sprintStats.totalSp) * 100}%`, animationDuration: '0.8s', animationDelay: '0.2s', animationFillMode: 'both' }} />
                          <div className="bg-green-500 origin-left animate-grow-bar" style={{ width: `${(sprintStats.doneSp / sprintStats.totalSp) * 100}%`, animationDuration: '0.8s', animationDelay: '0.3s', animationFillMode: 'both' }} />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{sprintPositiveLabel}</p>
                      <Link to="/sprinter" className="text-xs text-primary font-medium hover:underline flex items-center gap-1 shrink-0">Sprint Board <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Ingen aktiv sprint</p>
                <Link to="/sprinter" className="text-xs text-primary font-medium hover:underline mt-1 inline-block">Opprett en i Sprinter →</Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities (2/5) */}
        <Card className="lg:col-span-2 rounded-xl border-[0.5px]">
          <CardContent className="pt-5 space-y-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Aktivitetspoeng</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground tabular-nums">{totalEarned}</span>
              <span className="text-sm text-muted-foreground">/ {maxPossible} poeng</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${Math.min((totalEarned / maxPossible) * 100, 100)}%` }} />
            </div>
            <div className="flex gap-4">
              {mandatoryRemaining.length > 0 && (
                <p className="text-xs text-muted-foreground">{mandatoryRemaining.length} obligatoriske gjenstår</p>
              )}
            </div>
            <Link to="/aktiviteter" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">Åpne Aktiviteter <ArrowRight className="h-3 w-3" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* 4. Team overview */}
      {teamData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamData.map(({ member, activeCount, totalItems, todo, ip, rv, dn, totalSp, latestUpdate, weeklyCounts }) => {
            // Build sparkline SVG path
            const maxCount = Math.max(...weeklyCounts, 1);
            const sparkW = 48;
            const sparkH = 16;
            const points = weeklyCounts.map((c, i) => {
              const x = (i / (weeklyCounts.length - 1)) * sparkW;
              const y = sparkH - (c / maxCount) * sparkH;
              return `${x},${y}`;
            });
            const sparkPath = `M${points.join(" L")}`;
            const hasAnyUpdates = weeklyCounts.some((c) => c > 0);

            return (
            <Link key={member.id} to={`/profil/${member.id}`} className="block">
            <Card className="rounded-xl border-[0.5px] hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MemberAvatar member={member} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.name.split(" ")[0]}</p>
                    {totalItems > 0 ? (
                      <p className="text-[11px] text-muted-foreground">{activeCount} oppgaver i sprint</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Ingen tildelte oppgaver</p>
                    )}
                  </div>
                </div>
                {/* Mini stacked bar — only if has SP */}
                {totalSp > 0 && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden flex">
                    <div className="bg-gray-400" style={{ width: `${(todo / totalSp) * 100}%` }} />
                    <div className="bg-blue-500" style={{ width: `${(ip / totalSp) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(rv / totalSp) * 100}%` }} />
                    <div className="bg-green-500" style={{ width: `${(dn / totalSp) * 100}%` }} />
                  </div>
                )}
                {/* Sparkline: standup entries last 4 weeks */}
                {hasAnyUpdates && (
                  <div className="flex items-center gap-1.5">
                    <svg width={sparkW} height={sparkH} className="shrink-0">
                      <polyline points={points.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      {weeklyCounts.map((c, i) => (
                        <circle key={i} cx={(i / (weeklyCounts.length - 1)) * sparkW} cy={sparkH - (c / maxCount) * sparkH} r="2" fill="hsl(var(--primary))" />
                      ))}
                    </svg>
                    <span className="text-[10px] text-muted-foreground">{weeklyCounts[weeklyCounts.length - 1]} denne uken</span>
                  </div>
                )}
                {/* Only show standup if they have one */}
                {latestUpdate && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    <span className="text-foreground/60">{format(parseISO(latestUpdate.entry_date), "d. MMM", { locale: nb })}:</span>{" "}
                    {latestUpdate.content?.slice(0, 50)}{(latestUpdate.content?.length ?? 0) > 50 ? "…" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
            </Link>
          );
          })}
        </div>
      )}

      {/* 5. Upcoming meetings */}
      {enrichedMeetings.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1">Kommende møter</p>
          {enrichedMeetings.map((m) => (
            <Link key={m.id} to="/moter">
              <Card className="rounded-xl border-[0.5px] hover:shadow-sm transition-shadow cursor-pointer">
                <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {m.recurring?.label ?? "Møte"} — {m.meeting_date ? format(parseISO(m.meeting_date), "EEEE d. MMMM", { locale: nb }) : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.recurring?.start_time?.slice(0, 5)}–{m.recurring?.end_time?.slice(0, 5)}
                      {m.leader && ` · Leder: ${m.leader.name.split(" ")[0]}`}
                      {m.notetaker && ` · Ref: ${m.notetaker.name.split(" ")[0]}`}
                      {m.agendaCount > 0 && ` · ${m.agendaCount} agendapunkt`}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 6. Viktige frister */}
      <div className="space-y-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1 mb-2">Viktige frister</p>
        {viktigeFrister.filter((f) => !f.passed).map((f, i, arr) => {
          const badgeColor = f.days <= 1 ? "bg-red-100 text-red-700" : f.days < 7 ? "bg-red-100 text-red-700" : f.days < 14 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground";
          const dateLabel = f.dateEnd
            ? `${format(f.parsedDate, "d.", { locale: nb })}–${format(parseISO(f.dateEnd), "d. MMMM", { locale: nb })}`
            : format(f.parsedDate, "d. MMMM", { locale: nb });
          return (
            <div key={f.title} className={`flex items-center justify-between py-2.5 px-1 ${i < arr.length - 1 ? "border-b border-border/50" : ""}`}>
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

      {/* 7. Quick links (3 items) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aktiviteter", to: "/aktiviteter", sub: `${totalEarned}p opptjent` },
          { label: "Sprinter", to: "/sprinter", sub: `${sprintStats?.inProgress ?? 0} in progress` },
          { label: "Møtekalender", to: "/moter", sub: enrichedMeetings[0] ? format(parseISO(enrichedMeetings[0].meeting_date!), "d. MMM", { locale: nb }) : "Vis møter" },
        ].map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="rounded-xl border-[0.5px] hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
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
