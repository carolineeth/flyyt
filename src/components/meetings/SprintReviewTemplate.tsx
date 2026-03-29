import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Clock } from "lucide-react";
import type { TeamMember, SprintItem, BacklogItem } from "@/lib/types";

interface Props {
  sprintId: string | null;
  members: TeamMember[];
  feedback: string;
  onFeedbackChange: (f: string) => void;
  readOnly?: boolean;
}

export function SprintReviewTemplate({ sprintId, members, feedback, onFeedbackChange, readOnly }: Props) {
  const { data: sprintItems } = useQuery<(SprintItem & { backlog_item: BacklogItem })[]>({
    queryKey: ["sprint_review_items", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items")
        .select("*, backlog_item:backlog_items(*)")
        .eq("sprint_id", sprintId!)
        .order("column_order");
      if (error) throw error;
      return data as any;
    },
  });

  const doneItems = sprintItems?.filter((i) => i.column_name === "done") ?? [];
  const notDoneItems = sprintItems?.filter((i) => i.column_name !== "done") ?? [];

  return (
    <div className="space-y-4">
      {/* Demonstrated items */}
      <div>
        <Label className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Demonstrert ({doneItems.length} items)
        </Label>
        {doneItems.length > 0 ? (
          <div className="space-y-1 mt-2">
            {doneItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/5 text-sm">
                <Checkbox checked disabled />
                <span className="flex-1">{item.backlog_item?.title}</span>
                {item.backlog_item?.estimate && (
                  <Badge variant="outline" className="text-[10px] tabular-nums">{item.backlog_item.estimate}sp</Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            {sprintId ? "Ingen items er markert som Done i denne sprinten" : "Velg en sprint for å se items"}
          </p>
        )}
      </div>

      {/* Not completed items */}
      {notDoneItems.length > 0 && (
        <div>
          <Label className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-warning" />
            Ikke fullført ({notDoneItems.length} items)
          </Label>
          <div className="space-y-1 mt-2">
            {notDoneItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-warning/5 text-sm">
                <Checkbox checked={false} disabled />
                <span className="flex-1">{item.backlog_item?.title}</span>
                <Badge variant="secondary" className="text-[10px]">{item.column_name}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div>
        <Label>Feedback fra veileder / produkteier</Label>
        <Textarea
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          readOnly={readOnly}
          placeholder="Tilbakemeldinger og kommentarer..."
          rows={4}
          className="mt-1"
        />
      </div>
    </div>
  );
}
