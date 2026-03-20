import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getWeekNumber } from "@/hooks/useMeetingCalendar";

interface MonthlyCalendarProps {
  currentWeek: number;
  currentYear: number;
  onNavigateToWeek: (week: number, year: number) => void;
}

const dayLabels = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function useMonthMeetings(year: number, month: number) {
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

  return useQuery({
    queryKey: ["month_meetings", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, meeting_date, date, status, recurring_meeting_id, type")
        .gte("meeting_date", startDate)
        .lte("meeting_date", endDate);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function MonthlyCalendar({ currentWeek, currentYear, onNavigateToWeek }: MonthlyCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { data: monthMeetings } = useMonthMeetings(viewYear, viewMonth);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (firstDay.getDay() || 7) - 1;

    const days: { date: Date | null; dateStr: string; meetings: any[] }[] = [];

    for (let i = 0; i < startDow; i++) days.push({ date: null, dateStr: "", meetings: [] });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const meetings = (monthMeetings ?? []).filter((m) => m.meeting_date === dateStr);
      days.push({ date, dateStr, meetings });
    }

    return days;
  }, [viewYear, viewMonth, monthMeetings]);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const todayStr = today.toISOString().split("T")[0];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-primary";
      case "in_progress": return "bg-green-500";
      case "cancelled": return "bg-destructive";
      default: return "bg-muted-foreground/50";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Månedsoversikt
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize min-w-[120px] text-center">{monthName}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px">
          {dayLabels.map((d) => (
            <div key={d} className="text-[10px] font-medium text-muted-foreground text-center pb-1">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (!day.date) return <div key={`empty-${i}`} className="h-10" />;

            const isToday = day.dateStr === todayStr;
            const weekNum = getWeekNumber(day.date);
            const isCurrentWeek = weekNum === currentWeek && viewYear === currentYear;

            return (
              <button
                key={day.dateStr}
                onClick={() => onNavigateToWeek(weekNum, viewYear)}
                className={`h-10 rounded-md flex flex-col items-center justify-center gap-0.5 text-xs transition-colors hover:bg-accent/50 relative
                  ${isToday ? "bg-primary/10 font-bold" : ""}
                  ${isCurrentWeek ? "ring-1 ring-primary/30" : ""}
                `}
              >
                <span className={isToday ? "text-primary" : "text-foreground"}>{day.date.getDate()}</span>
                {day.meetings.length > 0 && (
                  <div className="flex gap-0.5">
                    {day.meetings.map((m) => (
                      <span key={m.id} className={`w-1.5 h-1.5 rounded-full ${getStatusColor(m.status)}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Fullført</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Pågår</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" /> Kommende</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Avlyst</span>
        </div>
      </CardContent>
    </Card>
  );
}
