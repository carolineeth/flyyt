import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Meeting {
  id: string;
  participants: string[] | null;
  recurring_meeting_id: string | null;
  status: string;
  week_number: number | null;
}

interface Member {
  id: string;
  name: string;
  avatar_color: string;
}

interface Props {
  meetings: Meeting[];
  members: Member[];
}

export function AttendanceTrendChart({ meetings, members }: Props) {
  const trendData = useMemo(() => {
    const withWeek = meetings.filter(
      (m) => m.week_number && m.participants && (m.participants as string[]).length > 0
    );
    if (withWeek.length === 0) return [];

    const weeks = [...new Set(withWeek.map((m) => m.week_number!))].sort((a, b) => a - b);

    return weeks.map((week) => {
      const weekMeetings = withWeek.filter((m) => m.week_number === week);
      const total = weekMeetings.length;
      const entry: Record<string, any> = { week: `Uke ${week}` };

      members.forEach((m) => {
        const attended = weekMeetings.filter((mtg) =>
          (mtg.participants as string[]).includes(m.id)
        ).length;
        entry[m.name.split(" ")[0]] = Math.round((attended / total) * 100);
      });

      // Team average
      const totalAttendance = members.reduce((sum, m) => {
        const attended = weekMeetings.filter((mtg) =>
          (mtg.participants as string[]).includes(m.id)
        ).length;
        return sum + attended;
      }, 0);
      entry["Snitt"] = Math.round((totalAttendance / (total * members.length)) * 100);

      return entry;
    });
  }, [meetings, members]);

  if (trendData.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Oppmøtetrend per uke
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" width={40} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                formatter={(value: number) => [`${value}%`, undefined]}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {members.map((m) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.name.split(" ")[0]}
                  stroke={m.avatar_color || "hsl(var(--primary))"}
                  strokeWidth={1.5}
                  dot={{ r: 3 }}
                  strokeOpacity={0.6}
                />
              ))}
              <Line
                type="monotone"
                dataKey="Snitt"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4 }}
                strokeDasharray="6 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Stiplet linje = teamgjennomsnitt. Viser kun uker med registrert oppmøte.
        </p>
      </CardContent>
    </Card>
  );
}
