import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logRequirementChange } from "@/hooks/useRequirementChangelog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, X, ExternalLink } from "lucide-react";

const PRIORITY_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  must: { bg: "#FCEBEB", fg: "#791F1F", label: "Must" },
  should: { bg: "#FAEEDA", fg: "#633806", label: "Should" },
  could: { bg: "#F1EFE8", fg: "#444441", label: "Could" },
  wont: { bg: "#F1EFE8", fg: "#444441", label: "Won't" },
};

interface Props {
  backlogItemId: string;
}

export function LinkedRequirements({ backlogItemId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  // Links for this backlog item
  const { data: links = [] } = useQuery({
    queryKey: ["req_links_for_item", backlogItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement_backlog_links")
        .select("id, requirement_id, backlog_item_id")
        .eq("backlog_item_id", backlogItemId);
      if (error) throw error;
      return data;
    },
  });

  // All requirements for lookup
  const { data: allReqs = [] } = useQuery<{ id: string; title: string; priority: string; status: string }[]>({
    queryKey: ["requirements_lookup"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("requirements" as any)
        .select("id, title, priority, status")
        .order("sort_order") as any);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedReqs = links
    .map((l) => allReqs.find((r) => r.id === l.requirement_id))
    .filter(Boolean) as { id: string; title: string; priority: string; status: string }[];

  const linkedIds = new Set(links.map((l) => l.requirement_id));
  const available = allReqs.filter((r) => !linkedIds.has(r.id));

  const addLink = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase.from("requirement_backlog_links").insert({
        requirement_id: reqId,
        backlog_item_id: backlogItemId,
      });
      if (error) throw error;
      // Double-write backup (fail silently)
      try { await (supabase.from("requirements" as any).update({ linked_backlog_item_id: backlogItemId } as any).eq("id", reqId) as any); } catch {}
    },
    onSuccess: (_, reqId) => {
      qc.invalidateQueries({ queryKey: ["req_links_for_item", backlogItemId] });
      qc.invalidateQueries({ queryKey: ["requirement_backlog_links"] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
      const req = allReqs.find((r) => r.id === reqId);
      logRequirementChange({
        requirement_id: reqId,
        change_type: "added_to_backlog",
        new_value: backlogItemId,
        description: `Koblet til backlog-item fra detalj-modal`,
      });
      toast.success(`Koblet til ${req?.id ?? reqId}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeLink = useMutation({
    mutationFn: async (reqId: string) => {
      const { error } = await supabase.from("requirement_backlog_links")
        .delete()
        .eq("requirement_id", reqId)
        .eq("backlog_item_id", backlogItemId);
      if (error) throw error;
    },
    onSuccess: (_, reqId) => {
      qc.invalidateQueries({ queryKey: ["req_links_for_item", backlogItemId] });
      qc.invalidateQueries({ queryKey: ["requirement_backlog_links"] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
      logRequirementChange({
        requirement_id: reqId,
        change_type: "removed_from_backlog",
        old_value: backlogItemId,
        description: `Fjernet kobling fra backlog-item detalj-modal`,
      });
      toast.success("Kobling fjernet");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Koblede krav ({linkedReqs.length})</Label>

      {linkedReqs.length > 0 && (
        <div className="space-y-1">
          {linkedReqs.map((req) => {
            const badge = PRIORITY_BADGE[req.priority];
            return (
              <div key={req.id} className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{req.id}</span>
                <span className="text-xs flex-1 min-w-0 truncate">{req.title}</span>
                {badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: badge.bg, color: badge.fg }}>
                    {badge.label}
                  </span>
                )}
                <button
                  onClick={() => removeLink.mutate(req.id)}
                  className="shrink-0 h-4 w-4 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Søk krav..."
        className="h-7 text-xs"
      />
      {search.trim() && (
        <div className="max-h-28 overflow-y-auto rounded border border-border bg-background">
          {available
            .filter((r) => {
              const q = search.toLowerCase();
              return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
            })
            .slice(0, 6)
            .map((r) => (
              <button
                key={r.id}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent transition-colors flex items-center gap-1.5"
                onClick={() => { addLink.mutate(r.id); setSearch(""); }}
              >
                <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{r.id}</span>
                <span className="truncate">{r.title}</span>
              </button>
            ))}
          {available.filter((r) => {
            const q = search.toLowerCase();
            return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
          }).length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5 italic">Ingen treff</p>
          )}
        </div>
      )}
    </div>
  );
}
