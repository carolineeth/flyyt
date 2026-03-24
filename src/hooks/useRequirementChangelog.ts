import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RequirementChange = {
  id: string;
  requirement_id: string | null;
  change_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  changed_by: string | null;
  created_at: string;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useRequirementChanges() {
  return useQuery<RequirementChange[]>({
    queryKey: ["requirement_changes"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("requirement_changes" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data as RequirementChange[];
    },
  });
}

export function useRequirementChangesForReq(requirementId: string | null) {
  return useQuery<RequirementChange[]>({
    queryKey: ["requirement_changes", requirementId],
    enabled: !!requirementId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("requirement_changes" as any)
        .select("*")
        .eq("requirement_id", requirementId!)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data as RequirementChange[];
    },
  });
}

// ─── Log a single change ──────────────────────────────────────────────────────

export async function logRequirementChange(entry: {
  requirement_id: string;
  change_type: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  description: string;
  changed_by?: string | null;
}) {
  const { error } = await (supabase
    .from("requirement_changes" as any)
    .insert({
      requirement_id: entry.requirement_id,
      change_type: entry.change_type,
      field_changed: entry.field_changed ?? null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
      description: entry.description,
      changed_by: entry.changed_by ?? null,
    } as any) as any);
  if (error) console.error("Failed to log requirement change:", error);
}

// ─── Seed initial changelog (run once if table is empty) ──────────────────────

export function useSeedRequirementChangelog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Check if already seeded
      const { count, error: countError } = await (supabase
        .from("requirement_changes" as any)
        .select("*", { count: "exact", head: true }) as any);
      if (countError) throw countError;
      if ((count ?? 0) > 0) return; // Already seeded

      // Fetch all requirements
      const { data: reqs, error: reqError } = await (supabase
        .from("requirements" as any)
        .select("id") as any);
      if (reqError) throw reqError;
      if (!reqs || reqs.length === 0) return;

      // Insert 'created' entry for each
      const entries = (reqs as { id: string }[]).map((r) => ({
        requirement_id: r.id,
        change_type: "created",
        description: "Krav opprettet i initiell kravspesifikasjon (v1.0)",
      }));

      const { error: insertError } = await (supabase
        .from("requirement_changes" as any)
        .insert(entries as any) as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requirement_changes"] });
    },
  });
}

// ─── Sprint → Requirement status sync ────────────────────────────────────────

/**
 * After a sprint item is moved to a new column, sync the status of any
 * requirement linked to the corresponding backlog item.
 *
 * Column mapping:
 *  done        → "implemented"  (always)
 *  in_progress → "in_progress"  (only if currently "not_started")
 *  review      → "in_progress"  (only if currently "not_started")
 *  todo        → no change      (behold — don't go backwards)
 */
export async function syncRequirementFromSprint(
  backlogItemId: string,
  columnName: string,
  backlogItemTitle?: string
) {
  const { data: reqs, error } = await (supabase
    .from("requirements" as any)
    .select("id, status")
    .eq("linked_backlog_item_id", backlogItemId) as any);
  if (error || !reqs?.length) return;

  for (const req of reqs as { id: string; status: string }[]) {
    let newStatus: string | null = null;

    if (columnName === "done" && req.status !== "implemented" && req.status !== "verified") {
      newStatus = "implemented";
    } else if (
      (columnName === "in_progress" || columnName === "review") &&
      req.status === "not_started"
    ) {
      newStatus = "in_progress";
    }

    if (newStatus) {
      await (supabase
        .from("requirements" as any)
        .update({ status: newStatus } as any)
        .eq("id", req.id) as any);

      await logRequirementChange({
        requirement_id: req.id,
        change_type: "status_changed",
        field_changed: "status",
        old_value: req.status,
        new_value: newStatus,
        description: `Auto-oppdatert fra Sprint Board: ${backlogItemTitle ?? "item"} flyttet til ${columnName}`,
      });
    }
  }
}

// ─── Human-readable labels ────────────────────────────────────────────────────

export const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: "Opprettet",
  updated: "Oppdatert",
  deleted: "Slettet",
  priority_changed: "Prioritet endret",
  status_changed: "Status endret",
  added_to_backlog: "Koblet til backlog",
  removed_from_backlog: "Fjernet fra backlog",
};

export const PRIORITY_DISPLAY: Record<string, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't",
};

export const STATUS_DISPLAY: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "I utvikling",
  implemented: "Implementert",
  verified: "Verifisert",
};
