import type { TeamMember } from "@/lib/types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: TeamMember;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-medium text-white shrink-0`}
      style={{ backgroundColor: member.avatar_color }}
      title={member.name}
    >
      {getInitials(member.name)}
    </div>
  );
}
