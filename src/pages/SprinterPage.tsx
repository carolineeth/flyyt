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
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Layers, Plus, GripVertical, Search, X, StickyNote, Settings2, History, StopCircle } from "lucide-react";
import type { Sprint, SprintItem, BacklogItem, Subtask } from "@/lib/types";
import SprintHistory from "@/components/sprints/SprintHistory";
import CloseSprintModal from "@/components/sprints/CloseSprintModal";

const columns = [
  { key: "todo", label: "To Do", color: "bg-muted" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-100" },
  { key: "review", label: "Review", color: "bg-amber-100" },
  { key: "done", label: "Done", color: "bg-green-100" },
] as const;

const typeLabels: Record<string, string> = {
  user_story: "Brukerhistorie", technical: "Teknisk oppgave", design: "Design",
};
const typeColors: Record<string, string> = {
  user_story: "bg-[#E6F1FB] text-[#0C447C]",
  technical: "bg-[#E1F5EE] text-[#085041]",
  design: "bg-[#FBEAF0] text-[#72243E]",
};
const priorityLabels: Record<string, string> = {
  must_have: "Må ha", should_have: "Bør ha", nice_to_have: "Fint å ha",
};
const priorityDot: Record<string, string> = {
  must_have: "bg-red-500", should_have: "bg-yellow-500", nice_to_have: "bg-gray-400",
};
const priorityOrder: Record<string, number> = { must_have: 0, should_have: 1, nice_to_have: 2 };
const storyPoints = [1, 2, 3, 5, 8, 13];

export default function SprinterPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();

  // Data queries
  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ["sprints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprints").select("*").order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBacklogItems } = useQuery<BacklogItem[]>({
    queryKey: ["backlog_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backlog_items").select("*").order("sort_order");
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

  // Fetch ALL sprint item IDs (across all sprints) so backlog excludes them all
  const { data: allSprintItemIds } = useQuery<string[]>({
    queryKey: ["all_sprint_backlog_ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_items").select("backlog_item_id");
      if (error) throw error;
      return data.map((r) => r.backlog_item_id);
    },
  });

  const { data: subtasks } = useQuery<Subtask[]>({
    queryKey: ["subtasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subtasks").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // State
  const [pageView, setPageView] = useState<"board" | "history">("board");
  const [showCloseSprint, setShowCloseSprint] = useState(false);
  const [activeTab, setActiveTab] = useState<"backlog" | "sprint">("backlog");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [backlogSearch, setBacklogSearch] = useState("");
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "" });
  const [planningMode, setPlanningMode] = useState(false);
  const [planningSelected, setPlanningSelected] = useState<Set<string>>(new Set());
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<"backlog" | "sprint" | null>(null);
  const [inlineAddCol, setInlineAddCol] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [backlogInlineTitle, setBacklogInlineTitle] = useState("");
  const [detailItem, setDetailItem] = useState<BacklogItem | null>(null);
  const [detailSprintItemId, setDetailSprintItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Computed
  const sprintItemIds = useMemo(() => new Set(allSprintItemIds ?? []), [allSprintItemIds]);

  const backlogFiltered = useMemo(() => {
    return (allBacklogItems ?? [])
      .filter((i) => !sprintItemIds.has(i.id))
      .filter((i) => filterType === "all" || i.type === filterType)
      .filter((i) => filterPriority === "all" || i.priority === filterPriority)
      .filter((i) => !backlogSearch || i.title.toLowerCase().includes(backlogSearch.toLowerCase()))
      .sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 9;
        const pb = priorityOrder[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return a.sort_order - b.sort_order;
      });
  }, [allBacklogItems, sprintItemIds, filterType, filterPriority, backlogSearch]);

  const sprintSummary = useMemo(() => {
    if (!sprintItems) return null;
    const total = sprintItems.length;
    const totalSp = sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const doneSp = sprintItems.filter(i => i.column_name === "done").reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const byCol: Record<string, number> = {};
    columns.forEach((c) => { byCol[c.key] = sprintItems.filter((i) => i.column_name === c.key).length; });
    return { total, totalSp, doneSp, byCol };
  }, [sprintItems]);

  // Mutations
  const createSprintMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sprints").insert({
        name: newSprint.name, goal: newSprint.goal || null,
        start_date: newSprint.start_date, end_date: newSprint.end_date,
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

  const addToSprintMutation = useMutation({
    mutationFn: async ({ backlogItemIds, column }: { backlogItemIds: string[]; column: string }) => {
      const inserts = backlogItemIds.map((id) => ({
        sprint_id: currentSprintId!, backlog_item_id: id, column_name: column,
      }));
      const { error } = await supabase.from("sprint_items").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      setPlanningSelected(new Set());
      toast.success("Lagt til i sprint");
    },
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newColumn }: { itemId: string; newColumn: string }) => {
      const { error } = await supabase.from("sprint_items").update({ column_name: newColumn }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint_items"] }),
  });

  const removeFromSprintMutation = useMutation({
    mutationFn: async (sprintItemId: string) => {
      const { error } = await supabase.from("sprint_items").delete().eq("id", sprintItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      setDetailItem(null);
      toast.success("Fjernet fra sprint");
    },
  });

  const inlineCreateMutation = useMutation({
    mutationFn: async ({ title, column }: { title: string; column?: string }) => {
      const { data, error } = await supabase.from("backlog_items").insert({
        item_id: "TEMP", title, type: "user_story", priority: "should_have",
      }).select().single();
      if (error) throw error;
      if (column && currentSprintId) {
        await supabase.from("sprint_items").insert({
          sprint_id: currentSprintId, backlog_item_id: data.id, column_name: column,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setInlineAddCol(null);
      setInlineTitle("");
      setBacklogInlineTitle("");
    },
  });

  const updateBacklogItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("backlog_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      toast.success("Oppdatert");
    },
  });

  const addSubtaskMutation = useMutation({
    mutationFn: async ({ backlogItemId, title }: { backlogItemId: string; title: string }) => {
      const { error } = await supabase.from("subtasks").insert({ backlog_item_id: backlogItemId, title });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks"] }),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("subtasks").update({ is_completed: completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subtasks"] }),
  });

  // Drag handlers
  const handleDragStartBacklog = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    setDragSource("backlog");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.setData("source", "backlog");
  };

  const handleDragStartSprint = (e: React.DragEvent, sprintItemId: string) => {
    setDraggedItemId(sprintItemId);
    setDragSource("sprint");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sprintItemId);
    e.dataTransfer.setData("source", "sprint");
  };

  const handleBoardDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("text/plain");
    const source = e.dataTransfer.getData("source");
    setDraggedItemId(null);
    setDragOverCol(null);
    setDragSource(null);
    if (!itemId) return;

    if (source === "backlog") {
      // Dragged from backlog to sprint column
      addToSprintMutation.mutate({ backlogItemIds: [itemId], column: colKey });
    } else {
      // Dragged within sprint board
      const item = sprintItems?.find((i) => i.id === itemId);
      if (item && item.column_name !== colKey) {
        moveItemMutation.mutate({ itemId, newColumn: colKey });
      }
    }
  }, [sprintItems, moveItemMutation, addToSprintMutation]);

  const openDetail = (item: BacklogItem, sprintItemId?: string) => {
    setDetailItem(item);
    setDetailSprintItemId(sprintItemId ?? null);
    setEditForm({
      title: item.title, description: item.description ?? "",
      type: item.type, priority: item.priority,
      estimate: item.estimate, assignee_id: item.assignee_id,
      epic: item.epic ?? "", labels: (item.labels ?? []).join(", "),
      collaborator_ids: (item as any).collaborator_ids ?? [],
    });
  };

  const saveDetail = () => {
    if (!detailItem) return;
    updateBacklogItemMutation.mutate({
      id: detailItem.id, title: editForm.title,
      description: editForm.description || null, type: editForm.type,
      priority: editForm.priority, estimate: editForm.estimate,
      assignee_id: editForm.assignee_id, epic: editForm.epic || null,
      labels: editForm.labels ? editForm.labels.split(",").map((l: string) => l.trim()).filter(Boolean) : [],
      collaborator_ids: editForm.collaborator_ids ?? [],
    });
    setDetailItem(null);
  };

  const itemSubtasks = detailItem ? subtasks?.filter((s) => s.backlog_item_id === detailItem.id) ?? [] : [];
  const wipLimit = 2;

  // Responsive: use tabs on narrow screens
  const isNarrow = typeof window !== "undefined" && window.innerWidth < 900;

  const backlogPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-sm font-semibold">
          {planningMode ? (
            <span className="text-green-700">Plukk items →</span>
          ) : (
            <>Backlog <span className="text-muted-foreground font-normal">({backlogFiltered.length})</span></>
          )}
        </h2>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 p-2 border-b border-border flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[100px]">
          <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={backlogSearch} onChange={(e) => setBacklogSearch(e.target.value)}
            placeholder="Søk..." className="pl-7 h-7 text-xs" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {backlogFiltered.map((item) => {
          const assignee = members?.find((m) => m.id === item.assignee_id);
          return (
            <div key={item.id}
              draggable={!planningMode}
              onDragStart={(e) => handleDragStartBacklog(e, item.id)}
              onDragEnd={() => { setDraggedItemId(null); setDragSource(null); }}
              onClick={() => planningMode
                ? setPlanningSelected((prev) => {
                    const n = new Set(prev);
                    n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                    return n;
                  })
                : openDetail(item)
              }
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors hover:bg-accent/50 ${
                draggedItemId === item.id ? "opacity-40" : ""
              } ${planningSelected.has(item.id) ? "bg-green-50 ring-1 ring-green-300" : ""}`}
            >
              {planningMode ? (
                <Checkbox checked={planningSelected.has(item.id)} className="shrink-0" />
              ) : (
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 cursor-grab" />
              )}
              <Badge className={`text-[8px] shrink-0 px-1 py-0 ${typeColors[item.type] ?? "bg-muted"}`}>
                {(typeLabels[item.type] ?? item.type).slice(0, 3)}
              </Badge>
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{item.title}</span>
              {item.estimate && (
                <span className="h-5 w-5 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center shrink-0 tabular-nums">{item.estimate}</span>
              )}
              <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.priority] ?? "bg-gray-400"}`} />
              {assignee && <MemberAvatar member={assignee} />}
              {((item as any).collaborator_ids ?? []).length > 0 && (
                <div className="flex -space-x-1">
                  {((item as any).collaborator_ids as string[]).slice(0, 2).map((cid) => {
                    const c = members?.find((m) => m.id === cid);
                    return c ? <MemberAvatar key={cid} member={c} /> : null;
                  })}
                  {((item as any).collaborator_ids as string[]).length > 2 && (
                    <span className="text-[9px] text-muted-foreground">+{((item as any).collaborator_ids as string[]).length - 2}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {backlogFiltered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Ingen items i backlog</p>
        )}
      </div>

      {/* Planning mode action bar */}
      {planningMode && planningSelected.size > 0 && (
        <div className="p-2 border-t border-border bg-green-50">
          <Button size="sm" className="w-full" onClick={() => {
            addToSprintMutation.mutate({ backlogItemIds: Array.from(planningSelected), column: "todo" });
            setPlanningMode(false);
          }}>
            Legg til i sprint ({planningSelected.size} items)
          </Button>
        </div>
      )}

      {/* Inline add */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-1">
          <Input value={backlogInlineTitle} onChange={(e) => setBacklogInlineTitle(e.target.value)}
            placeholder="+ Ny oppgave..." className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && backlogInlineTitle.trim()) {
                inlineCreateMutation.mutate({ title: backlogInlineTitle.trim() });
              }
            }} />
        </div>
      </div>
    </div>
  );

  const sprintPanel = (
    <div className="flex flex-col h-full min-h-0">
      {/* Sprint header */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={currentSprintId ?? ""} onValueChange={setSelectedSprintId}>
            <SelectTrigger className="w-40 h-7 text-xs"><SelectValue placeholder="Velg sprint" /></SelectTrigger>
            <SelectContent>
              {sprints?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.is_active ? " ●" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCreateSprint(true)}>
            <Plus className="h-3 w-3 mr-1" /> Ny sprint
          </Button>
          <Button size="sm" variant={planningMode ? "default" : "outline"} className="h-7 text-xs"
            onClick={() => { setPlanningMode(!planningMode); setPlanningSelected(new Set()); }}>
            {planningMode ? "Avslutt planning" : "Sprint Planning"}
          </Button>
          {currentSprint?.is_active && !planningMode && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowCloseSprint(true)}>
              <StopCircle className="h-3 w-3 mr-1" /> Avslutt sprint
            </Button>
          )}
        </div>
        {currentSprint?.goal && (
          <p className="text-xs text-muted-foreground italic flex items-center gap-1">
            <StickyNote className="h-3 w-3" /> {currentSprint.goal}
          </p>
        )}
        {/* Sprint stats */}
        {sprintSummary && sprintSummary.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span><strong className="text-foreground">{sprintSummary.total}</strong> items</span>
              <span><strong className="text-foreground">{sprintSummary.doneSp}</strong> av <strong className="text-foreground">{sprintSummary.totalSp}</strong> SP</span>
              <span className="text-muted-foreground/40">|</span>
              {columns.map((c) => (
                <span key={c.key}>{c.label}: <strong className="text-foreground">{sprintSummary.byCol[c.key]}</strong></span>
              ))}
            </div>
            {sprintSummary.totalSp > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {columns.map((c) => {
                  const colSp = sprintItems?.filter(i => i.column_name === c.key).reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0) ?? 0;
                  const pct = (colSp / sprintSummary.totalSp) * 100;
                  const colors: Record<string, string> = { todo: "bg-gray-300", in_progress: "bg-blue-400", review: "bg-amber-400", done: "bg-green-500" };
                  return pct > 0 ? <div key={c.key} className={`${colors[c.key]} transition-all`} style={{ width: `${pct}%` }} /> : null;
                })}
              </div>
            )}
          </div>
        )}
        {planningMode && (
          <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
            Valgt: <strong>{
              Array.from(planningSelected).reduce((s, id) => s + (allBacklogItems?.find(i => i.id === id)?.estimate ?? 0), 0)
            } SP</strong> | Anbefalt: ~40 SP per sprint
          </div>
        )}
      </div>

      {/* Kanban columns */}
      {!currentSprintId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={Layers} title="Ingen sprinter" description="Opprett din første sprint" actionLabel="Ny sprint" onAction={() => setShowCreateSprint(true)} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-2">
          <div className="grid grid-cols-4 gap-2 min-w-[600px] h-full">
            {columns.map((col) => {
              const colItems = sprintItems?.filter((i) => i.column_name === col.key) ?? [];
              const isOverWip = col.key === "in_progress" && colItems.length > wipLimit * (members?.length ?? 6);
              const isDragTarget = dragOverCol === col.key;
              return (
                <div key={col.key} className="flex flex-col min-h-0"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col.key); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleBoardDrop(e, col.key)}
                >
                  <div className={`flex items-center justify-between px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    isOverWip ? "bg-destructive/10 border border-destructive/30" :
                    isDragTarget ? "bg-primary/10 border border-primary/30" : "bg-muted"
                  }`}>
                    {col.label}
                    <Badge variant="secondary" className="text-[9px] tabular-nums h-4">{colItems.length}</Badge>
                  </div>
                  {isOverWip && <p className="text-[9px] text-destructive px-1 mt-0.5">⚠️ WIP-limit</p>}
                  <div className={`flex-1 overflow-y-auto space-y-1.5 mt-1 rounded-lg p-0.5 transition-colors ${
                    isDragTarget ? "bg-primary/5 ring-1 ring-primary/20 ring-dashed" : ""
                  }`}>
                    {colItems.map((item) => {
                      const assignee = members?.find((m) => m.id === item.backlog_item?.assignee_id);
                      return (
                        <Card key={item.id} draggable
                          onDragStart={(e) => handleDragStartSprint(e, item.id)}
                          onDragEnd={() => { setDraggedItemId(null); setDragOverCol(null); setDragSource(null); }}
                          onClick={() => openDetail(item.backlog_item, item.id)}
                          className={`shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                            draggedItemId === item.id ? "opacity-40 scale-95" : ""
                          }`}
                        >
                          <CardContent className="p-2 space-y-1.5">
                            <div className="flex items-start gap-1">
                              <GripVertical className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/40" />
                              <span className="text-[13px] font-medium leading-snug flex-1 min-w-0 line-clamp-2">{item.backlog_item?.title}</span>
                              {assignee && <MemberAvatar member={assignee} />}
                            </div>
                            <div className="flex items-center gap-1 pl-4 flex-wrap">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.backlog_item?.priority] ?? "bg-gray-400"}`} />
                              <Badge className={`text-[8px] px-1 py-0 ${typeColors[item.backlog_item?.type] ?? ""}`}>
                                {(typeLabels[item.backlog_item?.type] ?? "").slice(0, 3)}
                              </Badge>
                              {item.backlog_item?.estimate && (
                                <span className="h-4 w-4 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center tabular-nums">{item.backlog_item.estimate}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {/* Inline add in column */}
                  {inlineAddCol === col.key ? (
                    <div className="flex gap-1 mt-1">
                      <Input autoFocus value={inlineTitle} onChange={(e) => setInlineTitle(e.target.value)}
                        placeholder="Tittel..." className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && inlineTitle.trim()) inlineCreateMutation.mutate({ title: inlineTitle.trim(), column: col.key });
                          if (e.key === "Escape") { setInlineAddCol(null); setInlineTitle(""); }
                        }} />
                      <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => { setInlineAddCol(null); setInlineTitle(""); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button onClick={() => setInlineAddCol(col.key)}
                      className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1 flex items-center justify-center gap-0.5 rounded hover:bg-accent/50 mt-1">
                      <Plus className="h-3 w-3" /> Legg til
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const nextSprints = (sprints ?? []).filter((s) => s.id !== currentSprintId && !s.completed_at);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-4 pt-4 pb-2 flex items-end justify-between gap-4 flex-wrap">
        <PageHeader title="Sprinter" description="Product backlog og sprint board — dra items fra backlog til sprinten" />
        <div className="flex gap-1.5 mb-1">
          <Button size="sm" variant={pageView === "board" ? "default" : "outline"} className="h-7 text-xs"
            onClick={() => setPageView("board")}>
            <Layers className="h-3 w-3 mr-1" /> Board
          </Button>
          <Button size="sm" variant={pageView === "history" ? "default" : "outline"} className="h-7 text-xs"
            onClick={() => setPageView("history")}>
            <History className="h-3 w-3 mr-1" /> Historikk
          </Button>
        </div>
      </div>

      {pageView === "history" ? (
        <div className="flex-1 overflow-y-auto">
          <SprintHistory />
        </div>
      ) : (
        <>
          {/* Mobile tabs */}
          <div className="md:hidden flex border-b border-border px-4">
            <button onClick={() => setActiveTab("backlog")}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "backlog" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              Backlog
            </button>
            <button onClick={() => setActiveTab("sprint")}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors ${activeTab === "sprint" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              Sprint
            </button>
          </div>

          {/* Split view */}
          <div className="flex-1 min-h-0 flex">
            <div className={`border-r border-border ${activeTab === "sprint" ? "hidden md:flex" : "flex"} md:flex flex-col`}
              style={{ width: "40%", minWidth: 280 }}>
              {backlogPanel}
            </div>
            <div className={`flex-1 ${activeTab === "backlog" ? "hidden md:flex" : "flex"} md:flex flex-col min-w-0`}>
              {sprintPanel}
            </div>
          </div>
        </>
      )}

      {/* Create sprint dialog */}
      <Dialog open={showCreateSprint} onOpenChange={setShowCreateSprint}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny sprint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Navn</Label><Input value={newSprint.name} onChange={(e) => setNewSprint((p) => ({ ...p, name: e.target.value }))} placeholder="Sprint 2" /></div>
            <div><Label>Sprint Goal</Label><Textarea value={newSprint.goal} onChange={(e) => setNewSprint((p) => ({ ...p, goal: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="date" value={newSprint.start_date} onChange={(e) => setNewSprint((p) => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label>Slutt</Label><Input type="date" value={newSprint.end_date} onChange={(e) => setNewSprint((p) => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateSprint(false)}>Avbryt</Button>
            <Button onClick={() => createSprintMutation.mutate()} disabled={!newSprint.name || !newSprint.start_date || !newSprint.end_date}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editForm && detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  <span className="text-muted-foreground font-mono text-sm mr-2">{detailItem.item_id}</span>
                  Rediger item
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Tittel</Label><Input value={editForm.title} onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Beskrivelse</Label><Textarea value={editForm.description} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3}
                  placeholder={editForm.type === "user_story" ? "Som [rolle] ønsker jeg [mål] for å [effekt]" : ""} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={editForm.type} onValueChange={(v) => setEditForm((p: any) => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Prioritet</Label>
                    <Select value={editForm.priority} onValueChange={(v) => setEditForm((p: any) => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Estimat (Story Points)</Label>
                  <div className="flex gap-2 mt-1">
                    {storyPoints.map((sp) => (
                      <button key={sp} onClick={() => setEditForm((p: any) => ({ ...p, estimate: p.estimate === sp ? null : sp }))}
                        className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${editForm.estimate === sp ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ansvarlig</Label>
                    <Select value={editForm.assignee_id ?? ""} onValueChange={(v) => setEditForm((p: any) => ({ ...p, assignee_id: v || null }))}>
                      <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                      <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Epic</Label>
                    <Input value={editForm.epic} onChange={(e) => setEditForm((p: any) => ({ ...p, epic: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Bidragsytere</Label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {members?.map((m) => {
                      const selected = (editForm.collaborator_ids ?? []).includes(m.id);
                      return (
                        <button key={m.id} type="button"
                          onClick={() => setEditForm((p: any) => ({
                            ...p,
                            collaborator_ids: selected
                              ? (p.collaborator_ids ?? []).filter((id: string) => id !== m.id)
                              : [...(p.collaborator_ids ?? []), m.id],
                          }))}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                            selected ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}>
                          <MemberAvatar member={m} />
                          <span>{m.name.split(" ")[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label>Labels (kommaseparert)</Label>
                  <Input value={editForm.labels} onChange={(e) => setEditForm((p: any) => ({ ...p, labels: e.target.value }))} />
                </div>

                {/* Sprint status */}
                <div className="flex items-center gap-2 text-sm">
                  {detailSprintItemId ? (
                    <>
                      <Badge className="bg-green-100 text-green-700">I {currentSprint?.name ?? "sprint"}</Badge>
                      <Button size="sm" variant="ghost" className="text-xs text-destructive"
                        onClick={() => removeFromSprintMutation.mutate(detailSprintItemId)}>
                        Fjern fra sprint
                      </Button>
                    </>
                  ) : currentSprintId ? (
                    <Button size="sm" variant="outline" className="text-xs"
                      onClick={() => {
                        addToSprintMutation.mutate({ backlogItemIds: [detailItem.id], column: "todo" });
                        setDetailItem(null);
                      }}>
                      Legg til i {currentSprint?.name ?? "sprint"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ikke i sprint</span>
                  )}
                </div>

                {/* Subtasks */}
                <div>
                  <Label className="mb-1 block">Deloppgaver</Label>
                  <div className="space-y-1">
                    {itemSubtasks.map((st) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <Checkbox checked={st.is_completed} onCheckedChange={(v) => toggleSubtaskMutation.mutate({ id: st.id, completed: !!v })} />
                        <span className={`text-sm ${st.is_completed ? "line-through text-muted-foreground" : ""}`}>{st.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Ny deloppgave..." className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSubtaskTitle.trim()) {
                          addSubtaskMutation.mutate({ backlogItemId: detailItem.id, title: newSubtaskTitle.trim() });
                          setNewSubtaskTitle("");
                        }
                      }} />
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { if (newSubtaskTitle.trim()) { addSubtaskMutation.mutate({ backlogItemId: detailItem.id, title: newSubtaskTitle.trim() }); setNewSubtaskTitle(""); } }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDetailItem(null)}>Avbryt</Button>
                <Button onClick={saveDetail}>Lagre</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close sprint modal */}
      {currentSprint && sprintItems && (
        <CloseSprintModal
          open={showCloseSprint}
          onOpenChange={setShowCloseSprint}
          sprint={currentSprint as any}
          sprintItems={sprintItems}
          nextSprints={nextSprints as any[]}
          members={members ?? []}
        />
      )}
    </div>
  );
}
