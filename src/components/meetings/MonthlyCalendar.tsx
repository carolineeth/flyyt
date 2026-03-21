import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getWeekNumber } from "@/hooks/useMeetingCalendar";

interface MonthlyCalendarProps {
  currentWeek: number;
  currentYear: number;
  onNavigateToWeek: (week: number, year: number) => void;
}

const dayLabels = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

const meetingTypeLabels: Record<string, string> = {
  standup: "Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  advisor: "Veiledermøte",
  other: "Møte",
};

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

  const calendarWeeks = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = (firstDay.getDay() || 7) - 1;

    const allDays: { date: Date | null; dateStr: string; meetings: any[] }[] = [];

    for (let i = 0; i < startDow; i++) allDays.push({ date: null, dateStr: "", meetings: [] });

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const meetings = (monthMeetings ?? []).filter((m) => m.meeting_date === dateStr);
      allDays.push({ date, dateStr, meetings });
    }

    // Pad end to complete the last week
    while (allDays.length % 7 !== 0) allDays.push({ date: null, dateStr: "", meetings: [] });

    // Group into weeks
    const weeks: { weekNum: number | null; days: typeof allDays }[] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      const weekDays = allDays.slice(i, i + 7);
      const firstDateInWeek = weekDays.find((d) => d.date)?.date;
      const weekNum = firstDateInWeek ? getWeekNumber(firstDateInWeek) : null;
      weeks.push({ weekNum, days: weekDays });
    }

    return weeks;
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
      case "cancelled": return "bg-destructive/60";
      default: return "bg-muted-foreground/40";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "standup": return "bg-blue-400";
      case "sprint_planning": return "bg-violet-400";
      case "sprint_review": return "bg-amber-400";
      case "retrospective": return "bg-rose-400";
      case "advisor": return "bg-teal-400";
      default: return "bg-muted-foreground/40";
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
            <span className="text-sm font-medium capitalize min-w-[130px] text-center">{monthName}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          {/* Header row with week number column */}
          <div className="grid grid-cols-[28px_repeat(7,1fr)] gap-px mb-1">
            <div className="text-[9px] font-medium text-muted-foreground/50 text-center">Uke</div>
            {dayLabels.map((d) => (
              <div key={d} className="text-[10px] font-medium text-muted-foreground text-center pb-1">{d}</div>
            ))}
          </div>

          {/* Weeks */}
          {calendarWeeks.map((week, wi) => {
            const isCurrentWeekRow = week.weekNum === currentWeek && viewYear === currentYear;

            return (
              <div
                key={wi}
                className={`grid grid-cols-[28px_repeat(7,1fr)] gap-px ${
                  isCurrentWeekRow ? "bg-primary/5 rounded-md" : ""
                }`}
              >
                {/* Week number */}
                <button
                  onClick={() => week.weekNum != null && onNavigateToWeek(week.weekNum, viewYear)}
                  className={`h-12 flex items-center justify-center text-[10px] rounded-l-md transition-colors ${
                    isCurrentWeekRow
                      ? "text-primary font-bold"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  {week.weekNum}
                </button>

                {/* Days */}
                {week.days.map((day, di) => {
                  if (!day.date) return <div key={`empty-${wi}-${di}`} className="h-12" />;

                  const isToday = day.dateStr === todayStr;
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                  const hasMeetings = day.meetings.length > 0;

                  const dayContent = (
                    <button
                      key={day.dateStr}
                      onClick={() => {
                        const wn = getWeekNumber(day.date!);
                        onNavigateToWeek(wn, viewYear);
                      }}
                      className={`h-12 rounded-md flex flex-col items-center justify-center gap-1 text-xs transition-colors hover:bg-accent/50 relative
                        ${isToday ? "ring-2 ring-primary/40 bg-primary/10" : ""}
                        ${isWeekend ? "opacity-40" : ""}
                      `}
                    >
                      <span className={`text-[12px] leading-none ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                        {day.date.getDate()}
                      </span>
                      {hasMeetings && (
                        <div className="flex gap-[3px]">
                          {day.meetings.slice(0, 4).map((m) => (
                            <span
                              key={m.id}
                              className={`w-[6px] h-[6px] rounded-full ${
                                m.status === "cancelled" ? getStatusColor(m.status) : getTypeColor(m.type)
                              }`}
                            />
                          ))}
                          {day.meetings.length > 4 && (
                            <span className="text-[8px] text-muted-foreground leading-none">+{day.meetings.length - 4}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );

                  if (!hasMeetings) return dayContent;

                  return (
                    <Tooltip key={day.dateStr}>
                      <TooltipTrigger asChild>{dayContent}</TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs space-y-0.5 max-w-[180px]">
                        {day.meetings.map((m) => (
                          <div key={m.id} className="flex items-center gap-1.5">
                            <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${
                              m.status === "cancelled" ? getStatusColor(m.status) : getTypeColor(m.type)
                            }`} />
                            <span className={m.status === "cancelled" ? "line-through text-muted-foreground" : ""}>
                              {meetingTypeLabels[m.type] ?? m.type}
                            </span>
                          </div>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </TooltipProvider>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border">
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Møtetype:</span>
          {[
            { color: "bg-blue-400", label: "Standup" },
            { color: "bg-violet-400", label: "Planning" },
            { color: "bg-amber-400", label: "Review" },
            { color: "bg-rose-400", label: "Retro" },
            { color: "bg-teal-400", label: "Veileder" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`w-[6px] h-[6px] rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Status:</span>
          {[
            { color: "bg-primary", label: "Fullført" },
            { color: "bg-green-500", label: "Pågår" },
            { color: "bg-muted-foreground/40", label: "Kommende" },
            { color: "bg-destructive/60", label: "Avlyst" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`w-[6px] h-[6px] rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
