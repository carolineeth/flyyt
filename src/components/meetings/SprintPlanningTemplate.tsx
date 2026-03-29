import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember, BacklogItem, Sprint } from "@/lib/types";

interface Props {
  members: TeamMember[];
  participantIds: string[];
  sprintId: string | null;
  onSprintIdChange: (id: string) => void;
  capacity: Record<string, number>;
  onCapacityChange: (c: Record<string, number>) => void;
  selectedItemIds: string[];
  onSelectedItemsChange: (ids: string[]) => void;
  sprintGoal: string;
  onSprintGoalChange: (g: string) => void;
  readOnly?: boolean;
}

export function SprintPlanningTemplate({
  members, participantIds, sprintId, onSprintIdChange,
  capacity, onCapacityChange, selectedItemIds, onSelectedItemsChange,
  sprintGoal, onSprintGoalChange, readOnly
}: Props) {
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: readyItems } = useQuery<BacklogItem[]>({
    queryKey: ["backlog_ready"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backlog_items").select("*").in("status", ["sprint_ready", "backlog"]).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const participants = members.filter((m) => participantIds.includes(m.id));
  const totalCapacity = Object.values(capacity).reduce((s, v) => s + v, 0);
  const selectedItems = readyItems?.filter((i) => selectedItemIds.includes(i.id)) ?? [];
  const totalSP = selectedItems.reduce((s, i) => s + (i.estimate ?? 0), 0);
  const capPct = totalCapacity > 0 ? Math.min((totalSP / totalCapacity) * 100, 100) : 0;

  const toggleItem = (id: string) => {
    if (readOnly) return;
    onSelectedItemsChange(
      selectedItemIds.includes(id)
        ? selectedItemIds.filter((x) => x !== id)
        : [...selectedItemIds, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* Sprint goal */}
      <div>
        <Label>Sprint Goal</Label>
        <Textarea
          value={sprintGoal}
          onChange={(e) => onSprintGoalChange(e.target.value)}
          readOnly={readOnly}
          placeholder="Hva er målet for denne sprinten?"
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Capacity per person */}
      <div>
        <Label>Kapasitet per person (story points)</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {participants.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <MemberAvatar member={m} />
              <span className="text-sm truncate flex-1">{m.name.split(" ")[0]}</span>
              <Input
                type="number"
                min={0}
                value={capacity[m.id] ?? 0}
                onChange={(e) => onCapacityChange({ ...capacity, [m.id]: parseInt(e.target.value) || 0 })}
                readOnly={readOnly}
                className="w-16 h-8 text-sm tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>

      {/* SP progress */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium">Valgt vs. kapasitet</span>
          <span className={`text-sm font-bold tabular-nums ${totalSP > totalCapacity ? "text-destructive" : "text-primary"}`}>
            {totalSP} / {totalCapacity} SP
          </span>
        </div>
        <Progress value={capPct} className={`h-2 ${totalSP > totalCapacity ? "[&>div]:bg-destructive" : ""}`} />
      </div>

      {/* Items to pick */}
      <div>
        <Label>Velg items til sprint ({selectedItemIds.length} valgt)</Label>
        <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
          {readyItems?.map((item) => (
            <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer text-sm">
              <Checkbox
                checked={selectedItemIds.includes(item.id)}
                onCheckedChange={() => toggleItem(item.id)}
                disabled={readOnly}
              />
              <span className="flex-1 min-w-0 truncate">{item.title}</span>
              {item.estimate && (
                <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">{item.estimate}sp</Badge>
              )}
            </label>
          )) ?? <p className="text-sm text-muted-foreground">Ingen items med status &quot;Sprint Ready&quot;</p>}
        </div>
      </div>
    </div>
  );
}
