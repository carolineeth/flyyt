import { useState, useEffect, useMemo } from "react";
import {
  getWeekNumber,
  getWeekDates,
  getDateForDayOfWeek,
  getRotationPosition,
  formatDateNb,
  useRotation,
  useRecurringMeetings,
  useWeekMeetings,
  useAutoGenerateMeetings,
} from "@/hooks/useMeetingCalendar";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

function getCurrentWeekYear() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

export default function MeetingCalendarPage() {
  const current = getCurrentWeekYear();
  const [week, setWeek] = useState(current.week);
  const [year, setYear] = useState(current.year);

  const { data: rotation } = useRotation();
  const { data: recurringMeetings } = useRecurringMeetings();
  const { data: weekMeetings, isLoading } = useWeekMeetings(year, week);
  const { data: members } = useTeamMembers();
  const autoGenerate = useAutoGenerateMeetings();

  // Auto-generate meetings only for current or future weeks
  const isPastWeek = year < current.year || (year === current.year && week < current.week);
  useEffect(() => {
    if (
      !isPastWeek &&
      weekMeetings !== undefined &&
      weekMeetings.length === 0 &&
      recurringMeetings &&
      recurringMeetings.length > 0 &&
      rotation &&
      rotation.length > 0 &&
      !autoGenerate.isPending
    ) {
      autoGenerate.mutate({ year, week, recurringMeetings, rotation });
    }
  }, [weekMeetings, recurringMeetings, rotation, year, week, isPastWeek]);

  const { start: weekStart, end: weekEnd } = getWeekDates(year, week);
  const position = getRotationPosition(week);
  const currentRot = rotation?.find((r: any) => r.position === position);

  const leaderName = useMemo(() => {
    if (!currentRot || !members) return "–";
    return members.find((m) => m.id === currentRot.leader_id)?.name.split(" ")[0] || "–";
  }, [currentRot, members]);

  const notetakerName = useMemo(() => {
    if (!currentRot || !members) return "–";
    return members.find((m) => m.id === currentRot.notetaker_id)?.name.split(" ")[0] || "–";
  }, [currentRot, members]);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const isCurrentWeek = week === current.week && year === current.year;

  // Match meetings to recurring meetings
  const meetingsByRecurring = useMemo(() => {
    if (!recurringMeetings || !weekMeetings) return [];
    return recurringMeetings.map((rm: any) => {
      const meeting = weekMeetings.find((m: any) => m.recurring_meeting_id === rm.id);
      const meetingDate = getDateForDayOfWeek(year, week, rm.day_of_week);
      const dateStr = meetingDate.toISOString().split("T")[0];
      const isToday = dateStr === todayStr;

      // Get leader/notetaker names (with override support)
      const mLeader = meeting?.leader_id
        ? members?.find((m) => m.id === (meeting as any).leader_id)?.name.split(" ")[0] || leaderName
        : leaderName;
      const mNotetaker = meeting?.notetaker_id
        ? members?.find((m) => m.id === (meeting as any).notetaker_id)?.name.split(" ")[0] || notetakerName
        : notetakerName;

      return { rm, meeting, isToday, leaderName: mLeader, notetakerName: mNotetaker };
    });
  }, [recurringMeetings, weekMeetings, members, year, week, todayStr, leaderName, notetakerName]);

  const prevWeek = () => {
    if (week <= 1) { setWeek(52); setYear(year - 1); }
    else setWeek(week - 1);
  };
  const nextWeek = () => {
    if (week >= 52) { setWeek(1); setYear(year + 1); }
    else setWeek(week + 1);
  };
  const goToday = () => { setWeek(current.week); setYear(current.year); };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Møtekalender"
        description="Planlegg, gjennomfør og dokumenter gruppemøter"
      />

      {/* Week navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold">
              Uke {week} — {formatDateNb(weekStart)}–{formatDateNb(weekEnd)} {year}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <Button size="sm" onClick={goToday}>
              <Calendar className="h-4 w-4 mr-1" /> Denne uken
            </Button>
          )}
        </div>
      </div>

      {/* Rotation info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rotasjon posisjon {position}:</span>
        <Badge className="bg-teal-600 text-white text-[10px]">Leder: {leaderName}</Badge>
        <Badge className="bg-purple-600 text-white text-[10px]">Referent: {notetakerName}</Badge>
      </div>

      {/* Meeting cards */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetingsByRecurring.map(({ rm, meeting, isToday: isTodayMeeting, leaderName: ln, notetakerName: nn }) => (
            <MeetingCard
              key={rm.id}
              meeting={meeting}
              recurringMeeting={rm}
              leaderName={ln}
              notetakerName={nn}
              isToday={isTodayMeeting}
              year={year}
              week={week}
            />
          ))}
        </div>
      )}

      {/* Rotation indicator */}
      {rotation && members && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Rotasjonsordning</p>
          <div className="flex flex-wrap gap-2">
            {rotation.map((r: any) => {
              const leader = members.find((m) => m.id === r.leader_id);
              const notetaker = members.find((m) => m.id === r.notetaker_id);
              const isCurrent = r.position === position;
              const isPast = r.position < position;
              return (
                <div
                  key={r.position}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {leader?.name.split(" ")[0]} / {notetaker?.name.split(" ")[0]}
                  {isCurrent && <span className="ml-1 text-[10px]">← nå</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
