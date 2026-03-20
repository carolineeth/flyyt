import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubSessionItems } from "@/hooks/useMeetingCalendar";
import { useActivities } from "@/hooks/useActivities";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, Trash2, Plus } from "lucide-react";

const typeLabels: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  veiledermøte: "Veiledermøte",
  mobb_programmering: "Mobb-programmering",
  workshop: "Workshop",
  annet: "Annet",
};

const typeBorderColors: Record<string, string> = {
  sprint_planning: "border-l-blue-500",
  sprint_review: "border-l-blue-500",
  retrospective: "border-l-rose-500",
  veiledermøte: "border-l-teal-500",
  mobb_programmering: "border-l-rose-500",
  workshop: "border-l-rose-500",
  annet: "border-l-gray-400",
};

interface SubSessionBlockProps {
  subSession: any;
  meetingStatus: string;
  onDelete: () => void;
}

export function SubSessionBlock({ subSession, meetingStatus, onDelete }: SubSessionBlockProps) {
  const qc = useQueryClient();
  const { data: items } = useSubSessionItems(subSession.id);
  const { data: activities } = useActivities();
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

  const linkActivity = async (activityId: string) => {
    await supabase.from("meeting_sub_sessions" as any)
      .update({ linked_activity_id: activityId === "none" ? null : activityId } as any)
      .eq("id", subSession.id);
    qc.invalidateQueries({ queryKey: ["meeting_sub_sessions", subSession.meeting_id] });
    toast.success("Koblet til aktivitet");
  };

  const borderColor = typeBorderColors[subSession.type] || "border-l-gray-400";

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

      {meetingStatus !== "completed" && (
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
      )}

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notater for denne delen..."
        rows={2}
        className="text-xs"
      />

      {/* Link to activity */}
      <div className="flex items-center gap-2">
        <Link2 className="h-3 w-3 text-muted-foreground" />
        <Select
          value={subSession.linked_activity_id || "none"}
          onValueChange={linkActivity}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue placeholder="Koble til aktivitet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ingen kobling</SelectItem>
            {activities?.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
