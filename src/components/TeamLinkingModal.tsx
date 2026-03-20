import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQueryClient } from "@tanstack/react-query";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { toast } from "sonner";
import { Users } from "lucide-react";

interface Props {
  authUserId: string;
  onLinked: () => void;
}

export function TeamLinkingModal({ authUserId, onLinked }: Props) {
  const { data: members, isLoading } = useTeamMembers();
  const [linking, setLinking] = useState(false);
  const qc = useQueryClient();

  const handleLink = async (memberId: string) => {
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
  };

  // Filter out members that are already linked
  const availableMembers = members?.filter((m) => !(m as any).auth_user_id);

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
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center">Laster teammedlemmer...</p>
        ) : (
          <div className="space-y-2">
            {availableMembers?.map((member) => (
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
            {availableMembers?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Alle teammedlemmer er allerede koblet. Kontakt admin.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
