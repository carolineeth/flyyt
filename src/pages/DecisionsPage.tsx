import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Scale, Plus } from "lucide-react";
import type { Decision } from "@/lib/types";

const sourceLabels: Record<string, string> = { slack: "Slack", meeting: "Møte", workshop: "Workshop" };

export default function DecisionsPage() {
  const qc = useQueryClient();
  const { data: decisions, isLoading } = useQuery<Decision[]>({
    queryKey: ["decisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("decisions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", context: "", choice: "", rationale: "", source: "meeting" as string, date: new Date().toISOString().split("T")[0] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("decisions").insert({
        title: form.title,
        context: form.context || null,
        choice: form.choice || null,
        rationale: form.rationale || null,
        source: form.source,
        date: form.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions"] });
      setShowCreate(false);
      setForm({ title: "", context: "", choice: "", rationale: "", source: "meeting", date: new Date().toISOString().split("T")[0] });
      toast.success("Beslutning registrert");
    },
  });

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Beslutningslogg"
        description="Dokumenter viktige beslutninger med kontekst og begrunnelse"
        action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Ny beslutning</Button>}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Laster...</p> : !decisions?.length ? (
        <EmptyState icon={Scale} title="Ingen beslutninger ennå" description="Loggfør den første beslutningen for å bygge beslutningshistorikk" actionLabel="Legg til" onAction={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{new Date(d.date).toLocaleDateString("nb-NO")}</span>
                  {d.source && <Badge variant="secondary" className="text-[10px]">{sourceLabels[d.source] ?? d.source}</Badge>}
                </div>
                <h3 className="text-sm font-medium">{d.title}</h3>
                {d.context && <p className="text-sm text-muted-foreground"><span className="font-medium">Kontekst:</span> {d.context}</p>}
                {d.choice && <p className="text-sm"><span className="font-medium text-muted-foreground">Valg:</span> {d.choice}</p>}
                {d.rationale && <p className="text-sm text-muted-foreground"><span className="font-medium">Begrunnelse:</span> {d.rationale}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny beslutning</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Dato</Label><Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
            <div><Label>Beslutning</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Kort tittel" /></div>
            <div><Label>Kontekst</Label><Textarea value={form.context} onChange={(e) => setForm((p) => ({ ...p, context: e.target.value }))} placeholder="Hvorfor ble dette et spørsmål?" rows={2} /></div>
            <div><Label>Valg</Label><Textarea value={form.choice} onChange={(e) => setForm((p) => ({ ...p, choice: e.target.value }))} placeholder="Hva ble bestemt?" rows={2} /></div>
            <div><Label>Begrunnelse</Label><Textarea value={form.rationale} onChange={(e) => setForm((p) => ({ ...p, rationale: e.target.value }))} placeholder="Hvorfor dette valget?" rows={2} /></div>
            <div>
              <Label>Kilde</Label>
              <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="meeting">Møte</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
