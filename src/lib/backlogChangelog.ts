import { supabase } from "@/integrations/supabase/client";

export async function logBacklogChange({
  backlogItemId,
  changeType,
  oldValue,
  newValue,
  changedBy,
}: {
  backlogItemId: string;
  changeType: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy?: string | null;
}) {
  const { error } = await (supabase.from("backlog_changelog" as any).insert({
    backlog_item_id: backlogItemId,
    change_type: changeType,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    changed_by: changedBy ?? null,
  } as any) as any);
  if (error) console.error("Failed to log backlog change:", error);
}
