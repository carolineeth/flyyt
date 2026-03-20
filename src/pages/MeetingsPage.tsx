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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Users, Plus } from "lucide-react";
import type { Meeting } from "@/lib/types";

const typeLabels: Record<string, string> = {
  daily_standup: "Daily Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  advisor: "Veiledermøte",
  other: "Annet",
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ type: "daily_standup", date: new Date().toISOString().slice(0, 16), notes: "", participants: [] as string[] });

  const toggleParticipant = (id: string) => {
    setForm((p) => ({
      ...p,
      participants: p.participants.includes(id) ? p.participants.filter((x) => x !== id) : [...p.participants, id],
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").insert({
        type: form.type,
        date: new Date(form.date).toISOString(),
        notes: form.notes || null,
        participants: form.participants,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setShowCreate(false);
      toast.success("Møte registrert");
    },
  });

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Møtelogg"
        description="Logg alle møter — standup, planning, review, retro og veiledermøter"
        action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Nytt møte</Button>}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Laster...</p> : !meetings?.length ? (
        <EmptyState icon={Users} title="Ingen møter logget" description="Registrer det første møtet for å begynne å bygge møtehistorikken" actionLabel="Legg til møte" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const participantMembers = members?.filter((mem) => m.participants?.includes(mem.id)) ?? [];
            return (
              <Card key={m.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(m.date).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{typeLabels[m.type]}</Badge>
                  </div>
                  {m.notes && <p className="text-sm text-foreground whitespace-pre-wrap">{m.notes}</p>}
                  {participantMembers.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {participantMembers.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[10px]">{p.name.split(" ")[0]}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nytt møte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Dato og tid</Label><Input type="datetime-local" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
            <div>
              <Label>Deltakere</Label>
              <div className="flex flex-wrap gap-3 mt-1">
                {members?.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.participants.includes(m.id)} onCheckedChange={() => toggleParticipant(m.id)} />
                    {m.name.split(" ")[0]}
                  </label>
                ))}
              </div>
            </div>
            <div><Label>Notater / Agenda</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notater fra møtet..." rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
