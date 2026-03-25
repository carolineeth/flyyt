import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations, type Registration, type CatalogItem } from "@/hooks/useActivityCatalog";
import { useCompletedMeetings, useMeetingAgendaItemsAll, useMeetingActionPointsAll, type ProsessloggNote } from "@/hooks/useProsesslogg";
import { useAllMeetingSubSessions } from "@/hooks/useMeetingCalendar";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivitySlideOver } from "./ActivitySlideOver";
import { SprintSlideOver } from "./SprintSlideOver";
import { MeetingSlideOver } from "./MeetingSlideOver";
import { toast } from "sonner";
import { Copy, FileText, ChevronRight, ChevronDown } from "lucide-react";
import type { Sprint } from "@/lib/types";

function formatTypeSpecificExport(
  type: string,
  typeData: Record<string, any>,
  aps: any[],
  members: any[]
): string {
  if (!typeData || Object.keys(typeData).length === 0) return "";
  const lines: string[] = [];
  const member = (id: string) => members.find((m) => m.id === id)?.name?.split(" ")[0] ?? "?";
  const apLines = (label: string, apList: any[]) => {
    if (!apList.length) return;
    lines.push(`${label}:`);
    apList.forEach((ap) => {
      const status = ap.is_completed ? "✓" : "○";
      let l = `  ${status} ${ap.title || "(uten tittel)"}`;
      if (ap.assignee_id) l += ` → ${member(ap.assignee_id)}`;
      if (ap.deadline) l += ` (frist: ${ap.deadline})`;
      lines.push(l);
    });
  };
  if (type === "veiledermøte") {
    if (typeData.questions_for_advisor) lines.push(`Spørsmål til veileder: ${typeData.questions_for_advisor}`);
    if (typeData.advisor_feedback) lines.push(`Feedback fra veileder: ${typeData.advisor_feedback}`);
    apLines("Action points", aps);
  } else if (type === "sprint_planning") {
    if (typeData.sprint_goal) lines.push(`Sprint goal: ${typeData.sprint_goal}`);
    if (typeData.capacity) lines.push(`Kapasitet: ${typeData.capacity} SP`);
    if (typeData.planning_notes) lines.push(`Planlegging: ${typeData.planning_notes}`);
  } else if (type === "sprint_review") {
    if (typeData.what_was_demonstrated) lines.push(`Demonstrert: ${typeData.what_was_demonstrated}`);
    if (typeData.feedback) lines.push(`Feedback: ${typeData.feedback}`);
  } else if (type === "daily_standup") {
    const formatLabels: Record<string, string> = { fysisk: "Fysisk", digital: "Digital", asynkron: "Asynkron i Flyt" };
    if (typeData.format) lines.push(`Format: ${formatLabels[typeData.format] ?? typeData.format}`);
    if (typeData.duration_minutes) lines.push(`Varighet: ${typeData.duration_minutes} min`);
  } else if (type === "retrospective") {
    const retroLabels: Record<string, string> = { sailboat: "Sailboat", start_stop_continue: "Start-Stop-Continue", mad_sad_glad: "Mad-Sad-Glad", annet: "Annet" };
    if (typeData.retro_format) lines.push(`Format: ${retroLabels[typeData.retro_format] ?? typeData.retro_format}`);
    if (typeData.tools_used) lines.push(`Verktøy: ${typeData.tools_used}`);
    if (typeData.what_works) lines.push(`Hva fungerer: ${typeData.what_works}`);
    if (typeData.improvements) lines.push(`Forbedringspunkter: ${typeData.improvements}`);
    apLines("Action points fra retro", aps);
  } else if (type === "mobb_programmering") {
    if (typeData.what_was_built) lines.push(`Hva ble laget: ${typeData.what_was_built}`);
    if (typeData.code_link) lines.push(`Kildekode: ${typeData.code_link}`);
    if (typeData.schedule) lines.push(`Tidsskjema: ${typeData.schedule}`);
    if (typeData.duration_minutes) lines.push(`Varighet: ${typeData.duration_minutes} min`);
  } else if (type === "workshop") {
    if (typeData.workshop_type) lines.push(`Type: ${typeData.workshop_type}`);
    if (typeData.source) lines.push(`Kilde: ${typeData.source}`);
    if (typeData.purpose) lines.push(`Formål: ${typeData.purpose}`);
    if (typeData.agenda) lines.push(`Agenda: ${typeData.agenda}`);
  }
  return lines.length > 0 ? "\n" + lines.join("\n") : "";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

function CompleteDots({ fields }: { fields: (string | null | undefined)[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {fields.map((f, i) => (
        <span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: f ? "#97C459" : "hsl(var(--border))" }}
        />
      ))}
    </div>
  );
}

