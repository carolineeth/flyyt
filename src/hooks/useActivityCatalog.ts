import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  points: number;
  is_mandatory: boolean;
  category: string;
  period: string;
  period_deadline: string | null;
  max_occurrences: number;
  meeting_type: string | null;
  prosesslogg_template: string | null;
  sort_order: number;
}

export interface Registration {
  id: string;
  catalog_id: string;
  status: string;
  completed_date: string | null;
  completed_week: number | null;
  planned_week: number | null;
  occurrence_number: number;
  linked_meeting_id: string | null;
  linked_sub_session_id: string | null;
  timing_rationale: string | null;
  description: string | null;
  experiences: string | null;
  reflections: string | null;
  attachment_links: string[] | null;
  created_at: string;
}

export function useActivityCatalog() {
  return useQuery<CatalogItem[]>({
    queryKey: ["activity_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("activity_catalog" as any).select("*").order("sort_order") as any);
      if (error) throw error;
      return data as CatalogItem[];
    },
  });
}

export function useActivityRegistrations() {
  return useQuery<Registration[]>({
    queryKey: ["activity_registrations"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("activity_registrations" as any).select("*").order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data as Registration[];
    },
  });
}

export function useRegistrationParticipants() {
  return useQuery({
    queryKey: ["activity_registration_participants"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("activity_registration_participants" as any).select("*") as any);
      if (error) throw error;
      return data as { id: string; registration_id: string; member_id: string }[];
    },
  });
}

export function useCreateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: Partial<Registration> & { catalog_id: string }) => {
      const { data, error } = await (supabase.from("activity_registrations" as any).insert(reg as any).select().single() as any);
      if (error) throw error;
      return data as Registration;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_registrations"] });
    },
  });
}

export function useUpdateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Registration> & { id: string }) => {
      const { error } = await (supabase.from("activity_registrations" as any).update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_registrations"] });
    },
  });
}

export function useToggleRegistrationParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registrationId, memberId, isParticipant }: { registrationId: string; memberId: string; isParticipant: boolean }) => {
      if (isParticipant) {
        await (supabase.from("activity_registration_participants" as any).delete().eq("registration_id", registrationId).eq("member_id", memberId) as any);
      } else {
        await (supabase.from("activity_registration_participants" as any).insert({ registration_id: registrationId, member_id: memberId } as any) as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_registration_participants"] });
    },
  });
}
