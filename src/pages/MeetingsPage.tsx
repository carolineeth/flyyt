import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useActivities } from "@/hooks/useActivities";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { Users, Plus, Clock, Link2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { StandupTemplate } from "@/components/meetings/StandupTemplate";
import { SprintPlanningTemplate } from "@/components/meetings/SprintPlanningTemplate";
import { SprintReviewTemplate } from "@/components/meetings/SprintReviewTemplate";
import { RetroTemplate } from "@/components/meetings/RetroTemplate";
import { AdvisorTemplate } from "@/components/meetings/AdvisorTemplate";
import type { Meeting } from "@/lib/types";

const typeLabels: Record<string, string> = {
  daily_standup: "Daily Standup",
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  advisor: "Veiledermøte",
  other: "Annet",
};

const typeIcons: Record<string, string> = {
  daily_standup: "🔄",
  sprint_planning: "📋",
  sprint_review: "🔍",
  retrospective: "⛵",
  advisor: "🎓",
  other: "📝",
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const { data: members } = useTeamMembers();
  const { data: activities } = useActivities();
  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "daily_standup",
    date: new Date().toISOString().slice(0, 16),
    duration_minutes: 15,
    notes: "",
    participants: [] as string[],
    related_activity_id: null as string | null,
    sprint_id: null as string | null,
    facilitator_id: null as string | null,
    note_taker_id: null as string | null,
    // Planning-specific
    planning_capacity: {} as Record<string, number>,
    planning_selected_items: [] as string[],
    sprint_goal: "",
    // Review-specific
    review_feedback: "",
    // Retro-specific
    retro_items: [] as { column_type: string; text: string; member_id: string | null; is_anonymous: boolean }[],
    // Standup
    standup_entries: [] as { member_id: string; did_yesterday: string; doing_today: string; blockers: string }[],
    // Advisor
    agenda_items: [] as { question: string; answer: string }[],
    advisor_notes: "",
    action_points: [] as { title: string; assignee_id: string | null; deadline: string; is_completed: boolean }[],
  });

  const toggleParticipant = (id: string) => {
    setForm((p) => ({
      ...p,
      participants: p.participants.includes(id) ? p.participants.filter((x) => x !== id) : [...p.participants, id],
    }));
  };

  const selectAll = () => {
    if (members) setForm((p) => ({ ...p, participants: members.map((m) => m.id) }));
  };

  const resetForm = () => {
    setForm({
      type: "daily_standup", date: new Date().toISOString().slice(0, 16), duration_minutes: 15, notes: "",
      participants: [], related_activity_id: null, sprint_id: null,
      facilitator_id: null, note_taker_id: null,
      planning_capacity: {}, planning_selected_items: [], sprint_goal: "",
      review_feedback: "", retro_items: [], standup_entries: [],
      agenda_items: [], advisor_notes: "", action_points: [],
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create meeting
      const { data: meeting, error } = await supabase.from("meetings").insert({
        type: form.type,
        date: new Date(form.date).toISOString(),
        duration_minutes: form.duration_minutes || null,
        notes: form.notes || null,
        participants: form.participants,
        related_activity_id: form.related_activity_id,
        sprint_id: form.sprint_id,
        facilitator_id: form.facilitator_id,
        note_taker_id: form.note_taker_id,
        planning_capacity: form.type === "sprint_planning" ? form.planning_capacity : null,
        review_feedback: form.type === "sprint_review" ? form.review_feedback : null,
      }).select().single();
      if (error) throw error;

      // Save standup entries
      if (form.type === "daily_standup" && form.standup_entries.length > 0) {
        const entries = form.standup_entries
          .filter((e) => e.did_yesterday || e.doing_today || e.blockers)
          .map((e) => ({ meeting_id: meeting.id, ...e }));
        if (entries.length > 0) {
          const { error: seError } = await supabase.from("standup_entries").insert(entries);
          if (seError) throw seError;
        }
      }

      // Save retro items
      if (form.type === "retrospective" && form.retro_items.length > 0) {
        const retroItems = form.retro_items.map((item) => ({
          meeting_id: meeting.id,
          column_type: item.column_type,
          text: item.text,
          member_id: item.member_id,
          is_anonymous: item.is_anonymous,
        }));
        const { error: riError } = await supabase.from("retro_items").insert(retroItems);
        if (riError) throw riError;
      }

      // Save advisor agenda items
      if (form.type === "advisor" && form.agenda_items.length > 0) {
        const agendaItems = form.agenda_items.map((item, i) => ({
          meeting_id: meeting.id,
          question: item.question,
          answer: item.answer || null,
          sort_order: i,
        }));
        const { error: aiError } = await supabase.from("advisor_agenda_items").insert(agendaItems);
        if (aiError) throw aiError;
      }

      // Save action points
      if (form.action_points.length > 0) {
        const aps = form.action_points
          .filter((ap) => ap.title.trim())
          .map((ap) => ({
            meeting_id: meeting.id,
            title: ap.title,
            assignee_id: ap.assignee_id,
            deadline: ap.deadline || null,
            is_completed: ap.is_completed,
          }));
        if (aps.length > 0) {
          const { error: apError } = await supabase.from("meeting_action_points").insert(aps);
          if (apError) throw apError;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setShowCreate(false);
      resetForm();
      toast.success("Møte registrert");
    },
    onError: (e) => toast.error(e.message),
  });

  const exportToProcessLog = (meeting: Meeting) => {
    const participantNames = members
      ?.filter((m) => meeting.participants?.includes(m.id))
      .map((m) => m.name) ?? [];
    const dateStr = new Date(meeting.date).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    const log = [
      `## ${typeLabels[meeting.type]} — ${dateStr}`,
      `**Deltakere:** ${participantNames.join(", ")}`,
      meeting.duration_minutes ? `**Varighet:** ${meeting.duration_minutes} minutter` : "",
      "",
      meeting.notes ? `### Notater\n${meeting.notes}` : "",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(log);
    toast.success("Kopiert til utklippstavlen i prosesslogg-format");
  };

  const getDefaultDuration = (type: string) => {
    switch (type) {
      case "daily_standup": return 15;
      case "sprint_planning": return 60;
      case "sprint_review": return 30;
      case "retrospective": return 45;
      case "advisor": return 30;
      default: return 30;
    }
  };

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Møtelogg"
        description="Strukturerte maler for standup, planning, review, retro og veiledermøter"
        action={
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nytt møte
          </Button>
        }
      />

      {/* Meeting list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laster...</p>
      ) : !meetings?.length ? (
        <EmptyState
          icon={Users}
          title="Ingen møter logget"
          description="Registrer det første møtet for å begynne å bygge møtehistorikken"
          actionLabel="Legg til møte"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => {
            const participantMembers = members?.filter((mem) => m.participants?.includes(mem.id)) ?? [];
            const isExpanded = expandedId === m.id;
            return (
              <Card key={m.id} className="overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                >
                  <span className="text-lg shrink-0">{typeIcons[m.type] ?? "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{typeLabels[m.type]}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(m.date).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })}
                        {" "}
                        {new Date(m.date).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {m.duration_minutes && (
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <Clock className="h-3 w-3" />{m.duration_minutes} min
                        </Badge>
                      )}
                      {m.related_activity_id && (
                        <Badge variant="secondary" className="text-[10px] gap-0.5">
                          <Link2 className="h-3 w-3" />Koblet
                        </Badge>
                      )}
                    </div>
                    {participantMembers.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {participantMembers.map((p) => (
                          <Badge key={p.id} variant="outline" className="text-[10px]">{p.name.split(" ")[0]}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {/* Roles */}
                    {((m as any).facilitator_id || (m as any).note_taker_id) && (
                      <div className="flex gap-4 flex-wrap">
                        {(m as any).facilitator_id && (() => {
                          const f = members?.find((mem) => mem.id === (m as any).facilitator_id);
                          return f ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Badge variant="outline" className="text-[10px]">Møteleder</Badge>
                              <MemberAvatar member={f} />
                              <span className="text-muted-foreground">{f.name.split(" ")[0]}</span>
                            </div>
                          ) : null;
                        })()}
                        {(m as any).note_taker_id && (() => {
                          const n = members?.find((mem) => mem.id === (m as any).note_taker_id);
                          return n ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Badge variant="outline" className="text-[10px]">Referent</Badge>
                              <MemberAvatar member={n} />
                              <span className="text-muted-foreground">{n.name.split(" ")[0]}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                    {m.notes && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Notater</p>
                        <p className="text-sm whitespace-pre-wrap">{m.notes}</p>
                      </div>
                    )}

                    {/* Type-specific read-only templates */}
                    {m.type === "daily_standup" && members && (
                      <StandupTemplate
                        meetingId={m.id}
                        members={members}
                        participantIds={m.participants ?? []}
                        readOnly
                      />
                    )}

                    {m.type === "retrospective" && members && (
                      <RetroTemplate
                        meetingId={m.id}
                        members={members}
                        participantIds={m.participants ?? []}
                        items={[]}
                        onItemsChange={() => {}}
                        readOnly
                      />
                    )}

                    {m.type === "sprint_review" && m.review_feedback && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Feedback</p>
                        <p className="text-sm whitespace-pre-wrap">{m.review_feedback}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => exportToProcessLog(m)}>
                        <FileText className="h-3 w-3 mr-1" /> Eksporter til prosesslogg
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create meeting dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {typeIcons[form.type]} Nytt {typeLabels[form.type]?.toLowerCase() ?? "møte"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((p) => ({ ...p, type: v, duration_minutes: getDefaultDuration(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{typeIcons[k]} {v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dato og tid</Label>
                <Input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Varighet (min)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label>Koble til aktivitet</Label>
                <Select
                  value={form.related_activity_id ?? "none"}
                  onValueChange={(v) => setForm((p) => ({ ...p, related_activity_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Ingen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen kobling</SelectItem>
                    {activities?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between">
                <Label>Deltakere</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={selectAll}>Velg alle</Button>
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {members?.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.participants.includes(m.id)} onCheckedChange={() => toggleParticipant(m.id)} />
                    {m.name.split(" ")[0]}
                  </label>
                ))}
              </div>
            </div>

            {/* General notes (for all types) */}
            <div>
              <Label>Generelle notater</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Notater fra møtet..."
                rows={3}
              />
            </div>

            {/* Type-specific template */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium mb-3">{typeIcons[form.type]} {typeLabels[form.type]}-mal</h3>

              {form.type === "daily_standup" && members && (
                <StandupTemplate
                  meetingId={null}
                  members={members}
                  participantIds={form.participants}
                  onEntriesChange={(entries) => setForm((p) => ({ ...p, standup_entries: entries }))}
                />
              )}

              {form.type === "sprint_planning" && members && (
                <SprintPlanningTemplate
                  members={members}
                  participantIds={form.participants}
                  sprintId={form.sprint_id}
                  onSprintIdChange={(id) => setForm((p) => ({ ...p, sprint_id: id }))}
                  capacity={form.planning_capacity}
                  onCapacityChange={(c) => setForm((p) => ({ ...p, planning_capacity: c }))}
                  selectedItemIds={form.planning_selected_items}
                  onSelectedItemsChange={(ids) => setForm((p) => ({ ...p, planning_selected_items: ids }))}
                  sprintGoal={form.sprint_goal}
                  onSprintGoalChange={(g) => setForm((p) => ({ ...p, sprint_goal: g }))}
                />
              )}

              {form.type === "sprint_review" && (
                <SprintReviewTemplate
                  sprintId={form.sprint_id}
                  members={members ?? []}
                  feedback={form.review_feedback}
                  onFeedbackChange={(f) => setForm((p) => ({ ...p, review_feedback: f }))}
                />
              )}

              {form.type === "retrospective" && members && (
                <RetroTemplate
                  meetingId={null}
                  members={members}
                  participantIds={form.participants}
                  items={form.retro_items}
                  onItemsChange={(items) => setForm((p) => ({ ...p, retro_items: items }))}
                />
              )}

              {form.type === "advisor" && members && (
                <AdvisorTemplate
                  members={members}
                  agendaItems={form.agenda_items}
                  onAgendaChange={(items) => setForm((p) => ({ ...p, agenda_items: items }))}
                  advisorNotes={form.advisor_notes}
                  onAdvisorNotesChange={(n) => setForm((p) => ({ ...p, advisor_notes: n }))}
                  actionPoints={form.action_points}
                  onActionPointsChange={(aps) => setForm((p) => ({ ...p, action_points: aps }))}
                />
              )}

              {form.type === "other" && (
                <p className="text-sm text-muted-foreground">Bruk notatfeltet over for å dokumentere dette møtet.</p>
              )}
            </div>

            {/* Action points for non-advisor types */}
            {form.type !== "advisor" && (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Action Points</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setForm((p) => ({
                      ...p,
                      action_points: [...p.action_points, { title: "", assignee_id: null, deadline: "", is_completed: false }],
                    }))}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Legg til
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.action_points.map((ap, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={ap.title}
                        onChange={(e) => {
                          const updated = [...form.action_points];
                          updated[i] = { ...updated[i], title: e.target.value };
                          setForm((p) => ({ ...p, action_points: updated }));
                        }}
                        placeholder="Hva skal gjøres?"
                        className="flex-1 text-sm h-8"
                      />
                      <Select
                        value={ap.assignee_id ?? ""}
                        onValueChange={(v) => {
                          const updated = [...form.action_points];
                          updated[i] = { ...updated[i], assignee_id: v || null };
                          setForm((p) => ({ ...p, action_points: updated }));
                        }}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue placeholder="Ansvarlig" />
                        </SelectTrigger>
                        <SelectContent>
                          {members?.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Avbryt</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Lagrer..." : "Lagre møte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
