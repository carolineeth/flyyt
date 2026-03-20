import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubSessionItems } from "@/hooks/useMeetingCalendar";
import { useActivityCatalog, useActivityRegistrations } from "@/hooks/useActivityCatalog";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, CheckCircle2, Link2 } from "lucide-react";

const typeLabels: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  daily_standup: "Daily Standup",
  veiledermøte: "Veiledermøte",
  mobb_programmering: "Mobb-programmering",
  workshop: "Workshop",
  annet: "Annet",
};

const typeBorderColors: Record<string, string> = {
  sprint_planning: "border-l-blue-500",
  sprint_review: "border-l-blue-500",
  retrospective: "border-l-rose-500",
  daily_standup: "border-l-green-500",
  veiledermøte: "border-l-teal-500",
  mobb_programmering: "border-l-rose-500",
  workshop: "border-l-rose-500",
  annet: "border-l-gray-400",
};

// Map sub-session types to activity_catalog meeting_type
const activityMeetingTypeMap: Record<string, string> = {
  sprint_planning: "sprint_planning",
  sprint_review: "sprint_review",
  daily_standup: "daily_standup",
  veiledermøte: "veiledermøte",
};

interface SubSessionBlockProps {
  subSession: any;
  meetingStatus: string;
  meetingId: string;
  meetingDate?: string;
  meetingParticipants?: string[];
  onDelete: () => void;
}

export function SubSessionBlock({ subSession, meetingStatus, meetingId, meetingDate, meetingParticipants, onDelete }: SubSessionBlockProps) {
  const qc = useQueryClient();
  const { data: items } = useSubSessionItems(subSession.id);
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const [notes, setNotes] = useState(subSession.notes || "");
  const [newItem, setNewItem] = useState("");

  useEffect(() => { setNotes(subSession.notes || ""); }, [subSession.notes]);

  const saveNotes = useCallback(async (val: string) => {
    await supabase.from("meeting_sub_sessions" as any).update({ notes: val } as any).eq("id", subSession.id);
  }, [subSession.id]);

  useEffect(() => {
    const t = setTimeout(() => { if (notes !== (subSession.notes || "")) saveNotes(notes); }, 500);
    return () => clearTimeout(t);
  }, [notes, subSession.notes, saveNotes]);

  const addItem = async () => {
    if (!newItem.trim()) return;
    const order = (items?.length ?? 0);
    await supabase.from("meeting_sub_session_items" as any).insert({
      sub_session_id: subSession.id,
      content: newItem.trim(),
      sort_order: order,
    } as any);
    setNewItem("");
    qc.invalidateQueries({ queryKey: ["meeting_sub_session_items", subSession.id] });
  };

  const borderColor = typeBorderColors[subSession.type] || "border-l-gray-400";

  // Activity linking logic
  const meetingType = activityMeetingTypeMap[subSession.type];
  const matchingCatalog = meetingType ? catalog?.find((c) => c.meeting_type === meetingType) : null;
  const existingRegistration = matchingCatalog
    ? registrations?.find((r) => r.linked_sub_session_id === subSession.id)
    : null;
  const allLinkedRegs = matchingCatalog
    ? registrations?.filter((r) => r.catalog_id === matchingCatalog.id && r.status === "completed") ?? []
    : [];

  const linkToActivityPlan = async () => {
    if (!matchingCatalog) return;

    // Calculate week number from meeting date
    let completedWeek: number | null = null;
    if (meetingDate) {
      const d = new Date(meetingDate + "T00:00:00");
      const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      completedWeek = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }

    const occurrenceNumber = allLinkedRegs.length + 1;

    const { data: reg, error } = await (supabase.from("activity_registrations" as any).insert({
      catalog_id: matchingCatalog.id,
      status: "completed",
      completed_date: meetingDate || null,
      completed_week: completedWeek,
      occurrence_number: occurrenceNumber,
      linked_meeting_id: meetingId,
      linked_sub_session_id: subSession.id,
      description: notes || null,
    } as any).select().single() as any);

    if (error) { toast.error(error.message); return; }

    // Add meeting participants as activity participants
    if (reg && meetingParticipants && meetingParticipants.length > 0) {
      await (supabase.from("activity_registration_participants" as any).insert(
        meetingParticipants.map((memberId) => ({
          registration_id: (reg as any).id,
          member_id: memberId,
        }))
      ) as any);
    }

    qc.invalidateQueries({ queryKey: ["activity_registrations"] });
    qc.invalidateQueries({ queryKey: ["activity_registration_participants"] });
    toast.success(`✓ ${typeLabels[subSession.type]} koblet til aktivitetsplanen`);
  };

  return (
    <div className={`border-l-[3px] ${borderColor} bg-muted/30 rounded-r-md p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{typeLabels[subSession.type] || subSession.type}</Badge>
          <span className="text-sm font-medium">{subSession.title}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Sub-session agenda items */}
      {items && items.length > 0 && (
        <ul className="space-y-1 text-sm">
          {items.map((item: any) => (
            <li key={item.id} className="flex items-center gap-2 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
              {item.content}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Legg til punkt..."
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addItem}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notater for denne delen..."
        rows={2}
        className="text-xs"
      />

      {/* Activity plan link */}
      {matchingCatalog && (
        <div className="pt-1">
          {existingRegistration ? (
            <div className="flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Registrert i aktivitetsplanen (uke {existingRegistration.completed_week})</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={linkToActivityPlan}
            >
              <Link2 className="h-3 w-3 mr-1" />
              Koble til aktivitetsplan
              {matchingCatalog.max_occurrences > 1 && (
                <span className="ml-1 text-muted-foreground">
                  ({allLinkedRegs.length}/{matchingCatalog.max_occurrences})
                </span>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
