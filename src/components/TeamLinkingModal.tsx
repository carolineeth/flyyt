import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQueryClient } from "@tanstack/react-query";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LogOut, Users } from "lucide-react";
import { logoutUser } from "@/lib/auth";

interface Props {
  authUserId: string;
  authEmail: string | null;
  onLinked: () => void;
}

export function TeamLinkingModal({ authUserId, authEmail, onLinked }: Props) {
  const { data: members, isLoading } = useTeamMembers();
  const [linking, setLinking] = useState(false);
  const autoLinkedRef = useRef(false);
  const qc = useQueryClient();
  const normalizedAuthEmail = (authEmail ?? "").trim().toLowerCase();

  const handleLink = useCallback(async (memberId: string) => {
    setLinking(true);
    try {
      const { error } = await supabase
        .from("team_members")
        .update({ auth_user_id: authUserId } as any)
        .eq("id", memberId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Kontoen din er nå koblet til teamet!");
      onLinked();
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error("Denne kontoen er allerede koblet til et annet teammedlem.");
      } else {
        toast.error("Kunne ikke koble kontoen. Prøv igjen.");
      }
    } finally {
      setLinking(false);
    }
  }, [authUserId, onLinked, qc]);

  const availableMembers = useMemo(
    () => members?.filter((m) => !m.auth_user_id) ?? [],
    [members],
  );

  const matchingMembers = useMemo(() => {
    if (!normalizedAuthEmail) return [];
    return availableMembers.filter((m) => m.email.toLowerCase() === normalizedAuthEmail);
  }, [availableMembers, normalizedAuthEmail]);

  const membersToShow = matchingMembers.length > 0 ? matchingMembers : availableMembers;

  useEffect(() => {
    if (autoLinkedRef.current || isLoading || linking) return;
    if (matchingMembers.length !== 1) return;

    autoLinkedRef.current = true;
    void handleLink(matchingMembers[0].id);
  }, [handleLink, isLoading, linking, matchingMembers]);

  const handleLogout = async () => {
    const { error } = await logoutUser();
    if (error) {
      toast.error("Kunne ikke logge ut fullstendig, men lokal økt ble tømt");
    } else {
      toast.success("Logget ut");
    }
    window.location.href = "/";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Velkommen til Flyt!</h2>
          <p className="text-sm text-muted-foreground">
            Koble kontoen din til teamet ved å velge ditt navn nedenfor.
          </p>
          {authEmail && (
            <p className="text-xs text-muted-foreground">Innlogget som: {authEmail}</p>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center">Laster teammedlemmer...</p>
        ) : (
          <div className="space-y-2">
            {normalizedAuthEmail && matchingMembers.length === 0 && availableMembers.length > 0 && (
              <p className="text-xs text-muted-foreground text-center pb-2">
                Ingen direkte e-postmatch funnet. Velg riktig navn manuelt.
              </p>
            )}

            {membersToShow.map((member) => (
              <button
                key={member.id}
                onClick={() => handleLink(member.id)}
                disabled={linking}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
              >
                <MemberAvatar member={member} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
              </button>
            ))}
            {membersToShow.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Alle teammedlemmer er allerede koblet. Logg ut og prøv en annen konto.
              </p>
            )}
          </div>
        )}

        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            disabled={linking}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logg ut og bytt konto
          </Button>
        </div>
      </div>
    </div>
  );
}
