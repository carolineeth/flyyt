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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { toast } from "sonner";
import { Columns3, Plus, StickyNote, GripVertical, PanelRightOpen, Search, X, Check } from "lucide-react";
import type { Sprint, SprintItem, BacklogItem } from "@/lib/types";

const columns = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
] as const;

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
const storyPoints = [1, 2, 3, 5, 8, 13];

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

  // All backlog items (for add-from-backlog panel)
  const { data: allBacklogItems } = useQuery<BacklogItem[]>({
    queryKey: ["backlog_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("backlog_items").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Subtasks
  const { data: subtasks } = useQuery({
    queryKey: ["subtasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subtasks").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "" });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showBacklogPanel, setShowBacklogPanel] = useState(false);
  const [backlogSearch, setBacklogSearch] = useState("");
  const [backlogFilterType, setBacklogFilterType] = useState("all");
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set());
  const [inlineAddCol, setInlineAddCol] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [detailItem, setDetailItem] = useState<(SprintItem & { backlog_item: BacklogItem }) | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const wipLimit = 2;

  // Sprint summary
  const sprintSummary = useMemo(() => {
    if (!sprintItems) return null;
    const total = sprintItems.length;
    const totalSp = sprintItems.reduce((s, i) => s + (i.backlog_item?.estimate ?? 0), 0);
    const byCol: Record<string, number> = {};
    columns.forEach((c) => { byCol[c.key] = sprintItems.filter((i) => i.column_name === c.key).length; });
    return { total, totalSp, byCol };
  }, [sprintItems]);

  // Backlog items not in current sprint
  const availableBacklog = useMemo(() => {
    if (!allBacklogItems || !sprintItems) return [];
    const inSprint = new Set(sprintItems.map((si) => si.backlog_item_id));
    return allBacklogItems.filter((item) => {
      if (inSprint.has(item.id)) return false;
      if (backlogSearch && !item.title.toLowerCase().includes(backlogSearch.toLowerCase())) return false;
      if (backlogFilterType !== "all" && item.type !== backlogFilterType) return false;
      return true;
    });
  }, [allBacklogItems, sprintItems, backlogSearch, backlogFilterType]);

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

  const moveItemMutation = useMutation({
    mutationFn: async ({ itemId, newColumn }: { itemId: string; newColumn: string }) => {
      const { error } = await supabase.from("sprint_items").update({ column_name: newColumn }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprint_items"] }),
  });

  const addToSprintMutation = useMutation({
    mutationFn: async ({ backlogItemIds, column }: { backlogItemIds: string[]; column: string }) => {
      const inserts = backlogItemIds.map((id) => ({
        sprint_id: currentSprintId!,
        backlog_item_id: id,
        column_name: column,
      }));
      const { error } = await supabase.from("sprint_items").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setSelectedBacklogIds(new Set());
      toast.success("Lagt til i sprint");
    },
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
    mutationFn: async ({ title, column }: { title: string; column: string }) => {
      const { data, error } = await supabase.from("backlog_items").insert({
        item_id: "", title, type: "technical", priority: "should_have",
      }).select().single();
      if (error) throw error;
      await supabase.from("sprint_items").insert({
        sprint_id: currentSprintId!, backlog_item_id: data.id, column_name: column,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprint_items"] });
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setInlineAddCol(null);
      setInlineTitle("");
      toast.success("Item opprettet");
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

  const openDetail = (item: SprintItem & { backlog_item: BacklogItem }) => {
    setDetailItem(item);
    setEditForm({
      title: item.backlog_item?.title ?? "",
      description: item.backlog_item?.description ?? "",
      type: item.backlog_item?.type ?? "technical",
      priority: item.backlog_item?.priority ?? "should_have",
      estimate: item.backlog_item?.estimate,
      epic: item.backlog_item?.epic ?? "",
      collaborator_ids: (item.backlog_item as any)?.collaborator_ids ?? [],
    });
  };

  const saveDetail = () => {
    if (!detailItem) return;
    updateBacklogItemMutation.mutate({
      id: detailItem.backlog_item_id,
      title: editForm.title,
      description: editForm.description || null,
      type: editForm.type,
      priority: editForm.priority,
      estimate: editForm.estimate,
      epic: editForm.epic || null,
      collaborator_ids: editForm.collaborator_ids ?? [],
    } as any);
    setDetailItem(null);
  };

  const itemSubtasks = detailItem ? subtasks?.filter((s) => s.backlog_item_id === detailItem.backlog_item_id) ?? [] : [];

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Sprint Board"
        description="ScrumBan-board — dra kort mellom kolonner for å oppdatere status"
        action={
          <div className="flex gap-2">
            {currentSprintId && (
              <Button size="sm" variant="outline" onClick={() => setShowBacklogPanel(true)}>
                <PanelRightOpen className="h-4 w-4 mr-1" /> Legg til fra backlog
              </Button>
            )}
            <Button size="sm" onClick={() => setShowCreateSprint(true)}>
              <Plus className="h-4 w-4 mr-1" /> Ny sprint
            </Button>
          </div>
        }
      />

      {sprints && sprints.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
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

      {/* Sprint summary */}
      {sprintSummary && sprintSummary.total > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <span><strong className="text-foreground">{sprintSummary.total}</strong> items</span>
          <span><strong className="text-foreground">{sprintSummary.totalSp}</strong> sp</span>
          <span className="text-muted-foreground/60">|</span>
          {columns.map((c) => (
            <span key={c.key}>{c.label}: <strong className="text-foreground">{sprintSummary.byCol[c.key]}</strong></span>
          ))}
        </div>
      )}

      {!currentSprintId ? (
        <EmptyState icon={Columns3} title="Ingen sprinter ennå" description="Opprett din første sprint for å komme i gang med boardet" actionLabel="Opprett sprint" onAction={() => setShowCreateSprint(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {columns.map((col) => {
            const colItems = sprintItems?.filter((i) => i.column_name === col.key) ?? [];
            const isOverWip = col.key === "in_progress" && colItems.length > wipLimit * (members?.length ?? 6);
            const isDragTarget = dragOverCol === col.key;

            return (
              <div key={col.key} className="space-y-2"
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
                {isOverWip && <p className="text-[10px] text-destructive px-1">⚠️ WIP-limit overskredet</p>}
                <div className={`space-y-2 min-h-[120px] rounded-lg p-1 transition-colors ${isDragTarget ? "bg-primary/5 ring-2 ring-primary/20 ring-dashed" : ""}`}>
                  {colItems.map((item) => {
                    const collaborators = ((item.backlog_item as any)?.collaborator_ids ?? [])
                      .map((id: string) => members?.find((m) => m.id === id)).filter(Boolean);
                    const isDragging = draggedItemId === item.id;
                    return (
                      <Card key={item.id} draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={() => { setDraggedItemId(null); setDragOverCol(null); }}
                        onClick={() => openDetail(item)}
                        className={`shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40 scale-95" : ""}`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-1.5">
                            <GripVertical className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/40" />
                            <span className="text-[13px] font-medium leading-snug flex-1">{item.backlog_item?.title}</span>
                            {collaborators.length > 0 && (
                              <div className="flex -space-x-1.5 shrink-0">
                                {collaborators.slice(0, 3).map((m: any) => <MemberAvatar key={m.id} member={m} />)}
                                {collaborators.length > 3 && (
                                  <div className="h-5 w-5 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center border border-background text-muted-foreground shrink-0">+{collaborators.length - 3}</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap pl-5">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[item.backlog_item?.priority] ?? "bg-gray-400"}`} />
                            {item.backlog_item?.type && (
                              <Badge className={`text-[9px] ${typeColors[item.backlog_item.type] ?? ""}`}>
                                {typeLabels[item.backlog_item.type] ?? item.backlog_item.type}
                              </Badge>
                            )}
                            {item.backlog_item?.estimate && (
                              <span className="h-5 w-5 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center tabular-nums">{item.backlog_item.estimate}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {/* Inline add */}
                {inlineAddCol === col.key ? (
                  <div className="flex gap-1 p-1">
                    <Input
                      autoFocus
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      placeholder="Tittel..."
                      className="h-7 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inlineTitle.trim()) {
                          inlineCreateMutation.mutate({ title: inlineTitle.trim(), column: col.key });
                        }
                        if (e.key === "Escape") { setInlineAddCol(null); setInlineTitle(""); }
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setInlineAddCol(null); setInlineTitle(""); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setInlineAddCol(col.key)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 flex items-center justify-center gap-1 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Legg til
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create sprint dialog */}
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

      {/* Add from backlog sheet */}
      <Sheet open={showBacklogPanel} onOpenChange={setShowBacklogPanel}>
        <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Legg til fra backlog</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={backlogSearch} onChange={(e) => setBacklogSearch(e.target.value)} placeholder="Søk..." className="pl-8 h-9 text-sm" />
            </div>
            <Select value={backlogFilterType} onValueChange={setBacklogFilterType}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle typer</SelectItem>
                {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-1.5">
              {availableBacklog.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (selectedBacklogIds.size === 0) {
                      addToSprintMutation.mutate({ backlogItemIds: [item.id], column: "todo" });
                    } else {
                      setSelectedBacklogIds((prev) => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      });
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedBacklogIds.has(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={(checked) => {
                      setSelectedBacklogIds((prev) => {
                        const next = new Set(prev);
                        checked ? next.add(item.id) : next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge className={`text-[9px] ${typeColors[item.type] ?? ""}`}>{typeLabels[item.type]}</Badge>
                      {item.estimate && <span className="text-[10px] text-muted-foreground">{item.estimate}sp</span>}
                      <span className="text-[10px] text-muted-foreground">{priorityLabels[item.priority]}</span>
                    </div>
                  </div>
                </div>
              ))}
              {availableBacklog.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Ingen tilgjengelige items</p>
              )}
            </div>
            {selectedBacklogIds.size > 0 && (
              <Button className="w-full" onClick={() => addToSprintMutation.mutate({ backlogItemIds: Array.from(selectedBacklogIds), column: "todo" })}>
                Legg til {selectedBacklogIds.size} valgte
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editForm && detailItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  <span className="text-muted-foreground font-mono text-sm mr-2">{detailItem.backlog_item?.item_id}</span>
                  Rediger item
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Tittel</Label><Input value={editForm.title} onChange={(e) => setEditForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
                <div><Label>Beskrivelse</Label><Textarea value={editForm.description} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
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
                          addSubtaskMutation.mutate({ backlogItemId: detailItem.backlog_item_id, title: newSubtaskTitle.trim() });
                          setNewSubtaskTitle("");
                        }
                      }} />
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => {
                        if (newSubtaskTitle.trim()) {
                          addSubtaskMutation.mutate({ backlogItemId: detailItem.backlog_item_id, title: newSubtaskTitle.trim() });
                          setNewSubtaskTitle("");
                        }
                      }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="destructive" size="sm" onClick={() => removeFromSprintMutation.mutate(detailItem.id)}>
                  Fjern fra sprint
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => setDetailItem(null)}>Avbryt</Button>
                <Button onClick={saveDetail}>Lagre</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
