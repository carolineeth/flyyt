import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "./useTeamMembers";

// Week helpers
export function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getWeekDates(year: number, week: number) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay() || 7;
  const firstMonday = new Date(jan1);
  firstMonday.setUTCDate(jan1.getUTCDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek));
  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return { start: weekStart, end: weekEnd };
}

export function getDateForDayOfWeek(year: number, week: number, dayOfWeek: number): Date {
  const { start } = getWeekDates(year, week);
  const mondayDay = start.getUTCDay() || 7;
  const diff = dayOfWeek - mondayDay;
  const result = new Date(start);
  result.setUTCDate(start.getUTCDate() + diff);
  return result;
}

export function formatDateNb(d: Date): string {
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
}

export function formatWeekdayNb(d: Date): string {
  return d.toLocaleDateString("nb-NO", { weekday: "long" });
}

const START_WEEK = 10;
const ROTATION_SIZE = 6;

export function getRotationPosition(weekNumber: number): number {
  return ((weekNumber - START_WEEK) % ROTATION_SIZE + ROTATION_SIZE) % ROTATION_SIZE + 1;
}

export function useRotation() {
  return useQuery({
    queryKey: ["meeting_rotation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_rotation" as any)
        .select("*")
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useRecurringMeetings() {
  return useQuery({
    queryKey: ["recurring_meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_meetings" as any)
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useWeekMeetings(year: number, week: number) {
  const { start, end } = getWeekDates(year, week);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["week_meetings", year, week],
    queryFn: async () => {
      // Query by week_number OR by date range (for old meetings without week_number)
      const byWeek = supabase.from("meetings").select("*") as any;
      const { data: d1, error: e1 } = await byWeek.eq("week_number", week);
      if (e1) throw e1;

      const { data: d2, error: e2 } = await supabase
        .from("meetings")
        .select("*")
        .is("week_number" as any, null)
        .gte("date", startStr)
        .lte("date", endStr + "T23:59:59") as any;
      if (e2) throw e2;

      // Merge and deduplicate
      const all = [...(d1 || []), ...(d2 || [])];
      const seen = new Set<string>();
      return all.filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }) as any[];
    },
  });
}

export function useMeetingAgendaItems(meetingId: string | null) {
  return useQuery({
    queryKey: ["meeting_agenda_items", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agenda_items" as any)
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useMeetingSubSessions(meetingId: string | null) {
  return useQuery({
    queryKey: ["meeting_sub_sessions", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_sub_sessions" as any)
        .select("*")
        .eq("meeting_id", meetingId!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useMeetingActionPoints(meetingId: string | null) {
  return useQuery({
    queryKey: ["meeting_action_points", meetingId],
    enabled: !!meetingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_points")
        .select("*")
        .eq("meeting_id", meetingId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useSubSessionItems(subSessionId: string | null) {
  return useQuery({
    queryKey: ["meeting_sub_session_items", subSessionId],
    enabled: !!subSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_sub_session_items" as any)
        .select("*")
        .eq("sub_session_id", subSessionId!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSubSessionActionPoints(subSessionId: string | null) {
  return useQuery({
    queryKey: ["sub_session_action_points", subSessionId],
    enabled: !!subSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_points")
        .select("*")
        .eq("source_sub_session_id", subSessionId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useAllMeetingSubSessions() {
  return useQuery({
    queryKey: ["all_meeting_sub_sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("meeting_sub_sessions" as any)
        .select("id, type, notes, type_specific_data") as any);
      if (error) throw error;
      return data as { id: string; type: string; notes: string | null; type_specific_data: Record<string, any> }[];
    },
  });
}

export function useSubSessionById(id: string | null) {
  return useQuery({
    queryKey: ["meeting_sub_session", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("meeting_sub_sessions" as any)
        .select("id, type, notes, type_specific_data")
        .eq("id", id!)
        .single() as any);
      if (error) throw error;
      return data as { id: string; type: string; notes: string | null; type_specific_data: Record<string, any> };
    },
  });
}

export function useAutoGenerateMeetings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, week, recurringMeetings, rotation }: {
      year: number;
      week: number;
      recurringMeetings: any[];
      rotation: any[];
    }) => {
      const position = getRotationPosition(week);
      const rot = rotation.find((r: any) => r.position === position);
      if (!rot) return;

      const meetingsToCreate = recurringMeetings.map((rm: any) => {
        const meetingDate = getDateForDayOfWeek(year, week, rm.day_of_week);
        return {
          type: "other",
          date: meetingDate.toISOString(),
          meeting_date: meetingDate.toISOString().split("T")[0],
          week_number: week,
          recurring_meeting_id: rm.id,
          leader_id: rot.leader_id,
          notetaker_id: rot.notetaker_id,
          rotation_position: position,
          status: "upcoming",
          notes: null,
          participants: [],
        };
      });

      const { error } = await supabase.from("meetings").insert(meetingsToCreate as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["week_meetings", vars.year, vars.week] });
    },
  });
}
