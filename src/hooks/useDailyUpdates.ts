import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "./useTeamMembers";
import { useState, useEffect, useMemo } from "react";
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, getISOWeek, eachDayOfInterval, isWeekend, isBefore, isAfter, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";

const PROJECT_START = new Date(2026, 2, 3); // March 3, 2026 (week 10)

export interface DailyUpdate {
  id: string;
  member_id: string;
  entry_date: string;
  content: string | null;
  category: string | null;
  backlog_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useCurrentMember() {
  const { data: members } = useTeamMembers();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const currentMember = useMemo(() => {
    if (!members || !userEmail) return null;
    return members.find((m) => m.email.toLowerCase() === userEmail.toLowerCase()) ?? null;
  }, [members, userEmail]);

  return { currentMember, userEmail };
}

export function useWeekNavigation() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(currentDate);

  const today = startOfDay(new Date());
  const isCurrentWeek = weekStart <= today && today <= weekEnd;

  const goToPrevWeek = () => setCurrentDate((d) => subWeeks(d, 1));
  const goToNextWeek = () => setCurrentDate((d) => addWeeks(d, 1));
  const goToThisWeek = () => setCurrentDate(new Date());
  const goToWeek = (date: Date) => setCurrentDate(date);

  const weekLabel = `Uke ${weekNumber} — ${format(weekStart, "d.", { locale: nb })}–${format(weekEnd, "d. MMMM yyyy", { locale: nb })}`;

  // Weekdays in this week (mon-fri), filtered to not show future days and not before project start
  const weekdays = useMemo(() => {
    const allDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return allDays.filter((d) => {
      if (isWeekend(d)) return false;
      if (isAfter(d, today)) return false;
      if (isBefore(d, PROJECT_START)) return false;
      return true;
    });
  }, [weekStart, weekEnd, today]);

  return { weekStart, weekEnd, weekNumber, weekLabel, isCurrentWeek, weekdays, goToPrevWeek, goToNextWeek, goToThisWeek, goToWeek, currentDate };
}

export function useDailyUpdates(startDate: Date, endDate: Date) {
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery<DailyUpdate[]>({
    queryKey: ["daily_updates", startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates")
        .select("*")
        .gte("entry_date", startStr)
        .lte("entry_date", endStr)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyUpdate[];
    },
  });
}

export function useAllDailyUpdates() {
  return useQuery<DailyUpdate[]>({
    queryKey: ["daily_updates_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_updates")
        .select("*")
        .gte("entry_date", format(PROJECT_START, "yyyy-MM-dd"))
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyUpdate[];
    },
  });
}

export function useUpsertDailyUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      member_id: string;
      entry_date: string;
      content: string;
      category: string | null;
      backlog_item_id: string | null;
    }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from("daily_updates")
        .select("id")
        .eq("member_id", params.member_id)
        .eq("entry_date", params.entry_date)
        .maybeSingle() as any;

      if (existing) {
        const { error } = await supabase
          .from("daily_updates")
          .update({
            content: params.content,
            category: params.category,
            backlog_item_id: params.backlog_item_id,
          } as any)
          .eq("id", existing.id) as any;
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_updates")
          .insert(params as any) as any;
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_updates"] });
      qc.invalidateQueries({ queryKey: ["daily_updates_all"] });
    },
  });
}

export function useTodayHasUpdate(memberId: string | undefined) {
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["daily_update_today", memberId, today],
    enabled: !!memberId,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_updates")
        .select("id")
        .eq("member_id", memberId!)
        .eq("entry_date", today)
        .maybeSingle() as any;
      return !!data;
    },
  });
}

export function useActiveSprint() {
  return useQuery({
    queryKey: ["active_sprint"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sprints")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useInProgressBacklogItems(memberId: string | undefined) {
  return useQuery({
    queryKey: ["in_progress_backlog", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlog_items")
        .select("id, item_id, title")
        .eq("status", "in_progress")
        .order("title");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export { PROJECT_START };
