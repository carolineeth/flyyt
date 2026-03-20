import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@/lib/types";

interface StandupEntry {
  member_id: string;
  did_yesterday: string;
  doing_today: string;
  blockers: string;
}

interface Props {
  meetingId: string | null; // null = creating
  members: TeamMember[];
  participantIds: string[];
  onEntriesChange?: (entries: StandupEntry[]) => void;
  readOnly?: boolean;
}

export function StandupTemplate({ meetingId, members, participantIds, onEntriesChange, readOnly }: Props) {
  const [entries, setEntries] = useState<Record<string, StandupEntry>>({});

  // Load existing entries
  useEffect(() => {
    if (!meetingId) return;
    supabase.from("standup_entries").select("*").eq("meeting_id", meetingId).then(({ data }) => {
      if (data) {
        const map: Record<string, StandupEntry> = {};
        data.forEach((e) => { map[e.member_id] = { member_id: e.member_id, did_yesterday: e.did_yesterday ?? "", doing_today: e.doing_today ?? "", blockers: e.blockers ?? "" }; });
        setEntries(map);
      }
    });
  }, [meetingId]);

  const participants = members.filter((m) => participantIds.includes(m.id));

  const updateEntry = (memberId: string, field: keyof StandupEntry, value: string) => {
    setEntries((prev) => {
      const updated = { ...prev, [memberId]: { ...prev[memberId], member_id: memberId, did_yesterday: prev[memberId]?.did_yesterday ?? "", doing_today: prev[memberId]?.doing_today ?? "", blockers: prev[memberId]?.blockers ?? "", [field]: value } };
      onEntriesChange?.(Object.values(updated));
      return updated;
    });
  };

  // Collect all blockers
  const blockers = participants
    .map((m) => ({ member: m, blocker: entries[m.id]?.blockers ?? "" }))
    .filter((b) => b.blocker.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Blockers summary */}
      {blockers.length > 0 && (
        <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Blokkert ({blockers.length})
          </div>
          {blockers.map((b) => (
            <div key={b.member.id} className="flex items-start gap-2 text-sm">
              <MemberAvatar member={b.member} />
              <div>
                <span className="font-medium">{b.member.name.split(" ")[0]}:</span>{" "}
                <span className="text-muted-foreground">{b.blocker}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-person entries */}
      {participants.map((member) => {
        const entry = entries[member.id];
        return (
          <div key={member.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <MemberAvatar member={member} size="md" />
              <span className="text-sm font-medium">{member.name}</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hva gjorde jeg siden sist?</label>
              <Textarea
                value={entry?.did_yesterday ?? ""}
                onChange={(e) => updateEntry(member.id, "did_yesterday", e.target.value)}
                rows={2}
                readOnly={readOnly}
                className="mt-0.5 text-sm"
                placeholder="Beskriv hva du jobbet med..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hva skal jeg gjøre i dag?</label>
              <Textarea
                value={entry?.doing_today ?? ""}
                onChange={(e) => updateEntry(member.id, "doing_today", e.target.value)}
                rows={2}
                readOnly={readOnly}
                className="mt-0.5 text-sm"
                placeholder="Planer for i dag..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Er jeg blokkert av noe?</label>
              <Textarea
                value={entry?.blockers ?? ""}
                onChange={(e) => updateEntry(member.id, "blockers", e.target.value)}
                rows={2}
                readOnly={readOnly}
                className={`mt-0.5 text-sm ${(entry?.blockers ?? "").trim() ? "border-l-4 border-l-destructive" : ""}`}
                placeholder="Hindringer eller blokkere..."
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
