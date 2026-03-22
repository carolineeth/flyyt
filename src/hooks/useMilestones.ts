import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  date: string;
  category: string;
  is_completed: boolean;
  completed_at: string | null;
  is_fixed: boolean;
  priority: string;
  linked_activity_id: string | null;
  linked_sprint_id: string | null;
  created_at: string;
}

export function useMilestones() {
  return useQuery<Milestone[]>({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones" as any)
        .select("*")
        .order("date");
      if (error) throw error;
      return data as any;
    },
  });
}

export function useToggleMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("milestones" as any)
        .update({ is_completed, completed_at: is_completed ? new Date().toISOString() : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Omit<Milestone, "id" | "created_at" | "completed_at" | "is_completed">) => {
      const { error } = await supabase
        .from("milestones" as any)
        .insert({ ...m, is_completed: false } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
}
