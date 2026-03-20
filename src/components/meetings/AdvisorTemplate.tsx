import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Plus, X, GripVertical } from "lucide-react";
import type { TeamMember } from "@/lib/types";

interface AgendaItem {
  question: string;
  answer: string;
}

interface ActionPoint {
  title: string;
  assignee_id: string | null;
  deadline: string;
  is_completed: boolean;
}

interface Props {
  members: TeamMember[];
  agendaItems: AgendaItem[];
  onAgendaChange: (items: AgendaItem[]) => void;
  advisorNotes: string;
  onAdvisorNotesChange: (n: string) => void;
  actionPoints: ActionPoint[];
  onActionPointsChange: (points: ActionPoint[]) => void;
  readOnly?: boolean;
}

export function AdvisorTemplate({
  members, agendaItems, onAgendaChange, advisorNotes, onAdvisorNotesChange,
  actionPoints, onActionPointsChange, readOnly,
}: Props) {
  const addAgendaItem = () => {
    onAgendaChange([...agendaItems, { question: "", answer: "" }]);
  };

  const updateAgenda = (index: number, field: keyof AgendaItem, value: string) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    onAgendaChange(updated);
  };

  const removeAgenda = (index: number) => {
    onAgendaChange(agendaItems.filter((_, i) => i !== index));
  };

  const addActionPoint = () => {
    onActionPointsChange([...actionPoints, { title: "", assignee_id: null, deadline: "", is_completed: false }]);
  };

  const updateActionPoint = (index: number, field: keyof ActionPoint, value: any) => {
    const updated = [...actionPoints];
    updated[index] = { ...updated[index], [field]: value };
    onActionPointsChange(updated);
  };

  const removeActionPoint = (index: number) => {
    onActionPointsChange(actionPoints.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      {/* Agenda */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Agenda / Spørsmål til veileder</Label>
          {!readOnly && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addAgendaItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Legg til
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {agendaItems.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen agendapunkter ennå. Legg til spørsmål dere vil ta opp med veileder.</p>
          )}
          {agendaItems.map((item, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2 group">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-1.5 tabular-nums w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={item.question}
                    onChange={(e) => updateAgenda(i, "question", e.target.value)}
                    readOnly={readOnly}
                    placeholder="Spørsmål eller agendapunkt..."
                    className="text-sm"
                  />
                  <Textarea
                    value={item.answer}
                    onChange={(e) => updateAgenda(i, "answer", e.target.value)}
                    readOnly={readOnly}
                    placeholder="Svar / notater fra veileder..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
                {!readOnly && (
                  <button onClick={() => removeAgenda(i)} className="opacity-0 group-hover:opacity-100 transition-opacity mt-1.5">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advisor notes */}
      <div>
        <Label>Generelle notater fra veileder</Label>
        <Textarea
          value={advisorNotes}
          onChange={(e) => onAdvisorNotesChange(e.target.value)}
          readOnly={readOnly}
          placeholder="Overordnede tilbakemeldinger og kommentarer..."
          rows={4}
          className="mt-1"
        />
      </div>

      {/* Action points */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Action Points</Label>
          {!readOnly && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addActionPoint}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Legg til
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {actionPoints.map((ap, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <Checkbox
                checked={ap.is_completed}
                onCheckedChange={(c) => updateActionPoint(i, "is_completed", !!c)}
                disabled={readOnly}
              />
              <Input
                value={ap.title}
                onChange={(e) => updateActionPoint(i, "title", e.target.value)}
                readOnly={readOnly}
                placeholder="Hva skal gjøres?"
                className="flex-1 text-sm h-8"
              />
              <Select value={ap.assignee_id ?? ""} onValueChange={(v) => updateActionPoint(i, "assignee_id", v || null)} disabled={readOnly}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue placeholder="Ansvarlig" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={ap.deadline}
                onChange={(e) => updateActionPoint(i, "deadline", e.target.value)}
                readOnly={readOnly}
                className="w-32 h-8 text-xs"
              />
              {!readOnly && (
                <button onClick={() => removeActionPoint(i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