const typeLabels: Record<string, string> = {
  standup: "Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  advisor: "Veiledermøte",
  other: "Annet",
};

interface Props {
  notes: ProsessloggNote[];
}

export function OverviewTab({ notes }: Props) {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["completed_sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").not("completed_at", "is", null).order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: snapshots } = useQuery({
    queryKey: ["sprint_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_snapshots").select("*");
      if (error) throw error;
      return data;
    },
  });
  const { data: meetings } = useCompletedMeetings();
  const { data: allSubSessions } = useAllMeetingSubSessions();
  const { data: members } = useTeamMembers();

  const subSessionMap = useMemo(() => {
    const map: Record<string, { notes: string | null; type: string; type_specific_data: Record<string, any> }> = {};
    (allSubSessions ?? []).forEach((ss) => {
      map[ss.id] = { notes: ss.notes, type: ss.type, type_specific_data: ss.type_specific_data ?? {} };
    });
    return map;
  }, [allSubSessions]);

  // Map meeting_id → sub_sessions for filtering
  const subSessionsByMeeting = useMemo(() => {
    const map: Record<string, any[]> = {};
    (allSubSessions ?? []).forEach((ss) => {
      if (!ss.meeting_id) return;
      if (!map[ss.meeting_id]) map[ss.meeting_id] = [];
      map[ss.meeting_id].push(ss);
    });
    return map;
  }, [allSubSessions]);

  const effectiveDescription = (r: Registration) =>
    r.description || (r.linked_sub_session_id ? (subSessionMap[r.linked_sub_session_id]?.notes ?? null) : null);
  const { data: allAgendaItems } = useMeetingAgendaItemsAll();
  const { data: allActionPoints } = useMeetingActionPointsAll();
  const { data: decisions } = useQuery({
    queryKey: ["decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("decisions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Registration | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [exportType, setExportType] = useState("all");

  // Section collapse state — default expanded for sections with content, collapsed when empty
  const [activitiesOpen, setActivitiesOpen] = useState(true);
  const [sprintsOpen, setSprintsOpen] = useState(true);
  const [meetingsOpen, setMeetingsOpen] = useState(true);

  // Auto-collapse empty sections after data loads (effects moved after useMemo declarations below)

  const catalogMap = useMemo(() => {
    const map: Record<string, CatalogItem> = {};
    (catalog ?? []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [catalog]);

  const snapshotMap = useMemo(() => {
    const map: Record<string, any> = {};
    (snapshots ?? []).forEach((s) => { map[s.sprint_id] = s; });
    return map;
  }, [snapshots]);

  const inRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  // Completed registrations sorted: incomplete first, then by week desc
  const completedRegs = useMemo(() => {
    return (registrations ?? [])
      .filter((r) => r.status === "completed" && inRange(r.completed_date))
      .sort((a, b) => {
        const aComplete = [a.timing_rationale, effectiveDescription(a), a.experiences, a.reflections].filter(Boolean).length;
        const bComplete = [b.timing_rationale, effectiveDescription(b), b.experiences, b.reflections].filter(Boolean).length;
        if (aComplete < 4 && bComplete === 4) return -1;
        if (bComplete < 4 && aComplete === 4) return 1;
        return (b.completed_week ?? 0) - (a.completed_week ?? 0);
      });
  }, [registrations, dateFrom, dateTo, subSessionMap]);

  const filteredSprints = useMemo(() => {
    return (sprints ?? []).filter((s) => inRange(s.start_date) || inRange(s.end_date));
  }, [sprints, dateFrom, dateTo]);

  const filteredMeetings = useMemo(() => {
    return (meetings ?? [])
      .filter((m) => inRange(m.meeting_date))
      .filter((m) => {
        if (m.notes) return true;
        if ((allActionPoints ?? []).some((a: any) => a.meeting_id === m.id)) return true;
        if ((allAgendaItems ?? []).some((a) => a.meeting_id === m.id)) return true;
        const subs = subSessionsByMeeting[m.id] ?? [];
        return subs.some((ss) => ss.notes || Object.keys(ss.type_specific_data ?? {}).some((k) => ss.type_specific_data[k]));
      });
  }, [meetings, allAgendaItems, allActionPoints, subSessionsByMeeting, dateFrom, dateTo]);

  // Completeness counting
  const totalElements = completedRegs.length + filteredSprints.length + filteredMeetings.length + (decisions ?? []).length;
  const completeElements = useMemo(() => {
    const actComplete = completedRegs.filter((r) => [r.timing_rationale, effectiveDescription(r), r.experiences, r.reflections].every(Boolean)).length;
    const sprintComplete = filteredSprints.filter((s) => s.sprint_review_notes && s.reflection).length;
    const meetingComplete = filteredMeetings.filter((m) => m.notes).length;
    return actComplete + sprintComplete + meetingComplete + (decisions ?? []).length;
  }, [completedRegs, filteredSprints, filteredMeetings, decisions]);

  const progressPct = totalElements > 0 ? Math.round((completeElements / totalElements) * 100) : 0;

  // Group activities by week
  const activitiesByWeek = useMemo(() => {
    const groups: Record<number, Registration[]> = {};
    completedRegs.forEach((r) => {
      const week = r.completed_week ?? r.planned_week ?? 0;
      if (!groups[week]) groups[week] = [];
      groups[week].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
  }, [completedRegs]);

  // Export functions
  const exportActivities = () => {
    const text = completedRegs.map((r) => {
      const cat = catalogMap[r.catalog_id];
      const ss = r.linked_sub_session_id ? subSessionMap[r.linked_sub_session_id] : null;
      const ssAPs = ss
        ? (allActionPoints ?? []).filter((ap: any) => ap.source_sub_session_id === r.linked_sub_session_id)
        : [];
      const typeExtra = ss
        ? formatTypeSpecificExport(ss.type, ss.type_specific_data, ssAPs, members ?? [])
        : "";
      return [
        `${cat?.name ?? "?"} (#${r.occurrence_number})`,
        `Uke: ${r.completed_week ?? "?"}${r.completed_date ? ` — ${formatDate(r.completed_date)}` : ""}`,
        `Poeng: ${cat?.points ?? 0}`,
        "", "Tidspunkt:", r.timing_rationale || "(Ikke utfylt)",
        "", "Gjennomføring:", effectiveDescription(r) || "(Ikke utfylt)",
        typeExtra,
        "", "Erfaringer:", r.experiences || "(Ikke utfylt)",
        "", "Refleksjoner:", r.reflections || "(Ikke utfylt)",
        "", "---", "",
      ].filter((l) => l !== undefined).join("\n");
    }).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Aktiviteter kopiert");
  };

  const exportSprints = () => {
    const text = filteredSprints.map((s) => {
      const snap = snapshotMap[s.id];
      return [
        s.name,
        `${formatDate(s.start_date)} – ${formatDate(s.end_date)}`,
        s.goal ? `Mål: ${s.goal}` : "",
        snap ? `Fullført: ${snap.completed_points}/${snap.total_points} SP` : "",
        "", "Review:", s.sprint_review_notes || "(Ikke utfylt)",
        "", "Refleksjon:", s.reflection || "(Ikke utfylt)",
        "", "---", "",
      ].filter(Boolean).join("\n");
    }).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Sprinter kopiert");
  };

  const exportMeetings = () => {
    const text = filteredMeetings.map((m) => {
      const agenda = (allAgendaItems ?? []).filter((a) => a.meeting_id === m.id);
      const actions = (allActionPoints ?? []).filter((a) => a.meeting_id === m.id);
      return [
        `${typeLabels[m.type] || m.type} — ${formatDate(m.meeting_date || m.date)}`,
        agenda.length ? `Agenda: ${agenda.map((a) => a.title).join(", ")}` : "",
        actions.length ? `Action points: ${actions.map((a) => a.title).join(", ")}` : "",
        m.notes ? `Notater: ${m.notes}` : "",
        "---", "",
      ].filter(Boolean).join("\n");
    }).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Møtereferater kopiert");
  };

  const handleExport = (format: "plain" | "markdown") => {
    if (exportType === "activities") return exportActivities();
    if (exportType === "sprints") return exportSprints();
    if (exportType === "meetings") return exportMeetings();
    // All
    exportActivities();
    setTimeout(() => {
      const allText = [
        "=== AKTIVITETER ===\n",
        completedRegs.map((r) => {
          const cat = catalogMap[r.catalog_id];
          return `${cat?.name} (#${r.occurrence_number}) — Uke ${r.completed_week ?? "?"}\n`;
        }).join(""),
        "\n=== SPRINTER ===\n",
        filteredSprints.map((s) => `${s.name}\n`).join(""),
        "\n=== MØTER ===\n",
        filteredMeetings.map((m) => `${typeLabels[m.type] || m.type} — ${formatDate(m.meeting_date || m.date)}\n`).join(""),
      ].join("");
      navigator.clipboard.writeText(allText);
      toast.success("Alt kopiert");
    }, 100);
  };

  const selectedCatalog = selectedActivity ? catalogMap[selectedActivity.catalog_id] : null;
  const linkedNotes = selectedActivity ? notes.filter((n) => n.linked_registration_id === selectedActivity.id) : [];
  const selectedSnapshot = selectedSprint ? snapshotMap[selectedSprint.id] : null;
  const selectedMeetingAgenda = selectedMeeting ? (allAgendaItems ?? []).filter((a) => a.meeting_id === selectedMeeting.id) : [];
  const selectedMeetingActions = selectedMeeting ? (allActionPoints ?? []).filter((a) => a.meeting_id === selectedMeeting.id) : [];

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Prosesslogg-komplett</span>
          <span className="text-xs text-muted-foreground">{completeElements} av {totalElements} elementer har alle felt utfylt</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Activities */}
      <section>
        <button
          onClick={() => setActivitiesOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full text-left mb-2 group"
        >
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${activitiesOpen ? "" : "-rotate-90"}`} />
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium group-hover:text-foreground transition-colors">
            Teamaktiviteter ({completedRegs.length})
          </h3>
        </button>
        {activitiesOpen && (activitiesByWeek.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Ingen fullførte aktiviteter</p>
        ) : (
          <div className="space-y-3">
            {activitiesByWeek.map(([week, regs]) => (
              <div key={week}>
                <p className="text-[11px] text-muted-foreground mb-1">Uke {week}</p>
                <div className="space-y-0">
                  {regs.map((r) => {
                    const cat = catalogMap[r.catalog_id];
                    const fields = [r.timing_rationale, effectiveDescription(r), r.experiences, r.reflections];
                    const filled = fields.filter(Boolean).length;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedActivity(r)}
                        className="w-full flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium truncate">{cat?.name ?? "Ukjent"} #{r.occurrence_number}</span>
                            {filled < 4 && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 shrink-0">Mangler</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{r.completed_date ? formatDate(r.completed_date) : "Ikke fullført"}</span>
                            <Badge variant="secondary" className="text-[10px] h-4">{cat?.points ?? 0}p</Badge>
                          </div>
                        </div>
                        <CompleteDots fields={fields} />
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Sprints */}
      <section>
        <button
          onClick={() => setSprintsOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full text-left mb-2 group"
        >
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${sprintsOpen ? "" : "-rotate-90"}`} />
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium group-hover:text-foreground transition-colors">
            Sprinter ({filteredSprints.length})
          </h3>
        </button>
        {sprintsOpen && (filteredSprints.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Ingen fullførte sprinter</p>
        ) : (
          <div className="space-y-0">
            {filteredSprints.map((s) => {
              const snap = snapshotMap[s.id];
              const rate = snap ? Math.round((snap.completed_points / (snap.total_points || 1)) * 100) : null;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSprint(s)}
                  className="w-full flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">{s.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(s.start_date)} – {formatDate(s.end_date)}</span>
                      {rate !== null && snap && (
                        <Badge variant="secondary" className="text-[10px] h-4">{rate}% — {snap.completed_points}/{snap.total_points} SP</Badge>
                      )}
                    </div>
                  </div>
                  <CompleteDots fields={[s.sprint_review_notes, s.reflection]} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        ))}
      </section>

      {/* Meetings */}
      <section>
        <button
          onClick={() => setMeetingsOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full text-left mb-2 group"
        >
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${meetingsOpen ? "" : "-rotate-90"}`} />
          <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium group-hover:text-foreground transition-colors">
            Møtereferater ({filteredMeetings.length})
          </h3>
        </button>
        {meetingsOpen && (filteredMeetings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Ingen møter med notater</p>
        ) : (
          <div className="space-y-0">
            {filteredMeetings.map((m) => {
              const subs = subSessionsByMeeting[m.id] ?? [];
              const actions = (allActionPoints ?? []).filter((a: any) => a.meeting_id === m.id);
              const subsWithNotes = subs.filter((ss) => ss.notes || Object.keys(ss.type_specific_data ?? {}).some((k) => ss.type_specific_data[k]));
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className="w-full flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">{typeLabels[m.type] || m.type}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(m.meeting_date)}</span>
                      {subs.length > 0 && <span className="text-[10px] text-muted-foreground">{subs.length} delmøter</span>}
                      {actions.length > 0 && <span className="text-[10px] text-muted-foreground">{actions.length} aksjoner</span>}
                    </div>
                  </div>
                  <CompleteDots fields={subsWithNotes.map((ss) => ss.notes)} />
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        ))}
      </section>

      {/* Export section */}
      <section className="border-t pt-3">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Samlet eksport</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">Fra:</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-32 h-7 text-xs" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">Til:</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-32 h-7 text-xs" />
          </div>
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger className="w-[160px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alt samlet</SelectItem>
              <SelectItem value="activities">Alle aktiviteter</SelectItem>
              <SelectItem value="sprints">Alle sprinter</SelectItem>
              <SelectItem value="meetings">Alle møtereferater</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleExport("plain")}>
            <Copy className="h-3 w-3 mr-1" /> Ren tekst
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleExport("markdown")}>
            <FileText className="h-3 w-3 mr-1" /> Markdown
          </Button>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              Nullstill
            </Button>
          )}
        </div>
      </section>

      {/* Slide-overs */}
      <ActivitySlideOver
        open={!!selectedActivity}
        onOpenChange={(open) => !open && setSelectedActivity(null)}
        registration={selectedActivity}
        catalogItem={selectedCatalog}
        linkedNotes={linkedNotes}
      />
      <SprintSlideOver
        open={!!selectedSprint}
        onOpenChange={(open) => !open && setSelectedSprint(null)}
        sprint={selectedSprint}
        snapshot={selectedSnapshot}
      />
      <MeetingSlideOver
        open={!!selectedMeeting}
        onOpenChange={(open) => !open && setSelectedMeeting(null)}
        meeting={selectedMeeting}
        agendaItems={selectedMeetingAgenda}
        actionPoints={selectedMeetingActions}
      />
    </div>
  );
}
