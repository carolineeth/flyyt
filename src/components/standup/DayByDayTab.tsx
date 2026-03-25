import { useMemo, useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday, startOfDay, isWeekend } from "date-fns";
import { nb } from "date-fns/locale";
import { StandupInput } from "./StandupInput";
import { PersonCard } from "./PersonCard";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { TeamMember } from "@/lib/types";
import type { DailyUpdate, DailyTeamNote } from "@/hooks/useDailyUpdates";
import { useUpsertTeamNote } from "@/hooks/useDailyUpdates";
import { Button } from "@/components/ui/button";
import { PenLine, ChevronDown, Users } from "lucide-react";

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
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleExpand = (dayStr: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayStr)) next.delete(dayStr);
      else next.add(dayStr);
      return next;
    });
  };

  // Sorted newest first
  const sortedDays = useMemo(() => [...weekdays].sort((a, b) => b.getTime() - a.getTime()), [weekdays]);

  // Filter: for weekends, only show if there are entries
  const visibleDays = useMemo(() => {
    return sortedDays.filter((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayEntries = entries.filter((e) => e.entry_date === dayStr);
      // Weekend: only show if has entries
      if (isWeekend(day) && dayEntries.length === 0) return false;
      return true;
    });
  }, [sortedDays, entries]);

  // Is today a weekend?
  const todayIsWeekend = isWeekend(today);

  return (
    <div className="space-y-4">
      {/* Input for today - only show in current week AND not weekend */}
      {isCurrentWeek && currentMemberId && !todayCollapsed && !todayIsWeekend && (() => {
        const todayStr = format(today, "yyyy-MM-dd");
        const todayEntry = entries.find((e) => e.entry_date === todayStr && e.member_id === currentMemberId) ?? null;
        return (
          <StandupInput
            memberId={currentMemberId}
            existingEntry={todayEntry}
            date={today}
            dayLabel=""
            onSaved={() => setTodayCollapsed(true)}
            compact
          />
        );
      })()}

      {isCurrentWeek && currentMemberId && todayCollapsed && !todayIsWeekend && (
        <div className="flex justify-end">
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

      {visibleDays.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayEntries = entries.filter((e) => e.entry_date === dayStr);
        const isPast = day < today && !isToday(day);
        const myEntry = entries.find((e) => e.entry_date === dayStr && e.member_id === currentMemberId) ?? null;
        const showInput = editingDay === dayStr && currentMemberId;

        let dayHeading: string;
        if (isToday(day)) dayHeading = "I dag";
        else if (isYesterday(day)) dayHeading = "I går";
        else dayHeading = format(day, "EEEE d. MMMM", { locale: nb });

        // Determine if this day should be expanded by default
        const isRecentDay = isToday(day) || isYesterday(day);
        const isExpanded = isRecentDay || expandedDays.has(dayStr);
        const entryCount = dayEntries.length;

        // Members who wrote vs didn't write
        const membersWithEntry = members.filter((m) => dayEntries.some((e) => e.member_id === m.id));
        const membersWithoutEntry = members.filter((m) => !dayEntries.some((e) => e.member_id === m.id));

        // Older days with no entries: skip entirely (already filtered by visibleDays for weekends)
        // For weekdays with 0 entries that aren't today/yesterday: show nothing
        if (!isRecentDay && entryCount === 0) return null;

        return (
          <div key={dayStr}>
            <div className="flex items-center gap-2 mb-2">
              {!isRecentDay ? (
                <button
                  onClick={() => toggleExpand(dayStr)}
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground capitalize hover:text-primary transition-colors"
                >
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                  {dayHeading}
                  <span className="text-[11px] text-muted-foreground font-normal ml-1">
                    — {entryCount} {entryCount === 1 ? "oppdatering" : "oppdateringer"}
                  </span>
                </button>
              ) : (
                <h3 className="text-sm font-medium text-foreground capitalize">{dayHeading}</h3>
              )}
              {isPast && currentMemberId && !isToday(day) && isExpanded && (
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

            {isExpanded && (
              <div className="animate-fade-in">
                {showInput && (
                  <div className="mb-3">
                    <StandupInput
                      memberId={currentMemberId}
                      existingEntry={myEntry}
                      date={day}
                      dayLabel={`${dayHeading} — etterregistrering`}
                      onSaved={() => setEditingDay(null)}
                    />
                  </div>
                )}

                <TeamNoteField
                  entryDate={dayStr}
                  note={teamNotes.find((n) => n.entry_date === dayStr)}
                  editable={!!currentMemberId && (isToday(day) || isPast)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

                {/* Compact line for members without entry */}
                {membersWithoutEntry.length > 0 && membersWithEntry.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 px-1">
                    <span className="text-[11px] text-muted-foreground">Ikke oppdatert:</span>
                    <div className="flex -space-x-1">
                      {membersWithoutEntry.map((m) => (
                        <div
                          key={m.id}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium text-white border border-background"
                          style={{ backgroundColor: m.avatar_color }}
                          title={m.name}
                        >
                          {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* If today/yesterday and nobody has entries, show a softer message */}
                {isRecentDay && membersWithEntry.length === 0 && (
                  <p className="text-xs text-muted-foreground italic px-1">Ingen oppdateringer ennå</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
