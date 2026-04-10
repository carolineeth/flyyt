import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { saveToSupabase } from "@/lib/saveToSupabase";
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
import { Plus, Play, Square, Copy, ChevronUp, ChevronDown, X, CalendarDays, Users, ListChecks, FileText, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const subSessionTemplates: Record<string, string[]> = {
  sprint_planning: ["Gjennomgå product backlog", "Velg items for sprint", "Estimering", "Definer sprint goal"],
  sprint_review: ["Demo av fullførte items", "Feedback", "Items som ikke ble fullført"],
  retrospective: ["Hva fungerte bra?", "Hva kan forbedres?", "Action points for neste sprint"],
  daily_standup: ["Hva gjorde du i går?", "Hva skal du gjøre i dag?", "Hindringer"],
  veiledermøte: ["Spørsmål til veileder", "Feedback fra veileder", "Action points"],
};

const subSessionTypeLabels: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  daily_standup: "Daily Standup",
  veiledermøte: "Veiledermøte",
  annet: "Annet",
};

function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

async function autoLinkSubSessionToActivity(
  ssId: string,
  type: string,
  meetingId: string,
  meetingDateStr: string,
  participants: string[],
  qc: ReturnType<typeof import("@tanstack/react-query").useQueryClient>
) {
  const { data: catalogItems } = await (supabase
    .from("activity_catalog" as any)
    .select("*")
    .eq("meeting_type", type) as any);
  if (!catalogItems || (catalogItems as any[]).length === 0) return;
  const catalog = (catalogItems as any[])[0];

  const completedWeek = isoWeek(meetingDateStr);

  const { data: weekRegs } = await (supabase
    .from("activity_registrations" as any)
    .select("id")
    .eq("catalog_id", catalog.id)
    .eq("completed_week", completedWeek) as any);

  if (weekRegs && (weekRegs as any[]).length > 0) {
    await (supabase
      .from("activity_registrations" as any)
      .update({ linked_sub_session_id: ssId, linked_meeting_id: meetingId } as any)
      .eq("id", (weekRegs as any[])[0].id) as any);
    qc.invalidateQueries({ queryKey: ["activity_registrations"] });
    return;
  }

  const { data: allCompleted } = await (supabase
    .from("activity_registrations" as any)
    .select("id")
    .eq("catalog_id", catalog.id)
    .eq("status", "completed") as any);
  const occurrenceNumber = ((allCompleted as any[])?.length ?? 0) + 1;

  const { data: reg, error } = await (supabase
    .from("activity_registrations" as any)
    .insert({
      catalog_id: catalog.id,
      status: "completed",
      completed_date: meetingDateStr,
      completed_week: completedWeek,
      occurrence_number: occurrenceNumber,
      linked_meeting_id: meetingId,
      linked_sub_session_id: ssId,
    } as any)
    .select()
    .single() as any);
  if (error) { console.error("Auto-link error:", error); return; }

  if (reg && participants.length > 0) {
    await (supabase
      .from("activity_registration_participants" as any)
      .insert(participants.map((memberId) => ({ registration_id: (reg as any).id, member_id: memberId })) as any) as any);
    qc.invalidateQueries({ queryKey: ["activity_registration_participants"] });
  }
  qc.invalidateQueries({ queryKey: ["activity_registrations"] });
}

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
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState("");

  useEffect(() => { setNotes(meeting?.notes || ""); }, [meeting?.notes]);
  useEffect(() => { setRoom(meeting?.room || ""); }, [meeting?.room]);

  // Auto-save room with debounce
  useEffect(() => {
    if (!meeting?.id || room === (meeting?.room || "")) return;
    const t = setTimeout(() => {
      saveToSupabase(
        () => supabase.from("meetings").update({ room } as any).eq("id", meeting.id) as any,
        { silent: true, errorMessage: "Kunne ikke lagre rom." }
      );
    }, 800);
    return () => clearTimeout(t);
  }, [room, meeting?.room, meeting?.id]);

  const saveNotes = useCallback(async (val: string) => {
    if (!meeting?.id) return;
    await saveToSupabase(
      () => supabase.from("meetings").update({ notes: val } as any).eq("id", meeting.id) as any,
      { silent: true, errorMessage: "Kunne ikke lagre notater." }
    );
  }, [meeting?.id]);

  // Auto-save notes with debounce
  useEffect(() => {
    if (!meeting?.id || notes === (meeting?.notes || "")) return;
    const t = setTimeout(() => { saveNotes(notes); }, 800);
    return () => clearTimeout(t);
  }, [notes, meeting?.notes, saveNotes, meeting?.id]);

  // Also save on blur for immediate persistence
  const handleNotesBlur = useCallback(() => {
    if (meeting?.id && notes !== (meeting?.notes || "")) {
      saveNotes(notes);
    }
  }, [meeting?.id, notes, meeting?.notes, saveNotes]);

  const handleRoomBlur = useCallback(() => {
    if (meeting?.id && room !== (meeting?.room || "")) {
      saveToSupabase(
        () => supabase.from("meetings").update({ room } as any).eq("id", meeting.id) as any,
        { silent: true, errorMessage: "Kunne ikke lagre rom." }
      );
    }
  }, [meeting?.id, room, meeting?.room]);

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

  const cancelMeeting = async () => {
    const { error } = await supabase.from("meetings").update({ status: "cancelled" } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke avlyse møtet."); return; }
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
    const { error } = await supabase.from("meetings").update({
      meeting_date: dateStr,
      date: new Date(dateStr).toISOString(),
      week_number: newWeek,
    } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke flytte møtet."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    setShowReschedule(false);
    toast.success("Møte flyttet");
  };

  const uncancelMeeting = async () => {
    const { error } = await supabase.from("meetings").update({ status: "upcoming" } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke gjenopprette møtet."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte gjenopprettet");
  };

  const addAgendaItem = async () => {
    if (!newAgenda.trim()) return;
    const order = (agendaItems?.length ?? 0);
    const { error } = await supabase.from("meeting_agenda_items" as any).insert({
      meeting_id: meeting.id,
      title: newAgenda.trim(),
      sort_order: order,
    } as any);
    if (error) { toast.error("Kunne ikke legge til agendapunkt."); return; }
    setNewAgenda("");
    qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
  };

  const toggleAgendaItem = async (itemId: string, completed: boolean) => {
    const { error } = await supabase.from("meeting_agenda_items" as any).update({ is_completed: completed } as any).eq("id", itemId);
    if (error) toast.error("Kunne ikke oppdatere agendapunkt.");
    else qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
  };

  const moveAgendaItem = async (index: number, direction: "up" | "down") => {
    if (!agendaItems) return;
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= agendaItems.length) return;
    const a = agendaItems[index];
    const b = agendaItems[swapIdx];
    const results = await Promise.all([
      supabase.from("meeting_agenda_items" as any).update({ sort_order: b.sort_order } as any).eq("id", a.id),
      supabase.from("meeting_agenda_items" as any).update({ sort_order: a.sort_order } as any).eq("id", b.id),
    ]);
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error("Kunne ikke flytte agendapunkt.");
    else qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
  };

  const deleteAgendaItem = async (itemId: string) => {
    const { error } = await supabase.from("meeting_agenda_items" as any).delete().eq("id", itemId);
    if (error) toast.error("Kunne ikke slette agendapunkt.");
    else qc.invalidateQueries({ queryKey: ["meeting_agenda_items", meeting.id] });
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
      const { error: tplErr } = await (supabase.from("meeting_sub_session_items" as any).insert(
        templateItems.map((content, i) => ({
          sub_session_id: (ss as any).id,
          content,
          sort_order: i,
        })) as any
      ) as any);
      if (tplErr) console.error("Failed to insert template items", tplErr);
    }

    const meetingDateStr = meeting.meeting_date || meetingDate.toISOString().split("T")[0];
    await autoLinkSubSessionToActivity(
      (ss as any).id, type, meeting.id, meetingDateStr, meeting.participants || [], qc
    );

    qc.invalidateQueries({ queryKey: ["meeting_sub_sessions", meeting.id] });
    toast.success("Delmøte lagt til");
  };

  const deleteSubSession = async (ssId: string) => {
    const { error: apErr } = await supabase.from("meeting_action_points").delete().eq("source_sub_session_id", ssId);
    if (apErr) { toast.error("Kunne ikke fjerne action points"); return; }
    const { error: itemsErr } = await supabase.from("meeting_sub_session_items").delete().eq("sub_session_id", ssId);
    if (itemsErr) { toast.error("Kunne ikke slette delmøte-innhold"); return; }
    const { error: regErr } = await (supabase.from("activity_registrations").update({ linked_sub_session_id: null }).eq("linked_sub_session_id", ssId) as any);
    if (regErr) console.error("Failed to unlink registrations", regErr);
    const { error: ssErr } = await supabase.from("meeting_sub_sessions").delete().eq("id", ssId);
    if (ssErr) { toast.error("Kunne ikke slette delmøte"); return; }
    qc.invalidateQueries({ queryKey: ["meeting_sub_sessions", meeting.id] });
    toast.success("Delmøte fjernet");
  };

  const startMeeting = async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const { error } = await supabase.from("meetings").update({ status: "in_progress", actual_start_time: time } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke starte møtet."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte startet");
  };

  const endMeeting = async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const { error } = await supabase.from("meetings").update({ status: "completed", actual_end_time: time } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke avslutte møtet."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
    toast.success("Møte avsluttet");
  };

  const addActionPoint = async () => {
    const { error } = await supabase.from("meeting_action_points").insert({
      meeting_id: meeting.id,
      title: "",
      is_completed: false,
    } as any);
    if (error) { toast.error("Kunne ikke legge til action point."); return; }
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meeting.id] });
  };

  const updateActionPoint = async (apId: string, updates: any) => {
    const { error } = await supabase.from("meeting_action_points").update(updates).eq("id", apId);
    if (error) toast.error("Kunne ikke lagre action point.");
    else qc.invalidateQueries({ queryKey: ["meeting_action_points", meeting.id] });
  };

  const toggleMeetingParticipant = async (memberId: string, isPresent: boolean) => {
    const current: string[] = meeting.participants || [];
    const updated = isPresent ? current.filter((id: string) => id !== memberId) : [...current, memberId];
    const { error } = await supabase.from("meetings").update({ participants: updated } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke oppdatere deltaker."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });

    const { data: linkedRegs } = await (supabase
      .from("activity_registrations" as any)
      .select("id")
      .eq("linked_meeting_id", meeting.id) as any);
    if (linkedRegs && (linkedRegs as any[]).length > 0) {
      for (const reg of linkedRegs as any[]) {
        if (!isPresent) {
          await (supabase.from("activity_registration_participants" as any)
            .upsert({ registration_id: reg.id, member_id: memberId } as any, { onConflict: "registration_id,member_id" }) as any);
        } else {
          await (supabase.from("activity_registration_participants" as any)
            .delete().eq("registration_id", reg.id).eq("member_id", memberId) as any);
        }
      }
      qc.invalidateQueries({ queryKey: ["activity_registration_participants"] });
    }
  };

  const deleteActionPoint = async (apId: string) => {
    const { error } = await supabase.from("meeting_action_points").delete().eq("id", apId);
    if (error) toast.error("Kunne ikke slette action point.");
    else qc.invalidateQueries({ queryKey: ["meeting_action_points", meeting.id] });
  };

  const overrideRole = async (field: "leader_id" | "notetaker_id", memberId: string | null) => {
    const { error } = await supabase.from("meetings").update({ [field]: memberId } as any).eq("id", meeting.id);
    if (error) { toast.error("Kunne ikke oppdatere rolle."); return; }
    qc.invalidateQueries({ queryKey: ["week_meetings", year, week] });
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
          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {formatWeekdayNb(meetingDate)} {meetingDate.getDate()}. {meetingDate.toLocaleDateString("nb-NO", { month: "short" })}
              </span>
              {recurringMeeting && (
                <span className="text-sm text-muted-foreground">
                  {recurringMeeting.start_time?.slice(0, 5)}–{recurringMeeting.end_time?.slice(0, 5)}
                </span>
              )}
              {room && (
                <Badge variant="outline" className="text-xs font-normal">{room}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-base font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                {meetingLabel}
              </span>
              {(() => {
                if (isCancelled) return <Badge variant="destructive" className="text-xs">Avlyst</Badge>;
                if (status === "in_progress") return <Badge className="bg-green-600 text-white text-xs">Pågår</Badge>;
                if (status === "completed") return <Badge variant="secondary" className="text-xs">Fullført</Badge>;
                const meetingDay = meeting.meeting_date || format(meetingDate, "yyyy-MM-dd");
                const todayStr2 = format(new Date(), "yyyy-MM-dd");
                if (meetingDay === todayStr2) return <Badge className="bg-teal-600 text-white text-xs">I dag</Badge>;
                if (meetingDay < todayStr2) return <Badge className="bg-green-600/80 text-white text-xs">Fullført</Badge>;
                return <Badge variant="outline" className="text-xs text-muted-foreground">Kommende</Badge>;
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!expanded && !isCancelled && (
              <div className="flex items-center gap-3 mr-3 text-muted-foreground">
                {(agendaItems?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs">
                    <ListChecks className="h-3.5 w-3.5" />
                    {agendaItems?.filter((a: any) => a.is_completed).length}/{agendaItems?.length}
                  </span>
                )}
                {presentCount > 0 && (
                  <span className="flex items-center gap-1 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    {presentCount}
                  </span>
                )}
                {(subSessions?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-xs">
                    <FileText className="h-3.5 w-3.5" />
                    {subSessions?.length}
                  </span>
                )}
              </div>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded content — always editable */}
        {expanded && !isCancelled && (
          <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
            {/* Roles & Room */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-teal-600 text-white text-xs">Leder</Badge>
                <Select value={meeting.leader_id || ""} onValueChange={(v) => overrideRole("leader_id", v === "none" ? null as any : v)}>
                  <SelectTrigger className="h-8 text-sm w-32 border-0 p-0 pl-1">
                    <SelectValue placeholder={leaderName} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-purple-600 text-white text-xs">Referent</Badge>
                <Select value={meeting.notetaker_id || ""} onValueChange={(v) => overrideRole("notetaker_id", v === "none" ? null as any : v)}>
                  <SelectTrigger className="h-8 text-sm w-32 border-0 p-0 pl-1">
                    <SelectValue placeholder={notetakerName} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs shrink-0">Rom</Badge>
                <Input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  onBlur={handleRoomBlur}
                  placeholder="Grupperom..."
                  className="h-8 text-sm w-40"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Tilstede
                {presentCount > 0 && <span className="text-xs">({presentCount}/{members?.length ?? 0})</span>}
              </p>
              <div className="flex flex-wrap gap-3">
                {members?.map((m) => {
                  const isPresent = (meeting.participants || []).includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={isPresent}
                        onCheckedChange={() => toggleMeetingParticipant(m.id, isPresent)}
                      />
                      {m.name.split(" ")[0]}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Agenda */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Agenda
                {(agendaItems?.length ?? 0) > 0 && (
                  <span className="text-xs">
                    ({agendaItems?.filter((a: any) => a.is_completed).length}/{agendaItems?.length})
                  </span>
                )}
              </p>
              {(agendaItems?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  {agendaItems?.map((ai: any, idx: number) => (
                    <div key={ai.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={ai.is_completed}
                        onCheckedChange={(v) => toggleAgendaItem(ai.id, !!v)}
                      />
                      <span className={`text-sm flex-1 ${ai.is_completed ? "line-through text-muted-foreground" : ""}`}>
                        {ai.title}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveAgendaItem(idx, "up")} disabled={idx === 0}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveAgendaItem(idx, "down")} disabled={idx === (agendaItems?.length ?? 0) - 1}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteAgendaItem(ai.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newAgenda}
                  onChange={(e) => setNewAgenda(e.target.value)}
                  placeholder="+ Legg til agendapunkt"
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && addAgendaItem()}
                />
                <Button variant="ghost" size="sm" className="h-9 px-3" onClick={addAgendaItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sub-sessions — always editable */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Delmøter</p>
              {subSessions?.map((ss: any) => (
                <SubSessionBlock
                  key={ss.id}
                  subSession={ss}
                  meetingStatus={status}
                  meetingId={meeting.id}
                  meetingDate={meeting.meeting_date || meetingDate.toISOString().split("T")[0]}
                  meetingParticipants={meeting.participants || []}
                  onDelete={() => deleteSubSession(ss.id)}
                />
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm">
                    <Plus className="h-4 w-4 mr-1" /> Legg til delmøte
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1" align="start">
                  {Object.entries(subSessionTypeLabels).map(([k, v]) => (
                    <Button
                      key={k}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-9 text-sm"
                      onClick={() => addSubSession(k)}
                    >
                      {v}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1.5">Møtenotater</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Skriv møtenotater her... (lagres automatisk)"
                rows={4}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground/60 mt-1">Lagres automatisk</p>
            </div>

            {/* Action points */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Action points</p>
              {actionPoints?.map((ap) => (
                <ActionPointRow key={ap.id} ap={ap} members={members || []} onUpdate={updateActionPoint} onDelete={deleteActionPoint} />
              ))}
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={addActionPoint}>
                <Plus className="h-4 w-4 mr-1" /> Action point
              </Button>
            </div>

            {/* Control buttons */}
            <div className="flex gap-2 pt-2 flex-wrap border-t border-border">
              {!isPast && status === "upcoming" && (
                <Button size="sm" className="h-8 text-sm" onClick={startMeeting}>
                  <Play className="h-4 w-4 mr-1" /> Start møte
                </Button>
              )}
              {!isPast && status === "in_progress" && (
                <Button size="sm" variant="destructive" className="h-8 text-sm" onClick={endMeeting}>
                  <Square className="h-4 w-4 mr-1" /> Avslutt møte
                </Button>
              )}
              <Popover open={showReschedule} onOpenChange={setShowReschedule}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm">
                    <CalendarDays className="h-4 w-4 mr-1" /> Flytt møte
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Velg ny dato</p>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" className="h-8 text-sm w-full" onClick={() => rescheduleMeeting(newDate)} disabled={!newDate}>
                      Flytt hit
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" className="h-8 text-sm text-destructive hover:text-destructive" onClick={cancelMeeting}>
                <X className="h-4 w-4 mr-1" /> Avlys
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-sm" onClick={exportToProcessLog}>
                <Copy className="h-4 w-4 mr-1" /> Eksporter
              </Button>
            </div>
          </div>
        )}

        {/* Cancelled state */}
        {expanded && isCancelled && (
          <div className="px-5 pb-4 border-t border-border pt-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-sm" onClick={uncancelMeeting}>
                <Play className="h-4 w-4 mr-1" /> Gjenopprett møte
              </Button>
              <Popover open={showReschedule} onOpenChange={setShowReschedule}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-sm">
                    <CalendarDays className="h-4 w-4 mr-1" /> Flytt til ny dato
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Velg ny dato</p>
                    <Input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button size="sm" className="h-8 text-sm w-full" onClick={() => { rescheduleMeeting(newDate); uncancelMeeting(); }} disabled={!newDate}>
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

function ActionPointRow({ ap, members, onUpdate, onDelete }: { ap: any; members: any[]; onUpdate: (id: string, u: any) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(ap.title);

  useEffect(() => { setTitle(ap.title); }, [ap.title]);

  useEffect(() => {
    if (title === ap.title) return;
    const t = setTimeout(() => { onUpdate(ap.id, { title }); }, 800);
    return () => clearTimeout(t);
  }, [title, ap.title, ap.id, onUpdate]);

  const handleBlur = () => {
    if (title !== ap.title) onUpdate(ap.id, { title });
  };

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={ap.is_completed}
        onCheckedChange={(v) => onUpdate(ap.id, { is_completed: !!v })}
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleBlur}
        placeholder="Beskrivelse..."
        className="h-9 text-sm flex-1"
      />
      <Select value={ap.assignee_id || "none"} onValueChange={(v) => onUpdate(ap.id, { assignee_id: v === "none" ? null : v })}>
        <SelectTrigger className="h-9 text-sm w-32">
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
        className="h-9 text-sm w-36"
      />
      <button
        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        onClick={() => onDelete(ap.id)}
        title="Slett action point"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
