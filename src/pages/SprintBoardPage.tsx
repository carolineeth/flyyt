import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { toast } from "sonner";
import { Columns3, Plus, StickyNote, GripVertical } from "lucide-react";
import type { Sprint, SprintItem, BacklogItem } from "@/lib/types";

const columns = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;

const typeColors: Record<string, string> = {
  user_story: "bg-blue-100 text-blue-700",
  technical: "bg-blue-100 text-blue-700",
  design: "bg-pink-100 text-pink-700",
  report: "bg-purple-100 text-purple-700",
  admin: "bg-gray-100 text-gray-600",
};

export default function SprintBoardPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const activeSprint = sprints?.find((s) => s.is_active) ?? sprints?.[0];
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const currentSprintId = selectedSprintId ?? activeSprint?.id;
  const currentSprint = sprints?.find((s) => s.id === currentSprintId);

  const { data: sprintItems } = useQuery<(SprintItem & { backlog_item: BacklogItem })[]>({
    queryKey: ["sprint_items", currentSprintId],
    enabled: !!currentSprintId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items")
        .select("*, backlog_item:backlog_items(*)")
        .eq("sprint_id", currentSprintId!)
        .order("column_order");
      if (error) throw error;
      return data as any;
    },
  });

  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "" });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const wipLimit = 2;

  const createSprintMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sprints").insert({
        name: newSprint.name,
        goal: newSprint.goal || null,
        start_date: newSprint.start_date,
        end_date: newSprint.end_date,
        is_active: !sprints?.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setShowCreateSprint(false);
      setNewSprint({ name: "", goal: "", start_date: "", end_date: "" });
      toast.success("Sprint opprettet");
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newColumn }: { itemId: string; newColumn: string }) => {
      const { error } = await supabase.from("sprint_items").update({ column_name: newColumn }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint_items"] }),
  });

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => setDragOverCol(null);

  const handleDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    setDraggedItemId(null);
    setDragOverCol(null);
    if (!itemId) return;
    const item = sprintItems?.find((i) => i.id === itemId);
    if (item && item.column_name !== colKey) {
      moveItemMutation.mutate({ itemId, newColumn: colKey });
    }
  }, [sprintItems, moveItemMutation]);

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Sprint Board"
        description="ScrumBan-board — dra kort mellom kolonner for å oppdatere status"
        action={
          <Button size="sm" onClick={() => setShowCreateSprint(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ny sprint
          </Button>
        }
      />

      {sprints && sprints.length > 0 && (
        <div className="flex items-center gap-3">
          <Select value={currentSprintId ?? ""} onValueChange={setSelectedSprintId}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="Velg sprint" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.is_active ? " (aktiv)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentSprint?.goal && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5" />
              {currentSprint.goal}
            </div>
          )}
        </div>
      )}

      {!currentSprintId ? (
        <EmptyState
          icon={Columns3}
          title="Ingen sprinter ennå"
          description="Opprett din første sprint for å komme i gang med boardet"
          actionLabel="Opprett sprint"
          onAction={() => setShowCreateSprint(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {columns.map((col) => {
            const colItems = sprintItems?.filter((i) => i.column_name === col.key) ?? [];
            const isOverWip = col.key === "in_progress" && colItems.length > wipLimit * (members?.length ?? 6);
            const isDragTarget = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                className="space-y-2"
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-colors ${
                  isOverWip ? "bg-destructive/10 border border-destructive/30" :
                  isDragTarget ? "bg-primary/10 border border-primary/30" : "bg-muted"
                }`}>
                  <span className="text-xs font-medium">{col.label}</span>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">{colItems.length}</Badge>
                </div>
                {isOverWip && (
                  <p className="text-[10px] text-destructive px-1">⚠️ WIP-limit overskredet</p>
                )}
                <div className={`space-y-2 min-h-[120px] rounded-lg p-1 transition-colors ${
                  isDragTarget ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : ""
                }`}>
                  {colItems.map((item) => {
                    const assignee = members?.find((m) => m.id === item.backlog_item?.assignee_id);
                    const isDragging = draggedItemId === item.id;
                    return (
                      <Card
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={() => { setDraggedItemId(null); setDragOverCol(null); }}
                        className={`shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                          isDragging ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/40" />
                            <span className="text-sm font-medium leading-snug flex-1">{item.backlog_item?.title}</span>
                            {assignee && <MemberAvatar member={assignee} />}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap pl-5">
                            {item.backlog_item?.type && (
                              <Badge className={`text-[9px] ${typeColors[item.backlog_item.type] ?? ""}`}>
                                {item.backlog_item.type}
                              </Badge>
                            )}
                            {item.backlog_item?.estimate && (
                              <Badge variant="outline" className="text-[9px] tabular-nums">{item.backlog_item.estimate}sp</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateSprint} onOpenChange={setShowCreateSprint}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny sprint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Navn</Label><Input value={newSprint.name} onChange={(e) => setNewSprint((p) => ({ ...p, name: e.target.value }))} placeholder="Sprint 1" /></div>
            <div><Label>Sprint Goal</Label><Textarea value={newSprint.goal} onChange={(e) => setNewSprint((p) => ({ ...p, goal: e.target.value }))} placeholder="Hva skal oppnås?" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Startdato</Label><Input type="date" value={newSprint.start_date} onChange={(e) => setNewSprint((p) => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Sluttdato</Label><Input type="date" value={newSprint.end_date} onChange={(e) => setNewSprint((p) => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateSprint(false)}>Avbryt</Button>
            <Button onClick={() => createSprintMutation.mutate()} disabled={!newSprint.name || !newSprint.start_date || !newSprint.end_date}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
