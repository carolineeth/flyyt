import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar, Plus, RefreshCw } from "lucide-react";

function getCurrentWeekYear() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}

export default function MeetingCalendarPage() {
  const current = getCurrentWeekYear();
  const [week, setWeek] = useState(current.week);
  const [year, setYear] = useState(current.year);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [addForm, setAddForm] = useState({ date: "", startTime: "12:00", endTime: "14:00", label: "", status: "upcoming" });

  const qc = useQueryClient();
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

      // If meeting exists and has explicit leader/notetaker override (including null = cleared)
      const hasLeaderOverride = meeting && "leader_id" in meeting;
      const hasNotetakerOverride = meeting && "notetaker_id" in meeting;
      const mLeader = hasLeaderOverride && meeting.leader_id
        ? members?.find((m) => m.id === (meeting as any).leader_id)?.name.split(" ")[0] || leaderName
        : hasLeaderOverride && meeting.leader_id === null ? "–" : leaderName;
      const mNotetaker = hasNotetakerOverride && meeting.notetaker_id
        ? members?.find((m) => m.id === (meeting as any).notetaker_id)?.name.split(" ")[0] || notetakerName
        : hasNotetakerOverride && meeting.notetaker_id === null ? "–" : notetakerName;

      return { rm, meeting, isToday, leaderName: mLeader, notetakerName: mNotetaker };
    });
  }, [recurringMeetings, weekMeetings, members, year, week, todayStr, leaderName, notetakerName]);

  // Meetings not linked to recurring meetings (ad-hoc + legacy)
  const unlinkedMeetings = useMemo(() => {
    if (!weekMeetings) return [];
    const recurringIds = new Set(recurringMeetings?.map((rm: any) => rm.id) || []);
    return weekMeetings.filter((m: any) => !m.recurring_meeting_id || !recurringIds.has(m.recurring_meeting_id));
  }, [weekMeetings, recurringMeetings]);

  // Check if recurring meetings are missing for this past week
  const hasRecurringMeetings = useMemo(() => {
    if (!recurringMeetings || !weekMeetings) return true;
    return recurringMeetings.some((rm: any) =>
      weekMeetings.some((m: any) => m.recurring_meeting_id === rm.id)
    );
  }, [recurringMeetings, weekMeetings]);

  const prevWeek = () => {
    if (week <= 1) { setWeek(52); setYear(year - 1); }
    else setWeek(week - 1);
  };
  const nextWeek = () => {
    if (week >= 52) { setWeek(1); setYear(year + 1); }
    else setWeek(week + 1);
  };
  const goToday = () => { setWeek(current.week); setYear(current.year); };

  const generateForPastWeek = () => {
    if (!recurringMeetings || !rotation) return;
    autoGenerate.mutate(
      { year, week, recurringMeetings, rotation },
      {
        onSuccess: () => toast.success("Faste møter generert for denne uken"),
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const openAddMeeting = () => {
    const { start } = getWeekDates(year, week);
    setAddForm({
      date: start.toISOString().split("T")[0],
      startTime: "12:00",
      endTime: "14:00",
      label: "",
      status: isPastWeek ? "completed" : "upcoming",
    });
    setShowAddMeeting(true);
  };

  const createAdHocMeeting = async () => {
    if (!addForm.date || !addForm.label) return;
    const meetingDate = new Date(addForm.date);
    const meetingWeek = getWeekNumber(meetingDate);

    const rot = rotation?.find((r: any) => r.position === getRotationPosition(meetingWeek));

    const { error } = await supabase.from("meetings").insert({
      type: "other",
      date: meetingDate.toISOString(),
      meeting_date: addForm.date,
      week_number: week,
      leader_id: rot?.leader_id || null,
      notetaker_id: rot?.notetaker_id || null,
      rotation_position: getRotationPosition(week),
      status: addForm.status,
      notes: addForm.label,
      participants: [],
    } as any);

    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    setShowAddMeeting(false);
    toast.success("Møte lagt til");
  };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Møtekalender"
        description="Planlegg, gjennomfør og dokumenter gruppemøter"
        action={
          <div className="flex gap-2">
            {isPastWeek && !hasRecurringMeetings && recurringMeetings && rotation && (
              <Button variant="outline" size="sm" onClick={generateForPastWeek} disabled={autoGenerate.isPending}>
                <RefreshCw className={`h-4 w-4 mr-1 ${autoGenerate.isPending ? "animate-spin" : ""}`} />
                Generer faste møter
              </Button>
            )}
            <Button size="sm" onClick={openAddMeeting}>
              <Plus className="h-4 w-4 mr-1" /> Legg til møte
            </Button>
          </div>
        }
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

      {/* Ad-hoc / unlinked meetings */}
      {unlinkedMeetings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Andre møter denne uken</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unlinkedMeetings.map((m: any) => {
              const mDate = new Date(m.date);
              const mDateStr = mDate.toISOString().split("T")[0];
              const mLeader = m.leader_id || m.facilitator_id
                ? members?.find((mem) => mem.id === (m.leader_id || m.facilitator_id))?.name.split(" ")[0] || "–"
                : "–";
              const mNotetaker = m.notetaker_id || m.note_taker_id
                ? members?.find((mem) => mem.id === (m.notetaker_id || m.note_taker_id))?.name.split(" ")[0] || "–"
                : "–";
              return (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  recurringMeeting={null}
                  leaderName={mLeader}
                  notetakerName={mNotetaker}
                  isToday={mDateStr === todayStr}
                  year={year}
                  week={week}
                />
              );
            })}
          </div>
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

      {/* Add meeting dialog */}
      <Dialog open={showAddMeeting} onOpenChange={setShowAddMeeting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til møte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tittel / beskrivelse</Label>
              <Input
                value={addForm.label}
                onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="F.eks. Ekstra arbeidsmøte"
              />
            </div>
            <div>
              <Label>Dato</Label>
              <Input
                type="date"
                value={addForm.date}
                onChange={(e) => setAddForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starttid</Label>
                <Input
                  type="time"
                  value={addForm.startTime}
                  onChange={(e) => setAddForm((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sluttid</Label>
                <Input
                  type="time"
                  value={addForm.endTime}
                  onChange={(e) => setAddForm((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Kommende</SelectItem>
                  <SelectItem value="completed">Gjennomført</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddMeeting(false)}>Avbryt</Button>
            <Button onClick={createAdHocMeeting} disabled={!addForm.label || !addForm.date}>Legg til</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
