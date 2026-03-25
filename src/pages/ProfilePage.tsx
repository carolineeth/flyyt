import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentMember } from "@/hooks/useDailyUpdates";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useActivityCatalog, useActivityRegistrations } from "@/hooks/useActivityCatalog";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, CheckSquare, MessageSquare, Zap } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  getISOWeek,
  parseISO,
} from "date-fns";
import { nb } from "date-fns/locale";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// --- data hooks ---

function useActiveSprint() {
  return useQuery({
    queryKey: ["active_sprint_profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprints")
        .select("id, name")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useMemberSprintItems(memberId: string | undefined, sprintId: string | undefined) {
  return useQuery({
    queryKey: ["member_sprint_items", memberId, sprintId],
    enabled: !!memberId && !!sprintId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items")
        .select("id, column_name, column_order, backlog_item:backlog_items(id, item_id, title, estimate, collaborator_ids)")
        .eq("sprint_id", sprintId!)
        .order("column_order");
      if (error) throw error;
      const items = (data as any[]) ?? [];
      return items.filter((si) => (si.backlog_item?.collaborator_ids ?? []).includes(memberId));
    },
  });
}

function useMemberOpenActionPoints(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member_open_aps", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("meeting_action_points" as any)
        .select("id, title, due_date, status, meeting_id")
        .eq("assignee_id", memberId!)
        .neq("status", "done")
        .order("due_date") as any);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; due_date: string | null; status: string; meeting_id: string }[];
    },
  });
}

function useMemberWeekUpdates(memberId: string | undefined) {
  const now = new Date();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["member_week_updates", memberId, weekStart],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates")
        .select("id, entry_date, content, category")
        .eq("member_id", memberId!)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; entry_date: string; content: string | null; category: string | null }[];
    },
  });
}

function useMemberAllUpdates(memberId: string | undefined) {
  return useQuery({
    queryKey: ["member_all_updates", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates")
        .select("id, entry_date")
        .eq("member_id", memberId!)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; entry_date: string }[];
    },
  });
}

// --- column label helpers ---

const columnLabel: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const columnColor: Record<string, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-50 text-blue-700",
  review: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-green-700",
};

// --- component ---

