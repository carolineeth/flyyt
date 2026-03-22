import { format, isWeekend } from "date-fns";
import type { DailyUpdate } from "@/hooks/useDailyUpdates";

interface Props {
  weekdays: Date[];
  entries: DailyUpdate[];
  memberCount: number;
}

export function HeatmapStripe({ weekdays, entries, memberCount }: Props) {
  // Only count weekdays (not weekends)
  const workdays = weekdays.filter((d) => !isWeekend(d));
  const totalEntries = entries.filter((e) => {
    const d = weekdays.find((w) => format(w, "yyyy-MM-dd") === e.entry_date);
    return d && !isWeekend(d);
  }).length;
  const possible = memberCount * workdays.length;
  const pct = possible > 0 ? Math.round((totalEntries / possible) * 100) : 0;

  let pctColor = "text-muted-foreground";
  if (possible > 0) {
    if (pct < 30) pctColor = "text-red-500";
    else if (pct < 60) pctColor = "text-amber-500";
    else pctColor = "text-green-600";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {weekdays.map((d) => {
          const dayStr = format(d, "yyyy-MM-dd");
          const count = entries.filter((e) => e.entry_date === dayStr).length;
          const weekend = isWeekend(d);
          let bg = "hsl(var(--border))";
          if (weekend) bg = "hsl(var(--border) / 0.4)";
          else if (count >= 5) bg = "#97C459";
          else if (count >= 3) bg = "#C0DD97";
          else if (count >= 1) bg = "#EAF3DE";
          return (
            <div
              key={dayStr}
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: bg }}
              title={weekend ? "Helg" : `${count} oppdateringer`}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {totalEntries} av {possible || "–"} denne uken
      </span>
      {possible > 0 && (
        <span className={`text-xs font-medium ${pctColor}`}>
          {pct}%
        </span>
      )}
    </div>
  );
}
