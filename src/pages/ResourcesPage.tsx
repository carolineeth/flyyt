import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, Plus, ExternalLink } from "lucide-react";
import type { Resource } from "@/lib/types";

const defaultCategories = ["Kode", "Design", "Dokumentasjon", "Prosjektstyring", "Fildeling", "APIer", "Kurs"];

export default function ResourcesPage() {
  const qc = useQueryClient();
  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("category").order("title");
      if (error) throw error;
      return data;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", category: "Kode", description: "" });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("resources").insert({
        title: form.title,
        url: form.url,
        category: form.category,
        description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      setShowCreate(false);
      setForm({ title: "", url: "", category: "Kode", description: "" });
      toast.success("Ressurs lagt til");
    },
  });

  // Group by category
  const grouped = resources?.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, Resource[]>) ?? {};

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Ressurs-hub"
        description="Samlet lenkesamling for alle prosjektressurser"
        action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Legg til</Button>}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Laster...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {items.map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors group"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">{r.title}</p>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </div>
                  </a>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny ressurs</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tittel</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Navn på ressursen" /></div>
            <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {defaultCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Beskrivelse</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Kort beskrivelse" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.url}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
