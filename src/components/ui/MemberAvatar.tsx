import { useState } from "react";
import type { TeamMember } from "@/lib/types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-14 w-14 text-lg",
};

export function MemberAvatar({
  member,
  size = "sm",
}: {
  member: TeamMember;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [imgError, setImgError] = useState(false);
  const hasImage = member.avatar_url && !imgError;

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium text-white shrink-0 overflow-hidden`}
      style={{ backgroundColor: hasImage ? undefined : member.avatar_color }}
      role="img"
      aria-label={member.name}
      title={member.name}
    >
      {hasImage ? (
        <img
          src={member.avatar_url!}
          alt={member.name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials(member.name)}</span>
      )}
    </div>
  );
}
