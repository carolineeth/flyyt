import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BarChart3,
  Copy,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Calendar,
  Users,
  Layers,
  Target,
  CheckCircle,
  Activity,
  ClipboardList,
} from "lucide-react";
import { useRequirementChanges } from "@/hooks/useRequirementChangelog";
import { RequirementsInsight } from "@/components/insights/RequirementsInsight";
import { useActivityCatalog } from "@/hooks/useActivityCatalog";
import { calcTotalEarnedPoints } from "@/lib/calcTotalEarnedPoints";
import { PROJECT_START as _PROJECT_START_IMPORT } from "@/hooks/useDailyUpdates";
import type { Registration } from "@/hooks/useActivityCatalog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { format, differenceInWeeks, parseISO, getISOWeek, differenceInDays } from "date-fns";
import { nb } from "date-fns/locale";
import type { BacklogItem, Sprint, Meeting } from "@/lib/types";

const PROJECT_START = new Date("2026-03-03");
const PROJECT_END = new Date("2026-05-15"); // Innleveringsfrist

// --- Hooks ---

function useBacklogItems() {
  return useQuery<BacklogItem[]>({
    queryKey: ["backlog_items_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backlog_items").select("*");
      if (error) throw error;
      return data;
    },
  });
}

function useSprints() {
  return useQuery<Sprint[]>({
    queryKey: ["sprints_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });
}

function useSprintSnapshots() {
  return useQuery({
    queryKey: ["sprint_snapshots_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_snapshots").select("*");
      if (error) throw error;
      return data;
    },
  });
}

function useSprintItems() {
  return useQuery({
    queryKey: ["sprint_items_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_items").select("*, backlog_item:backlog_items(*)");
      if (error) throw error;
      return data as any[];
    },
  });
}

function useMeetings() {
  return useQuery<Meeting[]>({
    queryKey: ["meetings_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*");
      if (error) throw error;
      return data;
    },
  });
}

function useActionPoints() {
  return useQuery({
    queryKey: ["action_points_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_action_points").select("*");
      if (error) throw error;
      return data;
    },
  });
}

function useActivityRegistrations() {
  return useQuery({
    queryKey: ["activity_regs_insights"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_registrations").select("*, catalog:activity_catalog(*)");
      if (error) throw error;
      return data as any[];
    },
  });
}

function useDailyUpdates() {
  return useQuery({
    queryKey: ["daily_updates_insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates")
        .select("*")
        .gte("entry_date", format(PROJECT_START, "yyyy-MM-dd"));
      if (error) throw error;
      return data;
    },
  });
}

