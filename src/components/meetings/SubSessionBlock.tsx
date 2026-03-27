import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubSessionItems, useSubSessionActionPoints } from "@/hooks/useMeetingCalendar";
import { useActivityCatalog, useActivityRegistrations, useUpdateRegistration } from "@/hooks/useActivityCatalog";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  sprint_planning: "Sprint Planning",
  sprint_review: "Sprint Review",
  retrospective: "Retrospektiv",
  daily_standup: "Daily Standup",
  veiledermøte: "Veiledermøte",
  mobb_programmering: "Mobb-programmering",
  workshop: "Workshop",
  annet: "Annet",
};

const typeBorderColors: Record<string, string> = {
  sprint_planning: "border-l-blue-500",
  sprint_review: "border-l-blue-500",
  retrospective: "border-l-rose-500",
  daily_standup: "border-l-green-500",
  veiledermøte: "border-l-teal-500",
  mobb_programmering: "border-l-rose-500",
  workshop: "border-l-rose-500",
  annet: "border-l-gray-400",
};

const activityMeetingTypeMap: Record<string, string> = {
  sprint_planning: "sprint_planning",
  sprint_review: "sprint_review",
  retrospective: "retrospective",
  daily_standup: "daily_standup",
  veiledermøte: "veiledermøte",
  mobb_programmering: "mobb_programmering",
  workshop: "workshop",
};

const prosessloggPlaceholders: Record<string, string> = {
  veiledermøte:
    "Beskriv hva dere diskuterte med veileder og hvilken feedback dere fikk. Inkluder action points.",
  sprint_planning:
    "Beskriv hvordan dere gjennomførte sprint planning. Hvilke items ble valgt inn og hvorfor? Hvordan estimerte dere?",
  sprint_review:
    "Beskriv hva som ble demonstrert, hvem dere demonstrerte for, og hvilken feedback dere fikk.",
  daily_standup:
    "Beskriv hvordan dere gjennomførte daily standup. Var den fysisk eller digital? Hva snakket dere om?",
  retrospective:
    "Beskriv hvordan dere gjennomførte retrospektivet. Hvilket format og verktøy brukte dere?",
  mobb_programmering:
    "Beskriv hva dere lagde under mobb-programmeringen. Legg ved lenke til commit og bilde av seansen.",
  workshop:
    "Beskriv formålet med workshopen, hva slags workshop dere gjennomførte, og agendaen.",
};

// ─── Sub-session action points (for veiledermøte / retrospektiv) ──────────────

function MiniActionPoints({
  meetingId,
  subSessionId,
  members,
}: {
  meetingId: string;
  subSessionId: string;
  members: any[];
}) {
  const qc = useQueryClient();
  const { data: aps } = useSubSessionActionPoints(subSessionId);

  const addAP = async () => {
    const { error } = await (supabase.from("meeting_action_points").insert({
      meeting_id: meetingId,
      source_sub_session_id: subSessionId,
      title: "",
      is_completed: false,
    } as any) as any);
    if (error) { toast.error("Kunne ikke opprette action point"); return; }
    qc.invalidateQueries({ queryKey: ["sub_session_action_points", subSessionId] });
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meetingId] });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Action points</Label>
      {(aps ?? []).map((ap: any) => (
        <MiniAPRow
          key={ap.id}
          ap={ap}
          members={members}
          meetingId={meetingId}
          subSessionId={subSessionId}
        />
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addAP}>
        <Plus className="h-3 w-3 mr-1" /> Legg til action point
      </Button>
    </div>
  );
}