export default function ProfilePage() {
  const { memberId: memberIdParam } = useParams<{ memberId: string }>();
  const { currentMember } = useCurrentMember();
  const { data: allMembers } = useTeamMembers();
  const { data: catalog = [] } = useActivityCatalog();
  const { data: registrations = [] } = useActivityRegistrations();

  const [statsOpen, setStatsOpen] = useState(false);

  // Resolve which member to show
  const memberId = memberIdParam ?? currentMember?.id;
  const member = useMemo(() => {
    if (!allMembers || !memberId) return null;
    return allMembers.find((m) => m.id === memberId) ?? null;
  }, [allMembers, memberId]);

  const isOwnProfile = memberId === currentMember?.id;

  const { data: activeSprint } = useActiveSprint();
  const { data: sprintItems = [] } = useMemberSprintItems(memberId, activeSprint?.id);
  const { data: openAPs = [] } = useMemberOpenActionPoints(memberId);
  const { data: weekUpdates = [] } = useMemberWeekUpdates(memberId);
  const { data: allUpdates = [] } = useMemberAllUpdates(memberId);

  const now = new Date();
  const weekNum = getISOWeek(now);

  const totalEarned = calcTotalEarnedPoints(registrations, catalog);

  // Stats
  const activeSprintItems = sprintItems.filter(
    (si) => si.column_name !== "done"
  );
  const doneSprintItems = sprintItems.filter((si) => si.column_name === "done");

  const standupCount = allUpdates.length;

  // Streak: consecutive calendar days with updates (backwards from today)
  const streak = useMemo(() => {
    if (!allUpdates.length) return 0;
    const dates = new Set(allUpdates.map((u) => u.entry_date));
    let s = 0;
    let d = new Date();
    // allow today or yesterday as starting point
    const todayStr = format(d, "yyyy-MM-dd");
    const startFrom = dates.has(todayStr) ? d : new Date(d.getTime() - 86400000);
    for (let i = 0; i < 60; i++) {
      const str = format(new Date(startFrom.getTime() - i * 86400000), "yyyy-MM-dd");
      if (dates.has(str)) {
        s++;
      } else {
        break;
      }
    }
    return s;
  }, [allUpdates]);

  if (!member) {
    return (
      <div className="p-8 text-muted-foreground">
        {!memberId ? "Laster profil..." : "Fant ikke teammedlem."}
      </div>
    );
  }

  return (
    <div className="space-y-6 scroll-reveal max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold text-white shrink-0"
          style={{ backgroundColor: member.avatar_color }}
        >
          {getInitials(member.name)}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{member.name}</h1>
          <p className="text-sm text-muted-foreground">
            {isOwnProfile ? "Din profil" : "Teammedlem"} · Uke {weekNum}
          </p>
        </div>
      </div>

      {/* Key metrics line */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {activeSprintItems.length}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">aktive oppgaver</p>
        </div>
        <div>
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {openAPs.length}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">åpne aksjoner</p>
        </div>
        <div>
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {weekUpdates.length}
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">standups denne uken</p>
        </div>
        {isOwnProfile && (
          <div>
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {totalEarned}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">aktivitetspoeng</p>
          </div>
        )}
      </div>

      {/* Section 1: Mine oppgaver nå */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CheckSquare className="h-3.5 w-3.5" />
          Oppgaver nå
          {activeSprint && (
            <span className="normal-case font-normal">— {activeSprint.name}</span>
          )}
        </p>

        {sprintItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {activeSprint ? "Ingen tildelte oppgaver i aktiv sprint." : "Ingen aktiv sprint."}
          </p>
        ) : (
          <div className="space-y-1.5">
            {sprintItems.map((si) => (
              <Card key={si.id} className="rounded-lg border">
                <CardContent className="py-2.5 px-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {(si.backlog_item as any)?.item_id && (
                        <span className="text-muted-foreground mr-1.5 text-xs">
                          {(si.backlog_item as any).item_id}
                        </span>
                      )}
                      {(si.backlog_item as any)?.title ?? "Ukjent"}
                    </p>
                    {(si.backlog_item as any)?.estimate && (
                      <p className="text-[10px] text-muted-foreground">{(si.backlog_item as any).estimate} SP</p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      columnColor[si.column_name] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {columnLabel[si.column_name] ?? si.column_name}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Open action points */}
        {openAPs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] text-muted-foreground">Åpne aksjoner fra møter</p>
            {openAPs.map((ap) => (
              <Card key={ap.id} className="rounded-lg border">
                <CardContent className="py-2.5 px-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-foreground truncate">{ap.title}</p>
                  {ap.due_date && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(parseISO(ap.due_date), "d. MMM", { locale: nb })}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Aktivitet denne uken */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Standup-logg uke {weekNum}
        </p>

        {weekUpdates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen standups registrert denne uken.</p>
        ) : (
          <div className="space-y-1.5">
            {weekUpdates.map((u) => (
              <Card key={u.id} className="rounded-lg border">
                <CardContent className="py-2.5 px-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">
                      {format(parseISO(u.entry_date), "EEEE d. MMM", { locale: nb })}
                    </span>
                    {u.category && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {u.category}
                      </span>
                    )}
                  </div>
                  {u.content && (
                    <p className="text-sm text-foreground">{u.content}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Min statistikk (collapsible) */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider w-full hover:text-foreground transition-colors">
          <Zap className="h-3.5 w-3.5" />
          Statistikk
          <ChevronDown
            className={`h-3.5 w-3.5 ml-auto transition-transform ${statsOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-lg border">
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-2xl font-bold tabular-nums">{standupCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">totale standup-dager</p>
              </CardContent>
            </Card>
            <Card className="rounded-lg border">
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-2xl font-bold tabular-nums">{streak}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">dagers streak</p>
              </CardContent>
            </Card>
            <Card className="rounded-lg border">
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-2xl font-bold tabular-nums">{doneSprintItems.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">oppgaver levert denne sprint</p>
              </CardContent>
            </Card>
            {isOwnProfile && (
              <Card className="rounded-lg border">
                <CardContent className="pt-3 pb-3 px-4">
                  <p className="text-2xl font-bold tabular-nums">{totalEarned} / 30</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">aktivitetspoeng</p>
                </CardContent>
              </Card>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
