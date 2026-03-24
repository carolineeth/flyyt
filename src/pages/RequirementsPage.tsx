import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Link2,
  X,
  ExternalLink,
  Download,
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

  const { data: requirements, isLoading } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirements" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as Requirement[];
    },
  });

  const { data: backlogItems } = useQuery<
    { id: string; item_id: string; title: string; status: string }[]
  >({
    queryKey: ["backlog_items_for_req"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlog_items")
        .select("id, item_id, title, status")
        .order("sort_order");
      if (error) throw error;
      return data as { id: string; item_id: string; title: string; status: string }[];
    },
  });

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
  });

  const handleUpdate = (id: string, field: string, value: any) => {
    updateReq.mutate(
      { id, [field]: value } as any,
      { onSuccess: () => toast.success("Oppdatert") }
    );
  };

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
    requirements?.filter((r) => !r.linked_backlog_item_id).length ?? 0;

  const selectedReq = requirements?.find((r) => r.id === selectedId) ?? null;

  const { data: linkedSprintItems } = useQuery({
    queryKey: ["sprint_items_for_req", selectedReq?.linked_backlog_item_id],
    enabled: !!selectedReq?.linked_backlog_item_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprint_items" as any)
        .select("*, sprints(name)")
        .eq("backlog_item_id", selectedReq!.linked_backlog_item_id!);
      if (error) throw error;
      return data;
    },
  });

  const isInDone =
    (linkedSprintItems as any[])?.some(
      (si: any) => si.column_name === "done"
    ) ?? false;

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
        borderRadius: "9999px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      };
    if (priority === "should")
      return {
        background: "#FAEEDA",
        color: "#633806",
        fontSize: "11px",
        padding: "3px 8px",
        borderRadius: "9999px",
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
            borderRadius: "9999px",
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
            borderRadius: "9999px",
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
            borderRadius: "9999px",
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
            borderRadius: "9999px",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Laster krav...</p>
      </div>
    );
  }

  const linkedBacklogItem = selectedReq?.linked_backlog_item_id
    ? backlogItems?.find((b) => b.id === selectedReq.linked_backlog_item_id)
    : null;

  return (
    <div className="space-y-5 scroll-reveal">
      <PageHeader
        title="Kravspesifikasjon"
        description="Funksjonelle, ikke-funksjonelle og dokumentasjonskrav for prosjektet"
        action={
          <Button size="sm" variant="outline" onClick={exportMarkdown}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Eksporter til rapport
          </Button>
        }
      />

      {/* Info banner */}
      {!bannerDismissed && unlinkedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            {unlinkedCount} krav er ikke koblet til backlog-items.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 text-amber-600 hover:text-amber-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Funksjonelle krav */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Funksjonelle krav
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {implementedCount(fkItems)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {fkItems.length}
            </span>
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${fkItems.length > 0 ? (implementedCount(fkItems) / fkItems.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">implementert</p>
        </div>

        {/* Ikke-funksjonelle krav */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Ikke-funksjonelle krav
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {implementedCount(nfkItems)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {nfkItems.length}
            </span>
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${nfkItems.length > 0 ? (implementedCount(nfkItems) / nfkItems.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">implementert</p>
        </div>

        {/* Must-krav */}
        <div
          className={`rounded-xl border bg-card p-4 space-y-2 ${mustBorderClass}`}
        >
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Must-krav
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {implementedCount(mustItems)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              / {mustItems.length}
            </span>
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${mustPct < 0.5 ? "bg-red-500" : mustPct > 0.8 ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${mustPct * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">implementert</p>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type tabs */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {[
            { value: "all", label: "Alle" },
            { value: "functional", label: "Funksjonelle" },
            { value: "non_functional", label: "Ikke-funksjonelle" },
            { value: "documentation", label: "Dokumentasjon" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                filterType === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs">
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
          <SelectTrigger className="w-36 h-8 text-xs">
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
          className="h-8 text-xs w-56 ml-auto"
        />
      </div>

      {/* Requirements list */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border cursor-pointer select-none"
                  onClick={() => toggleCategory(cat)}
                >
                  {isCatCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-[14px] font-[500]">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {items.length} krav · {mustCount} must · {implCount}{" "}
                    implementert
                  </span>
                </div>

                {/* Requirement rows */}
                {!isCatCollapsed &&
                  items.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className="hover:bg-secondary/60 cursor-pointer border-b border-border/50 px-4 py-3 flex items-center gap-3"
                    >
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {req.id}
                      </span>
                      <span className="text-[13px] font-[500] flex-1 min-w-0 truncate">
                        {req.title}
                      </span>
                      <span style={priorityBadgeStyle(req.priority)}>
                        {PRIORITY_LABELS[req.priority] ?? req.priority}
                      </span>
                      {statusBadgeContent(req)}
                      {req.linked_backlog_item_id && (
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
      <div
        className={`fixed top-0 right-0 h-full w-[450px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
          selectedId ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedReq ? (
          <>
            {/* Panel header */}
            <div className="flex items-start justify-between p-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-muted-foreground">
                  {selectedReq.id}
                </span>
                <h2 className="font-semibold text-base mt-0.5 leading-snug">
                  {selectedReq.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="ml-3 shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Description */}
              {selectedReq.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedReq.description}
                </p>
              )}

              {/* Acceptance criteria */}
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

              {/* Prioritet */}
              <div className="space-y-1.5">
                <Label className="text-xs">Prioritet</Label>
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

              {/* Kilde */}
              {selectedReq.source && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Kilde</Label>
                  <p className="text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted">
                    {selectedReq.source}
                  </p>
                </div>
              )}

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
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

              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <p className="text-xs text-muted-foreground px-3 py-2 rounded-md bg-muted">
                  {TYPE_LABELS[selectedReq.type] ?? selectedReq.type}
                </p>
              </div>

              {/* Notater */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notater</Label>
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

              {/* Koble til backlog-item */}
              <div className="space-y-1.5">
                <Label className="text-xs">Koble til backlog-item</Label>
                <Select
                  value={selectedReq.linked_backlog_item_id ?? "none"}
                  onValueChange={(v) =>
                    handleUpdate(
                      selectedReq.id,
                      "linked_backlog_item_id",
                      v === "none" ? null : v
                    )
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Velg backlog-item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen kobling</SelectItem>
                    {backlogItems?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.item_id} – {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Linked item card */}
                {linkedBacklogItem && (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-2 mt-2">
                    <div>
                      <p className="text-xs font-medium">
                        {linkedBacklogItem.item_id} – {linkedBacklogItem.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {linkedBacklogItem.status}
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                )}

                {/* Auto-status from sprint board */}
                {isInDone && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded mt-1">
                    <Check className="h-3 w-3" />
                    Auto-status fra Sprint Board: item er i Ferdig-kolonnen
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
