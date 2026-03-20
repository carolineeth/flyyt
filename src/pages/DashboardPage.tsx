import { useActivities, useActivityParticipants } from "@/hooks/useActivities";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Target, CalendarDays, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { data: activities } = useActivities();
  const { data: members } = useTeamMembers();
  const { data: participants } = useActivityParticipants();

  const completedActivities = activities?.filter((a) => a.status === "completed") ?? [];
  const totalEarned = completedActivities.reduce((sum, a) => sum + a.points, 0);
  const maxPossible = 30;
  const progressPct = Math.min((totalEarned / maxPossible) * 100, 100);

  const quickLinks = [
    { label: "Aktiviteter", to: "/aktiviteter", icon: Target },
    { label: "Sprint Board", to: "/sprint", icon: CalendarDays },
    { label: "Møter", to: "/moter", icon: Users },
  ];

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Dashboard"
        description="Oversikt over teamets fremdrift i IN2000-prosjektet"
      />

      {/* Activity points */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Teamaktivitetspoeng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-foreground tabular-nums">{totalEarned}</span>
            <span className="text-muted-foreground text-sm mb-1">/ {maxPossible} poeng</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {completedActivities.length} aktiviteter fullført · Maks 3 poenggivende per uke
          </p>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Totalt aktiviteter</p>
            <p className="text-2xl font-bold tabular-nums">{activities?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Fullførte</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{completedActivities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Obligatoriske gjenstår</p>
            <p className="text-2xl font-bold tabular-nums">
              {activities?.filter((a) => a.is_mandatory && a.status !== "completed").length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Teammedlemmer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {members?.map((m) => {
              const memberActivities = participants?.filter((p) => p.member_id === m.id).length ?? 0;
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <MemberAvatar member={m} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name.split(" ")[0]}</p>
                    <p className="text-xs text-muted-foreground">{memberActivities} aktiviteter</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quickLinks.map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:shadow-md transition-shadow duration-200 cursor-pointer group">
              <CardContent className="pt-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <link.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