function MiniAPRow({
  ap,
  members,
  meetingId,
  subSessionId,
}: {
  ap: any;
  members: any[];
  meetingId: string;
  subSessionId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(ap.title || "");
  const dirty = useRef(false);

  useEffect(() => { setTitle(ap.title || ""); dirty.current = false; }, [ap.id]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      const { error } = await (supabase.from("meeting_action_points").update({ title } as any).eq("id", ap.id) as any);
      if (error) { toast.error("Kunne ikke lagre action point"); return; }
      qc.invalidateQueries({ queryKey: ["sub_session_action_points", subSessionId] });
      qc.invalidateQueries({ queryKey: ["meeting_action_points", meetingId] });
    }, 300);
    return () => clearTimeout(t);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (updates: any) => {
    const { error } = await (supabase.from("meeting_action_points").update(updates).eq("id", ap.id) as any);
    if (error) { toast.error("Kunne ikke oppdatere action point"); return; }
    qc.invalidateQueries({ queryKey: ["sub_session_action_points", subSessionId] });
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meetingId] });
  };

  const remove = async () => {
    const { error } = await (supabase.from("meeting_action_points").delete().eq("id", ap.id) as any);
    if (error) { toast.error("Kunne ikke slette action point"); return; }
    qc.invalidateQueries({ queryKey: ["sub_session_action_points", subSessionId] });
    qc.invalidateQueries({ queryKey: ["meeting_action_points", meetingId] });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Checkbox
        checked={ap.is_completed}
        onCheckedChange={(v) => update({ is_completed: !!v })}
      />
      <Input
        value={title}
        onChange={(e) => { dirty.current = true; setTitle(e.target.value); }}
        placeholder="Beskrivelse..."
        className="h-7 text-xs flex-1"
      />
      <Select
        value={ap.assignee_id || "none"}
        onValueChange={(v) => update({ assignee_id: v === "none" ? null : v })}
      >
        <SelectTrigger className="h-7 text-xs w-24">
          <SelectValue placeholder="Ansvarlig" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ingen</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={ap.deadline || ""}
        onChange={(e) => update({ deadline: e.target.value || null })}
        className="h-7 text-xs w-28"
      />
      <button
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        onClick={remove}
        title="Slett"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Type-specific field sections ─────────────────────────────────────────────

function TypeSpecificFields({
  type,
  typeData,
  onChange,
  meetingId,
  subSessionId,
  members,
}: {
  type: string;
  typeData: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  meetingId: string;
  subSessionId: string;
  members: any[];
}) {
  const f = (key: string) => typeData[key] ?? "";
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ [key]: e.target.value });

  if (type === "veiledermøte") {
    return (
      <div className="space-y-2 p-3 bg-teal-50/40 dark:bg-teal-950/20 rounded-md border border-teal-200/50 dark:border-teal-800/50">
        <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Veiledermøte</p>
        <div>
          <Label className="text-xs">Spørsmål til veileder</Label>
          <Textarea value={f("questions_for_advisor")} onChange={set("questions_for_advisor")} rows={2} className="text-xs mt-0.5" placeholder="Hva ville dere diskutere?" />
        </div>
        <div>
          <Label className="text-xs">Feedback fra veileder</Label>
          <Textarea value={f("advisor_feedback")} onChange={set("advisor_feedback")} rows={2} className="text-xs mt-0.5" placeholder="Hva sa veileder?" />
        </div>
        <MiniActionPoints meetingId={meetingId} subSessionId={subSessionId} members={members} />
      </div>
    );
  }

  if (type === "sprint_planning") {
    return (
      <div className="space-y-2 p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-md border border-blue-200/50 dark:border-blue-800/50">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Sprint Planning</p>
        <div>
          <Label className="text-xs">Sprint goal</Label>
          <Textarea value={f("sprint_goal")} onChange={set("sprint_goal")} rows={2} className="text-xs mt-0.5" placeholder="Hva er målet for denne sprinten?" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Total kapasitet (SP)</Label>
            <Input
              type="number"
              value={f("capacity")}
              onChange={(e) => onChange({ capacity: e.target.value ? Number(e.target.value) : "" })}
              className="h-7 text-xs mt-0.5"
              placeholder="0"
              min={0}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Notater fra planlegging</Label>
          <Textarea value={f("planning_notes")} onChange={set("planning_notes")} rows={2} className="text-xs mt-0.5" placeholder="Hvilke items ble valgt og hvorfor?" />
        </div>
      </div>
    );
  }

  if (type === "sprint_review") {
    return (
      <div className="space-y-2 p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-md border border-blue-200/50 dark:border-blue-800/50">
        <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Sprint Review</p>
        <div>
          <Label className="text-xs">Hva ble demonstrert?</Label>
          <Textarea value={f("what_was_demonstrated")} onChange={set("what_was_demonstrated")} rows={2} className="text-xs mt-0.5" placeholder="Beskriv hva dere demonstrerte" />
        </div>
        <div>
          <Label className="text-xs">Feedback</Label>
          <Textarea value={f("feedback")} onChange={set("feedback")} rows={2} className="text-xs mt-0.5" placeholder="Feedback fra veileder / produkteier / teamet" />
        </div>
      </div>
    );
  }

  if (type === "daily_standup") {
    return (
      <div className="space-y-2 p-3 bg-green-50/40 dark:bg-green-950/20 rounded-md border border-green-200/50 dark:border-green-800/50">
        <p className="text-[11px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">Daily Standup</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Format</Label>
            <Select value={f("format") || "none"} onValueChange={(v) => onChange({ format: v === "none" ? "" : v })}>
              <SelectTrigger className="h-7 text-xs mt-0.5">
                <SelectValue placeholder="Velg format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ikke valgt</SelectItem>
                <SelectItem value="fysisk">Fysisk standup</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
                <SelectItem value="asynkron">Asynkron i Flyt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-28">
            <Label className="text-xs">Varighet (min)</Label>
            <Input
              type="number"
              value={f("duration_minutes")}
              onChange={(e) => onChange({ duration_minutes: e.target.value ? Number(e.target.value) : "" })}
              className="h-7 text-xs mt-0.5"
              placeholder="15"
              min={0}
            />
          </div>
        </div>
      </div>
    );
  }

  if (type === "retrospective") {
    return (
      <div className="space-y-2 p-3 bg-rose-50/40 dark:bg-rose-950/20 rounded-md border border-rose-200/50 dark:border-rose-800/50">
        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Retrospektiv</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Retro-format</Label>
            <Select value={f("retro_format") || "none"} onValueChange={(v) => onChange({ retro_format: v === "none" ? "" : v })}>
              <SelectTrigger className="h-7 text-xs mt-0.5">
                <SelectValue placeholder="Velg format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ikke valgt</SelectItem>
                <SelectItem value="sailboat">Sailboat</SelectItem>
                <SelectItem value="start_stop_continue">Start-Stop-Continue</SelectItem>
                <SelectItem value="mad_sad_glad">Mad-Sad-Glad</SelectItem>
                <SelectItem value="annet">Annet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Verktøy brukt</Label>
            <Input value={f("tools_used")} onChange={set("tools_used")} className="h-7 text-xs mt-0.5" placeholder="Miro, post-its, Flyt..." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Hva fungerer og skal fortsettes?</Label>
          <Textarea value={f("what_works")} onChange={set("what_works")} rows={2} className="text-xs mt-0.5" placeholder="Hva vil dere fortsette med?" />
        </div>
        <div>
          <Label className="text-xs">Forbedringspunkter</Label>
          <Textarea value={f("improvements")} onChange={set("improvements")} rows={2} className="text-xs mt-0.5" placeholder="Hva skal dere endre til neste gang?" />
        </div>
        <MiniActionPoints meetingId={meetingId} subSessionId={subSessionId} members={members} />
      </div>
    );
  }

  if (type === "mobb_programmering") {
    return (
      <div className="space-y-2 p-3 bg-rose-50/40 dark:bg-rose-950/20 rounded-md border border-rose-200/50 dark:border-rose-800/50">
        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Mobb-programmering</p>
        <div>
          <Label className="text-xs">Hva ble laget?</Label>
          <Textarea value={f("what_was_built")} onChange={set("what_was_built")} rows={2} className="text-xs mt-0.5" placeholder="Beskriv hva dere lagde" />
        </div>
        <div>
          <Label className="text-xs">Lenke til kildekode / commit</Label>
          <Input value={f("code_link")} onChange={set("code_link")} className="h-7 text-xs mt-0.5" placeholder="https://github.com/..." />
        </div>
        <div>
          <Label className="text-xs">Tidsskjema (hvem drev når)</Label>
          <Textarea value={f("schedule")} onChange={set("schedule")} rows={2} className="text-xs mt-0.5" placeholder="Eks: Lars 30 min → Kari 30 min → ..." />
        </div>
        <div>
          <Label className="text-xs">Total varighet (min, min. 60)</Label>
          <Input
            type="number"
            value={f("duration_minutes")}
            onChange={(e) => onChange({ duration_minutes: e.target.value ? Number(e.target.value) : "" })}
            className="h-7 text-xs mt-0.5"
            placeholder="60"
            min={60}
          />
        </div>
      </div>
    );
  }

  if (type === "workshop") {
    return (
      <div className="space-y-2 p-3 bg-rose-50/40 dark:bg-rose-950/20 rounded-md border border-rose-200/50 dark:border-rose-800/50">
        <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Workshop</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Type workshop</Label>
            <Input value={f("workshop_type")} onChange={set("workshop_type")} className="h-7 text-xs mt-0.5" placeholder="Crazy 8, How Might We..." />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Kilde / inspirasjon</Label>
            <Input value={f("source")} onChange={set("source")} className="h-7 text-xs mt-0.5" placeholder="Bok, nettside..." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Formål</Label>
          <Textarea value={f("purpose")} onChange={set("purpose")} rows={2} className="text-xs mt-0.5" placeholder="Hva var målet med workshopen?" />
        </div>
        <div>
          <Label className="text-xs">Agenda</Label>
          <Textarea value={f("agenda")} onChange={set("agenda")} rows={2} className="text-xs mt-0.5" placeholder="Trinn for trinn..." />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main component ────────────────────────────────────────────────────────────

interface SubSessionBlockProps {
  subSession: any;
  meetingStatus: string;
  meetingId: string;
  meetingDate?: string;
  meetingParticipants?: string[];
  onDelete: () => void;
}

export function SubSessionBlock({
  subSession,
  meetingStatus: _meetingStatus,
  meetingId,
  meetingDate: _meetingDate,
  meetingParticipants: _meetingParticipants,
  onDelete,
}: SubSessionBlockProps) {
  const qc = useQueryClient();
  const { data: items } = useSubSessionItems(subSession.id);
  const { data: catalog } = useActivityCatalog();
  const { data: registrations } = useActivityRegistrations();
  const { data: members } = useTeamMembers();
  const updateReg = useUpdateRegistration();

  // ── Notes ──
  const [notes, setNotes] = useState(subSession.notes || "");
  const [newItem, setNewItem] = useState("");

  useEffect(() => { setNotes(subSession.notes || ""); }, [subSession.notes]);

  const saveNotes = useCallback(async (val: string) => {
    await supabase.from("meeting_sub_sessions" as any).update({ notes: val } as any).eq("id", subSession.id);
  }, [subSession.id]);

  useEffect(() => {
    const t = setTimeout(() => { if (notes !== (subSession.notes || "")) saveNotes(notes); }, 500);
    return () => clearTimeout(t);
  }, [notes, subSession.notes, saveNotes]);


  // ── Type-specific data ──
  const [typeData, setTypeData] = useState<Record<string, any>>(
    (subSession.type_specific_data as Record<string, any>) || {}
  );
  const typeDataDirty = useRef(false);

  useEffect(() => {
    setTypeData((subSession.type_specific_data as Record<string, any>) || {});
    typeDataDirty.current = false;
  }, [subSession.id]);

  const handleTypeDataChange = useCallback((updates: Record<string, any>) => {
    typeDataDirty.current = true;
    setTypeData((prev) => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    if (!typeDataDirty.current) return;
    const t = setTimeout(async () => {
      await supabase
        .from("meeting_sub_sessions" as any)
        .update({ type_specific_data: typeData } as any)
        .eq("id", subSession.id);
    }, 600);
    return () => clearTimeout(t);
  }, [typeData, subSession.id]);

  // ── Prosesslogg ──
  const [prosesslogg, setProsesslogg] = useState({
    timing_rationale: "",
    description: "",
    experiences: "",
    reflections: "",
  });

  const meetingType = activityMeetingTypeMap[subSession.type];
  const matchingCatalog = meetingType ? catalog?.find((c) => c.meeting_type === meetingType) : null;
  const existingRegistration = matchingCatalog
    ? registrations?.find((r) => r.linked_sub_session_id === subSession.id)
    : null;

  useEffect(() => {
    if (existingRegistration) {
      setProsesslogg({
        timing_rationale: existingRegistration.timing_rationale || "",
        description: existingRegistration.description || "",
        experiences: existingRegistration.experiences || "",
        reflections: existingRegistration.reflections || "",
      });
    }
  }, [existingRegistration?.id]);

  useEffect(() => {
    if (!existingRegistration) return;
    const reg = existingRegistration;
    const t = setTimeout(() => {
      const changed =
        prosesslogg.timing_rationale !== (reg.timing_rationale || "") ||
        prosesslogg.description !== (reg.description || "") ||
        prosesslogg.experiences !== (reg.experiences || "") ||
        prosesslogg.reflections !== (reg.reflections || "");
      if (changed) {
        updateReg.mutate({
          id: reg.id,
          timing_rationale: prosesslogg.timing_rationale || null,
          description: prosesslogg.description || null,
          experiences: prosesslogg.experiences || null,
          reflections: prosesslogg.reflections || null,
        } as any);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [
    prosesslogg.timing_rationale,
    prosesslogg.description,
    prosesslogg.experiences,
    prosesslogg.reflections,
    existingRegistration?.timing_rationale,
    existingRegistration?.description,
    existingRegistration?.experiences,
    existingRegistration?.reflections,
  ]);

  // ── Agenda items ──
  const addItem = async () => {
    if (!newItem.trim()) return;
    await supabase.from("meeting_sub_session_items" as any).insert({
      sub_session_id: subSession.id,
      content: newItem.trim(),
      sort_order: items?.length ?? 0,
    } as any);
    setNewItem("");
    qc.invalidateQueries({ queryKey: ["meeting_sub_session_items", subSession.id] });
  };

  const borderColor = typeBorderColors[subSession.type] || "border-l-gray-400";
  const descriptionPlaceholder =
    prosessloggPlaceholders[subSession.type] || "Hvordan ble aktiviteten gjennomført?";

  return (
    <div className={`border-l-[3px] ${borderColor} bg-muted/30 rounded-r-md p-3 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{typeLabels[subSession.type] || subSession.type}</Badge>
          <span className="text-sm font-medium">{subSession.title}</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Agenda items */}
      {items && items.length > 0 && (
        <ul className="space-y-1 text-sm">
          {items.map((item: any) => (
            <li key={item.id} className="flex items-center gap-2 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
              {item.content}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Legg til agendapunkt..."
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addItem}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Type-specific fields */}
      {subSession.type !== "annet" && (
        <TypeSpecificFields
          type={subSession.type}
          typeData={typeData}
          onChange={handleTypeDataChange}
          meetingId={meetingId}
          subSessionId={subSession.id}
          members={members || []}
        />
      )}

      {/* Meeting notes */}
      <div>
        <Label className="text-xs text-muted-foreground">Møtenotater</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notater for denne delen..."
          rows={2}
          className="text-xs mt-0.5"
        />
      </div>

      {/* Prosesslogg */}
      {matchingCatalog && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          {existingRegistration ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Registrert i aktivitetsplanen (uke {existingRegistration.completed_week})</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">Prosesslogg</span>
                  <span className="text-[10px] text-muted-foreground/50">· lagres automatisk</span>
                </div>

                <Textarea
                  value={prosesslogg.timing_rationale}
                  onChange={(e) => setProsesslogg((p) => ({ ...p, timing_rationale: e.target.value }))}
                  placeholder="Hvorfor dette tidspunktet?"
                  rows={2}
                  className="text-xs"
                />
                <div>
                  <Textarea
                    value={prosesslogg.description}
                    onChange={(e) => setProsesslogg((p) => ({ ...p, description: e.target.value }))}
                    placeholder={descriptionPlaceholder}
                    rows={3}
                    className="text-xs"
                  />
                  {!prosesslogg.description && notes && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">Møtenotater finnes.</span>
                      <button
                        className="text-[10px] text-primary underline"
                        onClick={() => setProsesslogg((p) => ({ ...p, description: notes }))}
                      >
                        Bruk som gjennomføring
                      </button>
                    </div>
                  )}
                </div>
                <Textarea
                  value={prosesslogg.experiences}
                  onChange={(e) => setProsesslogg((p) => ({ ...p, experiences: e.target.value }))}
                  placeholder="Erfaringer (positive og negative)..."
                  rows={2}
                  className="text-xs"
                />
                <Textarea
                  value={prosesslogg.reflections}
                  onChange={(e) => setProsesslogg((p) => ({ ...p, reflections: e.target.value }))}
                  placeholder="Refleksjoner — er dette noe teamet gjør igjen?"
                  rows={2}
                  className="text-xs"
                />
              </div>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Kobler til aktivitetsplanen automatisk ved neste møte.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
