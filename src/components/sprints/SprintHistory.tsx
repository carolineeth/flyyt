import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, ReferenceLine } from "recharts";
import { ChevronDown, ChevronRight, Copy, Download, Table2, TrendingUp, TrendingDown, Minus, History, Check, X as XIcon, Pencil, FileText, RefreshCw } from "lucide-react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { nb } from "date-fns/locale";
import html2canvas from "html2canvas";

const typeLabels: Record<string, string> = {
  user_story: "Brukerhistorie", technical: "Teknisk oppgave", design: "Design",
};
const typeColors: Record<string, string> = {
  user_story: "bg-[#E6F1FB] text-[#0C447C]",
  technical: "bg-[#E1F5EE] text-[#085041]",
  design: "bg-[#FBEAF0] text-[#72243E]",
};

interface CompletionEvent {
  taskId: string;
  taskName: string;
  storyPoints: number;
  completedAt: string | null;
  completedBy: string | null;
}

interface SprintSnapshot {
  id: string;
  sprint_id: string;
  total_items: number;
  completed_items: number;
  total_points: number;
  completed_points: number;
  items_by_type: Record<string, number>;
  items_by_person: Record<string, { assigned: number; completed: number; points: number }>;
  completed_item_titles: string[];
  incomplete_item_titles: string[];
  daily_burndown: { date: string; remaining: number; ideal: number }[];
  completion_events?: CompletionEvent[];
  created_at: string;
}

interface CompletedSprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string;
  end_date: string;
  completed_at: string | null;
  sprint_review_notes: string | null;
  sprint_planning_notes: string | null;
  planning_completed_at: string | null;
  review_completed_at: string | null;
  reflection: string | null;
  edit_changelog: any[] | null;
  snapshot?: SprintSnapshot;
}

