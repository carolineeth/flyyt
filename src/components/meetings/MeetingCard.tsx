import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useMeetingAgendaItems,
  useMeetingSubSessions,
  useMeetingActionPoints,
  formatWeekdayNb,
} from "@/hooks/useMeetingCalendar";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubSessionBlock } from "./SubSessionBlock";
import { toast } from "sonner";
import { Plus, Play, Square, Copy, ChevronUp, ChevronDown, X, CalendarDays, Save, Pencil, Eye, Users, ListChecks, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const subSessionTemplates: Record<string, string[]> = {
  sprint_planning: ["Gjennomgå product backlog", "Velg items for sprint", "Estimering", "Definer sprint goal"],
  sprint_review: ["Demo av fullførte items", "Feedback", "Items som ikke ble fullført"],
  retrospective: ["Hva fungerte bra?", "Hva kan forbedres?", "Action points for neste sprint"],
  veiledermøte: ["Spørsmål til veileder", "Feedback fra veileder", "Action points"],
  mobb_programmering: ["Hva skal vi jobbe med?", "Tidsskjema (hvem driver når)", "Lenke til commit/kildekode", "Refleksjoner"],
};

const subSessionTypeLabels: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  veiledermøte: "Veiledermøte",
  mobb_programmering: "Mobb-programmering",
  workshop: "Workshop",
  annet: "Annet",
};

interface MeetingCardProps {
  meeting: any;
  recurringMeeting: any;
  leaderName: string;
  notetakerName: string;
  isToday: boolean;
  year: number;
  week: number;
}

