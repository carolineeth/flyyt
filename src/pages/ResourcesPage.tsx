import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, ExternalLink, Upload, FileText, Download, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploadCategory, setUploadCategory] = useState("Fildeling");
  const [showUploadNewCategory, setShowUploadNewCategory] = useState(false);
  const [uploadNewCategory, setUploadNewCategory] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [editForm, setEditForm] = useState({ title: "", url: "", category: "", description: "" });
  const [editNewCategory, setEditNewCategory] = useState("");
  const [showEditNewCategory, setShowEditNewCategory] = useState(false);

  // Delete state
  const [deletingResource, setDeletingResource] = useState<Resource | null>(null);

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
      setNewCategory("");
      setShowNewCategory(false);
      toast.success("Ressurs lagt til");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingResource) return;
      const { error } = await supabase.from("resources").update({
        title: editForm.title,
        url: editForm.url,
        category: editForm.category,
        description: editForm.description || null,
      }).eq("id", editingResource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      setEditingResource(null);
      toast.success("Ressurs oppdatert");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", resourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      setDeletingResource(null);
      toast.success("Ressurs fjernet");
    },
    onError: (err: any) => {
      toast.error("Kunne ikke fjerne: " + err.message);
    },
  });

  const openEdit = (r: Resource) => {
    setEditForm({ title: r.title, url: r.url, category: r.category, description: r.description ?? "" });
    setEditingResource(r);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    openUploadDialog(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openUploadDialog = (files: File[]) => {
    setPendingFiles(files);
    setUploadCategory("Fildeling");
    setShowUploadNewCategory(false);
    setUploadNewCategory("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) openUploadDialog(files);
  };

  const confirmUpload = async () => {
    if (!pendingFiles) return;
    setUploading(true);
    const category = showUploadNewCategory ? uploadNewCategory : uploadCategory;
    try {
      for (const file of pendingFiles) {
        const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const path = `resources/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);

        const { error: insertError } = await supabase.from("resources").insert({
          title: file.name,
          url: urlData.publicUrl,
          category,
          description: `Opplastet fil (${(file.size / 1024).toFixed(0)} KB)`,
        });
        if (insertError) throw insertError;
      }
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success(`${pendingFiles.length === 1 ? "Fil" : `${pendingFiles.length} filer`} lastet opp`);
    } catch (err: any) {
      toast.error("Opplasting feilet: " + (err.message ?? "Ukjent feil"));
    } finally {
      setUploading(false);
      setPendingFiles(null);
    }
  };

  const isFileUrl = (url: string) =>
    url.includes("/storage/v1/object/public/attachments/resources/");

  // Merge default + existing categories
  const allCategories = Array.from(new Set([...defaultCategories, ...(resources?.map((r) => r.category) ?? [])])).sort();

  // Group by category
  const grouped = resources?.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, Resource[]>) ?? {};

  const handleCategorySelect = (v: string, setter: typeof setForm, setShowNew: typeof setShowNewCategory) => {
    if (v === "__new__") {
      setShowNew(true);
    } else {
      setShowNew(false);
      setter((p) => ({ ...p, category: v }));
    }
  };

  return (
    <div
      className="space-y-8 scroll-reveal relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="border-2 border-dashed border-primary rounded-xl p-12 text-center">
            <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">Slipp filer her for å laste opp</p>
            <p className="text-sm text-muted-foreground mt-1">Velg kategori i neste steg</p>
          </div>
        </div>
      )}
      <PageHeader
        title="Ressurs-hub"
        description="Samlet lenkesamling og filer for alle prosjektressurser"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> {uploading ? "Laster opp…" : "Last opp fil"}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Legg til lenke
            </Button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          </div>
        }
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Laster...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {items.map((r) => {
                  const isFile = isFileUrl(r.url);
                  return (
                    <div
                      key={r.id}
                      className="flex items-start gap-2 p-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors group"
                    >
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 flex-1 min-w-0">
                        {isFile ? (
                          <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                        {isFile && <Download className="h-3.5 w-3.5 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                      </a>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Rediger
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeletingResource(r)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Fjern
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ny ressurs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Tittel</Label><Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Navn på ressursen" /></div>
            <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
            <div>
              <Label>Kategori</Label>
              <Select value={showNewCategory ? "__new__" : form.category} onValueChange={(v) => handleCategorySelect(v, setForm, setShowNewCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__new__">+ Ny kategori…</SelectItem>
                </SelectContent>
              </Select>
              {showNewCategory && (
                <Input
                  className="mt-2"
                  placeholder="Skriv inn ny kategori"
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value);
                    setForm((p) => ({ ...p, category: e.target.value }));
                  }}
                  autoFocus
                />
              )}
            </div>
            <div><Label>Beskrivelse</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Kort beskrivelse" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.url}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingResource} onOpenChange={(open) => !open && setEditingResource(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rediger ressurs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Tittel</Label><Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>URL</Label><Input value={editForm.url} onChange={(e) => setEditForm((p) => ({ ...p, url: e.target.value }))} /></div>
            <div>
              <Label>Kategori</Label>
              <Select value={showEditNewCategory ? "__new__" : editForm.category} onValueChange={(v) => handleCategorySelect(v, setEditForm, setShowEditNewCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__new__">+ Ny kategori…</SelectItem>
                </SelectContent>
              </Select>
              {showEditNewCategory && (
                <Input
                  className="mt-2"
                  placeholder="Skriv inn ny kategori"
                  value={editNewCategory}
                  onChange={(e) => {
                    setEditNewCategory(e.target.value);
                    setEditForm((p) => ({ ...p, category: e.target.value }));
                  }}
                  autoFocus
                />
              )}
            </div>
            <div><Label>Beskrivelse</Label><Textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingResource(null)}>Avbryt</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={!editForm.title || !editForm.url}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingResource} onOpenChange={(open) => !open && setDeletingResource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjern ressurs</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på at du vil fjerne «{deletingResource?.title}»? Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingResource && deleteMutation.mutate(deletingResource.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload category dialog */}
      <Dialog open={!!pendingFiles} onOpenChange={(open) => !open && setPendingFiles(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Last opp {pendingFiles?.length === 1 ? "fil" : `${pendingFiles?.length} filer`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {pendingFiles?.map((f) => f.name).join(", ")}
            </div>
            <div>
              <Label>Kategori</Label>
              <Select
                value={showUploadNewCategory ? "__new__" : uploadCategory}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setShowUploadNewCategory(true);
                  } else {
                    setShowUploadNewCategory(false);
                    setUploadCategory(v);
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__new__">+ Ny kategori…</SelectItem>
                </SelectContent>
              </Select>
              {showUploadNewCategory && (
                <Input
                  className="mt-2"
                  placeholder="Skriv inn ny kategori"
                  value={uploadNewCategory}
                  onChange={(e) => setUploadNewCategory(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingFiles(null)}>Avbryt</Button>
            <Button onClick={confirmUpload} disabled={uploading || (showUploadNewCategory && !uploadNewCategory)}>
              {uploading ? "Laster opp…" : "Last opp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
