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
import { Layers, Plus, GripVertical, Search, X, StickyNote, Settings2, History, StopCircle, PanelLeftClose, PanelLeftOpen, Check, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Sprint, SprintItem, BacklogItem, Subtask } from "@/lib/types";
import { syncRequirementFromSprint } from "@/hooks/useRequirementChangelog";
import SprintHistory from "@/components/sprints/SprintHistory";
import CloseSprintModal from "@/components/sprints/CloseSprintModal";
import { LinkedRequirements } from "@/components/backlog/LinkedRequirements";

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
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
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
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineForm, setInlineForm] = useState({
    title: "",
    type: "user_story",
    priority: "should_have",
    estimate: null as number | null,
    collaborator_ids: [] as string[],
  });
  const [detailItem, setDetailItem] = useState<BacklogItem | null>(null);
  const [detailSprintItemId, setDetailSprintItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [planningNotes, setPlanningNotes] = useState("");
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

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
      const hasActive = sprints?.some((s) => s.is_active && !s.completed_at);
      const { error } = await supabase.from("sprints").insert({
        name: newSprint.name, goal: newSprint.goal || null,
        start_date: newSprint.start_date, end_date: newSprint.end_date,
        is_active: !hasActive,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      setShowCreateSprint(false);
      setNewSprint({ name: "", goal: "", start_date: "", end_date: "" });
      toast.success("Sprint opprettet");
    },
    onError: (e) => toast.error((e as Error).message),
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
      qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] });
      setPlanningSelected(new Set());
      toast.success("Lagt til i sprint");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newColumn, backlogItemId }: { itemId: string; newColumn: string; backlogItemId?: string }) => {
      const { error } = await supabase.from("sprint_items").update({ column_name: newColumn }).eq("id", itemId);
      if (error) throw error;
      // Sync linked requirement status
      if (backlogItemId) {
        await syncRequirementFromSprint(backlogItemId, newColumn);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sprint_items"] }); qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] }); qc.invalidateQueries({ queryKey: ["requirements"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeFromSprintMutation = useMutation({
    mutationFn: async (sprintItemId: string) => {
      const { error } = await supabase.from("sprint_items").delete().eq("id", sprintItemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] });
      setDetailItem(null);
      toast.success("Fjernet fra sprint");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteBacklogItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("sprint_items").delete().eq("backlog_item_id", id);
      if (e1) throw new Error("Kunne ikke fjerne fra sprint");
      const { error: e2 } = await supabase.from("daily_updates").update({ backlog_item_id: null }).eq("backlog_item_id", id);
      if (e2) throw new Error("Kunne ikke oppdatere daglige oppdateringer");
      const { error: e3 } = await supabase.from("subtasks").delete().eq("backlog_item_id", id);
      if (e3) throw new Error("Kunne ikke slette deloppgaver");
      const { error: e4 } = await supabase.from("backlog_changelog").delete().eq("backlog_item_id", id);
      if (e4) throw new Error("Kunne ikke slette endringslogg");
      const { error } = await supabase.from("backlog_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setDetailItem(null);
      setConfirmDeleteId(null);
      toast.success("Item slettet");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const inlineCreateMutation = useMutation({
    mutationFn: async ({ title, column, type, priority, estimate, collaborator_ids }: {
      title: string; column?: string; type?: string; priority?: string; estimate?: number | null; collaborator_ids?: string[];
    }) => {
      const { data, error } = await supabase.from("backlog_items").insert({
        item_id: "",
        title,
        type: type || "user_story",
        priority: priority || "should_have",
        estimate: estimate ?? null,
        collaborator_ids: collaborator_ids?.length ? collaborator_ids : null,
      }).select().single();
      if (error) throw error;
      if (column && currentSprintId) {
        const { error: siErr } = await supabase.from("sprint_items").insert({
          sprint_id: currentSprintId, backlog_item_id: data.id, column_name: column,
        });
        if (siErr) throw new Error("Kunne ikke legge til i sprint");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setInlineAddCol(null);
      setInlineTitle("");
      setBacklogInlineTitle("");
      toast.success("Item opprettet");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateBacklogItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await (supabase.from("backlog_items").update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["all_sprint_backlog_ids"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      toast.success("Oppdatert");
    },
    onError: (e) => toast.error((e as Error).message),
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

  const activateSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      const { error: deactErr } = await supabase.from("sprints").update({ is_active: false }).eq("is_active", true);
      if (deactErr) throw new Error("Kunne ikke deaktivere aktiv sprint");
      const { error } = await supabase.from("sprints").update({ is_active: true }).eq("id", sprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint startet");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Save sprint planning notes + mark planning as completed
  const savePlanningMutation = useMutation({
    mutationFn: async ({ sprintId, notes, participants }: { sprintId: string; notes: string; participants: string[] }) => {
      const { error } = await supabase.from("sprints").update({
        sprint_planning_notes: notes || null,
        planning_completed_at: new Date().toISOString(),
        planning_participants: participants,
      } as any).eq("id", sprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint Planning fullført og lagret");
      setPlanningMode(false);
      setPlanningSelected(new Set());
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Save sprint review notes + mark review as completed
  const saveReviewMutation = useMutation({
    mutationFn: async ({ sprintId, notes, participants }: { sprintId: string; notes: string; participants: string[] }) => {
      const { error } = await supabase.from("sprints").update({
        sprint_review_notes: notes || null,
        review_completed_at: new Date().toISOString(),
        review_participants: participants,
      } as any).eq("id", sprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["completed_sprints"] });
      toast.success("Sprint Review fullført og lagret");
      setShowReviewMode(false);
    },
    onError: (e) => toast.error((e as Error).message),
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
        moveItemMutation.mutate({ itemId, newColumn: colKey, backlogItemId: (item as any).backlog_item_id });
      }
    }
  }, [sprintItems, moveItemMutation, addToSprintMutation]);

  const openDetail = (item: BacklogItem, sprintItemId?: string) => {
    setDetailItem(item);
    setDetailSprintItemId(sprintItemId ?? null);
    setEditForm({
      title: item.title, description: item.description ?? "",
      type: item.type, priority: item.priority,
      estimate: item.estimate,
      epic: item.epic ?? "", labels: (item.labels ?? []).join(", "),
      collaborator_ids: (item as any).collaborator_ids ?? [],
      user_story: (item as any).user_story ?? "",
    });
  };

  const saveDetail = () => {
    if (!detailItem) return;
    updateBacklogItemMutation.mutate({
      id: detailItem.id, title: editForm.title,
      description: editForm.description || null, type: editForm.type,
      priority: editForm.priority, estimate: editForm.estimate,
      epic: editForm.epic || null,
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
    <div className="card-elevated flex flex-col h-full min-h-0 m-2 mr-0">
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="text-lg font-semibold">
          {planningMode ? (
            <span className="text-green-700">Plukk items →</span>
          ) : (
            <>Backlog <span className="text-muted-foreground font-normal text-base">({backlogFiltered.length})</span></>
          )}
        </h2>
        <a href="/backlog" className="text-xs text-primary hover:underline">Se full backlog →</a>
      </div>

      {/* Filters */}
      <div className="flex gap-3 px-5 pb-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-28 h-8 text-xs rounded-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-24 h-8 text-xs rounded-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[100px]">
          <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={backlogSearch} onChange={(e) => setBacklogSearch(e.target.value)}
            placeholder="Søk..." className="pl-7 h-8 text-xs rounded-[10px]" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {backlogFiltered.map((item) => {
          const collaborators = ((item as any).collaborator_ids ?? [])
            .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
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
              className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm cursor-pointer transition-colors hover:bg-neutral-50 ${
                draggedItemId === item.id ? "opacity-40" : ""
              } ${planningSelected.has(item.id) ? "bg-green-50 ring-1 ring-green-300" : ""}`}
            >
              {planningMode ? (
                <Checkbox checked={planningSelected.has(item.id)} className="shrink-0" />
              ) : (
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 cursor-grab" />
              )}
              <Badge className={`text-[9px] shrink-0 px-1.5 py-0.5 rounded-md ${typeColors[item.type] ?? "bg-muted"}`}>
                {(typeLabels[item.type] ?? item.type).slice(0, 3)}
              </Badge>
              <span className="flex-1 min-w-0 line-clamp-2 text-sm font-medium">{item.title}</span>
              {item.estimate && (
                <span className="h-5 w-5 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center shrink-0 tabular-nums">{item.estimate}</span>
              )}
              <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.priority] ?? "bg-gray-400"}`} />
              {collaborators.length > 0 && (
                <div className="flex -space-x-1.5 shrink-0">
                  {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} />)}
                  {collaborators.length > 3 && (
                    <div className="h-5 w-5 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center border border-background text-muted-foreground shrink-0">+{collaborators.length - 3}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {backlogFiltered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Ingen items i backlog</p>
            <p className="text-xs text-muted-foreground mt-1">Opprett den første oppgaven under ↓</p>
          </div>
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

      {/* Inline create form */}
      <div className="px-3 py-3 border-t border-neutral-100">
        {!showInlineCreate ? (
          <button
            onClick={() => setShowInlineCreate(true)}
            className="w-full py-3 rounded-[10px] border border-dashed border-neutral-300 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Ny oppgave
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-primary/20 p-4 space-y-3"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setShowInlineCreate(false); setInlineForm({ title: "", type: "user_story", priority: "should_have", estimate: null, collaborator_ids: [] }); }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && inlineForm.title.trim()) {
                inlineCreateMutation.mutate({
                  title: inlineForm.title.trim(),
                  type: inlineForm.type,
                  priority: inlineForm.priority,
                  estimate: inlineForm.estimate,
                  collaborator_ids: inlineForm.collaborator_ids,
                });
                setInlineForm((p) => ({ ...p, title: "", estimate: null, collaborator_ids: [] }));
              }
            }}
          >
            {/* Title */}
            <Input
              autoFocus
              value={inlineForm.title}
              onChange={(e) => setInlineForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Skriv tittel på oppgaven..."
              className="text-sm rounded-lg"
            />

            {/* Type pills + SP + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "user_story", label: "Brukerhistorie", bg: "#E6F1FB", fg: "#0C447C" },
                { key: "technical", label: "Teknisk", bg: "#E1F5EE", fg: "#085041" },
                { key: "design", label: "Design", bg: "#FBEAF0", fg: "#72243E" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setInlineForm((p) => ({ ...p, type: t.key }))}
                  className="py-1 px-2.5 rounded-md text-xs font-medium transition-all"
                  style={{
                    backgroundColor: inlineForm.type === t.key ? t.bg : "hsl(var(--muted))",
                    color: inlineForm.type === t.key ? t.fg : "hsl(var(--muted-foreground))",
                  }}
                >
                  {t.label}
                </button>
              ))}

              <Input
                type="number"
                value={inlineForm.estimate ?? ""}
                onChange={(e) => setInlineForm((p) => ({ ...p, estimate: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="SP"
                className="w-14 h-7 text-xs text-center rounded-lg"
              />

              {[
                { key: "must_have", label: "Must", dot: "bg-red-500" },
                { key: "should_have", label: "Should", dot: "bg-amber-500" },
                { key: "nice_to_have", label: "Could", dot: "bg-neutral-400" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setInlineForm((prev) => ({ ...prev, priority: p.key }))}
                  className={`flex items-center gap-1 py-1 px-2 rounded-md text-xs font-medium transition-all ${
                    inlineForm.priority === p.key ? "bg-neutral-200 text-foreground" : "text-muted-foreground hover:bg-neutral-100"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>

            {/* Assignees */}
            <div className="flex items-center gap-1.5">
              {members?.map((m) => {
                const selected = inlineForm.collaborator_ids.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setInlineForm((p) => ({
                      ...p,
                      collaborator_ids: selected
                        ? p.collaborator_ids.filter((id) => id !== m.id)
                        : [...p.collaborator_ids, m.id],
                    }))}
                    className={`rounded-full transition-all ${selected ? "ring-2 ring-primary ring-offset-1" : "opacity-60 hover:opacity-100"}`}
                  >
                    <MemberAvatar member={m} size="sm" />
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowInlineCreate(false); setInlineForm({ title: "", type: "user_story", priority: "should_have", estimate: null, collaborator_ids: [] }); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={() => {
                  if (!inlineForm.title.trim()) return;
                  inlineCreateMutation.mutate({
                    title: inlineForm.title.trim(),
                    type: inlineForm.type,
                    priority: inlineForm.priority,
                    estimate: inlineForm.estimate,
                    collaborator_ids: inlineForm.collaborator_ids,
                  });
                  setInlineForm((p) => ({ ...p, title: "", estimate: null, collaborator_ids: [] }));
                }}
                disabled={!inlineForm.title.trim() || inlineCreateMutation.isPending}
                className="bg-primary text-white py-2 px-4 rounded-[10px] text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {inlineCreateMutation.isPending ? "Oppretter..." : "Opprett"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const sprintPanel = (
    <div className="flex flex-col h-full min-h-0">
      {/* Sprint header */}
      <div className="card-elevated mx-2 mt-2 mb-3 p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={currentSprintId ?? ""} onValueChange={setSelectedSprintId}>
            <SelectTrigger className="w-44 h-8 text-sm font-semibold rounded-[10px]"><SelectValue placeholder="Velg sprint" /></SelectTrigger>
            <SelectContent>
              {sprints?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}{s.is_active ? " ●" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-sm rounded-[10px]" onClick={() => setShowCreateSprint(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Ny sprint
          </Button>
          <Button size="sm" variant={planningMode ? "default" : "outline"} className="h-8 text-sm rounded-[10px]"
            onClick={() => { setPlanningMode(!planningMode); setPlanningSelected(new Set()); }}>
            {planningMode ? "Avslutt planning" : "Sprint Planning"}
          </Button>
          {currentSprint && !currentSprint.is_active && !currentSprint.completed_at && !planningMode && (
            <Button size="sm" variant="outline" className="h-8 text-sm rounded-[10px] text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => activateSprintMutation.mutate(currentSprint.id)}
              disabled={activateSprintMutation.isPending}>
              Start sprint
            </Button>
          )}
          {currentSprint?.is_active && !planningMode && !showReviewMode && (
            <button className="h-8 px-4 text-sm font-medium rounded-[10px] bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1.5"
              onClick={() => { setShowReviewMode(true); setReviewNotes(currentSprint.sprint_review_notes ?? ""); }}>
              Sprint Review
            </button>
          )}
          {currentSprint?.is_active && !planningMode && !showReviewMode && (
            <button className="h-8 px-4 text-sm font-medium rounded-[10px] bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1.5"
              onClick={() => setShowCloseSprint(true)}>
              <StopCircle className="h-3.5 w-3.5" /> Avslutt sprint
            </button>
          )}
        </div>
        {currentSprint?.goal && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
            {currentSprint.goal}
          </p>
        )}
        {/* Sprint stats */}
        {sprintSummary && sprintSummary.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span><strong className="text-foreground">{sprintSummary.total}</strong> items · <strong className="text-foreground">{sprintSummary.doneSp}</strong> av <strong className="text-foreground">{sprintSummary.totalSp}</strong> SP</span>
              <span className="text-muted-foreground/30">|</span>
              <span>To Do: <strong className="text-gray-500">{sprintSummary.byCol["todo"]}</strong></span>
              <span>In Progress: <strong className="text-blue-600">{sprintSummary.byCol["in_progress"]}</strong></span>
              <span>Review: <strong className="text-amber-600">{sprintSummary.byCol["review"]}</strong></span>
              <span>Done: <strong className="text-green-600">{sprintSummary.byCol["done"]}</strong></span>
            </div>
            {sprintSummary.totalSp > 0 && (
              <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                {columns.map((c) => {
                  const colSp = sprintItems?.filter(i => i.column_name === c.key).reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0) ?? 0;
                  const pct = (colSp / sprintSummary.totalSp) * 100;
                  const colors: Record<string, string> = { todo: "bg-gray-300", in_progress: "bg-blue-500", review: "bg-amber-500", done: "bg-green-500" };
                  return pct > 0 ? <div key={c.key} className={`${colors[c.key]} transition-all`} style={{ width: `${pct}%` }} /> : null;
                })}
              </div>
            )}
          </div>
        )}
        {/* Sprint status banner */}
        {currentSprint && !currentSprint.completed_at && (
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
            planningMode ? "bg-blue-50 text-blue-700" :
            showReviewMode ? "bg-purple-50 text-purple-700" :
            currentSprint.is_active ? "bg-green-50 text-green-700" :
            "bg-neutral-100 text-neutral-600"
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {planningMode ? "Sprint Planning pågår" :
             showReviewMode ? "Sprint Review pågår" :
             currentSprint.is_active ? "Sprint aktiv" :
             "Sprint ikke startet"}
          </div>
        )}

        {planningMode && (
          <div className="space-y-2">
            <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">
              Valgt: <strong>{
                Array.from(planningSelected).reduce((s, id) => s + (allBacklogItems?.find(i => i.id === id)?.estimate ?? 0), 0)
              } SP</strong> | Anbefalt: ~40 SP per sprint
            </div>
            <div>
              <textarea
                value={planningNotes}
                onChange={(e) => setPlanningNotes(e.target.value)}
                placeholder="Sprint Planning-notater: Beslutninger, prioriteringer, diskusjoner..."
                className="w-full text-sm rounded-[10px] border border-neutral-200 p-3 min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!currentSprintId) return;
                  savePlanningMutation.mutate({
                    sprintId: currentSprintId,
                    notes: planningNotes,
                    participants: members?.map(m => m.id) ?? [],
                  });
                }}
                disabled={savePlanningMutation.isPending}
                className="bg-blue-600 text-white py-1.5 px-4 rounded-[10px] text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                {savePlanningMutation.isPending ? "Lagrer..." : "Fullfør Sprint Planning"}
              </button>
            </div>
          </div>
        )}

        {/* Sprint Review mode */}
        {showReviewMode && currentSprint && (
          <div className="space-y-2 bg-purple-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-purple-700">Sprint Review</p>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Sprint Review-notater: Hva ble demonstrert, feedback fra stakeholders..."
              className="w-full text-sm rounded-[10px] border border-purple-200 p-3 min-h-[60px] resize-none bg-white"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReviewMode(false)} className="text-xs text-muted-foreground hover:text-foreground">Avbryt</button>
              <button
                onClick={() => {
                  saveReviewMutation.mutate({
                    sprintId: currentSprint.id,
                    notes: reviewNotes,
                    participants: members?.map(m => m.id) ?? [],
                  });
                }}
                disabled={saveReviewMutation.isPending}
                className="bg-purple-600 text-white py-1.5 px-4 rounded-[10px] text-xs font-semibold hover:bg-purple-700 transition-colors"
              >
                {saveReviewMutation.isPending ? "Lagrer..." : "Fullfør Sprint Review"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Kanban columns */}
      {!currentSprintId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={Layers} title="Ingen sprinter" description="Opprett din første sprint" actionLabel="Ny sprint" onAction={() => setShowCreateSprint(true)} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto px-3 pb-3">
          <div className="grid grid-cols-4 gap-3 min-w-[720px] h-full">
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
                  <div className={`flex items-center justify-between px-4 py-2 rounded-[10px] text-sm font-semibold uppercase tracking-wide transition-colors ${
                    isOverWip ? "bg-destructive/10 border border-destructive/30" :
                    isDragTarget ? "bg-primary/10 border border-primary/30" : "bg-neutral-50"
                  }`}>
                    {col.label}
                    <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 text-xs font-medium flex items-center justify-center tabular-nums">{colItems.length}</span>
                  </div>
                  {isOverWip && <p className="text-[10px] text-destructive px-1 mt-1">⚠️ WIP-limit</p>}
                  <div className={`flex-1 overflow-y-auto space-y-3 pt-3 rounded-xl p-1 transition-colors min-h-[400px] ${
                    isDragTarget ? "bg-primary/5 border-2 border-dashed border-primary/30" : ""
                  }`}>
                    {colItems.map((item) => {
                      const collaborators = ((item.backlog_item as any)?.collaborator_ids ?? [])
                        .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
                      return (
                        <div key={item.id} draggable
                          onDragStart={(e) => handleDragStartSprint(e, item.id)}
                          onDragEnd={() => { setDraggedItemId(null); setDragOverCol(null); setDragSource(null); }}
                          onClick={() => openDetail(item.backlog_item, item.id)}
                          className={`bg-white rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                            draggedItemId === item.id ? "opacity-50 scale-[0.97] rotate-1" : ""
                          }`}
                          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03)" }}
                        >
                          <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{item.backlog_item?.title}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.backlog_item?.priority] ?? "bg-gray-400"}`} />
                            <Badge className={`text-xs py-0.5 px-2 rounded-md ${typeColors[item.backlog_item?.type] ?? ""}`}>
                              {(typeLabels[item.backlog_item?.type] ?? "").slice(0, 3)}
                            </Badge>
                            {item.backlog_item?.estimate && (
                              <span className="text-xs font-medium text-muted-foreground tabular-nums ml-auto">{item.backlog_item.estimate} SP</span>
                            )}
                          </div>
                          {collaborators.length > 0 && (
                            <div className="flex -space-x-1.5 mt-3 justify-end">
                              {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} size="sm" />)}
                              {collaborators.length > 3 && (
                                <div className="h-6 w-6 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center border border-background text-muted-foreground shrink-0">+{collaborators.length - 3}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Fjernet — items legges til via drag fra backlog */}
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
      <div className="px-6 pt-5 pb-3 flex items-end justify-between gap-4 flex-wrap">
        <PageHeader title="Sprinter" description="Product backlog og sprint board" />
        <div className="flex gap-2 mb-1">
          <button
            onClick={() => setPageView("board")}
            className={`py-2 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pageView === "board"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-muted-foreground border border-neutral-200 hover:text-foreground"
            }`}>
            <Layers className="h-3.5 w-3.5" /> Board
          </button>
          <button
            onClick={() => setPageView("history")}
            className={`py-2 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center gap-1.5 ${
              pageView === "history"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-white text-muted-foreground border border-neutral-200 hover:text-foreground"
            }`}>
            <History className="h-3.5 w-3.5" /> Historikk
          </button>
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
          <div className="flex-1 min-h-0 flex gap-3 px-2">
            {!backlogCollapsed && (
              <div className={`${activeTab === "sprint" ? "hidden md:flex" : "flex"} md:flex flex-col transition-all`}
                style={{ width: "35%", minWidth: 280 }}>
                {backlogPanel}
              </div>
            )}
            <div className={`flex-1 ${activeTab === "backlog" && !backlogCollapsed ? "hidden md:flex" : "flex"} md:flex flex-col min-w-0`}>
              <div className="hidden md:flex items-center px-1 pt-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setBacklogCollapsed(!backlogCollapsed)}
                  title={backlogCollapsed ? "Vis backlog" : "Skjul backlog"}>
                  {backlogCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {sprintPanel}
            </div>
          </div>
        </>
      )}

      {/* Create sprint dialog */}
      <Dialog open={showCreateSprint} onOpenChange={setShowCreateSprint}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny sprint</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
                  Rediger item
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Tittel</Label><Input value={editForm.title} onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Beskrivelse</Label><Textarea value={editForm.description} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3}
                  placeholder={editForm.type === "user_story" ? "Som [rolle] ønsker jeg [mål] for å [effekt]" : ""} /></div>
                <div>
                  <Label>Brukerhistorie</Label>
                  <Textarea value={editForm.user_story} onChange={(e) => setEditForm((p: any) => ({ ...p, user_story: e.target.value }))}
                    placeholder="Som en [brukergruppe] vil jeg [funksjon] slik at [nytte]" rows={2} className="text-xs" />
                </div>
                <LinkedRequirements backlogItemId={detailItem.id} />
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
                    <Label>Tildelt</Label>
                    <div className="space-y-0.5 mt-1.5">
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
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left ${selected ? "bg-primary/10" : "hover:bg-muted"}`}
                          >
                            <div className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                              {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            <MemberAvatar member={m} />
                            <span className={`text-sm ${selected ? "text-foreground font-medium" : "text-muted-foreground"}`}>{m.name.split(" ")[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label>Epic</Label>
                    <Input value={editForm.epic} onChange={(e) => setEditForm((p: any) => ({ ...p, epic: e.target.value }))} />
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
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto"
                  onClick={() => setConfirmDeleteId(detailItem.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />Slett item
                </Button>
                <Button variant="ghost" onClick={() => setDetailItem(null)}>Avbryt</Button>
                <Button onClick={saveDetail}>Lagre</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette item?</AlertDialogTitle>
            <AlertDialogDescription>
              Itemet fjernes fra backlog og eventuelle sprinter. Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && deleteBacklogItemMutation.mutate(confirmDeleteId)}
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
