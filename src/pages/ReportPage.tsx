import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Pencil,
  Check,
  ArrowRight,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "ikke_startet",   label: "Ikke startet",     cls: "text-muted-foreground bg-muted/70" },
  { value: "utkast",         label: "Utkast",           cls: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40" },
  { value: "til_gjennomgang",label: "Til gjennomgang",  cls: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40" },
  { value: "ferdig",         label: "Ferdig",           cls: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40" },
];

function statusCls(status: string) {
  return STATUS_OPTIONS.find(o => o.value === status)?.cls ?? "text-muted-foreground bg-muted/70";
}

// Priority order for "Neste å skrive": prosess > refleksjon > produkt > bruker > presentasjon > avslutning
const PRIORITY_ORDER = ["4", "5", "3", "2", "1", "6"];

// Subsections where prosesslogg export is relevant
const PROSESSLOGG_SECTIONS: Record<string, string> = {
  "4.1": "aktiviteter og sprint-oversikt",
  "4.2": "sprint-oppsummeringer",
  "4.4": "testing-relaterte items",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type ReportSection = {
  id: string;
  section_number: string;
  title: string;
  parent_section: string | null;
  description: string | null;
  assignee_id: string | null;
  status: string;
  word_count_target: number | null;
  word_count_goal: number;
  notes: string | null;
  sort_order: number;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: members } = useTeamMembers();

  // Overleaf URL (persisted in localStorage)
  const [overleafUrl, setOverleafUrl] = useState(() => localStorage.getItem("overleaf_url") ?? "");
  const [editingOverleaf, setEditingOverleaf] = useState(false);
  const [overleafInput, setOverleafInput] = useState(overleafUrl);

  // Collapsed main sections (default: all expanded)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (num: string) => setCollapsed(p => ({ ...p, [num]: !p[num] }));

  // Expanded descriptions
  const [descExpanded, setDescExpanded] = useState<Record<string, boolean>>({});
  const toggleDesc = (id: string) => setDescExpanded(p => ({ ...p, [id]: !p[id] }));

  // ── Data ──
  const { data: sections, isLoading } = useQuery<ReportSection[]>({
    queryKey: ["report_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReportSection> & { id: string }) => {
      const { error } = await supabase
        .from("report_sections" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["report_sections"] }),
  });

  const handleUpdate = (id: string, field: string, value: string | null) => {
    updateSection.mutate({ id, [field]: value } as any, {
      onSuccess: () => toast.success("Oppdatert"),
    });
  };

  // ── Derived ──
  const allSections = sections ?? [];
  const mainSections = allSections.filter(s => !s.parent_section);
  const subsections = allSections.filter(s => !!s.parent_section);
  const childrenOf = (num: string) => allSections.filter(s => s.parent_section === num);

  const subsectionsDone = subsections.filter(s => s.status === "ferdig").length;
  const totalSubsections = subsections.length;
  const progressPct = totalSubsections > 0 ? Math.round((subsectionsDone / totalSubsections) * 100) : 0;
  const totalWordTarget = subsections.reduce((sum, s) => sum + (s.word_count_target ?? s.word_count_goal ?? 0), 0);

  const nextToWrite = PRIORITY_ORDER
    .flatMap(prio => childrenOf(prio).filter(s => s.status === "ikke_startet"))
    .at(0);

  const deadline = new Date("2026-05-15T23:59:59");
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000));

  // ── Overleaf save ──
  const saveOverleaf = () => {
    const url = overleafInput.trim();
    localStorage.setItem("overleaf_url", url);
    setOverleafUrl(url);
    setEditingOverleaf(false);
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Laster rapport...</div>;

  return (
    <div className="space-y-6 scroll-reveal">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Rapport</h1>
            {overleafUrl && !editingOverleaf && (
              <a href={overleafUrl} target="_blank" rel="noopener noreferrer" title="Åpne i Overleaf">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
            {!editingOverleaf && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title={overleafUrl ? "Rediger Overleaf-lenke" : "Legg til Overleaf-lenke"}
                onClick={() => { setOverleafInput(overleafUrl); setEditingOverleaf(true); }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          {editingOverleaf && (
            <div className="flex items-center gap-2 mt-1.5">
              <Input
                value={overleafInput}
                onChange={e => setOverleafInput(e.target.value)}
                placeholder="https://www.overleaf.com/project/..."
                className="h-8 text-xs w-80"
                onKeyDown={e => e.key === "Enter" && saveOverleaf()}
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={saveOverleaf}>
                <Check className="h-3.5 w-3.5 mr-1" /> Lagre
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingOverleaf(false)}>
                Avbryt
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-sm mt-1">Oversikt over innleveringsrapportens seksjoner og fremdrift</p>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Seksjoner ferdig</p>
            <p className="text-lg font-bold tabular-nums">{subsectionsDone}/{totalSubsections}</p>
            <Progress value={progressPct} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Estimert ordtelling</p>
            <p className="text-lg font-bold tabular-nums">{totalWordTarget.toLocaleString("nb-NO")} ord</p>
            <p className="text-xs text-muted-foreground mt-1">Mål: ~7 500 ord (≈25 s.)</p>
          </CardContent>
        </Card>
        <Card className={daysLeft <= 14 ? "border-amber-300 dark:border-amber-700" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Innlevering 15. mai</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${daysLeft <= 7 ? "text-destructive" : ""}`}>
              {daysLeft} dager igjen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Neste å skrive</p>
            {nextToWrite ? (
              <>
                <p className="text-sm font-semibold leading-tight">
                  {nextToWrite.section_number} {nextToWrite.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {nextToWrite.word_count_target ?? nextToWrite.word_count_goal} ord
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-emerald-600">Alt er skrevet!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Seksjon</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Ansvarlig</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-20">Ordmål</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-52">Notater</th>
                </tr>
              </thead>
              <tbody>
                {mainSections.map(main => {
                  const isCollapsed = collapsed[main.section_number];
                  const children = childrenOf(main.section_number);
                  return (
                    <>
                      {/* ── Main section row ── */}
                      <tr
                        key={main.id}
                        className="border-b border-border bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggle(main.section_number)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="text-muted-foreground shrink-0">
                              {isCollapsed
                                ? <ChevronRight className="h-4 w-4" />
                                : <ChevronDown className="h-4 w-4" />
                              }
                            </button>
                            <span className="font-[500] text-[14px]">
                              {main.section_number}. {main.title}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              ({children.filter(c => c.status === "ferdig").length}/{children.length})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <Select
                            value={main.assignee_id ?? "none"}
                            onValueChange={v => handleUpdate(main.id, "assignee_id", v === "none" ? null : v)}
                          >
                            <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                              <SelectValue placeholder="Velg..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ikke tildelt</SelectItem>
                              {members?.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <StatusSelect
                            value={main.status}
                            onChange={v => handleUpdate(main.id, "status", v)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {(main.word_count_target ?? main.word_count_goal).toLocaleString("nb-NO")}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <Input
                            key={main.id}
                            defaultValue={main.notes ?? ""}
                            placeholder="Notater..."
                            className="h-8 text-xs border-transparent hover:border-border"
                            onBlur={e => {
                              if (e.target.value !== (main.notes ?? ""))
                                handleUpdate(main.id, "notes", e.target.value);
                            }}
                          />
                        </td>
                      </tr>

                      {/* ── Subsection rows ── */}
                      {!isCollapsed && children.map(sub => (
                        <tr
                          key={sub.id}
                          className="border-b border-border/60 last:border-0 hover:bg-accent/20 transition-colors"
                        >
                          <td className="px-4 py-2.5 pl-10">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] text-muted-foreground w-7 shrink-0 tabular-nums">
                                  {sub.section_number}
                                </span>
                                <span className="text-[13px]">{sub.title}</span>
                                {PROSESSLOGG_SECTIONS[sub.section_number] && (
                                  <button
                                    className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary ml-1 shrink-0"
                                    title={`Hent ${PROSESSLOGG_SECTIONS[sub.section_number]} fra prosesslogg`}
                                    onClick={() => navigate("/prosesslogg")}
                                  >
                                    <FileText className="h-3 w-3" />
                                    <span>Hent fra prosesslogg</span>
                                    <ArrowRight className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                              {sub.description && (
                                <div className="ml-7 mt-0.5">
                                  <p className={`text-[12px] text-muted-foreground/70 leading-snug ${descExpanded[sub.id] ? "" : "line-clamp-1"}`}>
                                    {sub.description}
                                  </p>
                                  {sub.description.length > 60 && (
                                    <button
                                      className="text-[11px] text-muted-foreground hover:text-foreground mt-0.5"
                                      onClick={() => toggleDesc(sub.id)}
                                    >
                                      {descExpanded[sub.id] ? "Vis mindre" : "Vis mer"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Select
                              value={sub.assignee_id ?? "none"}
                              onValueChange={v => handleUpdate(sub.id, "assignee_id", v === "none" ? null : v)}
                            >
                              <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                                <SelectValue placeholder="Velg..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Ikke tildelt</SelectItem>
                                {members?.map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusSelect
                              value={sub.status}
                              onChange={v => handleUpdate(sub.id, "status", v)}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                            {sub.word_count_target ?? sub.word_count_goal
                              ? (sub.word_count_target ?? sub.word_count_goal).toLocaleString("nb-NO")
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              key={sub.id}
                              defaultValue={sub.notes ?? ""}
                              placeholder="Notater..."
                              className="h-8 text-xs border-transparent hover:border-border"
                              onBlur={e => {
                                if (e.target.value !== (sub.notes ?? ""))
                                  handleUpdate(sub.id, "notes", e.target.value);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── StatusSelect ───────────────────────────────────────────────────────────────

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = STATUS_OPTIONS.find(o => o.value === value) ?? STATUS_OPTIONS[0];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs border-transparent hover:border-border ${statusCls(value)} font-medium`}>
        <SelectValue>
          <span>{current.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>
            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${o.cls}`}>
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
