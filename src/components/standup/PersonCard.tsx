import { format } from "date-fns";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import type { TeamMember } from "@/lib/types";
import type { DailyUpdate } from "@/hooks/useDailyUpdates";
import { CATEGORIES } from "./StandupInput";

interface Props {
  member: TeamMember;
  entry: DailyUpdate | null;
  isCurrentUser: boolean;
  isToday: boolean;
}

export function PersonCard({ member, entry, isCurrentUser, isToday }: Props) {
  const cat = entry?.category ? CATEGORIES.find((c) => c.key === entry.category) : null;

  if (!entry) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <MemberAvatar member={member} size={28} />
          <span className="text-[13px] font-medium truncate">{member.name.split(" ")[0]}</span>
        </div>
        <p className="text-xs italic text-muted-foreground">
          {isCurrentUser && isToday ? "Din oppdatering — skriv ovenfor!" : "Ingen oppdatering"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <MemberAvatar member={member} size={28} />
        <span className="text-[13px] font-medium truncate">{member.name.split(" ")[0]}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {format(new Date(entry.updated_at), "HH:mm")}
        </span>
      </div>
      <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{entry.content}</p>
      {cat && (
        <span
          className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-md"
          style={{ backgroundColor: cat.bg, color: cat.fg }}
        >
          {cat.label}
        </span>
      )}
    </div>
  );
}
