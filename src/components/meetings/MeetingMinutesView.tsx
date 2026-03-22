import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText, Users, CheckCircle2, ListChecks, MessageSquare, MapPin } from "lucide-react";

function formatDateNb(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function MeetingMinutesView() {
  const { data: members } = useTeamMembers();
  
  const { data: meetings } = useQuery({
    queryKey: ["all_meetings_minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allSubSessions } = useQuery({
    queryKey: ["all_sub_sessions_minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_sub_sessions")
        .select("*, items:meeting_sub_session_items(*)")
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allAgendaItems } = useQuery({
    queryKey: ["all_agenda_items_minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_agenda_items")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: allActionPoints } = useQuery({
    queryKey: ["all_action_points_minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_action_points")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: recurringMeetings } = useQuery({
    queryKey: ["recurring_meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recurring_meetings").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Only show meetings that have some content (notes, agenda, sub-sessions, or action points)
  const meetingsWithContent = useMemo(() => {
    if (!meetings) return [];
    const todayStr = new Date().toISOString().split("T")[0];
    
    return meetings.filter((m) => {
      const mDate = m.meeting_date || m.date?.split("T")[0];
      if (!mDate || mDate > todayStr) return false; // Only past/today meetings
      
      const hasNotes = !!m.notes?.trim();
      const hasAgenda = (allAgendaItems ?? []).some((a) => a.meeting_id === m.id);
      const hasSubs = (allSubSessions ?? []).some((s) => s.meeting_id === m.id);
      const hasActions = (allActionPoints ?? []).some((a) => a.meeting_id === m.id);
      const hasParticipants = m.participants && m.participants.length > 0;
      
      return hasNotes || hasAgenda || hasSubs || hasActions || hasParticipants;
    });
  }, [meetings, allAgendaItems, allSubSessions, allActionPoints]);

  const getMemberName = (id: string) => members?.find((m) => m.id === id)?.name ?? "Ukjent";
  const getMember = (id: string) => members?.find((m) => m.id === id);

  const getMeetingLabel = (m: any) => {
    if (m.recurring_meeting_id && recurringMeetings) {
      const rm = recurringMeetings.find((r) => r.id === m.recurring_meeting_id);
      if (rm) return rm.label;
    }
    if (m.notes && !m.notes.includes("\n") && m.notes.length < 60) return m.notes;
    return m.type === "other" ? "Møte" : m.type;
  };

  const subSessionTypeLabels: Record<string, string> = {
    sprint_planning: "Sprint Planning",
    sprint_review: "Sprint Review",
    retrospective: "Retrospektiv",
    veiledermøte: "Veiledermøte",
    mobb_programmering: "Mobb-programmering",
    workshop: "Workshop",
    annet: "Annet",
  };

  if (!meetingsWithContent.length) {
    return <EmptyState icon={FileText} title="Ingen møtereferater ennå" description="Møtereferater vises her etter at møter er gjennomført med notater, agenda eller aksjonspunkter." />;
  }

  return (
    <div className="space-y-4">
      {meetingsWithContent.map((m) => {
        const mDate = m.meeting_date || m.date?.split("T")[0];
        const label = getMeetingLabel(m);
        const agenda = (allAgendaItems ?? []).filter((a) => a.meeting_id === m.id);
        const subs = (allSubSessions ?? []).filter((s) => s.meeting_id === m.id);
        const actions = (allActionPoints ?? []).filter((a) => a.meeting_id === m.id);
        const participantIds: string[] = m.participants || [];
        const leader = m.leader_id ? getMember(m.leader_id) : null;
        const notetaker = m.notetaker_id ? getMember(m.notetaker_id) : null;

        return (
          <Card key={m.id} className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{label}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{mDate ? formatDateNb(mDate) : "Ukjent dato"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.room && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <MapPin className="h-3 w-3" /> {m.room}
                    </Badge>
                  )}
                  <Badge className="bg-green-600/80 text-white text-[10px]">Fullført</Badge>
                </div>
              </div>

              {/* Roles & participants */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {leader && (
                  <div className="flex items-center gap-1.5">
                    <MemberAvatar member={leader} size="sm" />
                    <span className="text-muted-foreground">Leder: <span className="text-foreground font-medium">{leader.name.split(" ")[0]}</span></span>
                  </div>
                )}
                {notetaker && (
                  <div className="flex items-center gap-1.5">
                    <MemberAvatar member={notetaker} size="sm" />
                    <span className="text-muted-foreground">Referent: <span className="text-foreground font-medium">{notetaker.name.split(" ")[0]}</span></span>
                  </div>
                )}
                {participantIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">
                      {participantIds.map((id) => getMemberName(id).split(" ")[0]).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Agenda */}
              {agenda.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" /> Agenda
                  </p>
                  <ul className="space-y-1 pl-5">
                    {agenda.map((a) => (
                      <li key={a.id} className={`text-sm flex items-start gap-2 ${a.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${a.is_completed ? "text-green-500" : "text-border"}`} />
                        {a.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sub-sessions */}
              {subs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Delmøter</p>
                  {subs.map((sub) => (
                    <div key={sub.id} className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{subSessionTypeLabels[sub.type] || sub.type}</Badge>
                        <span className="text-sm font-medium text-foreground">{sub.title}</span>
                      </div>
                      {sub.notes && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sub.notes}</p>
                      )}
                      {sub.items && sub.items.length > 0 && (
                        <ul className="space-y-0.5 pl-4">
                          {sub.items.sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                            <li key={item.id} className="text-sm text-foreground">• {item.content}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {m.notes?.trim() && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Notater
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{m.notes}</p>
                </div>
              )}

              {/* Action points */}
              {actions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Aksjonspunkter</p>
                  <ul className="space-y-1 pl-1">
                    {actions.map((ap) => (
                      <li key={ap.id} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${ap.is_completed ? "text-green-500" : "text-amber-500"}`} />
                        <span className={ap.is_completed ? "line-through text-muted-foreground" : "text-foreground"}>
                          {ap.title}
                          {ap.assignee_id && (
                            <span className="text-muted-foreground text-xs ml-1">
                              → {getMemberName(ap.assignee_id).split(" ")[0]}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
