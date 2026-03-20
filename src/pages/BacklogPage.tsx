import { useState } from "react";
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
import { ListTodo, Plus, Filter } from "lucide-react";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { BacklogItem } from "@/lib/types";

const typeLabels: Record<string, string> = {
  user_story: "Brukerhistorie",
  technical: "Teknisk",
  design: "Design",
  report: "Rapport",
  admin: "Admin",
};
const typeColors: Record<string, string> = {
  user_story: "bg-blue-100 text-blue-700",
  technical: "bg-blue-100 text-blue-700",
  design: "bg-pink-100 text-pink-700",
  report: "bg-purple-100 text-purple-700",
  admin: "bg-gray-100 text-gray-600",
};
const priorityLabels: Record<string, string> = {
  must_have: "Må ha",
  should_have: "Bør ha",
  nice_to_have: "Fint å ha",
};
const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  sprint_ready: "Sprint Ready",
  in_sprint: "I Sprint",
  done: "Done",
};
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

  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newItem, setNewItem] = useState({
    title: "", description: "", type: "user_story", priority: "should_have",
    estimate: null as number | null, epic: "", assignee_id: null as string | null,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("backlog_items").insert({
        item_id: "", // auto-generated
        title: newItem.title,
        description: newItem.description || null,
        type: newItem.type,
        priority: newItem.priority,
        estimate: newItem.estimate,
        epic: newItem.epic || null,
        assignee_id: newItem.assignee_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backlog_items"] });
      setShowCreate(false);
      setNewItem({ title: "", description: "", type: "user_story", priority: "should_have", estimate: null, epic: "", assignee_id: null });
      toast.success("Backlog-item opprettet");
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = items?.filter((i) => {
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Product Backlog"
        description="Alle brukerhistorier, oppgaver og arbeidselementer for prosjektet"
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Legg til
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statuser</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Items */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : !filtered?.length ? (
        <EmptyState
          icon={ListTodo}
          title="Ingen items i backlog"
          description="Opprett det første backlog-itemet for å komme i gang"
          actionLabel="Legg til item"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const assignee = members?.find((m) => m.id === item.assignee_id);
            return (
              <Card key={item.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">{item.item_id}</span>
                  <Badge className={`text-[10px] shrink-0 ${typeColors[item.type] ?? ""}`}>
                    {typeLabels[item.type]}
                  </Badge>
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.title}</span>
                  {item.estimate && (
                    <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">{item.estimate}sp</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] shrink-0">{priorityLabels[item.priority]}</Badge>
                  <Badge variant="outline" className="text-[10px] shrink-0">{statusLabels[item.status]}</Badge>
                  {assignee && <MemberAvatar member={assignee} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nytt backlog-item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tittel</Label>
              <Input value={newItem.title} onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))} placeholder="Kort beskrivende tittel" />
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} placeholder="Som [rolle] ønsker jeg [mål] for å [effekt]" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={newItem.type} onValueChange={(v) => setNewItem((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioritet</Label>
                <Select value={newItem.priority} onValueChange={(v) => setNewItem((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Story Points</Label>
                <Select value={newItem.estimate?.toString() ?? ""} onValueChange={(v) => setNewItem((p) => ({ ...p, estimate: parseInt(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                  <SelectContent>
                    {storyPoints.map((sp) => <SelectItem key={sp} value={sp.toString()}>{sp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ansvarlig</Label>
                <Select value={newItem.assignee_id ?? ""} onValueChange={(v) => setNewItem((p) => ({ ...p, assignee_id: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Velg" /></SelectTrigger>
                  <SelectContent>
                    {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Epic/Kategori</Label>
              <Input value={newItem.epic} onChange={(e) => setNewItem((p) => ({ ...p, epic: e.target.value }))} placeholder="f.eks. Kartvisning, UX Research" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newItem.title || createMutation.isPending}>
              Opprett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
