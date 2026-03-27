import { useMemo, useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { StandupInput } from "./StandupInput";
import { PersonCard } from "./PersonCard";

import type { TeamMember } from "@/lib/types";
import type { DailyUpdate, DailyTeamNote } from "@/hooks/useDailyUpdates";
import { useUpsertTeamNote } from "@/hooks/useDailyUpdates";
import { Button } from "@/components/ui/button";
import { PenLine, Users } from "lucide-react";

interface TeamNoteFieldProps {
  entryDate: string;
  note: DailyTeamNote | undefined;
  editable: boolean;
}

function TeamNoteField({ entryDate, note, editable }: TeamNoteFieldProps) {
  const [text, setText] = useState(note?.content ?? "");
  const [saved, setSaved] = useState(true);
  const upsert = useUpsertTeamNote();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync if note changes externally (e.g. another user updated)
  useEffect(() => {
    setText(note?.content ?? "");
  }, [note?.content]);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 80) + "px";
  }, [text]);

  // Debounced auto-save
  useEffect(() => {
    if (saved) return;
    const t = setTimeout(() => {
      upsert.mutate({ entry_date: entryDate, content: text });
      setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, saved]);

  if (!editable && !note?.content) return null;

  return (
    <div className="flex gap-2 items-start mb-3 bg-muted/40 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 mt-0.5 min-w-[40px]">
        <Users className="h-3 w-3" />
        Alle
      </div>
      {editable ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          placeholder="Hva jobbet dere på som team i dag?"
          className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/60 min-h-[20px]"
          rows={1}
          style={{ maxHeight: "80px" }}
        />
      ) : (
        <p className="flex-1 text-sm text-foreground whitespace-pre-wrap">{note?.content}</p>
      )}
      {!saved && <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">lagrer…</span>}
    </div>
  );
}

interface Props {
  weekdays: Date[];
  entries: DailyUpdate[];
  teamNotes: DailyTeamNote[];
  members: TeamMember[];
  currentMemberId: string | null;
  isCurrentWeek: boolean;
}

export function DayByDayTab({ weekdays, entries, teamNotes, members, currentMemberId, isCurrentWeek }: Props) {
  const today = startOfDay(new Date());
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [todayCollapsed, setTodayCollapsed] = useState(false);

  // Sorted newest first
  const sortedDays = useMemo(() => [...weekdays].sort((a, b) => b.getTime() - a.getTime()), [weekdays]);

  // Show all days — no weekend filtering
  const visibleDays = sortedDays;

  return (
    <div className="space-y-0">
      {/* Input for today */}
      {isCurrentWeek && currentMemberId && !todayCollapsed && true && (() => {
        const todayStr = format(today, "yyyy-MM-dd");
        const todayEntry = entries.find((e) => e.entry_date === todayStr && e.member_id === currentMemberId) ?? null;
        return (
          <div className="mb-6">
            <StandupInput
              memberId={currentMemberId}
              existingEntry={todayEntry}
              date={today}
              dayLabel=""
              onSaved={() => setTodayCollapsed(true)}
              compact
            />
          </div>
        );
      })()}

      {isCurrentWeek && currentMemberId && todayCollapsed && true && (
        <div className="flex justify-end mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setTodayCollapsed(false)}
          >
            <PenLine className="h-3 w-3 mr-1" />
            Rediger dagens oppdatering
          </Button>
        </div>
      )}

      {visibleDays.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground italic">
            Ingen oppdateringer ennå denne uken.
          </p>
        </div>
      )}

      {visibleDays.map((day, idx) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayEntries = entries.filter((e) => e.entry_date === dayStr);
        const isPast = day < today && !isToday(day);
        const isFuture = day > today;
        const myEntry = entries.find((e) => e.entry_date === dayStr && e.member_id === currentMemberId) ?? null;
        const showInput = editingDay === dayStr && currentMemberId;
        const isRecentDay = isToday(day) || isYesterday(day);
        const entryCount = dayEntries.length;

        // Future days with no entries: show header only (handled below)

        let dayLabel: string;
        if (isToday(day)) dayLabel = "I dag";
        else if (isYesterday(day)) dayLabel = "I går";
        else dayLabel = format(day, "EEEE", { locale: nb });

        const dateLabel = format(day, "d. MMMM", { locale: nb });

        const membersWithEntry = members.filter((m) => dayEntries.some((e) => e.member_id === m.id));
        const membersWithoutEntry = members.filter((m) => !dayEntries.some((e) => e.member_id === m.id));

        const isLast = idx === visibleDays.length - 1 ||
          // Check if rest are all null-rendered
          visibleDays.slice(idx + 1).every((d) => {
            const ds = format(d, "yyyy-MM-dd");
            const de = entries.filter((e) => e.entry_date === ds);
            const recent = isToday(d) || isYesterday(d);
            return !recent && de.length === 0;
          });

        return (
          <div key={dayStr} className={`relative ${!isLast ? "pb-8" : "pb-2"}`}>
            {/* Timeline connector */}
            {!isLast && (
              <div className="absolute left-[19px] top-[44px] bottom-0 w-px bg-border" />
            )}

            {/* Day header */}
            <div className="flex items-center gap-3 mb-4">
              {/* Date circle */}
              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                isToday(day)
                  ? "bg-primary text-primary-foreground"
                  : entryCount > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className={`text-lg font-semibold capitalize ${
                    isToday(day) ? "text-primary" : isFuture ? "text-muted-foreground" : "text-foreground"
                  }`}>
                    {dayLabel}
                  </h3>
                  <span className="text-sm text-muted-foreground">{dateLabel}</span>
                  {entryCount > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {entryCount}/{members.length}
                    </span>
                  )}
                </div>
              </div>

              {isPast && currentMemberId && !isToday(day) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => setEditingDay(editingDay === dayStr ? null : dayStr)}
                >
                  <PenLine className="h-3 w-3 mr-1" />
                  {myEntry ? "Rediger" : "Legg til"}
                </Button>
              )}
            </div>

            {/* Day content */}
            <div className="ml-[52px]">
              {showInput && (
                <div className="mb-3">
                  <StandupInput
                    memberId={currentMemberId}
                    existingEntry={myEntry}
                    date={day}
                    dayLabel={`${dayLabel} — etterregistrering`}
                    onSaved={() => setEditingDay(null)}
                  />
                </div>
              )}

              <TeamNoteField
                entryDate={dayStr}
                note={teamNotes.find((n) => n.entry_date === dayStr)}
                editable={!!currentMemberId && (isToday(day) || isPast)}
              />

              {membersWithEntry.length > 0 && (
                <div className={`grid gap-4 ${membersWithEntry.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                  {membersWithEntry.map((m) => {
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
              )}

              {/* Members without entry */}
              {membersWithoutEntry.length > 0 && membersWithEntry.length > 0 && (
                <div className="flex items-center gap-2 mt-3 px-1">
                  <span className="text-xs text-muted-foreground">Ikke oppdatert:</span>
                  <div className="flex -space-x-0.5">
                    {membersWithoutEntry.map((m) => (
                      <div
                        key={m.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-background"
                        style={{ backgroundColor: m.avatar_color }}
                        title={m.name}
                      >
                        {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent day with no entries */}
              {isRecentDay && membersWithEntry.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-1">Ingen oppdateringer ennå</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
