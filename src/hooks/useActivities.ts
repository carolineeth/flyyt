import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Activity, ActivityParticipant } from "@/lib/types";

export function useActivities() {
  return useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useActivityParticipants() {
  return useQuery<ActivityParticipant[]>({
    queryKey: ["activity_participants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_participants").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Activity> & { id: string }) => {
      const { error } = await supabase.from("activities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });
}

export function useToggleParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ activityId, memberId, isParticipant }: { activityId: string; memberId: string; isParticipant: boolean }) => {
      if (isParticipant) {
        const { error } = await supabase.from("activity_participants").delete().eq("activity_id", activityId).eq("member_id", memberId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("activity_participants").insert({ activity_id: activityId, member_id: memberId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity_participants"] }),
  });
}
