import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface MeetingData {
  id: string;
  type: string;
  date: string;
  meeting_date: string | null;
  notes: string | null;
  week_number: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingData | null;
  agendaItems: { id: string; title: string; is_completed: boolean }[];
  actionPoints: { id: string; title: string; is_completed: boolean }[];
}

const typeLabels: Record<string, string> = {
  standup: "Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  advisor: "Veiledermøte",
  other: "Annet",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

export function MeetingSlideOver({ open, onOpenChange, meeting, agendaItems, actionPoints }: Props) {
  if (!meeting) return null;

  const exportText = () => {
    const text = [
      `${typeLabels[meeting.type] || meeting.type} — ${formatDate(meeting.meeting_date || meeting.date)}`,
      meeting.week_number ? `Uke ${meeting.week_number}` : "",
      "",
      agendaItems.length ? "Agenda:" : "",
      ...agendaItems.map((a) => `${a.is_completed ? "✓" : "○"} ${a.title}`),
      "",
      actionPoints.length ? "Action points:" : "",
      ...actionPoints.map((a) => `${a.is_completed ? "✓" : "○"} ${a.title}`),
      "",
      meeting.notes ? "Notater:" : "",
      meeting.notes || "",
    ].filter((l) => l !== undefined).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Kopiert til utklippstavlen");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:max-w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">{typeLabels[meeting.type] || meeting.type}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(meeting.meeting_date || meeting.date)}</span>
            {meeting.week_number && <Badge variant="secondary" className="text-[10px]">Uke {meeting.week_number}</Badge>}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {agendaItems.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agenda ({agendaItems.length})</label>
              <ul className="mt-1 space-y-1">
                {agendaItems.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span className={`text-xs ${a.is_completed ? "text-green-500" : "text-muted-foreground"}`}>
                      {a.is_completed ? "✓" : "○"}
                    </span>
                    <span className={a.is_completed ? "" : "text-muted-foreground"}>{a.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionPoints.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action points ({actionPoints.length})</label>
              <ul className="mt-1 space-y-1">
                {actionPoints.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm">
                    <span className={`text-xs ${a.is_completed ? "text-green-500" : "text-muted-foreground"}`}>
                      {a.is_completed ? "✓" : "○"}
                    </span>
                    <span className={a.is_completed ? "" : "text-muted-foreground"}>{a.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meeting.notes && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notater</label>
              <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded p-3">{meeting.notes}</div>
            </div>
          )}

          {!meeting.notes && agendaItems.length === 0 && actionPoints.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen innhold registrert for dette møtet</p>
          )}
        </div>

        <SheetFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={exportText} className="w-full">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Eksporter dette møtet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
