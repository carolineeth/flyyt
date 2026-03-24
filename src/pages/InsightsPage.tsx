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
import { format, differenceInWeeks, parseISO, startOfWeek, getISOWeek } from "date-fns";
import { nb } from "date-fns/locale";
import type { BacklogItem, Sprint, Meeting } from "@/lib/types";

const PROJECT_START = new Date("2026-03-03");

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
      const { data, error } = await supabase.from("daily_updates").select("*");
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
  const doneItems = items.filter((i) => i.status === "done");
  const doneSP = doneItems.reduce((s, i) => s + (i.estimate || 0), 0);
  const completedSprints = sprints.filter((s) => s.completed_at);
  const completedMeetings = meetings.filter((m) => m.status === "completed");

  const totalActivityPoints = useMemo(() => {
    return activityRegs
      .filter((r: any) => r.status === "completed")
      .reduce((s: number, r: any) => s + (r.catalog?.points || 0), 0);
  }, [activityRegs]);

  const avgCompletionRate = useMemo(() => {
    if (!snapshots.length) return 0;
    const rates = snapshots.map((s: any) =>
      s.total_items > 0 ? (s.completed_items / s.total_items) * 100 : 0
    );
    return Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length);
  }, [snapshots]);

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
    const doneItemsList = items.filter((i) => i.status === "done");
    doneItemsList.forEach((item) => {
      const assignee = item.assignee_id;
      if (assignee && result[assignee]) {
        const type = item.type || "user_story";
        result[assignee][type] = (result[assignee][type] || 0) + (item.estimate || 1);
      }
    });
    return members.map((m) => {
      const data = result[m.id] || {};
      const total = Object.values(data).reduce((s, v) => s + v, 0);
      return {
        name: m.name.split(" ")[0],
        ...data,
        total,
      };
    }).filter((d) => d.total > 0);
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

  const actionPointRate = useMemo(() => {
    if (!actionPoints.length) return 0;
    const completed = actionPoints.filter((ap: any) => ap.is_completed).length;
    return Math.round((completed / actionPoints.length) * 100);
  }, [actionPoints]);

  const workloadDistribution = useMemo(() => {
    const spPerPerson: Record<string, number> = {};
    doneItems.forEach((item) => {
      if (item.assignee_id) {
        spPerPerson[item.assignee_id] = (spPerPerson[item.assignee_id] || 0) + (item.estimate || 0);
      }
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                <div key={e.name} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{e.name}:</span>
                  <span className={e.accuracy >= 80 ? "text-primary" : e.accuracy >= 60 ? "text-amber-600" : "text-destructive"}>
                    {e.accuracy}%
                  </span>
                  {e.accuracy >= 80 ? (
                    <TrendingUp className="h-3 w-3 text-primary" />
                  ) : e.accuracy >= 60 ? (
                    <Minus className="h-3 w-3 text-amber-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
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
      </SectionCard>

      {/* REQUIREMENTS CHANGELOG */}
      <SectionCard
        title="Kravspesifikasjon-endringer"
        icon={<ClipboardList className="h-4 w-4" />}
        onCopy={() => copy(generateRequirementsReport())}
      >
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Funksjonelle krav</p>
            <p className="text-lg font-bold">{requirements.filter((r) => r.category === "functional").length}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Ikke-funksjonelle</p>
            <p className="text-lg font-bold">{requirements.filter((r) => r.category === "non_functional").length}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Totale endringer</p>
            <p className="text-lg font-bold">{reqChanges.length}</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Siste endring</p>
            <p className="text-sm font-semibold">
              {reqChanges[0]
                ? format(parseISO(reqChanges[0].created_at), "d. MMM", { locale: nb })
                : "—"}
            </p>
          </div>
        </div>

        {/* Implemented progress */}
        {requirements.length > 0 && (() => {
          const implemented = requirements.filter((r) => r.status === "implemented" || r.status === "verified").length;
          const pct = Math.round((implemented / requirements.length) * 100);
          return (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Implementert</span>
                <span>{implemented} / {requirements.length} ({pct}%)</span>
              </div>
              <div className="bg-muted rounded-full h-2">
                <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}

        {/* Change timeline */}
        {reqChanges.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">Endringslogg (siste 20)</h4>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {reqChanges.slice(0, 20).map((c) => {
                const colorMap: Record<string, string> = {
                  created: "bg-green-500",
                  updated: "bg-blue-500",
                  deleted: "bg-red-500",
                  status_changed: "bg-amber-500",
                  priority_changed: "bg-purple-500",
                  added_to_backlog: "bg-cyan-500",
                  removed_from_backlog: "bg-orange-500",
                };
                const dot = colorMap[c.change_type] ?? "bg-muted-foreground";
                return (
                  <div key={c.id} className="flex gap-3 items-start text-xs">
                    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                    <div className="flex-1">
                      <span className="text-muted-foreground">{format(parseISO(c.created_at), "d. MMM HH:mm", { locale: nb })}</span>
                      {" · "}
                      <span>{c.description ?? c.change_type}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ingen endringer logget ennå.</p>
        )}

        <ReflectionField
          value={reflections.requirements || ""}
          onChange={(v) => setReflection("requirements", v)}
          placeholder="Refleksjon: Hvordan utviklet kravspesifikasjonen seg gjennom prosjektet?"
        />
      </SectionCard>

      {/* EXPORT */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Eksporter komplett rapport-statistikk</h3>
            <p className="text-xs text-muted-foreground">Inkluderer alle seksjoner og refleksjoner</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(generateFullReport().replace(/[#|*-]/g, ""))}>
              <Copy className="h-3 w-3 mr-1" />
              Ren tekst
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(generateFullReport())}>
              <Copy className="h-3 w-3 mr-1" />
              Markdown
            </Button>
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {onCopy && (
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="h-3 w-3 mr-1" />
            Kopier til rapport
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
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
    <div className="mt-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-muted/50 text-sm min-h-[60px]"
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
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
