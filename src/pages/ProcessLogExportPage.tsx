import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useActivities, useActivityParticipants } from "@/hooks/useActivities";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ClipboardCheck, Copy, FileText } from "lucide-react";
import type { Sprint, SprintItem, BacklogItem, Decision } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProcessLogExportPage() {
  const { data: activities } = useActivities();
  const { data: participants } = useActivityParticipants();
  const { data: members } = useTeamMembers();
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });
  const { data: sprintItems } = useQuery<(SprintItem & { backlog_item: BacklogItem })[]>({
    queryKey: ["all_sprint_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items")
        .select("*, backlog_item:backlog_items(*)")
        .order("column_order");
      if (error) throw error;
      return data as any;
    },
  });
  const { data: decisions } = useQuery<Decision[]>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("decisions").select("*").order("date");
      if (error) throw error;
      return data;
    },
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const inRange = (dateStr: string) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  // --- Activity export ---
  const completedActivities = useMemo(() => {
    return (activities ?? [])
      .filter((a) => a.status === "completed" && (a.completed_date ? inRange(a.completed_date) : true))
      .sort((a, b) => (a.completed_week ?? 0) - (b.completed_week ?? 0));
  }, [activities, dateFrom, dateTo]);

  const getParticipantNames = (activityId: string) => {
    const pIds = (participants ?? []).filter((p) => p.activity_id === activityId).map((p) => p.member_id);
    return (members ?? []).filter((m) => pIds.includes(m.id)).map((m) => m.name);
  };

  const activityMarkdown = useMemo(() => {
    return completedActivities.map((a) => {
      const names = getParticipantNames(a.id);
      const lines = [
        `**${a.name}** (Uke ${a.completed_week ?? "?"}, ${a.completed_date ? formatDate(a.completed_date) : "ukjent dato"})`,
        `Poeng: ${a.points} | Deltakere: ${names.length > 0 ? names.join(", ") : "Ikke angitt"}`,
        "",
        "**Hvorfor dette tidspunktet:**",
        (a as any).timing_rationale || "_Ikke utfylt_",
        "",
        "**Gjennomføring:**",
        a.notes || "_Ikke utfylt_",
        "",
        "**Erfaringer:**",
        (a as any).experiences || "_Ikke utfylt_",
        "",
        "**Refleksjoner:**",
        (a as any).reflections || "_Ikke utfylt_",
        "",
        `**Vedlegg:** ${a.attachment_links?.length ? a.attachment_links.join(", ") : "Ingen"}`,
        "",
        "---",
        "",
      ];
      return lines.join("\n");
    }).join("\n");
  }, [completedActivities, participants, members]);

  const activityPlain = useMemo(() => {
    return completedActivities.map((a) => {
      const names = getParticipantNames(a.id);
      const lines = [
        `${a.name} (Uke ${a.completed_week ?? "?"}, ${a.completed_date ? formatDate(a.completed_date) : "ukjent dato"})`,
        `Poeng: ${a.points} | Deltakere: ${names.length > 0 ? names.join(", ") : "Ikke angitt"}`,
        "",
        "Hvorfor dette tidspunktet:",
        (a as any).timing_rationale || "(Ikke utfylt)",
        "",
        "Gjennomføring:",
        a.notes || "(Ikke utfylt)",
        "",
        "Erfaringer:",
        (a as any).experiences || "(Ikke utfylt)",
        "",
        "Refleksjoner:",
        (a as any).reflections || "(Ikke utfylt)",
        "",
        `Vedlegg: ${a.attachment_links?.length ? a.attachment_links.join(", ") : "Ingen"}`,
        "",
        "---",
        "",
      ];
      return lines.join("\n");
    }).join("\n");
  }, [completedActivities, participants, members]);

  // --- Sprint export ---
  const filteredSprints = useMemo(() => {
    return (sprints ?? []).filter((s) => inRange(s.start_date) || inRange(s.end_date));
  }, [sprints, dateFrom, dateTo]);

  const sprintMarkdown = useMemo(() => {
    const header = "| Sprint | Periode | Mål | Fullførte items | Story points |\n|--------|---------|-----|-----------------|--------------|";
    const rows = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id);
      const done = items.filter((si) => si.column_name === "done");
      const sp = done.reduce((sum, si) => sum + (si.backlog_item?.estimate ?? 0), 0);
      return `| ${s.name} | ${formatDate(s.start_date)}–${formatDate(s.end_date)} | ${s.goal ?? "-"} | ${done.length} | ${sp} |`;
    });

    const details = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id && si.column_name === "done");
      if (!items.length) return "";
      const listing = items.map((si) => `- **${si.backlog_item?.title}**: ${si.backlog_item?.description ?? "Ingen beskrivelse"}`).join("\n");
      return `\n### ${s.name}\n${listing}`;
    }).filter(Boolean).join("\n");

    return `${header}\n${rows.join("\n")}\n${details}`;
  }, [filteredSprints, sprintItems]);

  const sprintPlain = useMemo(() => {
    const rows = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id);
      const done = items.filter((si) => si.column_name === "done");
      const sp = done.reduce((sum, si) => sum + (si.backlog_item?.estimate ?? 0), 0);
      return `${s.name} | ${formatDate(s.start_date)}–${formatDate(s.end_date)} | ${s.goal ?? "-"} | ${done.length} fullført | ${sp} SP`;
    });

    const details = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id && si.column_name === "done");
      if (!items.length) return "";
      const listing = items.map((si) => `  - ${si.backlog_item?.title}: ${si.backlog_item?.description ?? "Ingen beskrivelse"}`).join("\n");
      return `\n${s.name}:\n${listing}`;
    }).filter(Boolean).join("\n");

    return `${rows.join("\n")}\n${details}`;
  }, [filteredSprints, sprintItems]);

  // --- Decision export ---
  const filteredDecisions = useMemo(() => {
    return (decisions ?? []).filter((d) => inRange(d.date));
  }, [decisions, dateFrom, dateTo]);

  const decisionMarkdown = useMemo(() => {
    return filteredDecisions.map((d) => {
      return `- **${formatDate(d.date)}: ${d.title}**\n  Kontekst: ${d.context ?? "-"} | Valg: ${d.choice ?? "-"} | Begrunnelse: ${d.rationale ?? "-"}`;
    }).join("\n\n");
  }, [filteredDecisions]);

  const decisionPlain = useMemo(() => {
    return filteredDecisions.map((d) => {
      return `${formatDate(d.date)}: ${d.title}\n  Kontekst: ${d.context ?? "-"} | Valg: ${d.choice ?? "-"} | Begrunnelse: ${d.rationale ?? "-"}`;
    }).join("\n\n");
  }, [filteredDecisions]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert til utklippstavlen`);
  };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Prosesslogg-eksport"
        description="Generer og kopier strukturerte prosesslogg-tekster for innlevering"
      />

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-sm text-muted-foreground">Fra:</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-sm text-muted-foreground">Til:</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Nullstill filter
          </Button>
        )}
      </div>

      <Tabs defaultValue="activities">
        <TabsList>
          <TabsTrigger value="activities">Aktiviteter ({completedActivities.length})</TabsTrigger>
          <TabsTrigger value="sprints">Sprinter ({filteredSprints.length})</TabsTrigger>
          <TabsTrigger value="decisions">Beslutninger ({filteredDecisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(activityPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Kopier ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(activityMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Kopier som Markdown
            </Button>
          </div>
          {completedActivities.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ingen fullførte aktiviteter i valgt periode</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background leading-relaxed">{activityPlain}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sprints" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(sprintPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Kopier ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(sprintMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Kopier som Markdown
            </Button>
          </div>
          {filteredSprints.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ingen sprinter i valgt periode</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background leading-relaxed">{sprintPlain}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(decisionPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Kopier ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(decisionMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Kopier som Markdown
            </Button>
          </div>
          {filteredDecisions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ingen beslutninger i valgt periode</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background leading-relaxed">{decisionPlain}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
