import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations } from "@/hooks/useActivityCatalog";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAllDailyUpdates } from "@/hooks/useDailyUpdates";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { ArrowRight, AlertTriangle, Lightbulb, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { format, getISOWeek, startOfWeek, endOfWeek, differenceInDays, parseISO } from "date-fns";
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

function useBacklogCount() {
  return useQuery({
    queryKey: ["backlog_count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("backlog_items").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
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
  const { data: backlogCount } = useBacklogCount();
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

  // Deadlines
  const deadlines = useMemo(() => {
    const list: { name: string; date: Date }[] = [
      { name: "Første halvdel aktiviteter", date: new Date(2026, 3, 5) },
      { name: "Prosjektinnlevering", date: new Date(2026, 4, 15) },
    ];
    if (activeSprint?.end_date) {
      list.push({ name: `${activeSprint.name} slutt`, date: parseISO(activeSprint.end_date) });
    }
    return list.filter((d) => d.date > now).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activeSprint, now]);

  const nextDeadline = deadlines[0];
  const daysToDeadline = nextDeadline ? differenceInDays(nextDeadline.date, now) : null;

  // Activity stats
  const regs = registrations ?? [];
  const cat = catalog ?? [];
  const completedRegs = regs.filter((r) => r.status === "completed");
  const totalEarned = completedRegs.reduce((sum, r) => {
    const c = cat.find((c) => c.id === r.catalog_id);
    return sum + (c?.points ?? 0);
  }, 0);
  const maxPossible = 30;
  const plannedPoints = regs.filter((r) => r.status !== "completed" && r.status !== "not_started").reduce((sum, r) => {
    const c = cat.find((c) => c.id === r.catalog_id);
    return sum + (c?.points ?? 0);
  }, 0);
  const mandatoryRemaining = cat.filter((c) => c.is_mandatory && !regs.some((r) => r.catalog_id === c.id && r.status === "completed")).length;

  // Sprint stats
  const sprintStats = useMemo(() => {
    if (!sprintItems) return null;
    const todo = sprintItems.filter((i) => i.column_name === "todo");
    const inProgress = sprintItems.filter((i) => i.column_name === "in_progress");
    const review = sprintItems.filter((i) => i.column_name === "review");
    const done = sprintItems.filter((i) => i.column_name === "done");
    const totalSp = sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const doneSp = done.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    return { todo: todo.length, inProgress: inProgress.length, review: review.length, done: done.length, total: sprintItems.length, totalSp, doneSp };
  }, [sprintItems]);

  // Action items
  const actionItems = useMemo(() => {
    const items: { text: string; type: "urgent" | "warning" | "tip" }[] = [];
    // Mandatory activities not done with upcoming deadline
    const mandatoryNotDone = cat.filter((c) => c.is_mandatory && !regs.some((r) => r.catalog_id === c.id && r.status === "completed"));
    mandatoryNotDone.forEach((c) => {
      const deadline = c.period_deadline ? parseISO(c.period_deadline) : null;
      if (deadline) {
        const days = differenceInDays(deadline, now);
        if (days <= 30 && days >= 0) {
          items.push({ text: `${c.name} er obligatorisk — frist ${format(deadline, "d. MMMM", { locale: nb })} (${days} dager)`, type: days <= 7 ? "urgent" : "warning" });
        }
      }
    });
    // Review items
    if (sprintStats && sprintStats.review > 0) {
      items.push({ text: `${sprintStats.review} items i Review — vurdér å godkjenne`, type: "warning" });
    }
    // Tip about activity planning
    if (completedRegs.length === 0 && regs.length === 0) {
      items.push({ text: "Ingen aktiviteter planlagt ennå — maks 3 valgfrie gir poeng per uke", type: "tip" });
    }
    return items.slice(0, 3);
  }, [cat, regs, completedRegs, sprintStats, now]);

  // Team member sprint data
  const teamData = useMemo(() => {
    if (!members || !sprintItems) return [];
    const todayStr = format(now, "yyyy-MM-dd");
    return members.map((m) => {
      const myItems = sprintItems.filter((si) => si.backlog_item?.assignee_id === m.id);
      const active = myItems.filter((si) => si.column_name !== "done");
      const todo = myItems.filter((si) => si.column_name === "todo").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const ip = myItems.filter((si) => si.column_name === "in_progress").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const rv = myItems.filter((si) => si.column_name === "review").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const dn = myItems.filter((si) => si.column_name === "done").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const totalSp = todo + ip + rv + dn;
      // Latest standup
      const memberUpdates = allUpdates?.filter((u) => u.member_id === m.id);
      const latest = memberUpdates?.length ? memberUpdates[memberUpdates.length - 1] : null;
      return { member: m, activeCount: active.length, todo, ip, rv, dn, totalSp, latestUpdate: latest };
    });
  }, [members, sprintItems, allUpdates, now]);

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

  const inProgressCount = sprintStats?.inProgress ?? 0;

  return (
    <div className="space-y-5 scroll-reveal">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{weekLabel}</p>
        </div>
        {nextDeadline && daysToDeadline !== null && (
          <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
            daysToDeadline <= 7
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-muted text-muted-foreground"
          }`}>
            {daysToDeadline} dager til {nextDeadline.name}
          </div>
        )}
      </div>

      {/* 2. Action items */}
      {actionItems.length > 0 && (
        <div className="space-y-2">
          {actionItems.map((item, i) => {
            const styles = {
              urgent: "bg-red-50 border-red-200 text-red-700",
              warning: "bg-amber-50 border-amber-200 text-amber-700",
              tip: "bg-teal-50 border-teal-200 text-teal-700",
            };
            const icons = {
              urgent: Flame,
              warning: AlertTriangle,
              tip: Lightbulb,
            };
            const Icon = icons[item.type];
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${styles[item.type]}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.text}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Two-column: Sprint + Activities */}
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
                    {/* Stacked progress */}
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      {sprintStats.total > 0 && (
                        <>
                          <div className="bg-gray-400 transition-all" style={{ width: `${(sprintStats.todo / sprintStats.total) * 100}%` }} />
                          <div className="bg-blue-500 transition-all" style={{ width: `${(sprintStats.inProgress / sprintStats.total) * 100}%` }} />
                          <div className="bg-amber-500 transition-all" style={{ width: `${(sprintStats.review / sprintStats.total) * 100}%` }} />
                          <div className="bg-green-500 transition-all" style={{ width: `${(sprintStats.done / sprintStats.total) * 100}%` }} />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{sprintStats.doneSp}</span> av {sprintStats.totalSp} SP</p>
                      <Link to="/sprinter" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">Åpne Sprint Board <ArrowRight className="h-3 w-3" /></Link>
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
              <p className="text-xs"><span className="text-blue-600 font-medium">{plannedPoints}p</span> <span className="text-muted-foreground">planlagt</span></p>
              <p className="text-xs"><span className="text-red-500 font-medium">{mandatoryRemaining}</span> <span className="text-muted-foreground">obligatoriske gjenstår</span></p>
            </div>
            <Link to="/aktiviteter" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">Åpne Aktiviteter <ArrowRight className="h-3 w-3" /></Link>
          </CardContent>
        </Card>
      </div>

      {/* 4. Team overview */}
      {teamData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teamData.map(({ member, activeCount, todo, ip, rv, dn, totalSp, latestUpdate }) => (
            <Card key={member.id} className="rounded-xl border-[0.5px]">
              <CardContent className="pt-4 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MemberAvatar member={member} size="md" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{member.name.split(" ")[0]}</p>
                    <p className="text-[11px] text-muted-foreground">{activeCount} oppgaver i sprint</p>
                  </div>
                </div>
                {/* Mini stacked bar */}
                {totalSp > 0 && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden flex">
                    <div className="bg-gray-400" style={{ width: `${(todo / totalSp) * 100}%` }} />
                    <div className="bg-blue-500" style={{ width: `${(ip / totalSp) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(rv / totalSp) * 100}%` }} />
                    <div className="bg-green-500" style={{ width: `${(dn / totalSp) * 100}%` }} />
                  </div>
                )}
                {/* Latest standup */}
                {latestUpdate ? (
                  <p className="text-[11px] text-muted-foreground truncate">
                    <span className="text-foreground/60">{format(parseISO(latestUpdate.entry_date), "d. MMM", { locale: nb })}:</span>{" "}
                    {latestUpdate.content?.slice(0, 50)}{(latestUpdate.content?.length ?? 0) > 50 ? "…" : ""}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">Ingen oppdatering ennå</p>
                )}
              </CardContent>
            </Card>
          ))}
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

      {/* 6. Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Aktiviteter", to: "/aktiviteter", sub: `${totalEarned}p opptjent` },
          { label: "Sprinter", to: "/sprinter", sub: `${inProgressCount} in progress` },
          { label: "Møtekalender", to: "/moter", sub: enrichedMeetings[0] ? format(parseISO(enrichedMeetings[0].meeting_date!), "d. MMM", { locale: nb }) : "Vis møter" },
          { label: "Oppgaver", to: "/oppgaver", sub: `${backlogCount ?? 0} items` },
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
