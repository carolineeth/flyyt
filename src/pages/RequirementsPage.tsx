import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useSeedRequirementChangelog,
  logRequirementChange,
  PRIORITY_DISPLAY,
  STATUS_DISPLAY,
} from "@/hooks/useRequirementChangelog";
import { logBacklogChange } from "@/lib/backlogChangelog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Link2,
  X,
  ExternalLink,
  Download,
  Plus,
} from "lucide-react";

type Requirement = {
  id: string;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  type: "functional" | "non_functional" | "documentation";
  category: string;
  priority: "must" | "should" | "could" | "wont";
  source: string | null;
  status: "not_started" | "in_progress" | "implemented" | "verified";
  linked_backlog_item_id: string | null;
  notes: string | null;
  sort_order: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  Værkart: "Værkart (Victoria WMS)",
  Tidslinje: "Tidslinje og animasjon",
  Farevarsler: "Farevarsler",
  Punktdata: "Punktdata",
  Tillegg: "Tilleggsfunksjonalitet",
  Arkitektur: "Arkitektur og teknologi",
  Robusthet: "Robusthet og feilhåndtering",
  Testing: "Testing",
  Tilgjengelighet: "Tilgjengelighet",
  Dokumentasjon: "Dokumentasjon",
};

const PRIORITY_LABELS: Record<string, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "I utvikling",
  implemented: "Implementert",
  verified: "Verifisert",
};

const TYPE_LABELS: Record<string, string> = {
  functional: "Funksjonell",
  non_functional: "Ikke-funksjonell",
  documentation: "Dokumentasjon",
};

