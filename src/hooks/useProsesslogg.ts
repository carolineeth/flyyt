import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProsessloggNote {
  id: string;
  content: string;
  added_by: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  category: string;
  linked_registration_id: string | null;
  created_at: string;
}

export function useProsessloggNotes() {
  return useQuery<ProsessloggNote[]>({
    queryKey: ["prosesslogg_notes"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("prosesslogg_notes" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data as ProsessloggNote[];
    },
  });
}

export function useCreateProsessloggNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: { content: string; added_by: string | null; category: string; linked_registration_id?: string | null }) => {
      const { error } = await (supabase.from("prosesslogg_notes" as any).insert(note as any) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prosesslogg_notes"] }),
    onError: () => toast.error("Kunne ikke opprette notat"),
  });
}

export function useUpdateProsessloggNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProsessloggNote> & { id: string }) => {
      const { error } = await (supabase.from("prosesslogg_notes" as any).update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prosesslogg_notes"] }),
    onError: () => toast.error("Kunne ikke oppdatere notat"),
  });
}

export function useDeleteProsessloggNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("prosesslogg_notes" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prosesslogg_notes"] }),
    onError: () => toast.error("Kunne ikke slette notat"),
  });
}

export function useCompletedMeetings() {
  return useQuery({
    queryKey: ["completed_meetings_for_export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMeetingAgendaItemsAll() {
  return useQuery({
    queryKey: ["all_meeting_agenda_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agenda_items")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useMeetingActionPointsAll() {
  return useQuery({
    queryKey: ["all_meeting_action_points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_points")
        .select("*");
      if (error) throw error;
      return data;
    },
  });
}
