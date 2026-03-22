import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useActivityCatalog, useActivityRegistrations, useRegistrationParticipants } from "@/hooks/useActivityCatalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, FileText, Code } from "lucide-react";
import type { Sprint, SprintItem, BacklogItem, Decision } from "@/lib/types";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

function tex(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&%$#_{}]/g, (m) => "\\" + m)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/–/g, "--")
    .replace(/—/g, "---");
}

export default function ProcessLogExportPage() {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: regParticipants } = useRegistrationParticipants();
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
  const { data: standupUpdates } = useQuery({
    queryKey: ["all_daily_updates_export"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_updates").select("*").order("entry_date");
      if (error) throw error;
      return data;
    },
  });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const inRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
    return true;
  };

  const catalogMap = useMemo(() => {
    const map: Record<string, typeof catalog extends (infer T)[] | undefined ? T : never> = {};
    (catalog ?? []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [catalog]);

  const getRegParticipantNames = (regId: string) => {
    const pIds = (regParticipants ?? []).filter((p) => p.registration_id === regId).map((p) => p.member_id);
    return (members ?? []).filter((m) => pIds.includes(m.id)).map((m) => m.name);
  };

  // --- Activity registrations export ---
  const completedRegistrations = useMemo(() => {
    return (registrations ?? [])
      .filter((r) => r.status === "completed" && inRange(r.completed_date))
      .sort((a, b) => (a.completed_week ?? 0) - (b.completed_week ?? 0));
  }, [registrations, dateFrom, dateTo]);

  const allRegistrations = useMemo(() => {
    return (registrations ?? [])
      .filter((r) => inRange(r.completed_date) || inRange(r.created_at))
      .sort((a, b) => (a.completed_week ?? 0) - (b.completed_week ?? 0));
  }, [registrations, dateFrom, dateTo]);

  const activityPlain = useMemo(() => {
    if (!allRegistrations.length) return "";
    return allRegistrations.map((r) => {
      const cat = catalogMap[r.catalog_id];
      const names = getRegParticipantNames(r.id);
      const statusLabel = r.status === "completed" ? "Fullført" : r.status === "in_progress" ? "Pågår" : r.status === "planned" ? "Planlagt" : r.status;
      const lines = [
        `${cat?.name ?? "Ukjent"} (#${r.occurrence_number}) — ${statusLabel}`,
        `Uke: ${r.completed_week ?? r.planned_week ?? "?"} | ${r.completed_date ? formatDate(r.completed_date) : "Ikke fullført ennå"}`,
        `Poeng: ${cat?.points ?? 0} | Deltakere: ${names.length > 0 ? names.join(", ") : "Ikke angitt"}`,
        "",
        "Hvorfor dette tidspunktet:",
        r.timing_rationale || "(Ikke utfylt)",
        "",
        "Beskrivelse/Gjennomføring:",
        r.description || "(Ikke utfylt)",
        "",
        "Erfaringer:",
        r.experiences || "(Ikke utfylt)",
        "",
        "Refleksjoner:",
        r.reflections || "(Ikke utfylt)",
        "",
        `Vedlegg: ${r.attachment_links?.length ? r.attachment_links.join(", ") : "Ingen"}`,
        r.short_status ? `Kort status: ${r.short_status}` : "",
        "",
        "---",
        "",
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n");
  }, [allRegistrations, catalogMap, regParticipants, members]);

  const activityMarkdown = useMemo(() => {
    if (!allRegistrations.length) return "";
    return allRegistrations.map((r) => {
      const cat = catalogMap[r.catalog_id];
      const names = getRegParticipantNames(r.id);
      const statusLabel = r.status === "completed" ? "✅ Fullført" : r.status === "in_progress" ? "🔄 Pågår" : r.status === "planned" ? "📋 Planlagt" : r.status;
      const lines = [
        `### ${cat?.name ?? "Ukjent"} (#${r.occurrence_number}) — ${statusLabel}`,
        "",
        `**Uke:** ${r.completed_week ?? r.planned_week ?? "?"} | **Dato:** ${r.completed_date ? formatDate(r.completed_date) : "Ikke fullført ennå"}`,
        `**Poeng:** ${cat?.points ?? 0} | **Deltakere:** ${names.length > 0 ? names.join(", ") : "Ikke angitt"}`,
        "",
        "**Hvorfor dette tidspunktet:**",
        r.timing_rationale || "_Ikke utfylt_",
        "",
        "**Beskrivelse/Gjennomføring:**",
        r.description || "_Ikke utfylt_",
        "",
        "**Erfaringer:**",
        r.experiences || "_Ikke utfylt_",
        "",
        "**Refleksjoner:**",
        r.reflections || "_Ikke utfylt_",
        "",
        `**Vedlegg:** ${r.attachment_links?.length ? r.attachment_links.join(", ") : "Ingen"}`,
        r.short_status ? `**Kort status:** ${r.short_status}` : "",
        "",
        "---",
        "",
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n");
  }, [allRegistrations, catalogMap, regParticipants, members]);

  const activityLatex = useMemo(() => {
    if (!allRegistrations.length) return "";
    const items = allRegistrations.map((r) => {
      const cat = catalogMap[r.catalog_id];
      const names = getRegParticipantNames(r.id);
      const statusLabel = r.status === "completed" ? "Fullført" : r.status === "in_progress" ? "Pågår" : r.status === "planned" ? "Planlagt" : r.status;
      return [
        `\\subsection{${tex(cat?.name ?? "Ukjent")} (\\#${r.occurrence_number}) -- ${tex(statusLabel)}}`,
        "",
        `\\textbf{Uke:} ${r.completed_week ?? r.planned_week ?? "?"} \\hfill \\textbf{Dato:} ${r.completed_date ? tex(formatDate(r.completed_date)) : "Ikke fullført ennå"}\\\\`,
        `\\textbf{Poeng:} ${cat?.points ?? 0} \\hfill \\textbf{Deltakere:} ${names.length > 0 ? tex(names.join(", ")) : "Ikke angitt"}`,
        "",
        `\\paragraph{Hvorfor dette tidspunktet:} ${tex(r.timing_rationale || "(Ikke utfylt)")}`,
        "",
        `\\paragraph{Beskrivelse/Gjennomføring:} ${tex(r.description || "(Ikke utfylt)")}`,
        "",
        `\\paragraph{Erfaringer:} ${tex(r.experiences || "(Ikke utfylt)")}`,
        "",
        `\\paragraph{Refleksjoner:} ${tex(r.reflections || "(Ikke utfylt)")}`,
        "",
        r.attachment_links?.length
          ? `\\paragraph{Vedlegg:} ${r.attachment_links.map((l) => `\\url{${l}}`).join(", ")}`
          : `\\paragraph{Vedlegg:} Ingen`,
        r.short_status ? `\\paragraph{Kort status:} ${tex(r.short_status)}` : "",
        "",
      ].filter(Boolean).join("\n");
    });
    return `\\section{Aktiviteter}\n\n${items.join("\n")}`;
  }, [allRegistrations, catalogMap, regParticipants, members]);

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

  const sprintLatex = useMemo(() => {
    const tableRows = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id);
      const done = items.filter((si) => si.column_name === "done");
      const sp = done.reduce((sum, si) => sum + (si.backlog_item?.estimate ?? 0), 0);
      return `      ${tex(s.name)} & ${tex(formatDate(s.start_date))}--${tex(formatDate(s.end_date))} & ${tex(s.goal ?? "-")} & ${done.length} & ${sp} \\\\`;
    });

    const table = [
      "\\begin{table}[H]",
      "\\centering",
      "\\begin{tabular}{|l|l|p{5cm}|c|c|}",
      "\\hline",
      "\\textbf{Sprint} & \\textbf{Periode} & \\textbf{Mål} & \\textbf{Fullført} & \\textbf{SP} \\\\",
      "\\hline",
      ...tableRows,
      "\\hline",
      "\\end{tabular}",
      "\\caption{Sprintoversikt}",
      "\\end{table}",
    ].join("\n");

    const details = filteredSprints.map((s) => {
      const items = (sprintItems ?? []).filter((si) => si.sprint_id === s.id && si.column_name === "done");
      if (!items.length) return "";
      const listing = items.map((si) => `  \\item \\textbf{${tex(si.backlog_item?.title ?? "")}} -- ${tex(si.backlog_item?.description ?? "Ingen beskrivelse")}`).join("\n");
      return `\\subsection{${tex(s.name)}}\n\\begin{itemize}\n${listing}\n\\end{itemize}`;
    }).filter(Boolean).join("\n\n");

    return `\\section{Sprinter}\n\n${table}\n\n${details}`;
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

  const decisionLatex = useMemo(() => {
    const items = filteredDecisions.map((d) => {
      return [
        `\\subsection{${tex(d.title)} (${tex(formatDate(d.date))})}`,
        `\\textbf{Kontekst:} ${tex(d.context ?? "-")}\\\\`,
        `\\textbf{Valg:} ${tex(d.choice ?? "-")}\\\\`,
        `\\textbf{Begrunnelse:} ${tex(d.rationale ?? "-")}`,
        "",
      ].join("\n");
    });
    return `\\section{Beslutninger}\n\n${items.join("\n")}`;
  }, [filteredDecisions]);

  // --- Standup export ---
  const filteredStandups = useMemo(() => {
    return (standupUpdates ?? []).filter((u) => inRange(u.entry_date));
  }, [standupUpdates, dateFrom, dateTo]);

  const standupPlain = useMemo(() => {
    const byDate: Record<string, typeof filteredStandups> = {};
    filteredStandups.forEach((u) => {
      if (!byDate[u.entry_date]) byDate[u.entry_date] = [];
      byDate[u.entry_date].push(u);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, updates]) => {
        const header = formatDate(date);
        const entries = updates.map((u) => {
          const member = (members ?? []).find((m) => m.id === u.member_id);
          return `  ${member?.name ?? "Ukjent"}: ${u.content || "(tomt)"} [${u.category || "annet"}]`;
        }).join("\n");
        return `${header}\n${entries}`;
      }).join("\n\n");
  }, [filteredStandups, members]);

  const standupMarkdown = useMemo(() => {
    const byDate: Record<string, typeof filteredStandups> = {};
    filteredStandups.forEach((u) => {
      if (!byDate[u.entry_date]) byDate[u.entry_date] = [];
      byDate[u.entry_date].push(u);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, updates]) => {
        const header = `### ${formatDate(date)}`;
        const entries = updates.map((u) => {
          const member = (members ?? []).find((m) => m.id === u.member_id);
          return `- **${member?.name ?? "Ukjent"}**: ${u.content || "_tomt_"} \`${u.category || "annet"}\``;
        }).join("\n");
        return `${header}\n${entries}`;
      }).join("\n\n");
  }, [filteredStandups, members]);

  const standupLatex = useMemo(() => {
    const byDate: Record<string, typeof filteredStandups> = {};
    filteredStandups.forEach((u) => {
      if (!byDate[u.entry_date]) byDate[u.entry_date] = [];
      byDate[u.entry_date].push(u);
    });
    const sections = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, updates]) => {
        const entries = updates.map((u) => {
          const member = (members ?? []).find((m) => m.id === u.member_id);
          return `  \\item \\textbf{${tex(member?.name ?? "Ukjent")}}: ${tex(u.content || "(tomt)")} \\textit{(${tex(u.category || "annet")})}`;
        }).join("\n");
        return `\\subsection{${tex(formatDate(date))}}\n\\begin{itemize}\n${entries}\n\\end{itemize}`;
      });
    return `\\section{Standup-oppdateringer}\n\n${sections.join("\n\n")}`;
  }, [filteredStandups, members]);

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
          <TabsTrigger value="activities">Aktiviteter ({allRegistrations.length})</TabsTrigger>
          <TabsTrigger value="sprints">Sprinter ({filteredSprints.length})</TabsTrigger>
          <TabsTrigger value="standups">Standup ({filteredStandups.length})</TabsTrigger>
          <TabsTrigger value="decisions">Beslutninger ({filteredDecisions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => copy(activityPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(activityMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(activityLatex, "LaTeX")}>
              <Code className="h-3.5 w-3.5 mr-1" /> LaTeX
            </Button>
          </div>
          {allRegistrations.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ingen aktivitetsregistreringer i valgt periode</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background leading-relaxed">{activityPlain}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sprints" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => copy(sprintPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(sprintMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(sprintLatex, "LaTeX")}>
              <Code className="h-3.5 w-3.5 mr-1" /> LaTeX
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

        <TabsContent value="standups" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => copy(standupPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(standupMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(standupLatex, "LaTeX")}>
              <Code className="h-3.5 w-3.5 mr-1" /> LaTeX
            </Button>
          </div>
          {filteredStandups.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Ingen standup-oppdateringer i valgt periode</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-background leading-relaxed">{standupPlain}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => copy(decisionPlain, "Ren tekst")}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Ren tekst
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(decisionMarkdown, "Markdown")}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy(decisionLatex, "LaTeX")}>
              <Code className="h-3.5 w-3.5 mr-1" /> LaTeX
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