function useBacklogChangelog() {
  return useQuery({
    queryKey: ["backlog_changelog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlog_changelog" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// --- Helpers ---
function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Kopiert til utklippstavle");
}

const CHART_COLORS = {
  user_story: "#3B82F6",
  technical: "#0F6E56",
  design: "#D4537E",
  report: "#534AB7",
  admin: "#888780",
};

const TYPE_LABELS: Record<string, string> = {
  user_story: "Brukerhistorie",
  technical: "Teknisk",
  design: "Design",
  report: "Rapport",
  admin: "Admin",
};

// --- Component ---
export default function InsightsPage() {
  const { data: items = [] } = useBacklogItems();
  const { data: sprints = [] } = useSprints();
  const { data: snapshots = [] } = useSprintSnapshots();
  const { data: sprintItems = [] } = useSprintItems();
  const { data: members = [] } = useTeamMembers();
  const { data: meetings = [] } = useMeetings();
  const { data: actionPoints = [] } = useActionPoints();
  const { data: activityRegs = [] } = useActivityRegistrations();
  const { data: activityCatalog = [] } = useActivityCatalog();
  const { data: dailyUpdates = [] } = useDailyUpdates();
  const { data: changelog = [] } = useBacklogChangelog();
  const { data: reqChanges = [] } = useRequirementChanges();
  const { data: requirements = [] } = useQuery<{ id: string; title: string; category: string; status: string; priority: string }[]>({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("requirements" as any).select("id, title, category, status, priority") as any);
      if (error) throw error;
      return data;
    },
  });

  const [reflections, setReflections] = useState<Record<string, string>>({});
  const setReflection = (key: string, val: string) =>
    setReflections((prev) => ({ ...prev, [key]: val }));

  // === TOP METRICS ===
  const weeksElapsed = differenceInWeeks(new Date(), PROJECT_START);
  const totalProjectWeeks = differenceInWeeks(PROJECT_END, PROJECT_START);
  const weeksRemaining = Math.max(0, totalProjectWeeks - weeksElapsed);
  const projectProgressPct = Math.min(100, Math.round((weeksElapsed / totalProjectWeeks) * 100));
  const doneItems = items.filter((i) => i.status === "done");
  const doneSP = doneItems.reduce((s, i) => s + (i.estimate || 0), 0);
  const totalSP = items.reduce((s, i) => s + (i.estimate || 0), 0);
  const deliverySpPct = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  const completedSprints = sprints.filter((s) => s.completed_at);
  const completedMeetings = meetings.filter((m) => m.status === "completed");

  const totalActivityPoints = useMemo(
    () => calcTotalEarnedPoints(activityRegs as Registration[], activityCatalog),
    [activityRegs, activityCatalog]
  );
  const activityPointsPct = Math.round((totalActivityPoints / 30) * 100);

  const avgCompletionRate = useMemo(() => {
    if (!snapshots.length) return 0;
    const rates = snapshots.map((s: any) =>
      s.total_items > 0 ? (s.completed_items / s.total_items) * 100 : 0
    );
    return Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length);
  }, [snapshots]);

  // === Project pulse (combined activity per week) ===
  const projectPulse = useMemo(() => {
    const weekMap: Record<number, { week: number; standups: number; meetings: number; itemsDone: number }> = {};
    const ensure = (w: number) => {
      if (!weekMap[w]) weekMap[w] = { week: w, standups: 0, meetings: 0, itemsDone: 0 };
      return weekMap[w];
    };
    dailyUpdates.forEach((u: any) => ensure(getISOWeek(parseISO(u.entry_date))).standups++);
    completedMeetings.forEach((m) => ensure(getISOWeek(parseISO(m.date as string))).meetings++);
    doneItems.forEach((i) => {
      const d = (i as any).updated_at ?? i.created_at;
      if (d) ensure(getISOWeek(parseISO(d))).itemsDone++;
    });
    return Object.values(weekMap)
      .sort((a, b) => a.week - b.week)
      .map((d) => ({ ...d, name: `Uke ${d.week}` }));
  }, [dailyUpdates, completedMeetings, doneItems]);

  // === Sprint trend (velocity + accuracy combined) ===
  const sprintTrend = useMemo(() => {
    return completedSprints.map((sprint) => {
      const snap: any = snapshots.find((s: any) => s.sprint_id === sprint.id);
      const planned = snap?.total_points ?? 0;
      const delivered = snap?.completed_points ?? 0;
      return {
        name: sprint.name.replace("Sprint ", "S"),
        planned,
        delivered,
        accuracy: planned > 0 ? Math.round((delivered / planned) * 100) : 0,
      };
    });
  }, [completedSprints, snapshots]);

  // === Average cycle time (created → done) ===
  const cycleTime = useMemo(() => {
    const days = doneItems
      .map((i: any) => {
        const created = i.created_at ? parseISO(i.created_at) : null;
        const done = i.updated_at ? parseISO(i.updated_at) : null;
        if (!created || !done) return null;
        return Math.max(0, differenceInDays(done, created));
      })
      .filter((d): d is number => d !== null);
    if (!days.length) return { avg: 0, median: 0, count: 0 };
    const avg = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
    const sorted = [...days].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { avg, median, count: days.length };
  }, [doneItems]);

  // === Collaboration matrix (who works with whom) ===
  const collaborationMatrix = useMemo(() => {
    if (members.length < 2) return [];
    const pairs: Record<string, number> = {};
    items.forEach((item) => {
      const collab: string[] = (item as any).collaborator_ids ?? [];
      const all = item.assignee_id && !collab.includes(item.assignee_id) ? [item.assignee_id, ...collab] : collab;
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const key = [all[i], all[j]].sort().join("|");
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
    });
    return Object.entries(pairs)
      .map(([key, count]) => {
        const [a, b] = key.split("|");
        const ma = members.find((m) => m.id === a);
        const mb = members.find((m) => m.id === b);
        if (!ma || !mb) return null;
        return { a: ma.name.split(" ")[0], b: mb.name.split(" ")[0], count };
      })
      .filter((x): x is { a: string; b: string; count: number } => x !== null)
      .sort((x, y) => y.count - x.count)
      .slice(0, 8);
  }, [items, members]);

  // === SECTION A: Sprint Analysis ===
  const velocityData = useMemo(() => {
    return completedSprints.map((sprint) => {
      const snap = snapshots.find((s: any) => s.sprint_id === sprint.id);
      return {
        name: sprint.name,
        planned: snap?.total_points ?? 0,
        delivered: snap?.completed_points ?? 0,
      };
    });
  }, [completedSprints, snapshots]);

  const avgVelocity = useMemo(() => {
    if (!velocityData.length) return 0;
    return Math.round(velocityData.reduce((s, v) => s + v.delivered, 0) / velocityData.length);
  }, [velocityData]);

  const completionData = useMemo(() => {
    return completedSprints.map((sprint) => {
      const snap = snapshots.find((s: any) => s.sprint_id === sprint.id);
      const completed = snap?.completed_items ?? 0;
      const total = snap?.total_items ?? 0;
      const incomplete = total - completed;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { name: sprint.name, completed, incomplete, pct };
    });
  }, [completedSprints, snapshots]);

  const estimationAccuracy = useMemo(() => {
    return velocityData.map((v) => ({
      name: v.name,
      accuracy: v.planned > 0 ? Math.round((v.delivered / v.planned) * 100) : 0,
    }));
  }, [velocityData]);

  // === SECTION B: Cross-functional ===
  const workByPerson = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    members.forEach((m) => {
      result[m.id] = { user_story: 0, technical: 0, design: 0, report: 0, admin: 0 };
    });
    // Include ALL items (not just done) so the chart is never empty mid-project
    items.forEach((item) => {
      const assignees: string[] = (item as any).collaborator_ids ?? (item.assignee_id ? [item.assignee_id] : []);
      assignees.forEach((id) => {
        if (result[id]) {
          const type = item.type || "user_story";
          result[id][type] = (result[id][type] || 0) + (item.estimate || 1);
        }
      });
    });
    return members.map((m) => {
      const data = result[m.id] || {};
      const total = Object.values(data).reduce((s, v) => s + v, 0);
      return {
        name: m.name.split(" ")[0],
        ...data,
        total,
      };
    });
  }, [items, members]);

  const crossFunctionalityScores = useMemo(() => {
    return workByPerson.map((p) => {
      const types = ["user_story", "technical", "design", "report", "admin"];
      const total = p.total || 1;
      const typesWithWork = types.filter(
        (t) => (p as any)[t] > 0
      ).length;
      return { name: p.name, score: typesWithWork, total };
    });
  }, [workByPerson]);

  // === SECTION C: Backlog Evolution ===
  const backlogGrowth = useMemo(() => {
    // Use item created_at for growth since changelog may be empty
    const weekMap: Record<number, number> = {};
    items.forEach((item) => {
      const w = getISOWeek(parseISO(item.created_at));
      weekMap[w] = (weekMap[w] || 0) + 1;
    });
    const weeks = Object.keys(weekMap)
      .map(Number)
      .sort((a, b) => a - b);
    let cumulative = 0;
    return weeks.map((w) => {
      cumulative += weekMap[w];
      return { week: `Uke ${w}`, total: cumulative };
    });
  }, [items]);

  // === SECTION D: Agile Metrics ===
  const standupParticipation = useMemo(() => {
    if (!dailyUpdates.length || !members.length) return [];
    const weekMap: Record<string, Set<string>> = {};
    dailyUpdates.forEach((u: any) => {
      const w = getISOWeek(parseISO(u.entry_date));
      const key = `Uke ${w}`;
      if (!weekMap[key]) weekMap[key] = new Set();
      weekMap[key].add(u.member_id);
    });
    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, memberSet]) => ({
        week,
        pct: Math.round((memberSet.size / members.length) * 100),
      }));
  }, [dailyUpdates, members]);

  // === SECTION E: Team Health ===
  const meetingsPerWeek = useMemo(() => {
    const weekMap: Record<string, number> = {};
    completedMeetings.forEach((m) => {
      const w = getISOWeek(parseISO(m.date as string));
      const key = `Uke ${w}`;
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    return Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }));
  }, [completedMeetings]);

  // Meeting attendance per person
  const meetingAttendanceByPerson = useMemo(() => {
    if (!members.length || !completedMeetings.length) return [];
    const countMap: Record<string, number> = {};
    members.forEach((m) => { countMap[m.id] = 0; });
    completedMeetings.forEach((meeting) => {
      const participants: string[] = (meeting as any).participants ?? [];
      participants.forEach((id) => {
        if (countMap[id] !== undefined) countMap[id]++;
      });
    });
    return members.map((m) => ({
      name: m.name.split(" ")[0],
      meetings: countMap[m.id] ?? 0,
      pct: Math.round(((countMap[m.id] ?? 0) / completedMeetings.length) * 100),
    })).sort((a, b) => b.meetings - a.meetings);
  }, [members, completedMeetings]);

  // Standup participation per person
  const standupByPerson = useMemo(() => {
    if (!members.length || !dailyUpdates.length) return [];
    const countMap: Record<string, number> = {};
    members.forEach((m) => { countMap[m.id] = 0; });
    dailyUpdates.forEach((u: any) => {
      if (countMap[u.member_id] !== undefined) countMap[u.member_id]++;
    });
    const uniqueDays = new Set(dailyUpdates.map((u: any) => u.entry_date)).size;
    return members.map((m) => ({
      name: m.name.split(" ")[0],
      count: countMap[m.id] ?? 0,
      pct: uniqueDays > 0 ? Math.round(((countMap[m.id] ?? 0) / uniqueDays) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [members, dailyUpdates]);

  const actionPointRate = useMemo(() => {
    if (!actionPoints.length) return 0;
    const completed = actionPoints.filter((ap: any) => ap.is_completed).length;
    return Math.round((completed / actionPoints.length) * 100);
  }, [actionPoints]);

  const workloadDistribution = useMemo(() => {
    const spPerPerson: Record<string, number> = {};
    doneItems.forEach((item) => {
      const assignees: string[] = (item as any).collaborator_ids ?? (item.assignee_id ? [item.assignee_id] : []);
      assignees.forEach((id) => {
        spPerPerson[id] = (spPerPerson[id] || 0) + (item.estimate || 0);
      });
    });
    const values = Object.values(spPerPerson);
    if (values.length < 2) return { stddev: 0, values: [] };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    return {
      stddev: Math.round(Math.sqrt(variance) * 10) / 10,
      values: members
        .filter((m) => spPerPerson[m.id] !== undefined)
        .map((m) => ({ name: m.name.split(" ")[0], sp: spPerPerson[m.id] || 0 })),
    };
  }, [doneItems, members]);

  // === COPY GENERATORS ===
  const generateSprintReport = () => {
    let text = `## Sprint-oversikt\n\nTeamet gjennomførte ${completedSprints.length} sprinter. Gjennomsnittlig velocity var ${avgVelocity} story points per sprint.\n\n`;
    text += `| Sprint | Planlagt | Levert | Completion |\n|--------|----------|--------|------------|\n`;
    velocityData.forEach((v) => {
      const pct = v.planned > 0 ? Math.round((v.delivered / v.planned) * 100) : 0;
      text += `| ${v.name} | ${v.planned} SP | ${v.delivered} SP | ${pct}% |\n`;
    });
    if (reflections.sprint) text += `\n${reflections.sprint}`;
    return text;
  };

  const generateCrossFunctionalReport = () => {
    let text = `## Tverrfaglig arbeid\n\n`;
    text += `| Medlem | Brukerhistorie | Teknisk | Design | Rapport | Admin | Total SP |\n|--------|----------------|---------|--------|---------|-------|----------|\n`;
    workByPerson.forEach((p) => {
      text += `| ${p.name} | ${(p as any).user_story} | ${(p as any).technical} | ${(p as any).design} | ${(p as any).report} | ${(p as any).admin} | ${p.total} |\n`;
    });
    if (reflections.crossfunc) text += `\n${reflections.crossfunc}`;
    return text;
  };

  const generateBacklogReport = () => {
    let text = `## Kravspesifikasjon og endringskontroll\n\n`;
    text += `Backlogen inneholdt ${items.length} items totalt, hvorav ${doneItems.length} ble levert (${doneSP} SP).\n`;
    if (reflections.backlog) text += `\n${reflections.backlog}`;
    return text;
  };

  const generateAgileReport = () => {
    let text = `## Smidig praksis og effekt\n\n`;
    text += `Teamet brukte ScrumBan med ${completedSprints.length} sprinter. Gjennomsnittlig velocity var ${avgVelocity} SP/sprint.\n\n`;
    text += `Standup-deltakelse: gjennomsnittlig ${standupParticipation.length > 0 ? Math.round(standupParticipation.reduce((s, p) => s + p.pct, 0) / standupParticipation.length) : 0}%.\n`;
    if (reflections.agile) text += `\n${reflections.agile}`;
    return text;
  };

  const generateRequirementsReport = () => {
    const functional = requirements.filter((r) => r.category === "functional");
    const nonFunctional = requirements.filter((r) => r.category === "non_functional");
    const documentation = requirements.filter((r) => r.category === "documentation");
    const implemented = requirements.filter((r) => r.status === "implemented" || r.status === "verified");
    const lastChange = reqChanges[0];
    let text = `## 4.3 Kravspesifikasjon og endringer\n\n`;
    text += `Kravspesifikasjonen inneholder ${requirements.length} krav: ${functional.length} funksjonelle, ${nonFunctional.length} ikke-funksjonelle og ${documentation.length} dokumentasjonskrav.\n\n`;
    text += `${implemented.length} av ${requirements.length} krav er implementert eller verifisert (${requirements.length > 0 ? Math.round((implemented.length / requirements.length) * 100) : 0}%).\n\n`;
    text += `Totalt ${reqChanges.length} endringer er logget i endringsloggen.\n`;
    if (lastChange) {
      text += `Siste endring: ${format(parseISO(lastChange.created_at), "d. MMMM yyyy", { locale: nb })} — ${lastChange.description ?? lastChange.change_type}.\n`;
    }
    if (reflections.requirements) text += `\n${reflections.requirements}`;
    return text;
  };

  const generateFullReport = () => {
    return [
      generateSprintReport(),
      generateCrossFunctionalReport(),
      generateBacklogReport(),
      generateAgileReport(),
      generateRequirementsReport(),
    ].join("\n\n---\n\n");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Prosjektinnsikt"
        description="Statistikk og analyse for prosessdokumentasjon og rapport"
      />

      {/* TOP METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="Prosjektvarighet"
          value={`${weeksElapsed} uker`}
        />
        <MetricCard
          icon={<CheckCircle className="h-4 w-4" />}
          label="Items levert"
          value={`${doneItems.length} / ${doneSP} SP`}
        />
        <MetricCard
          icon={<Layers className="h-4 w-4" />}
          label="Sprinter fullført"
          value={`${completedSprints.length}`}
          sub={`${avgCompletionRate}% snitt`}
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Aktivitetspoeng"
          value={`${totalActivityPoints} / 30p`}
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Møter gjennomført"
          value={`${completedMeetings.length}`}
        />
      </div>

      {/* SECTION A: Sprint Analysis */}
      <SectionCard
        title="Sprint-analyse"
        icon={<Layers className="h-4 w-4" />}
        onCopy={() => copy(generateSprintReport())}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Velocity */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Velocity-trend</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    name="Planlagt"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Levert"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gjennomsnittlig velocity: <strong>{avgVelocity} SP/sprint</strong>
            </p>
          </div>

          {/* Completion rate */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Completion rate per sprint</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="completed" stackId="a" fill="hsl(var(--primary))" name="Fullført" />
                  <Bar dataKey="incomplete" stackId="a" fill="hsl(var(--destructive))" name="Ikke fullført" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Estimation accuracy */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Estimerings-nøyaktighet</h4>
            <div className="flex flex-wrap gap-3">
              {estimationAccuracy.map((e) => (
                <div key={e.name} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  e.accuracy >= 80 ? "bg-green-50 text-green-700" : e.accuracy >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}>
                  <span className="font-medium">{e.name}:</span>
                  <span className="font-semibold">{e.accuracy}%</span>
                  {e.accuracy >= 80 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : e.accuracy >= 50 ? (
                    <Minus className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ReflectionField
          value={reflections.sprint || ""}
          onChange={(v) => setReflection("sprint", v)}
          placeholder="Refleksjon: Hva sier velocity-trenden om teamets utvikling?"
        />
      </SectionCard>

      {/* SECTION B: Cross-functional */}
      <SectionCard
        title="Tverrfaglig analyse"
        icon={<Users className="h-4 w-4" />}
        onCopy={() => copy(generateCrossFunctionalReport())}
      >
        {workByPerson.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[160px] text-muted-foreground gap-2">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">Ingen backlog-items er tildelt ennå</p>
            <p className="text-xs opacity-70">Grafen fylles ut når items assignes til teammedlemmer</p>
          </div>
        ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Work by person */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Arbeidstypefordeling per person</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workByPerson} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={70} />
                  <Tooltip />
                  <Bar dataKey="user_story" stackId="a" fill={CHART_COLORS.user_story} name="Brukerhistorie" />
                  <Bar dataKey="technical" stackId="a" fill={CHART_COLORS.technical} name="Teknisk" />
                  <Bar dataKey="design" stackId="a" fill={CHART_COLORS.design} name="Design" />
                  <Bar dataKey="report" stackId="a" fill={CHART_COLORS.report} name="Rapport" />
                  <Bar dataKey="admin" stackId="a" fill={CHART_COLORS.admin} name="Admin" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cross-functionality scores */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Tverrfaglighets-score</h4>
            <div className="space-y-2">
              {crossFunctionalityScores.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20">{p.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${(p.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">{p.score}/5</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              1 = spesialist (kun én type), 5 = generalist (alle typer)
            </p>
          </div>
        </div>
        )}

        <ReflectionField
          value={reflections.crossfunc || ""}
          onChange={(v) => setReflection("crossfunc", v)}
          placeholder="Refleksjon: Hvordan var tverrfagligheten i teamet?"
        />
      </SectionCard>

      {/* SECTION C: Backlog Evolution */}
      <SectionCard
        title="Backlog-evolusjon"
        icon={<Activity className="h-4 w-4" />}
        onCopy={() => copy(generateBacklogReport())}
      >
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">Backlog-vekst over tid</h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={backlogGrowth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  name="Totale items"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          <StatBox label="Totale items" value={items.length} />
          <StatBox label="Levert" value={doneItems.length} />
          <StatBox label="Levert SP" value={doneSP} />
        </div>

        <ReflectionField
          value={reflections.backlog || ""}
          onChange={(v) => setReflection("backlog", v)}
          placeholder="Refleksjon: Hvordan endret kravene seg gjennom prosjektet?"
        />
      </SectionCard>

      {/* SECTION D: Agile Metrics */}
      <SectionCard
        title="Smidig-effekt"
        icon={<TrendingUp className="h-4 w-4" />}
        onCopy={() => copy(generateAgileReport())}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Standup participation */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Standup-deltakelse over tid</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={standupParticipation}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" unit="%" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Deltakelse"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Meetings per week */}
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Møter per uke</h4>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meetingsPerWeek}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Møter" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <ReflectionField
          value={reflections.agile || ""}
          onChange={(v) => setReflection("agile", v)}
          placeholder="Refleksjon: Hvordan påvirket smidig praksis teamets effektivitet?"
        />
      </SectionCard>

      {/* SECTION E: Team Health */}
      <SectionCard title="Teamhelse" icon={<Users className="h-4 w-4" />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatBox label="Action points fullført" value={`${actionPointRate}%`} />
          <StatBox
            label="Arbeidslast stddev"
            value={`${workloadDistribution.stddev} SP`}
            sub={workloadDistribution.stddev < 5 ? "Jevn fordeling ✓" : "Ujevn fordeling ⚠"}
          />
          <StatBox label="Totale møter" value={completedMeetings.length} />
        </div>

        {workloadDistribution.values.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">SP per person</h4>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadDistribution.values}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="sp" fill="hsl(var(--primary))" name="Story Points" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Meeting attendance per person */}
        {meetingAttendanceByPerson.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              Møtedeltakelse per person
              <span className="font-normal ml-1 text-xs">({completedMeetings.length} møter totalt)</span>
            </h4>
            <div className="space-y-2">
              {meetingAttendanceByPerson.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20">{p.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {p.meetings} møter ({p.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standup participation per person */}
        {standupByPerson.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">
              Standup-deltakelse per person
            </h4>
            <div className="space-y-2">
              {standupByPerson.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20">{p.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${
                        p.pct >= 80 ? "bg-green-500" : p.pct >= 50 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(p.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {p.count} dager ({p.pct}%)
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Prosent av dager med standup-oppføring (grønn ≥ 80%, gul ≥ 50%, rød &lt; 50%)
            </p>
          </div>
        )}
      </SectionCard>

      {/* REQUIREMENTS CHANGELOG */}
      <RequirementsInsight
        requirements={requirements}
        reqChanges={reqChanges}
        reflectionValue={reflections.requirements || ""}
        onReflectionChange={(v) => setReflection("requirements", v)}
        onCopy={() => copy(generateRequirementsReport())}
      />

      {/* EXPORT */}
      <div className="card-elevated p-6 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Eksporter komplett rapport-statistikk</h3>
          <p className="text-sm text-muted-foreground">Inkluderer alle seksjoner og refleksjoner</p>
        </div>
        <div className="flex gap-2">
          <button className="py-2.5 px-5 rounded-[10px] bg-white border border-neutral-200 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" onClick={() => copy(generateFullReport().replace(/[#|*-]/g, ""))}>
            <Copy className="h-3.5 w-3.5" /> Ren tekst
          </button>
          <button className="py-2.5 px-5 rounded-[10px] bg-white border border-neutral-200 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" onClick={() => copy(generateFullReport())}>
            <Copy className="h-3.5 w-3.5" /> Markdown
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  onCopy,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onCopy?: () => void;
}) {
  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {onCopy && (
          <button onClick={onCopy} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Kopier til rapport
          </button>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ReflectionField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground italic mb-2">{placeholder}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Skriv refleksjon..."
        className="rounded-[10px] border-neutral-200 p-4 text-sm min-h-[80px] leading-relaxed"
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-neutral-50 rounded-[10px] p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
