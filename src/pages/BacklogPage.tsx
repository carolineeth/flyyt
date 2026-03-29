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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ListTodo, Plus, GripVertical, Trash2, Check, ClipboardEdit, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { BacklogItem, Sprint } from "@/lib/types";
import { logBacklogChange } from "@/lib/backlogChangelog";
import { EpicSelector, useEpics } from "@/components/backlog/EpicSelector";
import { QualityTagSelector, QualityTagChips } from "@/components/backlog/QualityTags";

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
  const { data: epics = [] } = useEpics();
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

  // Sprint items with column info (for active + completed sections)
  const { data: sprintItemsFull } = useQuery({
    queryKey: ["sprint_items_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sprint_items").select("*, backlog_item:backlog_items(*), sprint:sprints(id, name, is_active, completed_at)");
      if (error) throw error;
      return data as any[];
    },
  });

  // Refinement sessions
  const { data: refinementSessions = [] } = useQuery({
    queryKey: ["refinement_sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("backlog_refinement_sessions" as any).select("*").order("session_date", { ascending: false }) as any);
      if (error) throw error;
      return data;
    },
  });

  const [activeSection, setActiveSection] = useState<"backlog" | "active" | "completed">("backlog");
  const [refinementMode, setRefinementMode] = useState(false);
  const [refinementNotes, setRefinementNotes] = useState("");
  const [refinementStats, setRefinementStats] = useState({ added: 0, reestimated: 0, reprioritized: 0 });

  const saveRefinementSession = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("backlog_refinement_sessions" as any).insert({
        notes: refinementNotes || null,
        tasks_added: refinementStats.added,
        tasks_reestimated: refinementStats.reestimated,
        tasks_reprioritized: refinementStats.reprioritized,
        participants: members?.map(m => m.id) ?? [],
      } as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["refinement_sessions"] });
      toast.success("Backlog Refinement lagret");
      setRefinementMode(false);
      setRefinementNotes("");
      setRefinementStats({ added: 0, reestimated: 0, reprioritized: 0 });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Computed sections
  const activeSprintItems = useMemo(() => {
    if (!sprintItemsFull) return [];
    return sprintItemsFull.filter((si: any) => si.sprint?.is_active && !si.sprint?.completed_at);
  }, [sprintItemsFull]);

  const completedItems = useMemo(() => {
    if (!sprintItemsFull) return [];
    return sprintItemsFull.filter((si: any) => si.column_name === "done");
  }, [sprintItemsFull]);

  const columnLabels: Record<string, string> = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };

  // Unlinked requirements for pre-fill
  const { data: unlinkedRequirements } = useQuery<{
    id: string; title: string; description: string | null;
    acceptance_criteria: string | null; type: string; priority: string;
  }[]>({
    queryKey: ["requirements_unlinked"],
    queryFn: async () => {
      // Fetch all requirements
      const { data: allReqs, error: reqErr } = await (supabase
        .from("requirements" as any)
        .select("id, title, description, acceptance_criteria, type, priority")
        .order("sort_order") as any);
      if (reqErr) throw reqErr;
      // Fetch all junction links
      const { data: links, error: linkErr } = await (supabase
        .from("requirement_backlog_links" as any)
        .select("requirement_id") as any);
      if (linkErr) throw linkErr;
      const linkedIds = new Set(((links ?? []) as any[]).map((l: any) => l.requirement_id));
      return ((allReqs ?? []) as any[]).filter((r) => !linkedIds.has(r.id));
    },
  });
  const REQ_TYPE_MAP: Record<string, string> = { functional: "user_story", non_functional: "technical", documentation: "technical" };
  const REQ_PRIO_MAP: Record<string, string> = { must: "must_have", should: "should_have", could: "nice_to_have", wont: "nice_to_have" };

  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterEpic, setFilterEpic] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<BacklogItem | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  const [newItem, setNewItem] = useState({
    title: "", description: "", type: "user_story", priority: "should_have",
    estimate: null as number | null, epic_id: null as string | null,
    sprint_id: null as string | null, quality_tags: [] as string[],
    status: "backlog" as string, collaborator_ids: [] as string[],
  });

  const [filterQualityTag, setFilterQualityTag] = useState<string>("all");

  // Sequential display numbers sorted by creation date (oldest = #1)
  const displayNumbers = useMemo(() => {
    if (!items) return {};
    const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const map: Record<string, number> = {};
    sorted.forEach((item, i) => { map[item.id] = i + 1; });
    return map;
  }, [items]);

  const activeEpics = epics.filter(e => !e.is_archived);

  // Collect unique quality tags for filter
  const allQualityTags = useMemo(() => {
    const tags = new Set<string>();
    items?.forEach(i => ((i as any).quality_tags ?? []).forEach((t: string) => tags.add(t)));
    return Array.from(tags).sort();
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
        status: newItem.status,
        estimate: newItem.estimate,
        epic_id: newItem.epic_id || null,
        assignee_id: null,
        collaborator_ids: newItem.collaborator_ids.length ? newItem.collaborator_ids : null,
        quality_tags: newItem.quality_tags.length ? newItem.quality_tags : null,
      } as any).select().single();
      if (error) throw error;
      if (data) {
        await logBacklogChange({ backlogItemId: data.id, changeType: "created", newValue: data.title });
      }
      // If sprint selected, add to sprint_items
      if (newItem.sprint_id && data) {
        const { error: sprintErr } = await supabase.from("sprint_items").insert({
          sprint_id: newItem.sprint_id,
          backlog_item_id: data.id,
          column_name: "todo",
        });
        if (sprintErr) throw sprintErr;
        await logBacklogChange({ backlogItemId: data.id, changeType: "added_to_sprint", newValue: newItem.sprint_id });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items_all"] });
      setShowCreate(false);
      setNewItem({ title: "", description: "", type: "user_story", priority: "should_have", estimate: null, epic_id: null, sprint_id: null, quality_tags: [], status: "backlog", collaborator_ids: [] });
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

  const deleteMutation = useMutation({
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
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["sprint_items_all"] });
      toast.success("Item slettet");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await (supabase.from("backlog_items").update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setDetailItem(null);
      toast.success("Oppdatert");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const openDetail = (item: BacklogItem) => {
    setDetailItem(item);
    setEditForm({
      title: item.title,
      description: item.description ?? "",
      type: item.type,
      priority: item.priority,
      estimate: item.estimate,
      epic_id: (item as any).epic_id ?? null,
      collaborator_ids: (item as any).collaborator_ids ?? [],
      user_story: (item as any).user_story ?? "",
      quality_tags: (item as any).quality_tags ?? [],
    });
  };

  const saveDetail = () => {
    if (!detailItem) return;
    updateItemMutation.mutate({
      id: detailItem.id,
      title: editForm.title,
      description: editForm.description || null,
      type: editForm.type,
      priority: editForm.priority,
      estimate: editForm.estimate,
      epic_id: editForm.epic_id || null,
      collaborator_ids: editForm.collaborator_ids ?? [],
      user_story: editForm.user_story || null,
      quality_tags: editForm.quality_tags?.length ? editForm.quality_tags : null,
    });
  };

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
      updateStatusMutation.mutate({ id: itemId, status, oldStatus: item.status });
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
    if (filterEpic !== "all" && (i as any).epic_id !== filterEpic) return false;
    if (filterQualityTag !== "all" && !((i as any).quality_tags ?? []).includes(filterQualityTag)) return false;
    return true;
  })?.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return (a.epic ?? "").localeCompare(b.epic ?? "");
  });

  const renderItemCard = (item: BacklogItem, compact = false) => {
    const collaborators = ((item as any).collaborator_ids ?? [])
      .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
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
        onClick={() => openDetail(item)}
        className={`transition-all cursor-pointer ${isDragging ? "opacity-40 scale-95" : "hover:shadow-sm"}`}
      >
        <CardContent className={`${compact ? "p-2.5" : "py-3 px-4"} flex items-center gap-2`}>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          {!compact && <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">#{displayNumbers[item.id] ?? "–"}</span>}
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
          {collaborators.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} />)}
              {collaborators.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center border border-background text-muted-foreground shrink-0">+{collaborators.length - 3}</div>
              )}
            </div>
          )}
          <QualityTagChips tags={(item as any).quality_tags ?? []} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                onClick={(e) => e.stopPropagation()}
                title="Slett item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slett «{item.title}»?</AlertDialogTitle>
                <AlertDialogDescription>
                  {itemSprintMap[item.id]
                    ? `Dette itemet er i ${itemSprintMap[item.id]}. Sletting fjerner det fra sprinten og sletter all tilknyttet data permanent.`
                    : "Dette sletter itemet permanent fra backlog, inkludert alle subtasks og endringslogg."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate(item.id)}
                >
                  Slett
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Product Backlog"
        description="Alle oppgaver — backlog, aktive i sprint, og fullførte"
        action={
          <div className="flex gap-2">
            {!refinementMode ? (
              <button className="py-2 px-4 rounded-[10px] bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors flex items-center gap-1.5"
                onClick={() => setRefinementMode(true)}>
                <ClipboardEdit className="h-3.5 w-3.5" /> Start Backlog Refinement
              </button>
            ) : (
              <button className="py-2 px-4 rounded-[10px] bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
                onClick={() => saveRefinementSession.mutate()} disabled={saveRefinementSession.isPending}>
                {saveRefinementSession.isPending ? "Lagrer..." : "Fullfør Refinement"}
              </button>
            )}
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Legg til
            </Button>
          </div>
        }
      />

      {/* Refinement banner */}
      {refinementMode && (
        <div className="card-elevated p-4 border-l-4 border-l-amber-500 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-semibold text-amber-700">Backlog Refinement pågår</span>
          </div>
          <textarea
            value={refinementNotes}
            onChange={(e) => setRefinementNotes(e.target.value)}
            placeholder="Refinement-notater: Hva ble diskutert, re-estimert, prioritert..."
            className="w-full text-sm rounded-[10px] border border-neutral-200 p-3 min-h-[48px] resize-none"
            rows={2}
          />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Lagt til: <strong className="text-foreground">{refinementStats.added}</strong></span>
            <span>Re-estimert: <strong className="text-foreground">{refinementStats.reestimated}</strong></span>
            <span>Omprioritert: <strong className="text-foreground">{refinementStats.reprioritized}</strong></span>
          </div>
          <button onClick={() => { setRefinementMode(false); setRefinementNotes(""); setRefinementStats({ added: 0, reestimated: 0, reprioritized: 0 }); }}
            className="text-xs text-muted-foreground hover:text-foreground">Avbryt refinement</button>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1.5">
        {[
          { key: "backlog" as const, label: "Backlog", count: items?.filter(i => !itemSprintMap[i.id]).length ?? 0 },
          { key: "active" as const, label: "Aktive i sprint", count: activeSprintItems.length },
          { key: "completed" as const, label: "Fullførte", count: completedItems.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key)}
            className={`py-2 px-4 rounded-[10px] text-sm font-medium transition-colors ${
              activeSection === tab.key
                ? "bg-primary/10 text-primary font-semibold"
                : "bg-white text-muted-foreground border border-neutral-200 hover:bg-neutral-50"
            }`}>
            {tab.label} <span className="ml-1 text-xs opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* === BACKLOG SECTION === */}
      {activeSection === "backlog" && <>
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
            {activeEpics.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {allQualityTags.length > 0 && (
          <Select value={filterQualityTag} onValueChange={setFilterQualityTag}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Kvalitetstag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle tags</SelectItem>
              {allQualityTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
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

      </>}

      {/* === ACTIVE SPRINT ITEMS SECTION === */}
      {activeSection === "active" && (
        <div className="card-elevated p-6 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Aktive oppgaver i sprint</p>
          {activeSprintItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen aktive sprint-items</p>
          ) : (
            <div className="space-y-1">
              {activeSprintItems.map((si: any) => {
                const item = si.backlog_item;
                if (!item) return null;
                const collaborators = ((item as any).collaborator_ids ?? [])
                  .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
                return (
                  <div key={si.id} className="flex items-center gap-3 py-3 px-4 border-b border-neutral-100 hover:bg-neutral-50 rounded-lg transition-colors">
                    <span className={`text-xs py-0.5 px-2 rounded-md font-medium ${typeColors[item.type] ?? "bg-muted"}`}>
                      {(typeLabels[item.type] ?? "").slice(0, 3)}
                    </span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.title}</span>
                    <span className={`text-xs py-0.5 px-2 rounded-md ${
                      si.column_name === "done" ? "bg-green-50 text-green-700" :
                      si.column_name === "in_progress" ? "bg-blue-50 text-blue-700" :
                      si.column_name === "review" ? "bg-amber-50 text-amber-700" :
                      "bg-neutral-100 text-neutral-600"
                    }`}>{columnLabels[si.column_name] ?? si.column_name}</span>
                    {item.estimate && <span className="text-xs text-muted-foreground tabular-nums">{item.estimate} SP</span>}
                    {collaborators.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} />)}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{si.sprint?.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === COMPLETED ITEMS SECTION === */}
      {activeSection === "completed" && (
        <div className="card-elevated p-6 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Fullførte oppgaver (alle sprinter)</p>
          {completedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Ingen fullførte items ennå</p>
          ) : (
            <div className="space-y-1">
              {completedItems.map((si: any) => {
                const item = si.backlog_item;
                if (!item) return null;
                const collaborators = ((item as any).collaborator_ids ?? [])
                  .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
                return (
                  <div key={si.id} className="flex items-center gap-3 py-3 px-4 border-b border-neutral-100 hover:bg-neutral-50 rounded-lg transition-colors">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    <span className={`text-xs py-0.5 px-2 rounded-md font-medium ${typeColors[item.type] ?? "bg-muted"}`}>
                      {(typeLabels[item.type] ?? "").slice(0, 3)}
                    </span>
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.title}</span>
                    {item.estimate && <span className="text-xs text-muted-foreground tabular-nums">{item.estimate} SP</span>}
                    {collaborators.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} />)}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">{si.sprint?.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === REFINEMENT HISTORY === */}
      {refinementSessions.length > 0 && (
        <div className="card-elevated p-5 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Refinement-historikk</p>
          </div>
          <div className="space-y-2">
            {refinementSessions.slice(0, 5).map((rs: any) => (
              <div key={rs.id} className="flex items-center gap-3 text-xs py-2 border-b border-neutral-100 last:border-0">
                <span className="text-muted-foreground">{format(parseISO(rs.session_date), "d. MMM yyyy", { locale: nb })}</span>
                <span>+{rs.tasks_added} lagt til · {rs.tasks_reestimated} re-estimert · {rs.tasks_reprioritized} omprioritert</span>
                {rs.notes && <span className="text-muted-foreground truncate flex-1">{rs.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nytt backlog-item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Pre-fill from requirement */}
            {(unlinkedRequirements?.length ?? 0) > 0 && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Forhåndsutfyll fra krav (valgfritt)</Label>
                <Select value="none" onValueChange={(v) => {
                  if (v === "none") return;
                  const req = unlinkedRequirements?.find((r) => r.id === v);
                  if (!req) return;
                  setNewItem((p) => ({
                    ...p,
                    title: `${req.id} — ${req.title}`,
                    description: [req.description, req.acceptance_criteria ? `\n\nAkseptansekriterie:\n${req.acceptance_criteria}` : null].filter(Boolean).join(""),
                    type: REQ_TYPE_MAP[req.type] ?? "user_story",
                    priority: REQ_PRIO_MAP[req.priority] ?? "should_have",
                  }));
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Velg krav for å forhåndsutfylle..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Velg krav —</SelectItem>
                    {unlinkedRequirements?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.id} — {r.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <Label>Status</Label>
                <Select value={newItem.status} onValueChange={(v) => setNewItem((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tildelt</Label>
                <div className="space-y-0.5 mt-1.5">
                  {members?.map((m) => {
                    const selected = newItem.collaborator_ids.includes(m.id);
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setNewItem((p) => ({
                          ...p,
                          collaborator_ids: selected
                            ? p.collaborator_ids.filter((id) => id !== m.id)
                            : [...p.collaborator_ids, m.id],
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
                <EpicSelector value={newItem.epic_id} onChange={(id) => setNewItem((p) => ({ ...p, epic_id: id }))} />
              </div>
            </div>
            <div>
              <Label>Kvalitetstags</Label>
              <QualityTagSelector value={newItem.quality_tags} onChange={(tags) => setNewItem((p) => ({ ...p, quality_tags: tags }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newItem.title || createMutation.isPending}>Opprett</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit detail dialog */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editForm && detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  <span className="text-muted-foreground font-mono text-sm mr-2">#{displayNumbers[detailItem.id] ?? "–"}</span>
                  Rediger item
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Tittel</Label><Input value={editForm.title} onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Beskrivelse</Label><Textarea value={editForm.description} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
                <div>
                  <Label>Brukerhistorie</Label>
                  <Textarea value={editForm.user_story} onChange={(e) => setEditForm((p: any) => ({ ...p, user_story: e.target.value }))}
                    placeholder="Som en [brukergruppe] vil jeg [funksjon] slik at [nytte]" rows={2} className="text-xs" />
                </div>
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
                  <div className="space-y-3">
                    <div>
                      <Label>Epic</Label>
                      <EpicSelector value={editForm.epic_id} onChange={(id) => setEditForm((p: any) => ({ ...p, epic_id: id }))} />
                    </div>
                    <div>
                      <Label>Kvalitetstags</Label>
                      <QualityTagSelector value={editForm.quality_tags ?? []} onChange={(tags) => setEditForm((p: any) => ({ ...p, quality_tags: tags }))} />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={detailItem.status} onValueChange={(v) => {
                        updateStatusMutation.mutate({ id: detailItem.id, status: v, oldStatus: detailItem.status });
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                  onClick={() => { deleteMutation.mutate(detailItem.id); setDetailItem(null); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Slett
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => setDetailItem(null)}>Avbryt</Button>
                <Button onClick={saveDetail} disabled={updateItemMutation.isPending}>
                  {updateItemMutation.isPending ? "Lagrer..." : "Lagre"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
