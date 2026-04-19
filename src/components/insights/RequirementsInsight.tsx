import { useMemo, useState } from "react";
import {
  ClipboardList,
  Copy,
  Plus,
  Trash2,
  ArrowRight,
  Pencil,
  Link2,
  Unlink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Circle,
  Filter,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, parseISO, startOfWeek, getISOWeek, isSameDay } from "date-fns";
import { nb } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_DISPLAY,
  PRIORITY_DISPLAY,
  CHANGE_TYPE_LABELS,
  type RequirementChange,
} from "@/hooks/useRequirementChangelog";

type Requirement = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
};

interface Props {
  requirements: Requirement[];
  reqChanges: RequirementChange[];
  reflectionValue: string;
  onReflectionChange: (v: string) => void;
  onCopy: () => void;
}

const CHANGE_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; ring: string }
> = {
  created: {
    label: "Opprettet",
    icon: <Plus className="h-3 w-3" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  deleted: {
    label: "Slettet",
    icon: <Trash2 className="h-3 w-3" />,
    color: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
  },
  status_changed: {
    label: "Status endret",
    icon: <ArrowRight className="h-3 w-3" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
  },
  priority_changed: {
    label: "Prioritet endret",
    icon: <ArrowRight className="h-3 w-3" />,
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  updated: {
    label: "Oppdatert",
    icon: <Pencil className="h-3 w-3" />,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
  },
  added_to_backlog: {
    label: "Koblet backlog",
    icon: <Link2 className="h-3 w-3" />,
    color: "text-teal-700",
    bg: "bg-teal-50",
    ring: "ring-teal-200",
  },
  removed_from_backlog: {
    label: "Frakoblet backlog",
    icon: <Unlink className="h-3 w-3" />,
    color: "text-orange-700",
    bg: "bg-orange-50",
    ring: "ring-orange-200",
  },
};

const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
  not_started: { color: "bg-neutral-300", icon: <Circle className="h-3 w-3 text-neutral-500" /> },
  in_progress: { color: "bg-blue-500", icon: <Clock className="h-3 w-3 text-blue-600" /> },
  implemented: { color: "bg-emerald-500", icon: <CheckCircle2 className="h-3 w-3 text-emerald-600" /> },
  verified: { color: "bg-primary", icon: <CheckCircle2 className="h-3 w-3 text-primary" /> },
};

const PRIORITY_COLOR: Record<string, string> = {
  must: "bg-rose-500",
  should: "bg-amber-500",
  could: "bg-blue-400",
  wont: "bg-neutral-400",
};

export function RequirementsInsight({
  requirements,
  reqChanges,
  reflectionValue,
  onReflectionChange,
  onCopy,
}: Props) {
  const [filterType, setFilterType] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  // ── Aggregate metrics ─────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = requirements.length;
    const implemented = requirements.filter(
      (r) => r.status === "implemented" || r.status === "verified"
    ).length;
    const inProgress = requirements.filter((r) => r.status === "in_progress").length;
    const notStarted = requirements.filter((r) => r.status === "not_started").length;
    const verified = requirements.filter((r) => r.status === "verified").length;
    const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;

    const byCategory = {
      functional: requirements.filter((r) => r.category === "functional").length,
      non_functional: requirements.filter((r) => r.category === "non_functional").length,
      documentation: requirements.filter((r) => r.category === "documentation").length,
    };

    const byPriority = {
      must: requirements.filter((r) => r.priority === "must").length,
      should: requirements.filter((r) => r.priority === "should").length,
      could: requirements.filter((r) => r.priority === "could").length,
      wont: requirements.filter((r) => r.priority === "wont").length,
    };

    const created = reqChanges.filter((c) => c.change_type === "created").length;
    const deleted = reqChanges.filter((c) => c.change_type === "deleted").length;
    const statusChanges = reqChanges.filter((c) => c.change_type === "status_changed").length;
    const linkChanges = reqChanges.filter(
      (c) => c.change_type === "added_to_backlog" || c.change_type === "removed_from_backlog"
    ).length;

    return {
      total,
      implemented,
      inProgress,
      notStarted,
      verified,
      pct,
      byCategory,
      byPriority,
      created,
      deleted,
      statusChanges,
      linkChanges,
    };
  }, [requirements, reqChanges]);

  // ── Cumulative growth chart (krav over tid) ───────────────────────────────
  const cumulativeData = useMemo(() => {
    if (reqChanges.length === 0) return [];
    const sorted = [...reqChanges].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const dayMap = new Map<string, { date: string; created: number; deleted: number; implemented: number }>();
    sorted.forEach((c) => {
      const day = format(parseISO(c.created_at), "yyyy-MM-dd");
      if (!dayMap.has(day))
        dayMap.set(day, { date: day, created: 0, deleted: 0, implemented: 0 });
      const entry = dayMap.get(day)!;
      if (c.change_type === "created") entry.created++;
      else if (c.change_type === "deleted") entry.deleted++;
      else if (c.change_type === "status_changed" && c.new_value === "implemented") entry.implemented++;
    });
    let total = 0;
    let totalImpl = 0;
    return Array.from(dayMap.values()).map((d) => {
      total += d.created - d.deleted;
      totalImpl += d.implemented;
      return {
        date: format(parseISO(d.date), "d. MMM", { locale: nb }),
        "Totalt antall krav": total,
        "Implementert (kumulativ)": totalImpl,
      };
    });
  }, [reqChanges]);

  // ── Weekly activity bars ──────────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    if (reqChanges.length === 0) return [];
    const weekMap = new Map<
      string,
      { week: string; sortKey: number; Opprettet: number; Implementert: number; Slettet: number; Statusendring: number; Annet: number }
    >();
    [...reqChanges].forEach((c) => {
      const date = parseISO(c.created_at);
      const w = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(w, "yyyy-MM-dd");
      if (!weekMap.has(key)) {
        weekMap.set(key, {
          week: `U${getISOWeek(date)}`,
          sortKey: w.getTime(),
          Opprettet: 0,
          Implementert: 0,
          Slettet: 0,
          Statusendring: 0,
          Annet: 0,
        });
      }
      const entry = weekMap.get(key)!;
      if (c.change_type === "created") entry.Opprettet++;
      else if (c.change_type === "deleted") entry.Slettet++;
      else if (c.change_type === "status_changed" && c.new_value === "implemented") entry.Implementert++;
      else if (c.change_type === "status_changed") entry.Statusendring++;
      else entry.Annet++;
    });
    return Array.from(weekMap.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [reqChanges]);

  // ── Hot list: krav med flest endringer ────────────────────────────────────
  const hotList = useMemo(() => {
    const counts = new Map<string, number>();
    reqChanges.forEach((c) => {
      if (!c.requirement_id) return;
      counts.set(c.requirement_id, (counts.get(c.requirement_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const req = requirements.find((r) => r.id === id);
        return { id, count, title: req?.title ?? id, status: req?.status, exists: !!req };
      })
      .filter((x) => x.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [reqChanges, requirements]);

  // ── Filtered timeline ─────────────────────────────────────────────────────
  const filteredChanges = useMemo(() => {
    if (filterType === "all") return reqChanges;
    if (filterType === "structural")
      return reqChanges.filter(
        (c) =>
          c.change_type === "created" ||
          c.change_type === "deleted" ||
          c.change_type === "added_to_backlog" ||
          c.change_type === "removed_from_backlog"
      );
    if (filterType === "status") return reqChanges.filter((c) => c.change_type === "status_changed");
    return reqChanges.filter((c) => c.change_type === filterType);
  }, [reqChanges, filterType]);

  // ── Group timeline by day ─────────────────────────────────────────────────
  const groupedTimeline = useMemo(() => {
    const list = showAll ? filteredChanges : filteredChanges.slice(0, 25);
    const byDay = new Map<string, RequirementChange[]>();
    list.forEach((c) => {
      const day = format(parseISO(c.created_at), "yyyy-MM-dd");
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(c);
    });
    return Array.from(byDay.entries());
  }, [filteredChanges, showAll]);

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Kravspesifikasjon — endringer over tid
        </h3>
        <button
          onClick={onCopy}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          <Copy className="h-3 w-3" />
          Kopier til rapport
        </button>
      </div>

      {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiTile
          label="Totalt antall krav"
          value={metrics.total}
          sub={`${metrics.byCategory.functional} F · ${metrics.byCategory.non_functional} NF · ${metrics.byCategory.documentation} D`}
          accent="bg-primary/10 text-primary"
        />
        <KpiTile
          label="Implementeringsgrad"
          value={`${metrics.pct}%`}
          sub={`${metrics.implemented} av ${metrics.total} ferdig`}
          accent="bg-emerald-50 text-emerald-700"
          progress={metrics.pct}
        />
        <KpiTile
          label="Endringer logget"
          value={reqChanges.length}
          sub={
            reqChanges[0]
              ? `Sist: ${format(parseISO(reqChanges[0].created_at), "d. MMM HH:mm", { locale: nb })}`
              : "—"
          }
          accent="bg-blue-50 text-blue-700"
        />
        <KpiTile
          label="Status-endringer"
          value={metrics.statusChanges}
          sub={`+${metrics.created} opprettet · −${metrics.deleted} slettet`}
          accent="bg-amber-50 text-amber-700"
        />
      </div>

      {/* ── STATUS DISTRIBUTION BARS ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <DistributionPanel
          title="Status-fordeling"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          total={metrics.total}
          segments={[
            { key: "verified", label: STATUS_DISPLAY.verified, value: metrics.verified, color: "bg-primary" },
            {
              key: "implemented",
              label: STATUS_DISPLAY.implemented,
              value: metrics.implemented - metrics.verified,
              color: "bg-emerald-500",
            },
            {
              key: "in_progress",
              label: STATUS_DISPLAY.in_progress,
              value: metrics.inProgress,
              color: "bg-blue-500",
            },
            {
              key: "not_started",
              label: STATUS_DISPLAY.not_started,
              value: metrics.notStarted,
              color: "bg-neutral-300",
            },
          ]}
        />
        <DistributionPanel
          title="Prioritet (MoSCoW)"
          icon={<AlertCircle className="h-3.5 w-3.5" />}
          total={metrics.total}
          segments={[
            { key: "must", label: PRIORITY_DISPLAY.must, value: metrics.byPriority.must, color: PRIORITY_COLOR.must },
            { key: "should", label: PRIORITY_DISPLAY.should, value: metrics.byPriority.should, color: PRIORITY_COLOR.should },
            { key: "could", label: PRIORITY_DISPLAY.could, value: metrics.byPriority.could, color: PRIORITY_COLOR.could },
            { key: "wont", label: PRIORITY_DISPLAY.wont, value: metrics.byPriority.wont, color: PRIORITY_COLOR.wont },
          ]}
        />
      </div>

      {/* ── CUMULATIVE GROWTH ───────────────────────────────────────────── */}
      {cumulativeData.length > 1 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-1">Vekst i kravspesifikasjonen</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Hvordan totalmengden krav og implementeringen har utviklet seg fra prosjektstart.
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="implGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="Totalt antall krav"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#totalGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="Implementert (kumulativ)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#implGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── WEEKLY ACTIVITY ─────────────────────────────────────────────── */}
      {weeklyData.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-1">Aktivitet per uke</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Antall registrerte endringer fordelt på uke og type.
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--background))",
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Opprettet" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Implementert" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Statusendring" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Slettet" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Annet" stackId="a" fill="#9ca3af" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── HOT LIST ─────────────────────────────────────────────────────── */}
      {hotList.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-1">Krav med flest endringer</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Ofte endrede krav kan signalisere uavklarte behov eller iterativ forfining.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {hotList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-[8px] border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{item.id}</span>
                  <span className="text-sm truncate">{item.title}</span>
                  {item.status && STATUS_META[item.status] && (
                    <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${STATUS_META[item.status].color}`} />
                  )}
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  {item.count}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold">Endringslogg</h4>
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="h-3 w-3 text-muted-foreground mr-1" />
            <FilterChip active={filterType === "all"} onClick={() => setFilterType("all")}>
              Alle ({reqChanges.length})
            </FilterChip>
            <FilterChip active={filterType === "structural"} onClick={() => setFilterType("structural")}>
              Strukturelt
            </FilterChip>
            <FilterChip active={filterType === "status"} onClick={() => setFilterType("status")}>
              Status
            </FilterChip>
            <FilterChip
              active={filterType === "priority_changed"}
              onClick={() => setFilterType("priority_changed")}
            >
              Prioritet
            </FilterChip>
          </div>
        </div>

        {filteredChanges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Ingen endringer matcher filteret.
          </p>
        ) : (
          <div className="relative max-h-[480px] overflow-y-auto pr-2">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-4">
              {groupedTimeline.map(([day, entries]) => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                    <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-background relative z-10" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {format(parseISO(day), "EEEE d. MMMM", { locale: nb })}
                      {isSameDay(parseISO(day), new Date()) && (
                        <span className="ml-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary normal-case">
                          I dag
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">({entries.length})</span>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    {entries.map((c) => {
                      const meta = CHANGE_META[c.change_type] ?? {
                        label: CHANGE_TYPE_LABELS[c.change_type] ?? c.change_type,
                        icon: <Pencil className="h-3 w-3" />,
                        color: "text-muted-foreground",
                        bg: "bg-muted",
                        ring: "ring-border",
                      };
                      const isStatusChange = c.change_type === "status_changed";
                      return (
                        <div
                          key={c.id}
                          className="group flex items-start gap-3 rounded-[8px] px-2.5 py-2 hover:bg-muted/40 transition-colors"
                        >
                          <span
                            className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}
                            title={meta.label}
                          >
                            {meta.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              {c.requirement_id && (
                                <span className="font-mono text-[11px] font-semibold text-foreground">
                                  {c.requirement_id}
                                </span>
                              )}
                              <span className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</span>
                              <span className="text-[11px] text-muted-foreground ml-auto">
                                {format(parseISO(c.created_at), "HH:mm", { locale: nb })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 mt-0.5 leading-snug">
                              {c.description ?? meta.label}
                            </p>
                            {isStatusChange && c.old_value && c.new_value && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                                <StatusPill value={c.old_value} dim />
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <StatusPill value={c.new_value} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredChanges.length > 25 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="mt-3 text-xs text-primary font-medium hover:underline"
          >
            {showAll ? "Vis færre" : `Vis alle ${filteredChanges.length} endringer`}
          </button>
        )}
      </div>

      {/* ── REFLECTION ───────────────────────────────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-border/60">
        <p className="text-xs text-muted-foreground italic mb-2">
          Refleksjon: Hvordan utviklet kravspesifikasjonen seg gjennom prosjektet?
        </p>
        <Textarea
          value={reflectionValue}
          onChange={(e) => onReflectionChange(e.target.value)}
          placeholder="Skriv refleksjon..."
          className="rounded-[10px] border-neutral-200 p-4 text-sm min-h-[80px] leading-relaxed"
        />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
  progress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="rounded-[10px] border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${accent.includes("emerald") ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DistributionPanel({
  title,
  icon,
  total,
  segments,
}: {
  title: string;
  icon: React.ReactNode;
  total: number;
  segments: { key: string; label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-[10px] border border-border/60 bg-background p-4">
      <div className="flex items-center gap-1.5 mb-3 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted mb-3">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={s.key}
              className={`${s.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.key} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`h-2 w-2 rounded-sm shrink-0 ${s.color}`} />
                <span className="truncate text-foreground/80">{s.label}</span>
              </div>
              <span className="font-mono text-muted-foreground shrink-0">
                {s.value} <span className="text-[10px]">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ value, dim = false }: { value: string; dim?: boolean }) {
  const meta = STATUS_META[value];
  const label = STATUS_DISPLAY[value] ?? value;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-border ${
        dim ? "bg-muted text-muted-foreground" : "bg-background text-foreground"
      }`}
    >
      {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.color}`} />}
      {label}
    </span>
  );
}
