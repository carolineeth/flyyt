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
  members: { id: string; name: string; avatar_color?: string }[];
}

export default function CloseSprintModal({ open, onOpenChange, sprint, sprintItems, nextSprints, members }: Props) {
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [incompleteAction, setIncompleteAction] = useState<"next_sprint" | "backlog">("backlog");
  const [targetSprintId, setTargetSprintId] = useState<string>(nextSprints[0]?.id ?? "");

  const doneItems = useMemo(() => sprintItems.filter((i) => i.column_name === "done"), [sprintItems]);
  const incompleteItems = useMemo(() => sprintItems.filter((i) => i.column_name !== "done"), [sprintItems]);

  // Stats
  const totalPoints = useMemo(() => sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0), [sprintItems]);
  const completedPoints = useMemo(() => doneItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0), [doneItems]);
  const completionPct = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  // Per-person stats
  const personStats = useMemo(() => {
    const map: Record<string, { name: string; completed: number; points: number }> = {};
    doneItems.forEach((i) => {
      const assignees: string[] = (i.backlog_item as any)?.collaborator_ids?.length > 0
        ? (i.backlog_item as any).collaborator_ids
        : [];
      assignees.forEach((id) => {
        const m = members.find((m) => m.id === id);
        if (!map[id]) map[id] = { name: m?.name?.split(" ")[0] ?? "Ukjent", completed: 0, points: 0 };
        map[id].completed++;
        map[id].points += i.backlog_item?.estimate ?? 0;
      });
    });
    return Object.entries(map).sort(([, a], [, b]) => b.points - a.points);
  }, [doneItems, members]);

  const closeMutation = useMutation({
    mutationFn: async () => {
      // Build snapshot
      const totalItems = sprintItems.length;
      const completedItems = doneItems.length;

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

      // Burndown
      const days = eachDayOfInterval({
        start: parseISO(sprint.start_date),
        end: parseISO(sprint.end_date),
      });
      const dailyBurndown = days.map((day, idx) => ({
        date: format(day, "dd/MM"),
        remaining: idx === days.length - 1 ? totalPoints - completedPoints : totalPoints,
        ideal: Math.round(totalPoints - (totalPoints / (days.length - 1)) * idx),
      }));
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
          const { error: moveErr } = await supabase.from("sprint_items").update({
            sprint_id: targetSprintId,
            column_name: "todo",
          }).eq("id", item.id);
          if (moveErr) throw new Error("Kunne ikke flytte ufullført item");
        }
        // Activate target sprint
        const { error: actErr } = await supabase.from("sprints").update({ is_active: true }).eq("id", targetSprintId);
        if (actErr) throw new Error("Kunne ikke aktivere neste sprint");
      } else {
        for (const item of incompleteItems) {
          const { error: delErr } = await supabase.from("sprint_items").delete().eq("id", item.id);
          if (delErr) throw new Error("Kunne ikke fjerne ufullført item");
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
        <div className="space-y-4 text-sm">
          {/* Stats summary */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold">{completedPoints}</div>
                <div className="text-[11px] text-muted-foreground">SP levert</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{doneItems.length}<span className="text-muted-foreground font-normal text-sm">/{sprintItems.length}</span></div>
                <div className="text-[11px] text-muted-foreground">Items fullført</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{completionPct}%</div>
                <div className="text-[11px] text-muted-foreground">Completion</div>
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              {completionPct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${completionPct}%` }} />}
              {completionPct < 100 && <div className="bg-destructive/40 transition-all" style={{ width: `${100 - completionPct}%` }} />}
            </div>

            {/* Per person */}
            {personStats.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bidrag</p>
                {personStats.map(([id, data]) => {
                  const maxPts = Math.max(personStats[0]?.[1]?.points ?? 1, 1);
                  const member = members.find((m) => m.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="text-xs w-16 truncate">{data.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(data.points / maxPts) * 100}%`,
                          backgroundColor: member?.avatar_color ?? "hsl(var(--primary))",
                        }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground w-10 text-right">{data.points} SP</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {incompleteItems.length > 0 && (
            <div>
              <Label>Ufullførte items ({incompleteItems.length})</Label>
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
