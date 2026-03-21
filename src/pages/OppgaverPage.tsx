import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { CheckSquare, Plus, GripVertical, MoreHorizontal, Trash2, Pencil, Calendar } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, isPast, isToday } from "date-fns";
import { nb } from "date-fns/locale";

const categories = [
  { key: "all", label: "Alle", color: "" },
  { key: "rapport", label: "Rapport", color: "bg-[#EEEDFE] text-[#3C3489]" },
  { key: "design", label: "Design", color: "bg-[#FBEAF0] text-[#72243E]" },
  { key: "admin", label: "Admin", color: "bg-[#F1EFE8] text-[#444441]" },
  { key: "research", label: "Research", color: "bg-[#E1F5EE] text-[#085041]" },
  { key: "presentasjon", label: "Presentasjon", color: "bg-[#E6F1FB] text-[#0C447C]" },
  { key: "diverse", label: "Diverse", color: "bg-amber-100 text-amber-800" },
] as const;

const categoryColors: Record<string, string> = Object.fromEntries(categories.filter(c => c.key !== "all").map(c => [c.key, c.color]));

type Task = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  assignee_id: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  created_by: string | null;
};

export default function OppgaverPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { currentMember } = useCurrentTeamMember();
  const memberId = currentMember?.id;

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskSubtasks } = useQuery({
    queryKey: ["task_subtasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_subtasks").select("*").order("created_at");
      if (error) throw error;
      return data as { id: string; task_id: string; title: string; is_completed: boolean; created_at: string }[];
    },
  });

  const [filterCategory, setFilterCategory] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineCategory, setInlineCategory] = useState("diverse");
  const [showDetail, setShowDetail] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editTask, setEditTask] = useState<any>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = tasks ?? [];
    if (filterCategory !== "all") list = list.filter(t => t.category === filterCategory);
    if (!showCompleted) list = list.filter(t => !t.is_completed);
    if (showMine && memberId) list = list.filter(t => t.assignee_id === memberId);
    return list.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (!a.is_completed && !b.is_completed) {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
      }
      return a.sort_order - b.sort_order;
    });
  }, [tasks, filterCategory, showCompleted, showMine, memberId]);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; category: string; assignee_id?: string | null; due_date?: string | null; description?: string | null }) => {
      const { error } = await supabase.from("tasks").insert({
        title: data.title,
        category: data.category,
        assignee_id: data.assignee_id ?? null,
        due_date: data.due_date ?? null,
        description: data.description ?? null,
        created_by: memberId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setInlineTitle("");
      toast.success("Oppgave opprettet");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("tasks").update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setShowDetail(false);
      toast.success("Oppdatert");
    },
  });

  const addTaskSubtask = useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const { error } = await supabase.from("task_subtasks").insert({ task_id: taskId, title });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_subtasks"] }),
  });

  const toggleTaskSubtask = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("task_subtasks").update({ is_completed: completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_subtasks"] }),
  });

  const deleteTaskSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_subtasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Slettet");
    },
  });

  const openEdit = (task: Task) => {
    setEditTask({ ...task });
    setShowDetail(true);
  };

  const formatDue = (d: string) => {
    try {
      return format(new Date(d), "d. MMM", { locale: nb });
    } catch { return d; }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader title="Oppgaver" description="For oppgaver som ikke er direkte knyttet til app-utvikling. Brukerhistorier og tekniske oppgaver hører hjemme i Sprinter." />

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map((c) => (
          <button key={c.key} onClick={() => setFilterCategory(c.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategory === c.key
                ? "bg-primary text-primary-foreground"
                : c.key === "all" ? "bg-muted text-muted-foreground hover:bg-accent" : `${c.color} hover:opacity-80`
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showCompleted} onCheckedChange={setShowCompleted} className="scale-75" />
          Vis fullførte
        </label>
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={showMine} onCheckedChange={setShowMine} className="scale-75" />
          Mine oppgaver
        </label>
      </div>

      {/* Inline add */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input value={inlineTitle} onChange={(e) => setInlineTitle(e.target.value)}
          placeholder="Ny oppgave..." className="border-0 shadow-none h-8 text-sm p-0 focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && inlineTitle.trim()) {
              createMutation.mutate({ title: inlineTitle.trim(), category: inlineCategory });
            }
          }} />
        <div className="flex gap-1 shrink-0">
          {categories.filter(c => c.key !== "all").map(c => (
            <button key={c.key} onClick={() => setInlineCategory(c.key)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                inlineCategory === c.key ? `${c.color} ring-1 ring-foreground/20` : "bg-muted text-muted-foreground opacity-50 hover:opacity-100"
              }`}>
              {c.label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : !filtered.length ? (
        <EmptyState icon={CheckSquare} title="Ingen oppgaver" description="Legg til din første oppgave ovenfor" />
      ) : (
        <div className="space-y-0.5">
          {filtered.map((task) => {
            const assignee = members?.find(m => m.id === task.assignee_id);
            const overdue = task.due_date && !task.is_completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
            return (
              <div key={task.id}
                draggable
                onDragStart={(e) => { setDraggedId(task.id); e.dataTransfer.setData("text/plain", task.id); }}
                onDragEnd={() => setDraggedId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("text/plain");
                  if (from && from !== task.id) {
                    updateMutation.mutate({ id: from, sort_order: task.sort_order });
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-accent/50 ${
                  task.is_completed ? "opacity-50" : ""
                } ${draggedId === task.id ? "opacity-30" : ""}`}>
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 cursor-grab" />
                <Checkbox checked={task.is_completed}
                  onCheckedChange={(v) => toggleMutation.mutate({ id: task.id, completed: !!v })} />
                <Badge className={`text-[8px] px-1 py-0 shrink-0 ${categoryColors[task.category] ?? "bg-muted"}`}>
                  {task.category.slice(0, 3)}
                </Badge>
                <span className={`flex-1 min-w-0 truncate text-[13px] font-medium ${task.is_completed ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </span>
                {task.due_date && (
                  <span className={`text-[11px] shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {formatDue(task.due_date)}
                  </span>
                )}
                {assignee && <MemberAvatar member={assignee} />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(task)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rediger
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(task.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Slett
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editTask && (() => {
            const subs = taskSubtasks?.filter((s) => s.task_id === editTask.id) ?? [];
            return (
              <>
                <DialogHeader><DialogTitle>Rediger oppgave</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Tittel</Label><Input value={editTask.title} onChange={(e) => setEditTask((p: any) => ({ ...p, title: e.target.value }))} /></div>
                  <div><Label>Beskrivelse</Label><Textarea value={editTask.description ?? ""} onChange={(e) => setEditTask((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Kategori</Label>
                      <Select value={editTask.category} onValueChange={(v) => setEditTask((p: any) => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => c.key !== "all").map(c => (
                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ansvarlig</Label>
                      <Select value={editTask.assignee_id ?? ""} onValueChange={(v) => setEditTask((p: any) => ({ ...p, assignee_id: v || null }))}>
                        <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                        <SelectContent>{members?.map(m => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Bidragsytere</Label>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {members?.map((m) => {
                        const selected = (editTask.collaborator_ids ?? []).includes(m.id);
                        return (
                          <button key={m.id} type="button"
                            onClick={() => setEditTask((p: any) => ({
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
                    <Label>Frist</Label>
                    <Input type="date" value={editTask.due_date ?? ""} onChange={(e) => setEditTask((p: any) => ({ ...p, due_date: e.target.value || null }))} />
                  </div>

                  {/* Subtasks */}
                  <div>
                    <Label className="mb-1 block">Deloppgaver</Label>
                    <div className="space-y-1">
                      {subs.map((st) => (
                        <div key={st.id} className="flex items-center gap-2">
                          <Checkbox checked={st.is_completed} onCheckedChange={(v) => toggleTaskSubtask.mutate({ id: st.id, completed: !!v })} />
                          <span className={`text-sm flex-1 ${st.is_completed ? "line-through text-muted-foreground" : ""}`}>{st.title}</span>
                          <button onClick={() => deleteTaskSubtask.mutate(st.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Ny deloppgave..." className="h-7 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSubtaskTitle.trim()) {
                            addTaskSubtask.mutate({ taskId: editTask.id, title: newSubtaskTitle.trim() });
                            setNewSubtaskTitle("");
                          }
                        }} />
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => { if (newSubtaskTitle.trim()) { addTaskSubtask.mutate({ taskId: editTask.id, title: newSubtaskTitle.trim() }); setNewSubtaskTitle(""); } }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowDetail(false)}>Avbryt</Button>
                  <Button onClick={() => updateMutation.mutate({
                    id: editTask.id, title: editTask.title,
                    description: editTask.description || null,
                    category: editTask.category, assignee_id: editTask.assignee_id,
                    due_date: editTask.due_date || null,
                    collaborator_ids: editTask.collaborator_ids ?? [],
                  })}>Lagre</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
