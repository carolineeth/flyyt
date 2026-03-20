import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityCatalog, useActivityRegistrations, useRegistrationParticipants } from "@/hooks/useActivityCatalog";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Target, CalendarDays, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AttendanceTrendChart } from "@/components/dashboard/AttendanceTrendChart";

function useAllMeetings() {
  return useQuery({
    queryKey: ["all_meetings_attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, participants, recurring_meeting_id, status, week_number")
        .not("recurring_meeting_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function DashboardPage() {
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: members } = useTeamMembers();
  const { data: participants } = useRegistrationParticipants();
  const { data: allMeetings } = useAllMeetings();

  const regs = registrations ?? [];
  const cat = catalog ?? [];

  const completedRegs = regs.filter((r) => r.status === "completed");
  const totalEarned = completedRegs.reduce((sum, r) => {
    const c = cat.find((c) => c.id === r.catalog_id);
    return sum + (c?.points ?? 0);
  }, 0);
  const maxPossible = 30;
  const progressPct = Math.min((totalEarned / maxPossible) * 100, 100);

  const mandatoryRemaining = cat.filter((c) => c.is_mandatory && !regs.some((r) => r.catalog_id === c.id && r.status === "completed")).length;

  // Attendance stats
  const attendanceData = useMemo(() => {
    if (!members || !allMeetings) return [];
    const meetingsWithParticipants = allMeetings.filter(
      (m) => m.participants && (m.participants as string[]).length > 0
    );
    const total = meetingsWithParticipants.length;
    if (total === 0) return [];

    return members.map((m) => {
      const attended = meetingsWithParticipants.filter((mtg) =>
        (mtg.participants as string[]).includes(m.id)
      ).length;
      return {
        name: m.name.split(" ")[0],
        attended,
        total,
        pct: Math.round((attended / total) * 100),
        color: m.avatar_color || "hsl(var(--primary))",
      };
    }).sort((a, b) => b.pct - a.pct);
  }, [members, allMeetings]);

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
            {completedRegs.length} aktiviteter fullført · Maks 3 poenggivende per uke
          </p>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Totalt registreringer</p>
            <p className="text-2xl font-bold tabular-nums">{regs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Fullførte</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{completedRegs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Obligatoriske gjenstår</p>
            <p className="text-2xl font-bold tabular-nums">{mandatoryRemaining}</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance chart */}
      {attendanceData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Oppmøte på faste møter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip
                    formatter={(value: number, _name: string, props: any) => [`${props.payload.attended}/${props.payload.total} møter (${value}%)`, "Oppmøte"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="pct" radius={[0, 4, 4, 0]} barSize={20}>
                    {attendanceData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Basert på {attendanceData[0]?.total ?? 0} møter med registrert oppmøte
            </p>
          </CardContent>
        </Card>
      )}

      {/* Attendance trend */}
      {allMeetings && members && (
        <AttendanceTrendChart meetings={allMeetings as any} members={members} />
      )}

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