export function MeetingCard({ meeting, recurringMeeting, leaderName, notetakerName, isToday, year, week }: MeetingCardProps) {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: agendaItems } = useMeetingAgendaItems(meeting?.id);
  const { data: subSessions } = useMeetingSubSessions(meeting?.id);
  const { data: actionPoints } = useMeetingActionPoints(meeting?.id);

  const [newAgenda, setNewAgenda] = useState("");
  const [notes, setNotes] = useState(meeting?.notes || "");
  const [room, setRoom] = useState(meeting?.room || "");
  const [expanded, setExpanded] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");

  useEffect(() => { setNotes(meeting?.notes || ""); }, [meeting?.notes]);
  useEffect(() => { setRoom(meeting?.room || ""); }, [meeting?.room]);

  // Auto-save room
  useEffect(() => {
    const t = setTimeout(() => {
      if (meeting?.id && room !== (meeting?.room || "")) {
        supabase.from("meetings").update({ room } as any).eq("id", meeting.id);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [room, meeting?.room, meeting?.id]);

  const saveNotes = useCallback(async (val: string) => {
    if (!meeting?.id) return;
    await supabase.from("meetings").update({ notes: val } as any).eq("id", meeting.id);
  }, [meeting?.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (meeting?.id && notes !== (meeting?.notes || "")) {
        saveNotes(notes);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [notes, meeting?.notes, saveNotes, meeting?.id]);

  if (!meeting) return null;

  const meetingDate = meeting.meeting_date ? new Date(meeting.meeting_date + "T00:00:00") : new Date(meeting.date);
  const status = meeting.status || "upcoming";
  const isCancelled = status === "cancelled";
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const isPast = meetingDate < todayDate;

  const presentCount = (meeting.participants || []).length;
  const presentNames = (meeting.participants || [])
    .map((pid: string) => members?.find((m) => m.id === pid)?.name?.split(" ")[0])
    .filter(Boolean);

  const saveMeeting = async () => {
    await saveNotes(notes);
    toast.success("Møte lagret");
  };

  const cancelMeeting = async () => {
    await supabase.from("meetings").update({ status: "cancelled" } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte avlyst");
  };

  const rescheduleMeeting = async (dateStr: string) => {
    if (!dateStr) return;
    const newMeetingDate = new Date(dateStr);
    const newWeek = (() => {
      const d = new Date(Date.UTC(newMeetingDate.getFullYear(), newMeetingDate.getMonth(), newMeetingDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    })();
    await supabase.from("meetings").update({
      meeting_date: dateStr,
      date: new Date(dateStr).toISOString(),
      week_number: newWeek,
    } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    setShowReschedule(false);
    toast.success("Møte flyttet til " + newMeetingDate.toLocaleDateString("nb-NO", { day: "numeric", month: "long" }));
  };

  const uncancelMeeting = async () => {
    await supabase.from("meetings").update({ status: "upcoming" } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte gjenopprettet");
  };

  const addAgendaItem = async () => {
    if (!newAgenda.trim()) return;
    const order = (agendaItems?.length ?? 0);
    await supabase.from("meeting_agenda_items" as any).insert({
      meeting_id: meeting.id,
      title: newAgenda.trim(),
      sort_order: order,
    } as any);
    setNewAgenda("");
    qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
    toast.success("Lagret");
  };

  const toggleAgendaItem = async (itemId: string, completed: boolean) => {
    await supabase.from("meeting_agenda_items" as any).update({ is_completed: completed } as any).eq("id", itemId);
    qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
  };

  const moveAgendaItem = async (index: number, direction: "up" | "down") => {
    if (!agendaItems) return;
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= agendaItems.length) return;
    const a = agendaItems[index];
    const b = agendaItems[swapIdx];
    await Promise.all([
      supabase.from("meeting_agenda_items" as any).update({ sort_order: b.sort_order } as any).eq("id", a.id),
      supabase.from("meeting_agenda_items" as any).update({ sort_order: a.sort_order } as any).eq("id", b.id),
    ]);
    qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
  };

  const addSubSession = async (type: string) => {
    const order = (subSessions?.length ?? 0);
    const title = subSessionTypeLabels[type] || type;
    const { data: ss, error } = await supabase.from("meeting_sub_sessions" as any).insert({
      meeting_id: meeting.id,
      type,
      title,
      sort_order: order,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }

    const templateItems = subSessionTemplates[type];
    if (templateItems && ss) {
      await supabase.from("meeting_sub_session_items" as any).insert(
        templateItems.map((content, i) => ({
          sub_session_id: (ss as any).id,
          content,
          sort_order: i,
        })) as any
      );
    }

    qc.invalidateQueries({ queryKey: ["meeting_sub_sessions", meeting.id] });
    toast.success("Delmøte lagt til");
  };

  const deleteSubSession = async (ssId: string) => {
    await supabase.from("meeting_sub_session_items" as any).delete().eq("sub_session_id", ssId);
    await supabase.from("meeting_sub_sessions" as any).delete().eq("id", ssId);
    qc.invalidateQueries({ queryKey: ["meeting_sub_sessions", meeting.id] });
    toast.success("Delmøte fjernet");
  };

  const startMeeting = async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await supabase.from("meetings").update({ status: "in_progress", actual_start_time: time } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte startet");
  };

  const endMeeting = async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await supabase.from("meetings").update({ status: "completed", actual_end_time: time } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte avsluttet");
  };

  const addActionPoint = async () => {
    await supabase.from("meeting_action_points").insert({
      meeting_id: meeting.id,
      title: "",
      is_completed: false,
    } as any);
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meeting.id] });
  };

  const updateActionPoint = async (apId: string, updates: any) => {
    await supabase.from("meeting_action_points").update(updates).eq("id", apId);
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meeting.id] });
  };

  const overrideRole = async (field: "leader_id" | "notetaker_id", memberId: string | null) => {
    await supabase.from("meetings").update({ [field]: memberId } as any).eq("id", meeting.id);
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success(memberId ? "Rolle oppdatert" : "Rolle fjernet");
  };

  const exportToProcessLog = () => {
    const dateStr = meetingDate.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const startTime = recurringMeeting ? `${recurringMeeting.start_time}` : "";
    const endTime = meeting.actual_end_time || (recurringMeeting ? recurringMeeting.end_time : "");

    let log = `Møte: ${recurringMeeting?.label || "Møte"} — ${dateStr}\n`;
    log += `Tid: ${startTime}–${endTime}\n`;
    log += `Møteleder: ${leaderName} | Referent: ${notetakerName}\n`;
    if (presentNames.length > 0) log += `Deltakere: ${presentNames.join(", ")}\n`;
    log += "\n";

    if (agendaItems?.length) {
      log += `Agenda:\n`;
      agendaItems.forEach((ai: any) => {
        log += `- [${ai.is_completed ? "✓" : "✗"}] ${ai.title}\n`;
      });
      log += "\n";
    }

    subSessions?.forEach((ss: any) => {
      log += `[Delmøte: ${ss.title}]\n`;
      if (ss.notes) log += `${ss.notes}\n`;
      log += "\n";
    });

    if (notes) {
      log += `Notater:\n${notes}\n\n`;
    }

    if (actionPoints?.length) {
      log += `Action points:\n`;
      actionPoints.forEach((ap: any) => {
        const assignee = members?.find((m) => m.id === ap.assignee_id);
        log += `- [${ap.is_completed ? "x" : " "}] ${ap.title}`;
        if (assignee) log += ` → ${assignee.name}`;
        if (ap.deadline) log += ` (frist: ${ap.deadline})`;
        log += "\n";
      });
    }

    navigator.clipboard.writeText(log);
    toast.success("Kopiert til utklippstavlen");
  };

  const meetingLabel = recurringMeeting?.label || meeting.notes || "Møte";

  return (
    <Card className={`overflow-hidden transition-shadow ${isToday ? "ring-2 ring-primary shadow-md" : ""} ${isCancelled ? "opacity-60" : ""}`}>
      <CardContent className="p-0">
        {/* Header — always visible */}
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {formatWeekdayNb(meetingDate)} {meetingDate.getDate()}. {meetingDate.toLocaleDateString("nb-NO", { month: "short" })}
              </span>
              {recurringMeeting && (
                <span className="text-xs text-muted-foreground">
                  {recurringMeeting.start_time?.slice(0, 5)}–{recurringMeeting.end_time?.slice(0, 5)}
                </span>
              )}
              {room && (
                <Badge variant="outline" className="text-[10px] font-normal">{room}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                {meetingLabel}
              </span>
              {(() => {
                if (isCancelled) return <Badge variant="destructive" className="text-[10px]">Avlyst</Badge>;
                if (status === "in_progress") return <Badge className="bg-green-600 text-white text-[10px]">Pågår</Badge>;
                if (status === "completed") return <Badge variant="secondary" className="text-[10px]">Fullført</Badge>;
                const meetingDay = meeting.meeting_date || format(meetingDate, "yyyy-MM-dd");
                const todayStr2 = format(new Date(), "yyyy-MM-dd");
                if (meetingDay === todayStr2) return <Badge className="bg-teal-600 text-white text-[10px]">I dag</Badge>;
                if (meetingDay < todayStr2) return <Badge className="bg-green-600/80 text-white text-[10px]">Fullført</Badge>;
                return <Badge variant="outline" className="text-[10px] text-muted-foreground">Kommende</Badge>;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Quick stats in header */}
            {!expanded && !isCancelled && (
              <div className="flex items-center gap-2 mr-2 text-muted-foreground">
                {(agendaItems?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <ListChecks className="h-3 w-3" />
                    {agendaItems?.filter((a: any) => a.is_completed).length}/{agendaItems?.length}
                  </span>
                )}
                {presentCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Users className="h-3 w-3" />
                    {presentCount}
                  </span>
                )}
                {(subSessions?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <FileText className="h-3 w-3" />
                    {subSessions?.length}
                  </span>
                )}
              </div>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && !isCancelled && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {/* Roles row */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <Badge className="bg-teal-600 text-white text-[10px]">Leder</Badge>
                {editMode ? (
                  <Select value={meeting.leader_id || ""} onValueChange={(v) => overrideRole("leader_id", v === "none" ? null as any : v)}>
                    <SelectTrigger className="h-6 text-xs w-28 border-0 p-0 pl-1">
                      <SelectValue placeholder={leaderName} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-medium">{leaderName}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Badge className="bg-purple-600 text-white text-[10px]">Referent</Badge>
                {editMode ? (
                  <Select value={meeting.notetaker_id || ""} onValueChange={(v) => overrideRole("notetaker_id", v === "none" ? null as any : v)}>
                    <SelectTrigger className="h-6 text-xs w-28 border-0 p-0 pl-1">
                      <SelectValue placeholder={notetakerName} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-medium">{notetakerName}</span>
                )}
              </div>
              {editMode ? (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] shrink-0">Rom</Badge>
                  <Input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="F.eks. Grupperom 3"
                    className="h-6 text-xs w-36"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : room ? (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px]">Rom</Badge>
                  <span className="text-xs font-medium">{room}</span>
                </div>
              ) : null}
              <div className="ml-auto">
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={(e) => { e.stopPropagation(); setEditMode(!editMode); }}
                >
                  {editMode ? <><Eye className="h-3 w-3 mr-1" /> Forhåndsvisning</> : <><Pencil className="h-3 w-3 mr-1" /> Rediger</>}
                </Button>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Tilstede
                {presentCount > 0 && <span className="text-[10px]">({presentCount}/{members?.length ?? 0})</span>}
              </p>
              {editMode ? (
                <div className="flex flex-wrap gap-2.5">
                  {members?.map((m) => {
                    const isPresent = (meeting.participants || []).includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={isPresent}
                          onCheckedChange={async (checked) => {
                            const current: string[] = meeting.participants || [];
                            const updated = checked
                              ? [...current, m.id]
                              : current.filter((id: string) => id !== m.id);
                            await supabase.from("meetings").update({ participants: updated } as any).eq("id", meeting.id);
                            qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
                          }}
                        />
                        {m.name.split(" ")[0]}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {presentCount > 0 ? (
                    presentNames.map((name: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">{name}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Ingen registrert ennå</span>
                  )}
                </div>
              )}
            </div>

            {/* Agenda */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ListChecks className="h-3 w-3" /> Agenda
                {(agendaItems?.length ?? 0) > 0 && (
                  <span className="text-[10px]">
                    ({agendaItems?.filter((a: any) => a.is_completed).length}/{agendaItems?.length})
                  </span>
                )}
              </p>
              {(agendaItems?.length ?? 0) > 0 ? (
                <div className="space-y-0.5">
                  {agendaItems?.map((ai: any, idx: number) => (
                    <div key={ai.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={ai.is_completed}
                        onCheckedChange={(v) => toggleAgendaItem(ai.id, !!v)}
                      />
                      <span className={`text-xs flex-1 ${ai.is_completed ? "line-through text-muted-foreground" : ""}`}>
                        {ai.title}
                      </span>
                      {editMode && (
                        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveAgendaItem(idx, "up")} disabled={idx === 0}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveAgendaItem(idx, "down")} disabled={idx === (agendaItems?.length ?? 0) - 1}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !editMode && <span className="text-xs text-muted-foreground italic">Ingen agendapunkter ennå</span>
              )}
              {/* Always allow adding agenda items */}
              <div className="flex gap-1 mt-1">
                <Input
                  value={newAgenda}
                  onChange={(e) => setNewAgenda(e.target.value)}
                  placeholder="+ Legg til agendapunkt"
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && addAgendaItem()}
                />
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addAgendaItem}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Sub-sessions */}
            {((subSessions?.length ?? 0) > 0 || editMode) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Delmøter</p>
                {subSessions?.map((ss: any) => (
                  editMode ? (
                    <SubSessionBlock
                      key={ss.id}
                      subSession={ss}
                      meetingStatus={status}
                      meetingId={meeting.id}
                      meetingDate={meeting.meeting_date || meetingDate.toISOString().split("T")[0]}
                      meetingParticipants={meeting.participants || []}
                      onDelete={() => deleteSubSession(ss.id)}
                    />
                  ) : (
                    <div key={ss.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{subSessionTypeLabels[ss.type] || ss.type}</Badge>
                        <span className="text-xs font-medium">{ss.title}</span>
                      </div>
                      {ss.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ss.notes}</p>}
                    </div>
                  )
                ))}
                {editMode && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Legg til delmøte
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      {Object.entries(subSessionTypeLabels).map(([k, v]) => (
                        <Button
                          key={k}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-8 text-xs"
                          onClick={() => addSubSession(k)}
                        >
                          {v}
                        </Button>
                      ))}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* Notes */}
            {(editMode || notes) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Notater</p>
                {editMode ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Møtenotater..."
                    rows={3}
                    className="text-xs"
                  />
                ) : (
                  <p className="text-xs bg-muted/50 rounded-md px-3 py-2 whitespace-pre-wrap">{notes}</p>
                )}
              </div>
            )}

            {/* Action points */}
            {((actionPoints?.length ?? 0) > 0 || editMode) && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Action points</p>
                {actionPoints?.map((ap) => (
                  editMode ? (
                    <ActionPointRow key={ap.id} ap={ap} members={members || []} onUpdate={updateActionPoint} />
                  ) : (
                    <div key={ap.id} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={ap.is_completed} onCheckedChange={(v) => updateActionPoint(ap.id, { is_completed: !!v })} />
                      <span className={`flex-1 ${ap.is_completed ? "line-through text-muted-foreground" : ""}`}>{ap.title || "–"}</span>
                      {ap.assignee_id && (
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {members?.find((m) => m.id === ap.assignee_id)?.name?.split(" ")[0]}
                        </Badge>
                      )}
                      {ap.deadline && <span className="text-[10px] text-muted-foreground">{ap.deadline}</span>}
                    </div>
                  )
                ))}
                {editMode && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addActionPoint}>
                    <Plus className="h-3 w-3 mr-1" /> Action point
                  </Button>
                )}
              </div>
            )}

            {/* Control buttons */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {!isPast && status === "upcoming" && (
                <Button size="sm" className="h-7 text-xs" onClick={startMeeting}>
                  <Play className="h-3 w-3 mr-1" /> Start møte
                </Button>
              )}
              {!isPast && status === "in_progress" && (
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={endMeeting}>
                  <Square className="h-3 w-3 mr-1" /> Avslutt møte
                </Button>
              )}
              {editMode && (
                <>
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={saveMeeting}>
                    <Save className="h-3 w-3 mr-1" /> Lagre
                  </Button>
                  <Popover open={showReschedule} onOpenChange={setShowReschedule}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <CalendarDays className="h-3 w-3 mr-1" /> Flytt møte
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Velg ny dato</p>
                        <Input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button size="sm" className="h-7 text-xs w-full" onClick={() => rescheduleMeeting(newDate)} disabled={!newDate}>
                          Flytt hit
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={cancelMeeting}>
                    <X className="h-3 w-3 mr-1" /> Avlys
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportToProcessLog}>
                <Copy className="h-3 w-3 mr-1" /> Eksporter
              </Button>
            </div>
          </div>
        )}

        {/* Cancelled state */}
        {expanded && isCancelled && (
          <div className="px-4 pb-3 border-t border-border pt-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={uncancelMeeting}>
                <Play className="h-3 w-3 mr-1" /> Gjenopprett møte
              </Button>
              <Popover open={showReschedule} onOpenChange={setShowReschedule}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <CalendarDays className="h-3 w-3 mr-1" /> Flytt til ny dato
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Velg ny dato</p>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button size="sm" className="h-7 text-xs w-full" onClick={() => { rescheduleMeeting(newDate); uncancelMeeting(); }} disabled={!newDate}>
                      Flytt og gjenopprett
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPointRow({ ap, members, onUpdate }: { ap: any; members: any[]; onUpdate: (id: string, u: any) => void }) {
  const [title, setTitle] = useState(ap.title);

  useEffect(() => { setTitle(ap.title); }, [ap.title]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (title !== ap.title) onUpdate(ap.id, { title });
    }, 500);
    return () => clearTimeout(t);
  }, [title, ap.title, ap.id, onUpdate]);

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={ap.is_completed}
        onCheckedChange={(v) => onUpdate(ap.id, { is_completed: !!v })}
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Beskrivelse..."
        className="h-7 text-xs flex-1"
      />
      <Select value={ap.assignee_id || "none"} onValueChange={(v) => onUpdate(ap.id, { assignee_id: v === "none" ? null : v })}>
        <SelectTrigger className="h-7 text-xs w-28">
          <SelectValue placeholder="Ansvarlig" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ingen</SelectItem>
          {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={ap.deadline || ""}
        onChange={(e) => onUpdate(ap.id, { deadline: e.target.value || null })}
        className="h-7 text-xs w-32"
      />
    </div>
  );
}
