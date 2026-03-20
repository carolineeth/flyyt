import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import type { TeamMember } from "@/lib/types";

/**
 * Returns the current team member linked via auth_user_id.
 * Also returns authUserId and isLinked status for the linking modal.
 */
export function useCurrentTeamMember() {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthUserId(data.user?.id ?? null);
      setLoading(false);
    });
  }, []);

  const { data: currentMember, isLoading: memberLoading, refetch } = useQuery({
    queryKey: ["current_team_member", authUserId],
    enabled: !!authUserId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("team_members")
        .select("*") as any)
        .eq("auth_user_id", authUserId!)
        .maybeSingle();
      if (error) throw error;
      return (data as TeamMember | null);
    },
  });

  return {
    authUserId,
    currentMember: currentMember ?? null,
    isLinked: !!currentMember,
    isLoading: loading || memberLoading,
    refetch,
  };
}