export default function RequirementsPage() {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const initializedRef = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newReq, setNewReq] = useState({
    type: "functional" as "functional" | "non_functional" | "documentation",
    category: "Værkart",
    title: "",
    description: "",
    acceptance_criteria: "",
    priority: "should" as "must" | "should" | "could" | "wont",
  });

  const { data: requirements, isLoading } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirements" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data as unknown) as Requirement[];
    },
  });

  const { data: backlogItems } = useQuery<
    { id: string; item_id: string; title: string; status: string; type: string }[]
  >({
    queryKey: ["backlog_items_for_req"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlog_items")
        .select("id, item_id, title, status, type")
        .order("sort_order");
      if (error) throw error;
      return data as { id: string; item_id: string; title: string; status: string; type: string }[];
    },
  });

  // Junction table: many-to-many links
  const { data: reqLinks = [] } = useQuery<{ id: string; requirement_id: string; backlog_item_id: string }[]>({
    queryKey: ["requirement_backlog_links"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("requirement_backlog_links" as any)
        .select("id, requirement_id, backlog_item_id") as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: async ({ requirementId, backlogItemId }: { requirementId: string; backlogItemId: string }) => {
      const { error } = await (supabase.from("requirement_backlog_links" as any).insert({
        requirement_id: requirementId,
        backlog_item_id: backlogItemId,
      } as any) as any);
      if (error) throw error;
      // Double-write to old column as backup (fail silently)
      try { await (supabase.from("requirements" as any).update({ linked_backlog_item_id: backlogItemId } as any).eq("id", requirementId) as any); } catch {}
    },
    onSuccess: (_, { requirementId, backlogItemId }) => {
      queryClient.invalidateQueries({ queryKey: ["requirement_backlog_links"] });
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      const item = backlogItems?.find((b) => b.id === backlogItemId);
      logRequirementChange({
        requirement_id: requirementId,
        change_type: "added_to_backlog",
        new_value: backlogItemId,
        description: `Koblet til backlog-item: ${item?.title ?? backlogItemId}`,
      });
      toast.success("Kobling lagt til");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeLinkMutation = useMutation({
    mutationFn: async ({ requirementId, backlogItemId }: { requirementId: string; backlogItemId: string }) => {
      const { error } = await (supabase.from("requirement_backlog_links" as any)
        .delete()
        .eq("requirement_id", requirementId)
        .eq("backlog_item_id", backlogItemId) as any);
      if (error) throw error;
      // Check if this was the last link; if so, clear old column (fail silently)
      const remaining = reqLinks.filter((l) => l.requirement_id === requirementId && l.backlog_item_id !== backlogItemId);
      if (remaining.length === 0) {
        try { await (supabase.from("requirements" as any).update({ linked_backlog_item_id: null } as any).eq("id", requirementId) as any); } catch {}
      }
    },
    onSuccess: (_, { requirementId, backlogItemId }) => {
      queryClient.invalidateQueries({ queryKey: ["requirement_backlog_links"] });
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      const item = backlogItems?.find((b) => b.id === backlogItemId);
      logRequirementChange({
        requirement_id: requirementId,
        change_type: "removed_from_backlog",
        old_value: backlogItemId,
        description: `Fjernet kobling til backlog-item: ${item?.title ?? backlogItemId}`,
      });
      toast.success("Kobling fjernet");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ── Seed changelog once on first load ──
  const seedChangelog = useSeedRequirementChangelog();
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    seedChangelog.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateReq = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Requirement>) => {
      const { error } = await supabase
        .from("requirements" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["requirements"] }),
    onError: () => toast.error("Kunne ikke oppdatere krav"),
  });

  const handleUpdate = (id: string, field: string, value: any) => {
    const current = requirements?.find((r) => r.id === id);

    updateReq.mutate(
      { id, [field]: value } as any,
      {
        onSuccess: () => {
          toast.success("Oppdatert");
          // Log the change
          if (field === "status" && current) {
            logRequirementChange({
              requirement_id: id,
              change_type: "status_changed",
              field_changed: "status",
              old_value: current.status,
              new_value: value,
              description: `Status endret fra ${STATUS_DISPLAY[current.status] ?? current.status} til ${STATUS_DISPLAY[value] ?? value}`,
            });
          } else if (field === "priority" && current) {
            logRequirementChange({
              requirement_id: id,
              change_type: "priority_changed",
              field_changed: "priority",
              old_value: current.priority,
              new_value: value,
              description: `Prioritet endret fra ${PRIORITY_DISPLAY[current.priority] ?? current.priority} til ${PRIORITY_DISPLAY[value] ?? value}`,
            });
          }
        },
      }
    );
  };

  // ── Create new requirement ──
  const createReqMutation = useMutation({
    mutationFn: async (form: typeof newReq) => {
      const all = requirements ?? [];
      // Auto-generate ID: FK-XX, NFK-XX, DK-XX
      const prefix =
        form.type === "functional" ? "FK" :
        form.type === "non_functional" ? "NFK" : "DK";
      const existing = all.filter((r) => r.type === form.type);
      const nums = existing.map((r) => parseInt(r.id.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const id = `${prefix}-${String(nextNum).padStart(2, "0")}`;
      const maxSort = all.length > 0 ? Math.max(...all.map((r) => r.sort_order)) : 0;

      const { error } = await (supabase
        .from("requirements" as any)
        .insert({
          id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          acceptance_criteria: form.acceptance_criteria.trim() || null,
          type: form.type,
          category: form.category,
          priority: form.priority,
          status: "not_started",
          sort_order: maxSort + 1,
        } as any) as any);
      if (error) throw error;

      await logRequirementChange({
        requirement_id: id,
        change_type: "created",
        description: `Krav opprettet: ${form.title.trim()}`,
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      toast.success("Krav opprettet");
      setCreateOpen(false);
      setNewReq({ type: "functional", category: "Værkart", title: "", description: "", acceptance_criteria: "", priority: "should" });
      setSelectedId(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Delete requirement ──
  const deleteReqMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("requirements" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      queryClient.invalidateQueries({ queryKey: ["requirement_changes"] });
      toast.success("Krav slettet");
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Create backlog item from requirement ──
  const REQ_TYPE_TO_BACKLOG: Record<string, string> = {
    functional: "user_story",
    non_functional: "technical",
    documentation: "technical",
  };
  const REQ_PRIORITY_TO_BACKLOG: Record<string, string> = {
    must: "must_have",
    should: "should_have",
    could: "nice_to_have",
    wont: "nice_to_have",
  };

  const createBacklogItemMutation = useMutation({
    mutationFn: async (req: Requirement) => {
      const desc = [
        req.description,
        req.acceptance_criteria ? `\n\nAkseptansekriterie:\n${req.acceptance_criteria}` : null,
      ].filter(Boolean).join("") || null;

      const { data, error } = await supabase
        .from("backlog_items")
        .insert({
          item_id: "",
          title: `${req.id} — ${req.title}`,
          description: desc,
          type: REQ_TYPE_TO_BACKLOG[req.type] ?? "user_story",
          priority: REQ_PRIORITY_TO_BACKLOG[req.priority] ?? "should_have",
          status: "backlog",
        })
        .select()
        .single();
      if (error) throw error;

      // Link via junction table (new)
      const { error: junctionErr } = await (supabase.from("requirement_backlog_links" as any).insert({
        requirement_id: req.id,
        backlog_item_id: data.id,
      } as any) as any);
      if (junctionErr) throw junctionErr;
      // Double-write to old column as backup (fail silently)
      try { await (supabase.from("requirements" as any).update({ linked_backlog_item_id: data.id } as any).eq("id", req.id) as any); } catch {}

      // Log to both changelogs
      await logRequirementChange({
        requirement_id: req.id,
        change_type: "added_to_backlog",
        new_value: data.id,
        description: `Oppgave opprettet i backlog og koblet til kravet`,
      });
      await logBacklogChange({ backlogItemId: data.id, changeType: "created", newValue: data.title });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      queryClient.invalidateQueries({ queryKey: ["requirement_backlog_links"] });
      queryClient.invalidateQueries({ queryKey: ["backlog_items_for_req"] });
      queryClient.invalidateQueries({ queryKey: ["backlog_items"] });
      toast.success("Oppgave opprettet i backlog og koblet til kravet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (!requirements || initializedRef.current) return;
    initializedRef.current = true;
    const newCollapsed: Record<string, boolean> = {};
    const cats = new Set(requirements.map((r) => r.category));
    cats.forEach((cat) => {
      const catItems = requirements.filter((r) => r.category === cat);
      const hasUnimplementedMust = catItems.some(
        (r) =>
          r.priority === "must" &&
          r.status !== "implemented" &&
          r.status !== "verified"
      );
      newCollapsed[cat] = !hasUnimplementedMust;
    });
    setCollapsed(newCollapsed);
  }, [requirements]);

  const filtered = useMemo(() => {
    if (!requirements) return [];
    return requirements.filter((r) => {
      if (filterType !== "all") {
        if (r.type !== filterType) return false;
      }
      if (filterPriority !== "all" && r.priority !== filterPriority)
        return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.id.toLowerCase().includes(q) &&
          !r.title.toLowerCase().includes(q) &&
          !(r.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [requirements, filterType, filterPriority, filterStatus, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    filtered.forEach((r) => {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    });
    return Array.from(map.entries()).sort(
      (a, b) =>
        Math.min(...a[1].map((r) => r.sort_order)) -
        Math.min(...b[1].map((r) => r.sort_order))
    );
  }, [filtered]);

  const fkItems = requirements?.filter((r) => r.type === "functional") ?? [];
  const nfkItems =
    requirements?.filter((r) => r.type === "non_functional") ?? [];
  const mustItems = requirements?.filter((r) => r.priority === "must") ?? [];

  const implementedCount = (arr: Requirement[]) =>
    arr.filter(
      (r) => r.status === "implemented" || r.status === "verified"
    ).length;

  const mustPct =
    mustItems.length > 0
      ? implementedCount(mustItems) / mustItems.length
      : 0;

  const unlinkedCount =
    requirements?.filter((r) => !reqLinks.some((l) => l.requirement_id === r.id)).length ?? 0;

  const selectedReq = requirements?.find((r) => r.id === selectedId) ?? null;

  // Links for the selected requirement
  const selectedReqLinks = useMemo(() => {
    if (!selectedReq) return [];
    return reqLinks.filter((l) => l.requirement_id === selectedReq.id);
  }, [reqLinks, selectedReq]);

  const selectedLinkedItems = useMemo(() => {
    if (!backlogItems) return [];
    return selectedReqLinks
      .map((l) => backlogItems.find((b) => b.id === l.backlog_item_id))
      .filter(Boolean) as { id: string; item_id: string; title: string; status: string; type: string }[];
  }, [selectedReqLinks, backlogItems]);

  // Backlog items NOT yet linked to this requirement (for dropdown)
  const availableBacklogItems = useMemo(() => {
    if (!backlogItems || !selectedReq) return [];
    const linkedIds = new Set(selectedReqLinks.map((l) => l.backlog_item_id));
    return backlogItems.filter((b) => !linkedIds.has(b.id));
  }, [backlogItems, selectedReq, selectedReqLinks]);

  const someLinkedDone = selectedLinkedItems.some((b) => b.status === "done" || b.status === "in_progress");

  const exportMarkdown = () => {
    if (!requirements) return;
    const header =
      "| ID | Krav | Type | Prioritet | Status |\n|----|------|------|-----------|--------|\n";
    const rows = [...requirements]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (r) =>
          `| ${r.id} | ${r.title} | ${TYPE_LABELS[r.type]} | ${PRIORITY_LABELS[r.priority]} | ${STATUS_LABELS[r.status]} |`
      )
      .join("\n");
    navigator.clipboard.writeText(header + rows);
    toast.success("Kravtabell kopiert til utklippstavlen");
  };

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const priorityBadgeStyle = (priority: string): React.CSSProperties => {
    if (priority === "must")
      return {
        background: "#FCEBEB",
        color: "#791F1F",
        fontSize: "11px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      };
    if (priority === "should")
      return {
        background: "#FAEEDA",
        color: "#633806",
        fontSize: "11px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      };
    return {
      background: "#F1EFE8",
      color: "#444441",
      fontSize: "11px",
      padding: "3px 8px",
      borderRadius: "9999px",
      fontWeight: 500,
      whiteSpace: "nowrap",
    };
  };

  const statusBadgeContent = (req: Requirement) => {
    if (req.status === "not_started")
      return (
        <span
          style={{
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "6px",
            border: "1px solid rgba(100,100,100,0.3)",
            color: "var(--muted-foreground)",
            whiteSpace: "nowrap",
          }}
        >
          Ikke startet
        </span>
      );
    if (req.status === "in_progress")
      return (
        <span
          style={{
            background: "#E6F1FB",
            color: "#0C447C",
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
          }}
        >
          I utvikling
        </span>
      );
    if (req.status === "implemented")
      return (
        <span
          style={{
            background: "#E1F5EE",
            color: "#085041",
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
          }}
        >
          Implementert
        </span>
      );
    if (req.status === "verified")
      return (
        <span
          style={{
            background: "#E1F5EE",
            color: "#085041",
            fontSize: "11px",
            padding: "3px 8px",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            whiteSpace: "nowrap",
          }}
        >
          <Check className="h-2.5 w-2.5" />
          Verifisert
        </span>
      );
    return null;
  };

  const mustBorderClass =
    mustPct < 0.5
      ? "border-red-300"
      : mustPct > 0.8
      ? "border-green-300"
      : "border-border";

  const [linkSearch, setLinkSearch] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Laster krav...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 scroll-reveal">
      <PageHeader
        title="Kravspesifikasjon"
        description="Funksjonelle, ikke-funksjonelle og dokumentasjonskrav for prosjektet"
        action={
          <div className="flex gap-2">
            <button className="py-2.5 px-5 rounded-[10px] bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nytt krav
            </button>
            <button className="py-2.5 px-5 rounded-[10px] bg-white border border-neutral-200 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" onClick={exportMarkdown}>
              <Download className="h-3.5 w-3.5" /> Eksporter til rapport
            </button>
          </div>
        }
      />

      {/* Create requirement dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nytt krav</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={newReq.type}
                  onValueChange={(v) => setNewReq((p) => ({ ...p, type: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="functional">Funksjonell</SelectItem>
                    <SelectItem value="non_functional">Ikke-funksjonell</SelectItem>
                    <SelectItem value="documentation">Dokumentasjon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioritet</Label>
                <Select
                  value={newReq.priority}
                  onValueChange={(v) => setNewReq((p) => ({ ...p, priority: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="must">Must</SelectItem>
                    <SelectItem value="should">Should</SelectItem>
                    <SelectItem value="could">Could</SelectItem>
                    <SelectItem value="wont">Won't</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Select
                value={newReq.category}
                onValueChange={(v) => setNewReq((p) => ({ ...p, category: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_LABELS).map((k) => (
                    <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tittel *</Label>
              <Input
                value={newReq.title}
                onChange={(e) => setNewReq((p) => ({ ...p, title: e.target.value }))}
                placeholder="Kort beskrivelse av kravet"
              />
            </div>
            <div className="space-y-1">
              <Label>Beskrivelse</Label>
              <Textarea
                value={newReq.description}
                onChange={(e) => setNewReq((p) => ({ ...p, description: e.target.value }))}
                placeholder="Detaljert beskrivelse (valgfritt)"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Akseptansekriterie</Label>
              <Textarea
                value={newReq.acceptance_criteria}
                onChange={(e) => setNewReq((p) => ({ ...p, acceptance_criteria: e.target.value }))}
                placeholder="Gitt... Når... Så... (valgfritt)"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button
              disabled={!newReq.title.trim() || createReqMutation.isPending}
              onClick={() => createReqMutation.mutate(newReq)}
            >
              Opprett krav
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info banner */}
      {!bannerDismissed && unlinkedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
          <span>
            {unlinkedCount} krav er ikke koblet til backlog-items.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 text-amber-600 hover:text-amber-900"
            aria-label="Lukk banner"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Funksjonelle krav", items: fkItems, color: "bg-primary" },
          { label: "Ikke-funksjonelle krav", items: nfkItems, color: "bg-primary" },
          { label: "Must-krav", items: mustItems, color: mustPct < 0.5 ? "bg-red-500" : mustPct > 0.8 ? "bg-green-500" : "bg-primary" },
        ].map((metric) => (
          <div key={metric.label} className="card-elevated p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{metric.label}</p>
            <p className="text-3xl font-bold tabular-nums">
              {implementedCount(metric.items)}{" "}
              <span className="text-lg font-normal text-muted-foreground">/ {metric.items.length}</span>
            </p>
            <div className="h-2 rounded-full bg-muted overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all ${metric.color}`}
                style={{ width: `${metric.items.length > 0 ? (implementedCount(metric.items) / metric.items.length) * 100 : 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">implementert</p>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type tabs */}
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "Alle" },
            { value: "functional", label: "Funksjonelle" },
            { value: "non_functional", label: "Ikke-funksjonelle" },
            { value: "documentation", label: "Dokumentasjon" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={`py-2 px-4 rounded-[10px] text-sm font-medium transition-colors whitespace-nowrap ${
                filterType === tab.value
                  ? "bg-primary/10 text-primary font-semibold"
                  : "bg-white text-muted-foreground border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-9 text-sm rounded-[10px]">
            <SelectValue placeholder="Prioritet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="must">Must</SelectItem>
            <SelectItem value="should">Should</SelectItem>
            <SelectItem value="could">Could</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm rounded-[10px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="not_started">Ikke startet</SelectItem>
            <SelectItem value="in_progress">I utvikling</SelectItem>
            <SelectItem value="implemented">Implementert</SelectItem>
            <SelectItem value="verified">Verifisert</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk på ID, tittel, beskrivelse..."
          className="h-9 text-sm w-64 ml-auto rounded-[10px]"
        />
      </div>

      {/* Requirements list */}
      <div className="card-elevated overflow-hidden">
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Ingen krav matcher filteret
          </div>
        ) : (
          grouped.map(([cat, items]) => {
            const mustCount = items.filter((r) => r.priority === "must").length;
            const implCount = items.filter(
              (r) =>
                r.status === "implemented" || r.status === "verified"
            ).length;
            const isCatCollapsed = collapsed[cat] ?? false;

            return (
              <div key={cat}>
                {/* Category heading */}
                <div
                  className="flex items-center gap-2 px-5 py-3 bg-neutral-50 border-b border-neutral-100 cursor-pointer select-none"
                  onClick={() => toggleCategory(cat)}
                >
                  {isCatCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-base font-semibold">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-sm text-muted-foreground ml-3">
                    {items.length} krav · {mustCount} must · {implCount} implementert
                  </span>
                </div>

                {/* Requirement rows */}
                {!isCatCollapsed &&
                  items.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className="hover:bg-neutral-50 cursor-pointer border-b border-neutral-100 px-5 py-4 flex items-center gap-3 transition-colors"
                    >
                      <span className="font-mono text-xs bg-neutral-100 text-neutral-600 py-1 px-2.5 rounded-md shrink-0 min-w-[4rem] text-center">
                        {req.id}
                      </span>
                      <span className="text-sm font-medium flex-1 min-w-0 truncate ml-1">
                        {req.title}
                      </span>
                      <span style={priorityBadgeStyle(req.priority)}>
                        {PRIORITY_LABELS[req.priority] ?? req.priority}
                      </span>
                      {statusBadgeContent(req)}
                      {reqLinks.some((l) => l.requirement_id === req.id) && (
                        <Link2 className="h-3 w-3 text-primary/60 shrink-0" />
                      )}
                    </div>
                  ))}
              </div>
            );
          })
        )}
      </div>

      {/* Backdrop */}
      {selectedId && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedId(null)}
        />
      )}

      {/* Detail panel */}
      {selectedId && selectedReq && (
      <div
        className="fixed top-0 right-0 h-full w-[480px] bg-white border-l border-neutral-200 z-50 flex flex-col"
        style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.06)" }}
      >
            {/* Panel header */}
            <div className="flex items-start justify-between p-6 border-b border-neutral-100">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs bg-neutral-100 text-neutral-600 py-1 px-2.5 rounded-md inline-block">
                  {selectedReq.id}
                </span>
                <h2 className="font-semibold text-xl mt-2 leading-snug">
                  {selectedReq.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="ml-3 shrink-0 rounded-[10px] w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-neutral-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {selectedReq.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedReq.description}
                </p>
              )}

              {selectedReq.acceptance_criteria && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Akseptansekriterie
                  </p>
                  <div
                    className="rounded-lg p-3 text-[12px] leading-relaxed"
                    style={{
                      background: "var(--color-info, #EFF6FF)",
                      border: "1px solid #BFDBFE",
                    }}
                  >
                    {selectedReq.acceptance_criteria}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prioritet</Label>
                <Select
                  value={selectedReq.priority}
                  onValueChange={(v) =>
                    handleUpdate(selectedReq.id, "priority", v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="must">Must</SelectItem>
                    <SelectItem value="should">Should</SelectItem>
                    <SelectItem value="could">Could</SelectItem>
                    <SelectItem value="wont">Won't</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedReq.source && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kilde</Label>
                  <p className="text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted">
                    {selectedReq.source}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select
                  value={selectedReq.status}
                  onValueChange={(v) =>
                    handleUpdate(selectedReq.id, "status", v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Ikke startet</SelectItem>
                    <SelectItem value="in_progress">I utvikling</SelectItem>
                    <SelectItem value="implemented">Implementert</SelectItem>
                    <SelectItem value="verified">Verifisert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type</Label>
                <p className="text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted">
                  {TYPE_LABELS[selectedReq.type] ?? selectedReq.type}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notater</Label>
                <Textarea
                  defaultValue={selectedReq.notes ?? ""}
                  onBlur={(e) =>
                    handleUpdate(selectedReq.id, "notes", e.target.value)
                  }
                  placeholder="Notater om implementasjon..."
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              {/* Linked backlog items (many-to-many) */}
              <div className="space-y-2 pt-1 border-t border-border/50">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Koblede backlog-items ({selectedLinkedItems.length})</Label>

                {selectedLinkedItems.length > 0 && (
                  <div className="space-y-1">
                    {selectedLinkedItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.item_id} — {item.title}</p>
                          <div className="flex gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.type === "user_story" ? "Brukerhistorie" : item.type === "technical" ? "Teknisk" : item.type}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.status}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLinkMutation.mutate({ requirementId: selectedReq.id, backlogItemId: item.id })}
                          className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Fjern kobling"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {someLinkedDone && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded">
                    <Check className="h-3 w-3" />
                    Koblede oppgaver er i arbeid eller fullført
                  </div>
                )}

                {/* Add link dropdown */}
                <div className="space-y-1">
                  <Input
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder="Søk backlog-items..."
                    className="h-7 text-xs"
                  />
                  {linkSearch.trim() && (
                    <div className="max-h-32 overflow-y-auto rounded border border-border bg-background">
                      {availableBacklogItems
                        .filter((b) => {
                          const q = linkSearch.toLowerCase();
                          return b.title.toLowerCase().includes(q) || b.item_id.toLowerCase().includes(q);
                        })
                        .slice(0, 8)
                        .map((b) => (
                          <button
                            key={b.id}
                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-1.5"
                            onClick={() => {
                              addLinkMutation.mutate({ requirementId: selectedReq.id, backlogItemId: b.id });
                              setLinkSearch("");
                            }}
                          >
                            <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="font-mono text-muted-foreground">{b.item_id}</span>
                            <span className="truncate">{b.title}</span>
                          </button>
                        ))}
                      {availableBacklogItems.filter((b) => {
                        const q = linkSearch.toLowerCase();
                        return b.title.toLowerCase().includes(q) || b.item_id.toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1.5 italic">Ingen treff</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Create new backlog item from requirement */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={createBacklogItemMutation.isPending}
                  onClick={() => createBacklogItemMutation.mutate(selectedReq)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Opprett nytt item fra dette kravet
                </Button>
              </div>

              {/* Delete */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteReqMutation.isPending}
                  onClick={() => {
                    if (confirm(`Slett "${selectedReq.id} — ${selectedReq.title}"? Dette kan ikke angres.`)) {
                      deleteReqMutation.mutate(selectedReq.id);
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Slett krav
                </Button>
              </div>
            </div>
      </div>
      )}
    </div>
  );
}
