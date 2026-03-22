import { useState, useCallback, useMemo } from "react";
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
import { toast } from "sonner";
import { ListTodo, Plus, GripVertical } from "lucide-react";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { BacklogItem, Sprint } from "@/lib/types";
import { logBacklogChange } from "@/lib/backlogChangelog";

const typeLabels: Record<string, string> = {
  user_story: "Brukerhistorie",
  technical: "Teknisk oppgave",
  design: "Design",
  report: "Rapport",
  admin: "Admin",
};
const typeColors: Record<string, string> = {
  user_story: "bg-[#E6F1FB] text-[#0C447C]",
  technical: "bg-[#E1F5EE] text-[#085041]",
  design: "bg-[#FBEAF0] text-[#72243E]",
  report: "bg-[#EEEDFE] text-[#3C3489]",
  admin: "bg-[#F1EFE8] text-[#444441]",
};
const priorityLabels: Record<string, string> = {
  must_have: "Må ha",
  should_have: "Bør ha",
  nice_to_have: "Fint å ha",
};
const priorityDot: Record<string, string> = {
  must_have: "bg-red-500",
  should_have: "bg-yellow-500",
  nice_to_have: "bg-gray-400",
};
const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  sprint_ready: "Sprint Ready",
  in_sprint: "I Sprint",
  done: "Done",
};
const statusOrder = ["backlog", "sprint_ready", "in_sprint", "done"];
const storyPoints = [1, 2, 3, 5, 8, 13];

