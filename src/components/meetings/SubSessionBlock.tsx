import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubSessionItems } from "@/hooks/useMeetingCalendar";
import { useActivityCatalog, useActivityRegistrations, useUpdateRegistration } from "@/hooks/useActivityCatalog";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, CheckCircle2, FileText } from "lucide-react";

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
  retrospective: "retrospective",
  daily_standup: "daily_standup",
  veiledermøte: "veiledermøte",
  mobb_programmering: "mobb_programmering",
  workshop: "workshop",
};

interface SubSessionBlockProps {
  subSession: any;
  meetingStatus: string;
  meetingId: string;
  meetingDate?: string;
  meetingParticipants?: string[];
  onDelete: () => void;
}

export function SubSessionBlock({ subSession, meetingStatus: _meetingStatus, meetingId: _meetingId, meetingDate: _meetingDate, meetingParticipants: _meetingParticipants, onDelete }: SubSessionBlockProps) {
  const qc = useQueryClient();
  const { data: items } = useSubSessionItems(subSession.id);
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const updateReg = useUpdateRegistration();
  const [notes, setNotes] = useState(subSession.notes || "");
  const [newItem, setNewItem] = useState("");
  const [prosesslogg, setProsesslogg] = useState({
    timing_rationale: "",
    description: "",
    experiences: "",
    reflections: "",
  });

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

  // Activity linking
  const meetingType = activityMeetingTypeMap[subSession.type];
  const matchingCatalog = meetingType ? catalog?.find((c) => c.meeting_type === meetingType) : null;
  const existingRegistration = matchingCatalog
    ? registrations?.find((r) => r.linked_sub_session_id === subSession.id)
    : null;

  // Sync prosesslogg state from registration (on first load / registration change)
  useEffect(() => {
    if (existingRegistration) {
      setProsesslogg({
        timing_rationale: existingRegistration.timing_rationale || "",
        description: existingRegistration.description || "",
        experiences: existingRegistration.experiences || "",
        reflections: existingRegistration.reflections || "",
      });
    }
  }, [existingRegistration?.id]);

  // Debounced auto-save prosesslogg fields → activity_registration
  useEffect(() => {
    if (!existingRegistration) return;
    const reg = existingRegistration;
    const t = setTimeout(() => {
      const changed =
        prosesslogg.timing_rationale !== (reg.timing_rationale || "") ||
        prosesslogg.description !== (reg.description || "") ||
        prosesslogg.experiences !== (reg.experiences || "") ||
        prosesslogg.reflections !== (reg.reflections || "");
      if (changed) {
        updateReg.mutate({
          id: reg.id,
          timing_rationale: prosesslogg.timing_rationale || null,
          description: prosesslogg.description || null,
          experiences: prosesslogg.experiences || null,
          reflections: prosesslogg.reflections || null,
        } as any);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [
    prosesslogg.timing_rationale,
    prosesslogg.description,
    prosesslogg.experiences,
    prosesslogg.reflections,
    existingRegistration?.timing_rationale,
    existingRegistration?.description,
    existingRegistration?.experiences,
    existingRegistration?.reflections,
  ]);

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

      {/* Activity registration status + prosesslogg */}
      {matchingCatalog && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          {existingRegistration ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Registrert i aktivitetsplanen (uke {existingRegistration.completed_week})</span>
              </div>

              {/* Prosesslogg fields */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">Prosesslogg</span>
                  <span className="text-[10px] text-muted-foreground/50">· lagres automatisk</span>
                </div>

                <Textarea
                  value={prosesslogg.timing_rationale}
                  onChange={(e) => setProsesslogg(p => ({ ...p, timing_rationale: e.target.value }))}
                  placeholder="Hvorfor dette tidspunktet?"
                  rows={2}
                  className="text-xs"
                />
                <div>
                  <Textarea
                    value={prosesslogg.description}
                    onChange={(e) => setProsesslogg(p => ({ ...p, description: e.target.value }))}
                    placeholder="Gjennomføring..."
                    rows={2}
                    className="text-xs"
                  />
                  {!prosesslogg.description && notes && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">Møtenotater finnes.</span>
                      <button
                        className="text-[10px] text-primary underline"
                        onClick={() => setProsesslogg(p => ({ ...p, description: notes }))}
                      >
                        Bruk som gjennomføring
                      </button>
                    </div>
                  )}
                </div>
                <Textarea
                  value={prosesslogg.experiences}
                  onChange={(e) => setProsesslogg(p => ({ ...p, experiences: e.target.value }))}
                  placeholder="Erfaringer..."
                  rows={2}
                  className="text-xs"
                />
                <Textarea
                  value={prosesslogg.reflections}
                  onChange={(e) => setProsesslogg(p => ({ ...p, reflections: e.target.value }))}
                  placeholder="Refleksjoner..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Kobler til aktivitetsplanen automatisk ved neste møte.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
