import { useMemo, useState } from "react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { StandupInput } from "./StandupInput";
import { PersonCard } from "./PersonCard";
import type { TeamMember } from "@/lib/types";
import type { DailyUpdate } from "@/hooks/useDailyUpdates";
import { Button } from "@/components/ui/button";
import { PenLine } from "lucide-react";

interface Props {
  weekdays: Date[];
  entries: DailyUpdate[];
  members: TeamMember[];
  currentMemberId: string | null;
  isCurrentWeek: boolean;
}

export function DayByDayTab({ weekdays, entries, members, currentMemberId, isCurrentWeek }: Props) {
  const today = startOfDay(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null);

  // Sorted newest first
  const sortedDays = useMemo(() => [...weekdays].sort((a, b) => b.getTime() - a.getTime()), [weekdays]);

  return (
    <div className="space-y-6">
      {/* Input for today - only show in current week */}
      {isCurrentWeek && currentMemberId && (() => {
        const todayStr = format(today, "yyyy-MM-dd");
        const todayEntry = entries.find((e) => e.entry_date === todayStr && e.member_id === currentMemberId) ?? null;
        return (
          <StandupInput
            memberId={currentMemberId}
            existingEntry={todayEntry}
            date={today}
            dayLabel={`I dag — ${format(today, "EEEE d. MMMM", { locale: nb })}`}
          />
        );
      })()}

      {sortedDays.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground italic">
            Ingen oppdateringer ennå denne uken. Skriv din første oppdatering ovenfor!
          </p>
        </div>
      )}

      {sortedDays.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayEntries = entries.filter((e) => e.entry_date === dayStr);
        const isPast = day < today && !isToday(day);
        const myEntry = entries.find((e) => e.entry_date === dayStr && e.member_id === currentMemberId) ?? null;
        const showInput = editingDay === dayStr && currentMemberId;

        let dayHeading: string;
        if (isToday(day)) dayHeading = "I dag";
        else if (isYesterday(day)) dayHeading = "I går";
        else dayHeading = format(day, "EEEE d. MMMM", { locale: nb });

        return (
          <div key={dayStr}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-foreground capitalize">{dayHeading}</h3>
              {isPast && currentMemberId && !isToday(day) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setEditingDay(editingDay === dayStr ? null : dayStr)}
                >
                  <PenLine className="h-3 w-3 mr-1" />
                  {myEntry ? "Rediger" : "Legg til"}
                </Button>
              )}
            </div>

            {showInput && (
              <div className="mb-3">
                <StandupInput
                  memberId={currentMemberId}
                  existingEntry={myEntry}
                  date={day}
                  dayLabel={`${dayHeading} — etterregistrering`}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((m) => {
                const entry = dayEntries.find((e) => e.member_id === m.id) ?? null;
                return (
                  <PersonCard
                    key={m.id}
                    member={m}
                    entry={entry}
                    isCurrentUser={m.id === currentMemberId}
                    isToday={isToday(day)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
