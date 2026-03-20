import { format } from "date-fns";
import type { DailyUpdate } from "@/hooks/useDailyUpdates";

interface Props {
  weekdays: Date[];
  entries: DailyUpdate[];
  memberCount: number;
}

export function HeatmapStripe({ weekdays, entries, memberCount }: Props) {
  const totalEntries = entries.length;
  const passedDays = weekdays.length;
  const possible = memberCount * passedDays;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {weekdays.map((d) => {
          const dayStr = format(d, "yyyy-MM-dd");
          const count = entries.filter((e) => e.entry_date === dayStr).length;
          let bg = "hsl(var(--border))";
          if (count >= 5) bg = "#97C459";
          else if (count >= 3) bg = "#C0DD97";
          else if (count >= 1) bg = "#EAF3DE";
          return (
            <div key={dayStr} className="w-4 h-4 rounded-sm" style={{ backgroundColor: bg }} title={`${count} oppdateringer`} />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {totalEntries} av {possible || "–"} denne uken
      </span>
    </div>
  );
}
