import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { eachDayOfInterval, parseISO, format } from "date-fns";
import type { Sprint, BacklogItem, SprintItem } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: Sprint;
  sprintItems: (SprintItem & { backlog_item: BacklogItem })[];
  nextSprints: Sprint[];
  members: { id: string; name: string }[];
}

export default function CloseSprintModal({ open, onOpenChange, sprint, sprintItems, nextSprints, members }: Props) {
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [incompleteAction, setIncompleteAction] = useState<"next_sprint" | "backlog">("backlog");
  const [targetSprintId, setTargetSprintId] = useState<string>(nextSprints[0]?.id ?? "");

  const doneItems = useMemo(() => sprintItems.filter((i) => i.column_name === "done"), [sprintItems]);
  const incompleteItems = useMemo(() => sprintItems.filter((i) => i.column_name !== "done"), [sprintItems]);

  const closeMutation = useMutation({
    mutationFn: async () => {
      // Build snapshot
      const totalItems = sprintItems.length;
      const completedItems = doneItems.length;
      const totalPoints = sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
      const completedPoints = doneItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);

      // Items by type
      const itemsByType: Record<string, number> = {};
      doneItems.forEach((i) => {
        const t = i.backlog_item?.type ?? "other";
        itemsByType[t] = (itemsByType[t] ?? 0) + 1;
      });

      // Items by person — keyed by member UUID (or "Ufordelt" for unassigned)
      const itemsByPerson: Record<string, { assigned: number; completed: number; points: number }> = {};
      sprintItems.forEach((i) => {
        const assignees: string[] = (i.backlog_item as any)?.collaborator_ids?.length > 0
          ? (i.backlog_item as any).collaborator_ids
          : [];
        const keys = assignees.length > 0 ? assignees : ["Ufordelt"];
        keys.forEach((key) => {
          if (!itemsByPerson[key]) itemsByPerson[key] = { assigned: 0, completed: 0, points: 0 };
          itemsByPerson[key].assigned++;
          if (i.column_name === "done") {
            itemsByPerson[key].completed++;
            itemsByPerson[key].points += i.backlog_item?.estimate ?? 0;
          }
        });
      });

      // Burndown: retroactive calculation
      // Simple: spread points evenly, mark done items as removed at sprint end
      const days = eachDayOfInterval({
        start: parseISO(sprint.start_date),
        end: parseISO(sprint.end_date),
      });
      const dailyBurndown = days.map((day, idx) => ({
        date: format(day, "dd/MM"),
        remaining: idx === days.length - 1 ? totalPoints - completedPoints : totalPoints,
        ideal: Math.round(totalPoints - (totalPoints / (days.length - 1)) * idx),
      }));
      // For a more realistic burndown, linearly reduce completed points over last 60% of sprint
      const startBurn = Math.floor(days.length * 0.4);
      for (let i = startBurn; i < days.length; i++) {
        const progress = (i - startBurn) / (days.length - 1 - startBurn);
        dailyBurndown[i].remaining = Math.round(totalPoints - completedPoints * progress);
      }

      // Save snapshot
      const { error: snapError } = await supabase.from("sprint_snapshots").insert({
        sprint_id: sprint.id,
        total_items: totalItems,
        completed_items: completedItems,
        total_points: totalPoints,
        completed_points: completedPoints,
        items_by_type: itemsByType,
        items_by_person: itemsByPerson,
        completed_item_titles: doneItems.map((i) => i.backlog_item?.title ?? ""),
        incomplete_item_titles: incompleteItems.map((i) => i.backlog_item?.title ?? ""),
        daily_burndown: dailyBurndown,
      });
      if (snapError) throw snapError;

      // Update sprint
      const { error: sprintError } = await supabase.from("sprints").update({
        is_active: false,
        completed_at: new Date().toISOString(),
        sprint_review_notes: reviewNotes || null,
      }).eq("id", sprint.id);
      if (sprintError) throw sprintError;

      // Handle incomplete items
      if (incompleteAction === "next_sprint" && targetSprintId) {
        for (const item of incompleteItems) {
          await supabase.from("sprint_items").update({
            sprint_id: targetSprintId,
            column_name: "todo",
          }).eq("id", item.id);
        }
      } else {
        // Move back to backlog — just delete sprint_items entries
        for (const item of incompleteItems) {
          await supabase.from("sprint_items").delete().eq("id", item.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_snapshots"] });
      qc.invalidateQueries({ queryKey: ["completed_sprints"] });
      onOpenChange(false);
      toast.success(`${sprint.name} avsluttet`);
    },
    onError: (e) => toast.error("Feil: " + (e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avslutt {sprint.name}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Fullførte items: <strong>{doneItems.length}</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Ufullførte: <strong>{incompleteItems.length}</strong>
            </div>
          </div>

          {incompleteItems.length > 0 && (
            <div>
              <Label>Ufullførte items</Label>
              <Select value={incompleteAction} onValueChange={(v) => setIncompleteAction(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Flytt tilbake til backlog</SelectItem>
                  <SelectItem value="next_sprint">Flytt til neste sprint</SelectItem>
                </SelectContent>
              </Select>
              {incompleteAction === "next_sprint" && nextSprints.length > 0 && (
                <Select value={targetSprintId} onValueChange={setTargetSprintId}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {nextSprints.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div>
            <Label>Sprint review-notater (valgfritt)</Label>
            <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3}
              placeholder="Hva ble demonstrert/diskutert?" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            {closeMutation.isPending ? "Avslutter..." : "Avslutt sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
