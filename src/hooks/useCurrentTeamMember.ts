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
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const applyUser = (user: { id: string; email?: string | null } | null) => {
      if (!isMounted) return;
      setAuthUserId(user?.id ?? null);
      setAuthEmail(user?.email ?? null);
      setLoading(false);
    };

    const bootstrap = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      if (sessionUser) {
        applyUser(sessionUser);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      applyUser(userData.user ?? null);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    void bootstrap();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const { data: currentMember, isLoading: memberLoading, refetch } = useQuery({
    queryKey: ["current_team_member", authUserId],
    enabled: !!authUserId,
    queryFn: async () => {
      const { data: memberId, error: memberIdError } = await supabase.rpc(
        "get_team_member_id_for_auth_user",
        { _auth_uid: authUserId! },
      );

      if (memberIdError) throw memberIdError;
      if (!memberId) return null;

      const { data, error } = await (supabase.from("team_members").select("*") as any)
        .eq("id", memberId)
        .maybeSingle();

      if (error) throw error;
      return (data as TeamMember | null);
    },
  });

  return {
    authUserId,
    authEmail,
    currentMember: currentMember ?? null,
    isLinked: !!currentMember,
    isLoading: loading || memberLoading,
    refetch,
  };
}
