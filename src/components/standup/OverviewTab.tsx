import { useMemo, useState } from "react";
import { format, eachDayOfInterval, isWeekend, isBefore, isAfter, startOfDay, getISOWeek, startOfWeek } from "date-fns";
import { nb } from "date-fns/locale";
import type { TeamMember } from "@/lib/types";
import type { DailyUpdate } from "@/hooks/useDailyUpdates";
import { useAllDailyUpdates, useActiveSprint, PROJECT_START } from "@/hooks/useDailyUpdates";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CATEGORIES } from "./StandupInput";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  members: TeamMember[];
  weekStart: Date;
  weekEnd: Date;
  onNavigateToWeek: (date: Date) => void;
  onSwitchTab: () => void;
}

type PeriodFilter = "week" | "sprint" | "all";

function getWorkdays(start: Date, end: Date): Date[] {
  const today = startOfDay(new Date());
  const effectiveEnd = isAfter(end, today) ? today : end;
  if (isBefore(effectiveEnd, start)) return [];
  return eachDayOfInterval({ start, end: effectiveEnd }).filter(
    (d) => !isWeekend(d) && !isBefore(d, PROJECT_START)
  );
}

export function OverviewTab({ members, weekStart, weekEnd, onNavigateToWeek, onSwitchTab }: Props) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const { data: allUpdates } = useAllDailyUpdates();
  const { data: activeSprint } = useActiveSprint();
  const [reflection, setReflection] = useState(
    "Oppdateringene ga teamet bedre oversikt over hvem som jobbet med hva, og gjorde det lettere å identifisere flaskehalser og koordinere arbeid på tvers av fagfelt."
  );

  const updates = allUpdates ?? [];

  const { filteredUpdates, periodDays, periodLabel } = useMemo(() => {
    const today = startOfDay(new Date());
    let start: Date, end: Date, label: string;

    if (periodFilter === "week") {
      start = weekStart;
      end = weekEnd;
      label = `Uke ${getISOWeek(weekStart)}`;
    } else if (periodFilter === "sprint" && activeSprint) {
      start = new Date(activeSprint.start_date);
      end = new Date(activeSprint.end_date);
      label = activeSprint.name;
    } else {
      start = PROJECT_START;
      end = today;
      label = `Uke ${getISOWeek(PROJECT_START)}–${getISOWeek(today)}`;
    }

    const days = getWorkdays(start, end);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(isAfter(end, today) ? today : end, "yyyy-MM-dd");
    const filtered = updates.filter((u) => u.entry_date >= startStr && u.entry_date <= endStr);

    return { filteredUpdates: filtered, periodDays: days, periodLabel: label };
  }, [periodFilter, weekStart, weekEnd, activeSprint, updates]);

  const memberCount = members.length;
  const possible = memberCount * periodDays.length;
  const totalEntries = filteredUpdates.length;
  const participationPct = possible > 0 ? Math.round((totalEntries / possible) * 100) : 0;

  // Most active
  const entriesPerMember = members.map((m) => ({
    member: m,
    count: filteredUpdates.filter((u) => u.member_id === m.id).length,
  }));
  const mostActive = entriesPerMember.sort((a, b) => b.count - a.count)[0];

  // Full team streak
  const fullTeamStreak = useMemo(() => {
    let maxStreak = 0, current = 0;
    for (const day of periodDays) {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = filteredUpdates.filter((u) => u.entry_date === dayStr).length;
      if (count >= memberCount) { current++; maxStreak = Math.max(maxStreak, current); }
      else current = 0;
    }
    return maxStreak;
  }, [periodDays, filteredUpdates, memberCount]);

  // Category distribution
  const catDist = useMemo(() => {
    const withCat = filteredUpdates.filter((u) => u.category);
    const allCatKeys = withCat.flatMap((u) => u.category!.split(",").filter(Boolean));
    const total = allCatKeys.length;
    if (total === 0) return [];
    return CATEGORIES.map((cat) => ({
      ...cat,
      count: allCatKeys.filter((k) => k === cat.key).length,
      pct: Math.round((allCatKeys.filter((k) => k === cat.key).length / total) * 100),
    }));
  }, [filteredUpdates]);

  const catBarColors: Record<string, string> = {
    code: "#85B7EB", design: "#ED93B1", report: "#AFA9EC", research: "#9FE1CB", admin: "#D3D1C7",
  };

  // Heatmap data
  const heatmapWeeks = useMemo(() => {
    if (periodDays.length === 0) return [];
    const weeks: { weekNum: number; days: Date[] }[] = [];
    let currentWeekNum = -1;
    for (const d of periodDays) {
      const wn = getISOWeek(d);
      if (wn !== currentWeekNum) {
        weeks.push({ weekNum: wn, days: [] });
        currentWeekNum = wn;
      }
      weeks[weeks.length - 1].days.push(d);
    }
    return weeks;
  }, [periodDays]);

  // Export text
  const buildExportText = (md: boolean) => {
    const h = md ? "## " : "";
    const b = md ? "**" : "";
    const startWeek = getISOWeek(PROJECT_START);
    const endWeek = getISOWeek(new Date());
    let text = `${h}Asynkrone daglige oppdateringer\n\n`;
    text += `Teamet brukte daglige asynkrone oppdateringer gjennom hele prosjektperioden (uke ${startWeek}–${endWeek}) for å holde oversikt over hverandres arbeid og sikre daglig kommunikasjon uten å kreve samtidige møter.\n\n`;
    text += `${b}Deltakelse:${b} Totalt ${totalEntries} oppdateringer av ${possible} mulige (${participationPct}%).\n\n`;
    text += `${b}Per teammedlem:${b}\n`;
    members.forEach((m) => {
      const c = filteredUpdates.filter((u) => u.member_id === m.id).length;
      const pct = periodDays.length > 0 ? Math.round((c / periodDays.length) * 100) : 0;
      text += `- ${m.name}: ${pct}% deltakelse (${c} av ${periodDays.length} dager)\n`;
    });
    text += `\n${b}Arbeidsfordeling basert på selvrapportert kategori:${b}\n`;
    catDist.forEach((c) => { text += `- ${c.label}: ${c.pct}%\n`; });
    text += `\n${b}Refleksjon:${b} ${reflection}\n`;
    return text;
  };

  const filters: { key: PeriodFilter; label: string }[] = [
    { key: "week", label: "Denne uken" },
    { key: "sprint", label: "Denne sprinten" },
    { key: "all", label: "Hele prosjektet" },
  ];

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setPeriodFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              periodFilter === f.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Totalt entries" value={totalEntries} sub={`av ${possible} (${participationPct}%)`} />
        <MetricCard label="Deltakelse" value={`${participationPct}%`} sub="teamgjennomsnitt" />
        <MetricCard label="Mest aktiv" value={mostActive?.member.name.split(" ")[0] ?? "–"} sub={`${mostActive?.count ?? 0} av ${periodDays.length} dager`} small />
        <MetricCard label="Fullt team streak" value={fullTeamStreak} sub="dager med fullt team" />
      </div>

      {/* Heatmap */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Aktivitetskart — oppdateringer per person per dag</h4>
        <div className="overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="w-[60px] sticky left-0 z-10 bg-background" />
                {heatmapWeeks.map((w) => (
                  <th key={w.weekNum} colSpan={w.days.length} className="text-[10px] text-muted-foreground text-center font-normal">
                    Uke {w.weekNum}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-background" />
                {periodDays.map((d) => (
                  <th key={format(d, "yyyy-MM-dd")} className="text-[9px] text-muted-foreground font-normal w-[18px]">
                    {format(d, "EEEEE", { locale: nb }).toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="text-[11px] text-muted-foreground text-right pr-2 sticky left-0 z-10 bg-background whitespace-nowrap">
                    {m.name.split(" ")[0]}
                  </td>
                  {periodDays.map((d) => {
                    const dayStr = format(d, "yyyy-MM-dd");
                    const entry = filteredUpdates.find((u) => u.member_id === m.id && u.entry_date === dayStr);
                    let bg = "hsl(var(--border))";
                    if (entry && (entry.content?.length ?? 0) >= 20) bg = "#97C459";
                    else if (entry) bg = "#EAF3DE";

                    return (
                      <td key={dayStr} className="p-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="block w-4 h-4 rounded-sm cursor-pointer"
                              style={{ backgroundColor: bg }}
                              onClick={() => {
                                onNavigateToWeek(startOfWeek(d, { weekStartsOn: 1 }));
                                onSwitchTab();
                              }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            <p className="font-medium">{format(d, "EEEE d. MMMM", { locale: nb })}</p>
                            <p className="text-muted-foreground">
                              {entry?.content ? entry.content.slice(0, 100) + (entry.content.length > 100 ? "…" : "") : "Ingen oppdatering"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <LegendItem color="#97C459" label="Oppdatering" />
          <LegendItem color="#EAF3DE" label="Kort oppdatering" />
          <LegendItem color="hsl(var(--border))" label="Ingen" />
        </div>
      </div>

      {/* Category distribution */}
      {catDist.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Kategorifordeling</h4>
          <div className="w-full h-2 rounded-full overflow-hidden flex">
            {catDist.filter((c) => c.pct > 0).map((c) => (
              <div key={c.key} style={{ width: `${c.pct}%`, backgroundColor: catBarColors[c.key] }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {catDist.map((c) => (
              <span key={c.key} className="text-[10px] text-muted-foreground">{c.label} {c.pct}%</span>
            ))}
          </div>
        </div>
      )}

      {/* Per person */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Per person</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m) => {
            const count = filteredUpdates.filter((u) => u.member_id === m.id).length;
            const pct = periodDays.length > 0 ? Math.round((count / periodDays.length) * 100) : 0;
            const memberCats = filteredUpdates.filter((u) => u.member_id === m.id && u.category);
            const topCat = memberCats.length > 0
              ? CATEGORIES.reduce((best, cat) => {
                  const c = memberCats.filter((u) => u.category!.split(",").includes(cat.key)).length;
                  return c > best.count ? { label: cat.label, count: c } : best;
                }, { label: "", count: 0 })
              : null;
            const topCatPct = memberCats.length > 0 && topCat ? Math.round((topCat.count / memberCats.length) * 100) : 0;
            let fillColor = "#EAF3DE";
            if (pct >= 80) fillColor = "#97C459";
            else if (pct >= 50) fillColor = "#C0DD97";

            return (
              <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MemberAvatar member={m} size="sm" />
                  <span className="text-[13px] font-medium">{m.name.split(" ")[0]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{count}/{periodDays.length} dager ({pct}%)</p>
                <div className="w-full h-1 rounded-full bg-muted mt-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: fillColor }} />
                </div>
                {topCat && topCat.label && (
                  <p className="text-xs text-muted-foreground mt-1.5">Mest: {topCat.label} ({topCatPct}%)</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Export section */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground">Eksporter til prosesslogg</h4>
        <p className="text-xs text-muted-foreground">
          Genererer et ferdig avsnitt om teamets daglige kommunikasjon for prosessloggen.
        </p>
        <Textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Skriv en refleksjon…"
          className="text-xs min-h-[60px]"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { navigator.clipboard.writeText(buildExportText(false)); toast.success("Kopiert som ren tekst!"); }}>
            Kopier som ren tekst
          </Button>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(buildExportText(true)); toast.success("Kopiert som Markdown!"); }}>
            Kopier som Markdown
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, small }: { label: string; value: string | number; sub: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${small ? "text-base" : "text-xl"}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