export default function BacklogPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: items, isLoading } = useQuery<BacklogItem[]>({
    queryKey: ["backlog_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backlog_items").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });
  const { data: sprintItems } = useQuery({
    queryKey: ["sprint_items_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_items").select("backlog_item_id, sprint_id");
      if (error) throw error;
      return data;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterEpic, setFilterEpic] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    title: "", description: "", type: "user_story", priority: "should_have",
    estimate: null as number | null, epic: "", assignee_id: null as string | null,
    sprint_id: null as string | null, labels: "" as string,
  });

  const existingEpics = useMemo(() => {
    const epics = new Set(items?.map((i) => i.epic).filter(Boolean) as string[]);
    return Array.from(epics);
  }, [items]);

  // Map backlog_item_id -> sprint name
  const itemSprintMap = useMemo(() => {
    const map: Record<string, string> = {};
    sprintItems?.forEach((si) => {
      const sprint = sprints?.find((s) => s.id === si.sprint_id);
      if (sprint) map[si.backlog_item_id] = sprint.name;
    });
    return map;
  }, [sprintItems, sprints]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("backlog_items").insert({
        item_id: "",
        title: newItem.title,
        description: newItem.description || null,
        type: newItem.type,
        priority: newItem.priority,
        estimate: newItem.estimate,
        epic: newItem.epic || null,
        assignee_id: newItem.assignee_id,
        labels: newItem.labels ? newItem.labels.split(",").map((l) => l.trim()).filter(Boolean) : [],
      }).select().single();
      if (error) throw error;
      if (data) {
        await logBacklogChange({ backlogItemId: data.id, changeType: "created", newValue: data.title });
      }
      // If sprint selected, add to sprint_items
      if (newItem.sprint_id && data) {
        await supabase.from("sprint_items").insert({
          sprint_id: newItem.sprint_id,
          backlog_item_id: data.id,
          column_name: "todo",
        });
        await logBacklogChange({ backlogItemId: data.id, changeType: "added_to_sprint", newValue: newItem.sprint_id });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items_all"] });
      setShowCreate(false);
      setNewItem({ title: "", description: "", type: "user_story", priority: "should_have", estimate: null, epic: "", assignee_id: null, sprint_id: null, labels: "" });
      toast.success("Backlog-item opprettet");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus?: string }) => {
      const { error } = await supabase.from("backlog_items").update({ status }).eq("id", id);
      if (error) throw error;
      await logBacklogChange({ backlogItemId: id, changeType: "status_changed", oldValue: oldStatus, newValue: status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlog_items"] }),
  });

  const updateSortMutation = useMutation({
    mutationFn: async ({ id, sort_order }: { id: string; sort_order: number }) => {
      const { error } = await supabase.from("backlog_items").update({ sort_order }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backlog_items"] }),
  });

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
  };
  const handleDragEnd = () => { setDraggedItemId(null); setDragOverStatus(null); };

  const handleBoardDrop = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    setDraggedItemId(null);
    setDragOverStatus(null);
    if (!itemId) return;
    const item = items?.find((i) => i.id === itemId);
    if (item && item.status !== status) {
      updateStatusMutation.mutate({ id: itemId, status });
    }
  }, [items, updateStatusMutation]);

  const handleListDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData("text/plain");
    setDraggedItemId(null);
    if (!dragId || dragId === targetId || !items) return;
    const targetItem = items.find((i) => i.id === targetId);
    if (targetItem) updateSortMutation.mutate({ id: dragId, sort_order: targetItem.sort_order });
  }, [items, updateSortMutation]);

  const priorityOrder: Record<string, number> = { must_have: 0, should_have: 1, nice_to_have: 2 };

  const filtered = items?.filter((i) => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterPriority !== "all" && i.priority !== filterPriority) return false;
    if (filterEpic !== "all" && i.epic !== filterEpic) return false;
    return true;
  })?.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return (a.epic ?? "").localeCompare(b.epic ?? "");
  });

  const renderItemCard = (item: BacklogItem, compact = false) => {
    const assignee = members?.find((m) => m.id === item.assignee_id);
    const isDragging = draggedItemId === item.id;
    const sprintName = itemSprintMap[item.id];
    return (
      <Card
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => handleListDrop(e, item.id)}
        className={`transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40 scale-95" : "hover:shadow-sm"}`}
      >
        <CardContent className={`${compact ? "p-2.5" : "py-3 px-4"} flex items-center gap-2`}>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          {!compact && <span className="text-xs text-muted-foreground font-mono w-14 shrink-0">{item.item_id}</span>}
          <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.priority] ?? "bg-gray-400"}`} title={priorityLabels[item.priority]} />
          <Badge className={`text-[9px] shrink-0 ${typeColors[item.type] ?? ""}`}>
            {compact ? item.type.slice(0, 3) : typeLabels[item.type]}
          </Badge>
          <span className={`${compact ? "text-xs" : "text-sm"} font-medium flex-1 min-w-0 truncate`}>{item.title}</span>
          {item.estimate && (
            <span className="h-5 w-5 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center shrink-0 tabular-nums">{item.estimate}</span>
          )}
          {sprintName ? (
            <Badge className="text-[9px] bg-green-100 text-green-700 shrink-0">{sprintName}</Badge>
          ) : !compact ? (
            <Badge variant="outline" className="text-[9px] text-muted-foreground shrink-0">Ikke i sprint</Badge>
          ) : null}
          {assignee && <MemberAvatar member={assignee} />}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Product Backlog"
        description="Dra elementer for å endre rekkefølge eller status"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Legg til
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap items-center">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statuser</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Prioritet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle prioriteter</SelectItem>
            {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEpic} onValueChange={setFilterEpic}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Epic" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle epics</SelectItem>
            {existingEpics.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex rounded-md border border-border overflow-hidden">
          <button className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} onClick={() => setViewMode("list")}>Liste</button>
          <button className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === "board" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} onClick={() => setViewMode("board")}>Board</button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : !filtered?.length ? (
        <EmptyState icon={ListTodo} title="Ingen items i backlog" description="Opprett det første backlog-itemet for å komme i gang" actionLabel="Legg til item" onAction={() => setShowCreate(true)} />
      ) : viewMode === "list" ? (
        <div className="space-y-1.5">{filtered.map((item) => renderItemCard(item))}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {statusOrder.map((status) => {
            const colItems = filtered?.filter((i) => i.status === status) ?? [];
            const isOver = dragOverStatus === status;
            return (
              <div key={status} className="space-y-2"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStatus(status); }}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={(e) => handleBoardDrop(e, status)}
              >
                <div className={`flex items-center justify-between px-2 py-1.5 rounded-md transition-colors ${isOver ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                  <span className="text-xs font-medium">{statusLabels[status]}</span>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">{colItems.length}</Badge>
                </div>
                <div className={`space-y-1.5 min-h-[100px] rounded-lg p-1 transition-colors ${isOver ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : ""}`}>
                  {colItems.map((item) => renderItemCard(item, true))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nytt backlog-item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tittel *</Label><Input value={newItem.title} onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))} placeholder="Kort beskrivende tittel" /></div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                placeholder={newItem.type === "user_story" ? "Som [rolle] ønsker jeg [mål] for å [effekt]" : "Beskriv oppgaven"} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={newItem.type} onValueChange={(v) => setNewItem((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioritet</Label>
                <Select value={newItem.priority} onValueChange={(v) => setNewItem((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Estimat (Story Points)</Label>
              <div className="flex gap-2 mt-1">
                {storyPoints.map((sp) => (
                  <button key={sp} onClick={() => setNewItem((p) => ({ ...p, estimate: p.estimate === sp ? null : sp }))}
                    className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${newItem.estimate === sp ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {sp}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ansvarlig</Label>
                <Select value={newItem.assignee_id ?? ""} onValueChange={(v) => setNewItem((p) => ({ ...p, assignee_id: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                  <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sprint</Label>
                <Select value={newItem.sprint_id ?? "none"} onValueChange={(v) => setNewItem((p) => ({ ...p, sprint_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ikke i sprint</SelectItem>
                    {sprints?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Epic/Kategori</Label>
              <Input value={newItem.epic} onChange={(e) => setNewItem((p) => ({ ...p, epic: e.target.value }))}
                placeholder="f.eks. Kartvisning, UX Research" list="epic-suggestions" />
              <datalist id="epic-suggestions">
                {existingEpics.map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
            <div>
              <Label>Labels (kommaseparert)</Label>
              <Input value={newItem.labels} onChange={(e) => setNewItem((p) => ({ ...p, labels: e.target.value }))} placeholder="frontend, api, bug" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newItem.title || createMutation.isPending}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