export default function SprintHistory() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: completedSprints } = useQuery({
    queryKey: ["completed_sprints"],
    queryFn: async () => {
      const { data: sprints, error } = await supabase
        .from("sprints")
        .select("*")
        .not("completed_at", "is", null)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return sprints as CompletedSprint[];
    },
  });

  const { data: snapshots } = useQuery({
    queryKey: ["sprint_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_snapshots").select("*");
      if (error) throw error;
      return data as SprintSnapshot[];
    },
  });

  const sprintsWithSnapshots = useMemo(() => {
    if (!completedSprints) return [];
    return completedSprints.map((s) => ({
      ...s,
      snapshot: snapshots?.find((sn) => sn.sprint_id === s.id),
    }));
  }, [completedSprints, snapshots]);

  // Velocity chart data
  const velocityData = useMemo(() => {
    if (!sprintsWithSnapshots.length) return [];
    return [...sprintsWithSnapshots].reverse().map((s) => ({
      name: s.name,
      id: s.id,
      completed: s.snapshot?.completed_points ?? 0,
      planned: s.snapshot?.total_points ?? 0,
    }));
  }, [sprintsWithSnapshots]);

  const avgVelocity = velocityData.length
    ? Math.round(velocityData.reduce((s, d) => s + d.completed, 0) / velocityData.length)
    : 0;

  const updateReflection = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from("sprints").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["completed_sprints"] }),
    onError: () => toast.error("Kunne ikke lagre"),
  });

  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);

  // Edit sprint field with changelog
  const editSprintField = useMutation({
    mutationFn: async ({ id, field, value, oldValue }: { id: string; field: string; value: string; oldValue: string }) => {
      // Get existing changelog
      const sprint = sprintsWithSnapshots.find(s => s.id === id);
      const existingLog: any[] = (sprint as any)?.edit_changelog ?? [];
      const newEntry = { timestamp: new Date().toISOString(), field, oldValue, newValue: value };
      const { error } = await supabase.from("sprints").update({
        [field]: value || null,
        edit_changelog: [...existingLog, newEntry],
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completed_sprints"] });
      toast.success("Sprint oppdatert");
    },
    onError: () => toast.error("Kunne ikke oppdatere"),
  });

  const [recalculating, setRecalculating] = useState<string | null>(null);

  const recalculateSnapshot = async (sprint: CompletedSprint) => {
    const sn = sprint.snapshot;
    if (!sn) return;
    setRecalculating(sprint.id);
    try {
      // Determine which item IDs to use
      const snAny = sn as any;
      const allItemIds: string[] = snAny.item_ids?.length ? snAny.item_ids : [];
      const doneItemIds: string[] = snAny.done_item_ids?.length ? snAny.done_item_ids : [];
      const hasFullIds = allItemIds.length > 0;

      // Fallback 1: extract done item IDs from completion_events
      let fallbackDoneIds: string[] = [];
      if (!hasFullIds && sn.completion_events?.length) {
        fallbackDoneIds = (sn.completion_events as CompletionEvent[])
          .map(e => e.taskId).filter(Boolean);
      }

      // Fallback 2: match by title if no IDs at all
      let matchedByTitle = false;
      let idsToFetch = hasFullIds ? allItemIds : fallbackDoneIds;

      if (idsToFetch.length === 0) {
        // Last resort: find items by title from completed_item_titles + incomplete_item_titles
        const allTitles = [...(sn.completed_item_titles ?? []), ...(sn.incomplete_item_titles ?? [])];
        if (allTitles.length === 0) {
          toast.error("Ingen item-IDer eller titler tilgjengelig for rekalkulering");
          setRecalculating(null);
          return;
        }
        const { data: titleMatched, error: titleErr } = await supabase
          .from("backlog_items")
          .select("id, title, type, estimate, collaborator_ids, assignee_id");
        if (titleErr) throw titleErr;

        const completedTitleSet = new Set(sn.completed_item_titles ?? []);
        const matched = (titleMatched ?? []).filter(i => allTitles.includes(i.title));
        idsToFetch = matched.map(i => i.id);
        fallbackDoneIds = matched.filter(i => completedTitleSet.has(i.title)).map(i => i.id);
        matchedByTitle = true;
      }

      // Fetch current backlog items
      let currentItems: any[];
      if (matchedByTitle) {
        // Already fetched above
        const { data } = await supabase
          .from("backlog_items")
          .select("id, title, type, estimate, collaborator_ids, assignee_id")
          .in("id", idsToFetch);
        currentItems = data ?? [];
      } else {
        const { data, error } = await supabase
          .from("backlog_items")
          .select("id, title, type, estimate, collaborator_ids, assignee_id")
          .in("id", idsToFetch);
        if (error) throw error;
        currentItems = data ?? [];
      }

      const itemMap = new Map(currentItems.map(i => [i.id, i]));
      const effectiveDoneIds = new Set(hasFullIds ? doneItemIds : fallbackDoneIds);

      // Rebuild totals
      let totalPoints = 0;
      let completedPoints = 0;
      const itemsByType: Record<string, number> = {};
      const itemsByPerson: Record<string, { assigned: number; completed: number; points: number }> = {};

      idsToFetch.forEach(id => {
        const item = itemMap.get(id);
        if (!item) return;
        const sp = item.estimate ?? 0;
        const isDone = effectiveDoneIds.has(id);
        totalPoints += sp;
        if (isDone) {
          completedPoints += sp;
          const t = item.type ?? "other";
          itemsByType[t] = (itemsByType[t] ?? 0) + 1;
        }
        const assignees: string[] = (item as any).collaborator_ids?.length
          ? (item as any).collaborator_ids : [];
        const keys = assignees.length > 0 ? assignees : ["Ufordelt"];
        keys.forEach(key => {
          if (!itemsByPerson[key]) itemsByPerson[key] = { assigned: 0, completed: 0, points: 0 };
          itemsByPerson[key].assigned++;
          if (isDone) {
            itemsByPerson[key].completed++;
            itemsByPerson[key].points += sp;
          }
        });
      });

      // Update snapshot
      const { error: updErr } = await (supabase.from("sprint_snapshots")
        .update({
          total_points: totalPoints,
          completed_points: completedPoints,
          items_by_type: itemsByType,
          items_by_person: itemsByPerson,
          recalculated_at: new Date().toISOString(),
        } as any).eq("id", sn.id) as any);
      if (updErr) throw updErr;

      qc.invalidateQueries({ queryKey: ["sprint_snapshots"] });
      toast.success(hasFullIds
        ? "Snapshot rekalkulert med oppdaterte SP-verdier"
        : matchedByTitle
        ? "Rekalkulert via tittel-matching — nøyaktigheten kan variere"
        : "Delvis rekalkulert — kun fullførte oppgaver oppdatert"
      );
    } catch (e) {
      toast.error("Kunne ikke rekalkulere: " + (e as Error).message);
    } finally {
      setRecalculating(null);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  const exportSprintText = (sprint: CompletedSprint) => {
    const sn = sprint.snapshot;
    if (!sn) return "";
    const completionPct = sn.total_points > 0 ? Math.round((sn.completed_points / sn.total_points) * 100) : 0;
    const byPerson = Object.entries(sn.items_by_person ?? {})
      .map(([name, d]) => `- ${name}: ${d.points} SP (${d.completed} items)`)
      .join("\n");
    return `Sprint: ${sprint.name}
Periode: ${format(parseISO(sprint.start_date), "d. MMM", { locale: nb })}–${format(parseISO(sprint.end_date), "d. MMM yyyy", { locale: nb })}
Sprint goal: ${sprint.goal ?? "–"}

Planlagt: ${sn.total_items} items, ${sn.total_points} story points
Levert: ${sn.completed_items} items, ${sn.completed_points} story points (${completionPct}% completion)

Fullførte:
${sn.completed_item_titles.map((t) => `- ${t}`).join("\n") || "Ingen"}

Ikke fullført:
${sn.incomplete_item_titles.map((t) => `- ${t}`).join("\n") || "Ingen"}

Bidrag per teammedlem:
${byPerson || "Ingen data"}

Sprint Planning-notater:
${sprint.sprint_planning_notes ?? "–"}

Sprint review:
${sprint.sprint_review_notes ?? "–"}

Refleksjon:
${sprint.reflection ?? "–"}`;
  };

  // Markdown export for university process log
  const exportSprintMarkdown = (sprint: CompletedSprint) => {
    const sn = sprint.snapshot;
    if (!sn) return "";
    const completionPct = sn.total_points > 0 ? Math.round((sn.completed_points / sn.total_points) * 100) : 0;
    const period = `${format(parseISO(sprint.start_date), "d. MMM", { locale: nb })}–${format(parseISO(sprint.end_date), "d. MMM yyyy", { locale: nb })}`;
    const byPerson = Object.entries(sn.items_by_person ?? {})
      .map(([key, d]) => {
        const member = members?.find((m) => m.id === key);
        const name = member ? member.name.split(" ")[0] : key;
        return `- ${name}: ${d.points} SP (${d.completed} fullført av ${d.assigned} tildelt)`;
      }).join("\n");

    const completionEvents = (sn.completion_events ?? []) as CompletionEvent[];
    const completedTasksSection = completionEvents.length > 0
      ? completionEvents.map(e => {
          const dateStr = e.completedAt ? format(parseISO(e.completedAt), "d. MMM", { locale: nb }) : "ukjent dato";
          return `- [${dateStr}] — ${e.taskName} (${e.storyPoints} SP)`;
        }).join("\n")
      : sn.completed_item_titles.map(t => `- ${t}`).join("\n");

    return `## ${sprint.name} — ${period}

### Sprint Planning
**Sprint goal:** ${sprint.goal ?? "–"}
${sprint.sprint_planning_notes ? `\n**Notater:**\n${sprint.sprint_planning_notes}\n` : ""}
**Planlagt:** ${sn.total_items} items, ${sn.total_points} story points

### Statistikk
- **Levert:** ${sn.completed_items} items, ${sn.completed_points} SP (${completionPct}% completion)
- **Velocity:** ${sn.completed_points} SP

### Fullførte oppgaver
${completedTasksSection || "Ingen"}

### Ikke fullført
${sn.incomplete_item_titles.map(t => `- ${t}`).join("\n") || "Ingen"}

### Bidrag per teammedlem
${byPerson || "Ingen data"}

### Sprint Review
${sprint.sprint_review_notes ?? "Ingen notater"}

### Refleksjon
${sprint.reflection ?? "Ingen refleksjon"}
`;
  };

  // Full JSON export
  const exportAllJSON = () => {
    const data = sprintsWithSnapshots.map(s => ({
      sprint: {
        name: s.name, goal: s.goal, start_date: s.start_date, end_date: s.end_date,
        completed_at: s.completed_at, sprint_planning_notes: s.sprint_planning_notes,
        planning_completed_at: (s as any).planning_completed_at,
        review_completed_at: (s as any).review_completed_at,
        sprint_review_notes: s.sprint_review_notes, reflection: s.reflection,
        edit_changelog: s.edit_changelog ?? [],
      },
      snapshot: s.snapshot ? {
        total_items: s.snapshot.total_items, completed_items: s.snapshot.completed_items,
        total_points: s.snapshot.total_points, completed_points: s.snapshot.completed_points,
        items_by_type: s.snapshot.items_by_type, items_by_person: s.snapshot.items_by_person,
        completed_item_titles: s.snapshot.completed_item_titles,
        incomplete_item_titles: s.snapshot.incomplete_item_titles,
        daily_burndown: s.snapshot.daily_burndown,
        completion_events: s.snapshot.completion_events ?? [],
      } : null,
    }));
    const aggregate = {
      total_sprints: data.length,
      avg_velocity: avgVelocity,
      total_items_completed: data.reduce((s, d) => s + (d.snapshot?.completed_items ?? 0), 0),
      total_items_planned: data.reduce((s, d) => s + (d.snapshot?.total_items ?? 0), 0),
      total_sp_delivered: data.reduce((s, d) => s + (d.snapshot?.completed_points ?? 0), 0),
    };
    return JSON.stringify({ sprints: data, aggregate, exported_at: new Date().toISOString() }, null, 2);
  };

  // Full Markdown export
  const exportAllMarkdown = () => {
    let md = `# Sprint-oversikt — Flyyt\n\n`;
    md += `**Eksportert:** ${format(new Date(), "d. MMMM yyyy HH:mm", { locale: nb })}\n`;
    md += `**Totalt:** ${sprintsWithSnapshots.length} sprinter · Gjennomsnittlig velocity: ${avgVelocity} SP/sprint\n\n---\n\n`;
    [...sprintsWithSnapshots].reverse().forEach(s => { md += exportSprintMarkdown(s) + "\n---\n\n"; });
    return md;
  };

  const exportSprintTable = (sprint: CompletedSprint) => {
    const sn = sprint.snapshot;
    if (!sn) return "";
    const rows = [
      ...sn.completed_item_titles.map((t) => `| ${t} | – | – | Fullført |`),
      ...sn.incomplete_item_titles.map((t) => `| ${t} | – | – | Ikke fullført |`),
    ];
    return `| Item | Type | SP | Status |\n|------|------|----|--------|\n${rows.join("\n")}`;
  };

  const exportImage = async (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `sprint-${elementId}.png`;
      link.href = canvas.toDataURL();
      link.click();
      toast.success("Bilde lastet ned");
    } catch (e) {
      toast.error("Kunne ikke generere bilde");
    }
  };

  // Comparison table
  const comparisonData = useMemo(() => {
    if (!sprintsWithSnapshots.length) return null;
    const sorted = [...sprintsWithSnapshots].reverse();
    const totalPlanned = sorted.reduce((s, sp) => s + (sp.snapshot?.total_items ?? 0), 0);
    const totalCompleted = sorted.reduce((s, sp) => s + (sp.snapshot?.completed_items ?? 0), 0);
    const totalSPPlanned = sorted.reduce((s, sp) => s + (sp.snapshot?.total_points ?? 0), 0);
    const totalSPDone = sorted.reduce((s, sp) => s + (sp.snapshot?.completed_points ?? 0), 0);
    return { sorted, totalPlanned, totalCompleted, totalSPPlanned, totalSPDone };
  }, [sprintsWithSnapshots]);

  const velocityTrend = useMemo(() => {
    if (velocityData.length < 2) return "stabil";
    const last = velocityData[velocityData.length - 1].completed;
    return last > avgVelocity * 1.1 ? "øker" : last < avgVelocity * 0.9 ? "synker" : "stabil";
  }, [velocityData, avgVelocity]);

  if (!completedSprints?.length) {
    return <EmptyState icon={History} title="Ingen avsluttede sprinter" description="Avslutt en sprint for å se historikk her" />;
  }

  return (
    <div className="space-y-6 p-4 overflow-y-auto max-w-4xl mx-auto">
      {/* Velocity chart */}
      {velocityData.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Velocity per sprint</p>
            <div className="h-[120px]">
              <ResponsiveContainer>
                <BarChart data={velocityData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Fullført SP" />
                  <ReferenceLine y={avgVelocity} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Gjennomsnittlig velocity: <strong className="text-foreground">{avgVelocity} SP/sprint</strong></p>
          </CardContent>
        </Card>
      )}

      {/* Sprint cards */}
      {sprintsWithSnapshots.map((sprint, idx) => {
        const isExpanded = expandedId === sprint.id || (idx === 0 && expandedId === null);
        const sn = sprint.snapshot;
        const completionPct = sn && sn.total_points > 0 ? Math.round((sn.completed_points / sn.total_points) * 100) : 0;
        const incompletePct = 100 - completionPct;

        return (
          <Card key={sprint.id} id={`sprint-card-${sprint.id}`} className="border rounded-xl overflow-hidden">
            {/* Header - always visible */}
            <button onClick={() => setExpandedId(isExpanded ? "__none__" : sprint.id)}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/30 transition-colors">
              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{sprint.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(sprint.start_date), "d. MMM", { locale: nb })}–{format(parseISO(sprint.end_date), "d. MMM yyyy", { locale: nb })}
                  </span>
                  <Badge className="bg-green-100 text-green-700 text-[9px]">Fullført</Badge>
                  {(sprint as any).planning_completed_at && (
                    <Badge className="bg-blue-50 text-blue-700 text-[9px]">Sprint Planning ✓</Badge>
                  )}
                  {(sprint as any).review_completed_at && (
                    <Badge className="bg-purple-50 text-purple-700 text-[9px]">Sprint Review ✓</Badge>
                  )}
                </div>
                {sprint.goal && (
                  <p className="text-xs text-muted-foreground italic mt-0.5 border-l-2 border-primary/30 pl-2">{sprint.goal}</p>
                )}
              </div>
              {/* Recalculate button */}
              <button
                onClick={(e) => { e.stopPropagation(); recalculateSnapshot(sprint); }}
                disabled={recalculating === sprint.id}
                className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent/50 transition-colors"
                title="Rekalkuler SP fra nåværende data"
              >
                <RefreshCw className={`h-3 w-3 ${recalculating === sprint.id ? "animate-spin" : ""}`} />
                Rekalkuler
              </button>
            </button>

            {/* Recalculation info */}
            {(sn as any)?.recalculated_at && (
              <p className="text-[10px] text-muted-foreground px-4 -mt-1 mb-1">
                Sist rekalkulert: {format(parseISO((sn as any).recalculated_at), "d. MMM yyyy HH:mm", { locale: nb })}
              </p>
            )}
            {/* Warning for old snapshots without full item IDs */}
            {sn && !(sn as any)?.item_ids?.length && (sn as any)?.recalculated_at && (
              <p className="text-[10px] text-amber-600 px-4 -mt-1 mb-1">
                ⚠ Delvis rekalkulert — kun fullførte oppgaver er oppdatert. Fremtidige sprinter vil ha full støtte.
              </p>
            )}

            {/* Collapsed stats */}
            {sn && (
              <div className="px-4 pb-3 space-y-2">
                <div className="flex gap-4 text-xs">
                  <div><span className="text-muted-foreground">Planlagt</span><br /><strong>{sn.total_items}</strong> items</div>
                  <div><span className="text-muted-foreground">Fullført</span><br /><strong>{sn.completed_items}</strong> items</div>
                  <div><span className="text-muted-foreground">SP levert</span><br /><strong>{sn.completed_points}</strong>/{sn.total_points}</div>
                  <div><span className="text-muted-foreground">Completion</span><br /><strong>{completionPct}%</strong></div>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  {completionPct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${completionPct}%` }} />}
                  {incompletePct > 0 && <div className="bg-destructive/40 transition-all" style={{ width: `${incompletePct}%` }} />}
                </div>
              </div>
            )}

            {/* Expanded content */}
            {isExpanded && sn && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                {/* Items overview */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Fullført</p>
                    <div className="space-y-0.5">
                      {sn.completed_item_titles.map((t, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3 w-3 text-green-600 shrink-0" />
                          <span className="line-through text-muted-foreground">{t}</span>
                        </div>
                      ))}
                      {!sn.completed_item_titles.length && <p className="text-xs text-muted-foreground italic">Ingen</p>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Ikke fullført</p>
                    <div className="space-y-0.5">
                      {sn.incomplete_item_titles.map((t, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <XIcon className="h-3 w-3 text-destructive shrink-0" />
                          <span>{t}</span>
                        </div>
                      ))}
                      {!sn.incomplete_item_titles.length && <p className="text-xs text-muted-foreground italic">Ingen</p>}
                    </div>
                  </div>
                </div>

                {/* Burndown chart */}
                {sn.daily_burndown?.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Burndown</p>
                    <div className="h-[200px]">
                      <ResponsiveContainer>
                        <LineChart data={sn.daily_burndown}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={30} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} name="Ideell" />
                          <Line type="monotone" dataKey="remaining" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} name="Faktisk" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Contribution per person */}
                {Object.keys(sn.items_by_person ?? {}).length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Bidrag per person</p>
                    <div className="space-y-1.5">
                      {(() => {
                        const entries = Object.entries(sn.items_by_person);
                        const maxPts = Math.max(...entries.map(([, d]) => d.points ?? 0), 1);
                        return entries
                          .sort(([, a], [, b]) => (b.points ?? 0) - (a.points ?? 0))
                          .map(([key, data]) => {
                            // key is either a UUID (new format) or first name (legacy)
                            const member = members?.find((m) => m.id === key)
                              ?? members?.find((m) => m.name.split(" ")[0].toLowerCase() === key.toLowerCase());
                            const displayName = member ? member.name.split(" ")[0] : key;
                            const pts = data.points ?? 0;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                {member ? <MemberAvatar member={member} /> : <span className="text-xs w-6 text-muted-foreground">{displayName.slice(0, 2)}</span>}
                                <span className="text-xs w-16 truncate">{displayName}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${(pts / maxPts) * 100}%`,
                                      backgroundColor: member?.avatar_color ?? "hsl(var(--primary))",
                                    }} />
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">{pts} SP</span>
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                )}

                {/* Completion timeline */}
                {(() => {
                  const events = (sn.completion_events ?? []) as CompletionEvent[];
                  const hasTimestamps = events.some(e => e.completedAt);
                  if (events.length === 0) return null;
                  if (!hasTimestamps) return (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Fullførte oppgaver over tid</p>
                      <p className="text-xs text-muted-foreground italic">Tidsstempler ikke tilgjengelig for denne sprinten</p>
                    </div>
                  );
                  // Build cumulative data
                  const sorted = events.filter(e => e.completedAt).sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
                  let cumSP = 0;
                  const timelineData = sorted.map((e, i) => {
                    cumSP += e.storyPoints;
                    return { name: format(parseISO(e.completedAt!), "d. MMM", { locale: nb }), cumTasks: i + 1, cumSP, task: e.taskName };
                  });
                  return (
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Fullførte oppgaver over tid</p>
                      <div className="h-[160px]">
                        <ResponsiveContainer>
                          <LineChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} width={30} />
                            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(val: any, name: string) => [val, name === "cumSP" ? "Kumulative SP" : "Oppgaver"]} />
                            <Line type="stepAfter" dataKey="cumSP" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Kumulative SP" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })()}

                {/* Sprint Planning notes */}
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Sprint Planning-notater</Label>
                  <Textarea value={sprint.sprint_planning_notes ?? ""} rows={2}
                    className="mt-1 text-xs bg-muted/30"
                    onChange={(e) => updateReflection.mutate({ id: sprint.id, field: "sprint_planning_notes", value: e.target.value })} />
                </div>

                {/* Sprint review notes */}
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Sprint review-notater</Label>
                  <Textarea value={sprint.sprint_review_notes ?? ""} rows={2}
                    className="mt-1 text-xs bg-muted/30"
                    onChange={(e) => updateReflection.mutate({ id: sprint.id, field: "sprint_review_notes", value: e.target.value })} />
                </div>

                {/* Reflection */}
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Refleksjon — hva gikk bra? Hva kan forbedres?</Label>
                  <Textarea value={sprint.reflection ?? ""} rows={3}
                    className="mt-1 text-xs"
                    onChange={(e) => updateReflection.mutate({ id: sprint.id, field: "reflection", value: e.target.value })} />
                </div>

                {/* Edit changelog */}
                {(sprint.edit_changelog ?? []).length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Endringslogg</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {(sprint.edit_changelog as any[]).map((entry, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          {format(parseISO(entry.timestamp), "d. MMM HH:mm", { locale: nb })} — {entry.field} endret
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-[11px] h-7"
                    onClick={() => copyText(exportSprintMarkdown(sprint), "Markdown for prosesslogg")}>
                    <FileText className="h-3 w-3 mr-1" /> Markdown (prosesslogg)
                  </Button>
                  <Button size="sm" variant="outline" className="text-[11px] h-7"
                    onClick={() => copyText(exportSprintText(sprint), "Ren tekst")}>
                    <Copy className="h-3 w-3 mr-1" /> Ren tekst
                  </Button>
                  <Button size="sm" variant="outline" className="text-[11px] h-7"
                    onClick={() => exportImage(`sprint-card-${sprint.id}`)}>
                    <Download className="h-3 w-3 mr-1" /> Bilde
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {/* Comparison table */}
      {comparisonData && comparisonData.sorted.length > 1 && (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Sprint-sammenligning</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 pr-3 font-medium text-muted-foreground"></th>
                  {comparisonData.sorted.map((s) => <th key={s.id} className="text-center py-1 px-2 font-medium">{s.name}</th>)}
                  <th className="text-center py-1 px-2 font-medium text-muted-foreground">Totalt</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-1 pr-3 text-muted-foreground">Periode</td>
                  {comparisonData.sorted.map((s) => (
                    <td key={s.id} className="text-center py-1 px-2">
                      {format(parseISO(s.start_date), "d. MMM", { locale: nb })}–{format(parseISO(s.end_date), "d. MMM", { locale: nb })}
                    </td>
                  ))}
                  <td className="text-center py-1 px-2 text-muted-foreground">–</td>
                </tr>
                {[
                  { label: "Items planlagt", key: "total_items" },
                  { label: "Items fullført", key: "completed_items" },
                  { label: "SP planlagt", key: "total_points" },
                  { label: "SP levert", key: "completed_points" },
                ].map((row) => (
                  <tr key={row.key} className="border-b">
                    <td className="py-1 pr-3 text-muted-foreground">{row.label}</td>
                    {comparisonData.sorted.map((s) => (
                      <td key={s.id} className="text-center py-1 px-2 font-medium">
                        {(s.snapshot as any)?.[row.key] ?? "–"}
                      </td>
                    ))}
                    <td className="text-center py-1 px-2 font-medium">
                      {comparisonData.sorted.reduce((s, sp) => s + ((sp.snapshot as any)?.[row.key] ?? 0), 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b">
                  <td className="py-1 pr-3 text-muted-foreground">Completion</td>
                  {comparisonData.sorted.map((s) => {
                    const pct = s.snapshot && s.snapshot.total_points > 0
                      ? Math.round((s.snapshot.completed_points / s.snapshot.total_points) * 100) : 0;
                    return <td key={s.id} className="text-center py-1 px-2 font-medium">{pct}%</td>;
                  })}
                  <td className="text-center py-1 px-2 font-medium">
                    {comparisonData.totalSPPlanned > 0 ? Math.round((comparisonData.totalSPDone / comparisonData.totalSPPlanned) * 100) : 0}%
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 text-muted-foreground">Velocity</td>
                  {comparisonData.sorted.map((s) => (
                    <td key={s.id} className="text-center py-1 px-2 font-medium">{s.snapshot?.completed_points ?? 0}</td>
                  ))}
                  <td className="text-center py-1 px-2 text-muted-foreground">Snitt: {avgVelocity}</td>
                </tr>
              </tbody>
            </table>

            {/* Velocity trend */}
            <div className="flex items-center gap-2 mt-3 text-xs">
              {velocityTrend === "øker" && <TrendingUp className="h-4 w-4 text-green-600" />}
              {velocityTrend === "synker" && <TrendingDown className="h-4 w-4 text-destructive" />}
              {velocityTrend === "stabil" && <Minus className="h-4 w-4 text-muted-foreground" />}
              <span>Velocity <strong>{velocityTrend}</strong></span>
            </div>

            <Button size="sm" variant="outline" className="text-[11px] h-7 mt-3" onClick={() => {
              const header = `| | ${comparisonData.sorted.map(s => s.name).join(" | ")} | Totalt |`;
              const sep = `|--|${comparisonData.sorted.map(() => "---").join("|")}|--------|`;
              const rows = ["total_items", "completed_items", "total_points", "completed_points"].map((key) => {
                const label = { total_items: "Items planlagt", completed_items: "Items fullført", total_points: "SP planlagt", completed_points: "SP levert" }[key] ?? key;
                const vals = comparisonData.sorted.map(s => String((s.snapshot as any)?.[key] ?? "–"));
                const total = comparisonData.sorted.reduce((s, sp) => s + ((sp.snapshot as any)?.[key] ?? 0), 0);
                return `| ${label} | ${vals.join(" | ")} | ${total} |`;
              });
              copyText(`${header}\n${sep}\n${rows.join("\n")}`, "Sammenligningstabell");
            }}>
              <Copy className="h-3 w-3 mr-1" /> Eksporter tabell
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Export all sprints */}
      {sprintsWithSnapshots.length > 0 && (
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Eksporter alle sprinter</p>
              <p className="text-xs text-muted-foreground">Komplett sprint-historikk for prosesslogg og rapport</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-[11px] h-7"
                onClick={() => copyText(exportAllMarkdown(), "Markdown-eksport")}>
                <FileText className="h-3 w-3 mr-1" /> Markdown (prosesslogg)
              </Button>
              <Button size="sm" variant="outline" className="text-[11px] h-7"
                onClick={() => {
                  const blob = new Blob([exportAllJSON()], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `flyyt-sprint-export-${format(new Date(), "yyyy-MM-dd")}.json`;
                  a.click(); URL.revokeObjectURL(url);
                  toast.success("JSON-fil lastet ned");
                }}>
                <Download className="h-3 w-3 mr-1" /> JSON (backup)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
