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
  const cats = entry?.category
    ? entry.category.split(",").map((k) => CATEGORIES.find((c) => c.key === k)).filter(Boolean)
    : [];

  if (!entry) {
    return (
      <div className="card-elevated p-5 opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <MemberAvatar member={member} size="lg" />
          <span className="text-base font-semibold truncate">{member.name.split(" ")[0]}</span>
        </div>
        <p className="text-sm italic text-muted-foreground">
          {isCurrentUser && isToday ? "Din oppdatering — skriv ovenfor!" : "Ingen oppdatering"}
        </p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} size="lg" />
        <span className="text-base font-semibold truncate">{member.name.split(" ")[0]}</span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {format(new Date(entry.updated_at), "HH:mm")}
        </span>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mt-3">{entry.content}</p>
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {cats.map((cat) => (
            <span
              key={cat!.key}
              className="inline-block text-xs font-medium py-0.5 px-2 rounded-md"
              style={{ backgroundColor: cat!.bg, color: cat!.fg }}
            >
              {cat!.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
