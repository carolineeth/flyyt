import { useState } from "react";
import { useActivities, useActivityParticipants, useUpdateActivity, useToggleParticipant } from "@/hooks/useActivities";
import { PointsPlanner } from "@/components/activities/PointsPlanner";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import type { Activity } from "@/lib/types";

const statusLabels: Record<string, string> = {
  not_started: "Ikke startet",
  in_progress: "Pågår",
  completed: "Fullført",
};

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-primary/10 text-primary",
};

export default function ActivitiesPage() {
  const { data: activities, isLoading } = useActivities();
  const { data: participants } = useActivityParticipants();
  const { data: members } = useTeamMembers();
  const updateActivity = useUpdateActivity();
  const toggleParticipant = useToggleParticipant();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completedActivities = activities?.filter((a) => a.status === "completed") ?? [];
  const totalEarned = completedActivities.reduce((sum, a) => sum + a.points, 0);

  const handleStatusChange = (activity: Activity, status: string) => {
    const updates: Partial<Activity> & { id: string } = { id: activity.id, status };
    if (status === "completed") {
      const now = new Date();
      updates.completed_date = now.toISOString().split("T")[0];
      // Calculate week number (ISO)
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
      updates.completed_week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }
    updateActivity.mutate(updates, {
      onSuccess: () => toast.success("Status oppdatert"),
    });
  };

  const handleNotesUpdate = (id: string, notes: string) => {
    updateActivity.mutate({ id, notes }, {
      onSuccess: () => toast.success("Notater lagret"),
    });
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Laster aktiviteter...</div>;

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Aktivitets-tracker"
        description="Teamaktiviteter teller 30% av prosjektkarakteren. Maks 3 aktiviteter gir poeng per uke."
      />

      {/* Points Planner */}
      {activities && <PointsPlanner activities={activities} />}

      {/* Activity list */}
      <div className="space-y-2">
        {activities?.map((activity) => {
          const activityParticipants = participants?.filter((p) => p.activity_id === activity.id) ?? [];
          const isExpanded = expandedId === activity.id;

          return (
            <Card key={activity.id} className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : activity.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{activity.name}</span>
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {activity.points}p
                    </Badge>
                    {activity.is_mandatory && (
                      <Badge variant="destructive" className="text-[10px]">
                        Obligatorisk
                      </Badge>
                    )}
                    {activity.deadline_date && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(activity.deadline_date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge className={`text-[10px] ${statusColors[activity.status]}`}>
                  {statusLabels[activity.status]}
                </Badge>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground w-16">Status</label>
                    <Select value={activity.status} onValueChange={(v) => handleStatusChange(activity, v)}>
                      <SelectTrigger className="w-40 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Ikke startet</SelectItem>
                        <SelectItem value="in_progress">Pågår</SelectItem>
                        <SelectItem value="completed">Fullført</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Participants */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Deltakere</p>
                    <div className="flex flex-wrap gap-3">
                      {members?.map((member) => {
                        const isParticipant = activityParticipants.some((p) => p.member_id === member.id);
                        return (
                          <label key={member.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={isParticipant}
                              onCheckedChange={() =>
                                toggleParticipant.mutate({
                                  activityId: activity.id,
                                  memberId: member.id,
                                  isParticipant,
                                })
                              }
                            />
                            {member.name.split(" ")[0]}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notater (prosesslogg)</p>
                    <Textarea
                      defaultValue={activity.notes ?? ""}
                      placeholder="Hva ble gjort? Hvorfor? Refleksjoner..."
                      rows={3}
                      onBlur={(e) => {
                        if (e.target.value !== (activity.notes ?? "")) {
                          handleNotesUpdate(activity.id, e.target.value);
                        }
                      }}
                    />
                  </div>

                  {/* Attachment links */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Vedlegg-lenker</p>
                    <div className="text-xs text-muted-foreground">
                      {activity.attachment_links && activity.attachment_links.length > 0
                        ? activity.attachment_links.map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-primary underline block">
                              {link}
                            </a>
                          ))
                        : "Ingen vedlegg ennå"}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
