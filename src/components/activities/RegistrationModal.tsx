import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  useUpdateRegistration,
  useCreateRegistration,
  useRegistrationParticipants,
  useToggleRegistrationParticipant,
  type CatalogItem,
  type Registration,
} from "@/hooks/useActivityCatalog";
import { toast } from "sonner";
import { Link2, FileText, Plus, Trash2, Pencil, Eye } from "lucide-react";
import { FileUpload, getPublicUrl } from "./FileUpload";
import { useSubSessionById, useSubSessionActionPoints } from "@/hooks/useMeetingCalendar";

interface RegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogItem: CatalogItem;
  registration: Registration | null;
  allRegistrations: Registration[];
}

export function RegistrationModal({ open, onOpenChange, catalogItem, registration, allRegistrations }: RegistrationModalProps) {
  const { data: members } = useTeamMembers();
  const { data: participants } = useRegistrationParticipants();
  const createReg = useCreateRegistration();
  const updateReg = useUpdateRegistration();
  const toggleParticipant = useToggleRegistrationParticipant();

  const [reg, setReg] = useState<Registration | null>(null);
  const linkedSubSessionId = (reg ?? registration)?.linked_sub_session_id ?? null;
  const { data: linkedSubSession } = useSubSessionById(linkedSubSessionId);
  const { data: ssActionPoints } = useSubSessionActionPoints(linkedSubSessionId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: "not_started",
    completed_date: "",
    timing_rationale: "",
    description: "",
    experiences: "",
    reflections: "",
    attachment_links: [] as string[],
    newLink: "",
    selectedMembers: [] as string[],
  });

  useEffect(() => {
    const existingParticipantIds = participants?.filter((p) => p.registration_id === registration?.id).map((p) => p.member_id) || [];
    if (registration) {
      setReg(registration);
      setEditing(false);
      setForm({
        status: registration.status,
        completed_date: registration.completed_date || "",
        timing_rationale: registration.timing_rationale || "",
        description: registration.description || "",
        experiences: registration.experiences || "",
        reflections: registration.reflections || "",
        attachment_links: registration.attachment_links || [],
        newLink: "",
        selectedMembers: existingParticipantIds,
      });
    } else {
      setReg(null);
      setEditing(true); // new registration starts in edit mode
      setForm({
        status: "not_started",
        completed_date: "",
        timing_rationale: "",
        description: "",
        experiences: "",
        reflections: "",
        attachment_links: [],
        newLink: "",
        selectedMembers: [],
      });
    }
  }, [registration, open, participants]);

  const regParticipants = participants?.filter((p) => p.registration_id === reg?.id) || [];

  // Calculate week number from date
  const getWeekNumber = (dateStr: string) => {
    const d = new Date(dateStr);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  const handleSave = async () => {
    const completedWeek = form.completed_date ? getWeekNumber(form.completed_date) : null;

    if (reg) {
      // Update existing
      updateReg.mutate({
        id: reg.id,
        status: form.status,
        completed_date: form.completed_date || null,
        completed_week: completedWeek,
        timing_rationale: form.timing_rationale || null,
        description: form.description || null,
        experiences: form.experiences || null,
        reflections: form.reflections || null,
        attachment_links: form.attachment_links,
      } as any, {
        onSuccess: () => toast.success("Registrering oppdatert"),
      });
    } else {
      // Count existing occurrences
      const existingCount = allRegistrations.filter((r) => r.catalog_id === catalogItem.id).length;
      createReg.mutate({
        catalog_id: catalogItem.id,
        status: form.status,
        completed_date: form.completed_date || null,
        completed_week: completedWeek,
        occurrence_number: existingCount + 1,
        timing_rationale: form.timing_rationale || null,
        description: form.description || null,
        experiences: form.experiences || null,
        reflections: form.reflections || null,
        attachment_links: form.attachment_links,
      } as any, {
        onSuccess: (data) => {
          setReg(data);
          // Save participants for new registration
          form.selectedMembers.forEach((memberId) => {
            toggleParticipant.mutate({ registrationId: data.id, memberId, isParticipant: false });
          });
          toast.success("Registrering opprettet");
        },
      });
    }
  };

  const addLink = () => {
    if (!form.newLink.trim()) return;
    setForm((p) => ({ ...p, attachment_links: [...p.attachment_links, p.newLink.trim()], newLink: "" }));
  };

  const removeLink = (idx: number) => {
    setForm((p) => ({ ...p, attachment_links: p.attachment_links.filter((_, i) => i !== idx) }));
  };

  // Auto-save debounce
  useEffect(() => {
    if (!reg) return;
    const t = setTimeout(() => {
      const completedWeek = form.completed_date ? getWeekNumber(form.completed_date) : null;
      updateReg.mutate({
        id: reg.id,
        status: form.status,
        completed_date: form.completed_date || null,
        completed_week: completedWeek,
        timing_rationale: form.timing_rationale || null,
        description: form.description || null,
        experiences: form.experiences || null,
        reflections: form.reflections || null,
        attachment_links: form.attachment_links,
      } as any);
    }, 800);
    return () => clearTimeout(t);
  }, [form.timing_rationale, form.description, form.experiences, form.reflections]);

  const prosessloggComplete = !!(form.timing_rationale && form.description && form.experiences && form.reflections);

  // Duplicate check: registration for same catalog+week already exists (meeting-based only)
  const duplicateInWeek = (catalogItem.meeting_type && form.completed_date && !reg)
    ? allRegistrations.find((r) =>
        r.catalog_id === catalogItem.id &&
        r.completed_week === getWeekNumber(form.completed_date)
      ) ?? null
    : null;

  const openDuplicate = () => {
    if (!duplicateInWeek) return;
    const existingParticipantIds = participants?.filter((p) => p.registration_id === duplicateInWeek.id).map((p) => p.member_id) || [];
    setReg(duplicateInWeek);
    setEditing(false);
    setForm({
      status: duplicateInWeek.status,
      completed_date: duplicateInWeek.completed_date || "",
      timing_rationale: duplicateInWeek.timing_rationale || "",
      description: duplicateInWeek.description || "",
      experiences: duplicateInWeek.experiences || "",
      reflections: duplicateInWeek.reflections || "",
      attachment_links: duplicateInWeek.attachment_links || [],
      newLink: "",
      selectedMembers: existingParticipantIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {catalogItem.name}
            <Badge variant="secondary" className="text-xs">{catalogItem.points}p</Badge>
            {catalogItem.is_mandatory && <Badge variant="destructive" className="text-xs">Obligatorisk</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* Catalog description */}
        {catalogItem.description && (
          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            {catalogItem.description}
          </div>
        )}

        {/* Fra møtekalenderen — read-only type-specific data */}
        {linkedSubSession && Object.keys(linkedSubSession.type_specific_data ?? {}).length > 0 && (
          <MeetingDataSection
            type={linkedSubSession.type}
            typeData={linkedSubSession.type_specific_data}
            actionPoints={ssActionPoints ?? []}
            members={members ?? []}
          />
        )}

        {reg && !editing ? (
          /* ===== PREVIEW MODE ===== */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={form.status === "completed" ? "default" : form.status === "in_progress" ? "secondary" : "outline"}>
                  {form.status === "completed" ? "Fullført" : form.status === "in_progress" ? "Pågår" : "Ikke startet"}
                </Badge>
                {form.completed_date && (
                  <span className="text-xs text-muted-foreground">
                    {form.completed_date} (uke {getWeekNumber(form.completed_date)})
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Rediger
              </Button>
            </div>

            {/* Participants preview */}
            {form.selectedMembers.length > 0 && members && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Deltakere</p>
                <div className="flex flex-wrap gap-1.5">
                  {form.selectedMembers.map((mid) => {
                    const m = members.find((m) => m.id === mid);
                    return m ? (
                      <Badge key={mid} variant="secondary" className="text-xs">{m.name.split(" ")[0]}</Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Process log preview */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Prosesslogg</p>
                {prosessloggComplete ? (
                  <Badge className="bg-primary/10 text-primary text-[10px]">✓ Komplett</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600">Mangler felt</Badge>
                )}
              </div>

              <PreviewField label="Hvorfor dette tidspunktet?" value={form.timing_rationale} />
              <PreviewField label="Gjennomføring" value={form.description} />
              <PreviewField label="Erfaringer" value={form.experiences} />
              <PreviewField label="Refleksjoner" value={form.reflections} />
            </div>

            {/* Attachments preview */}
            {form.attachment_links.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">Vedlegg</p>
                <div className="flex flex-wrap gap-2">
                  {form.attachment_links.filter((l) => !l.startsWith("http")).map((path, i) => {
                    const url = getPublicUrl(path);
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(path);
                    return isImage ? (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="h-16 w-16 rounded object-cover border" />
                      </a>
                    ) : (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                        {path.split("/").pop()}
                      </a>
                    );
                  })}
                </div>
                {form.attachment_links.filter((l) => l.startsWith("http")).map((link, i) => (
                  <a key={`l-${i}`} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline block truncate">
                    {link}
                  </a>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Lukk</Button>
            </DialogFooter>
          </div>
        ) : (
          /* ===== EDIT MODE ===== */
          <div className="space-y-4">
            {reg && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Forhåndsvis
                </Button>
              </div>
            )}

            {/* Status section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Ikke startet</SelectItem>
                    <SelectItem value="in_progress">Pågår</SelectItem>
                    <SelectItem value="completed">Fullført</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gjennomført dato</Label>
                <Input
                  type="date"
                  value={form.completed_date}
                  onChange={(e) => setForm((p) => ({ ...p, completed_date: e.target.value }))}
                />
                {form.completed_date && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Uke {getWeekNumber(form.completed_date)}</p>
                )}
                {duplicateInWeek && (
                  <Alert className="mt-2 py-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
                      <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                        {catalogItem.name} er allerede registrert i uke {getWeekNumber(form.completed_date)}.
                        {" "}
                        <button className="underline font-medium" onClick={openDuplicate}>
                          Åpne eksisterende
                        </button>
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                {form.completed_date && !catalogItem.is_mandatory && (() => {
                  const weekNum = getWeekNumber(form.completed_date);
                  const optionalInWeek = allRegistrations.filter((r) => {
                    if (r.id === reg?.id) return false;
                    const rWeek = r.status === "completed" && r.completed_week ? r.completed_week : r.planned_week;
                    if (rWeek !== weekNum) return false;
                    const cat = catalogItem; // We only know current item is optional
                    // Check other regs - we need catalog data, approximate by checking all non-current
                    return true;
                  });
                  // Count optional activities in the same week (excluding current reg)
                  const sameWeekRegs = allRegistrations.filter((r) => {
                    if (r.id === reg?.id) return false;
                    const rWeek = r.status === "completed" && r.completed_week ? r.completed_week : r.planned_week;
                    return rWeek === weekNum;
                  });
                  // We can't easily check is_mandatory of other regs here without catalog,
                  // but we know at least the count
                  if (sameWeekRegs.length >= 3) {
                    return (
                      <Alert variant="destructive" className="mt-2 py-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <AlertDescription className="text-xs">
                            Denne uken har allerede {sameWeekRegs.length} andre aktiviteter. Denne vil kanskje ikke gi poeng.
                          </AlertDescription>
                        </div>
                      </Alert>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Participants */}
            {members && (
              <div>
                <Label className="mb-2 block">Deltakere</Label>
                <div className="flex flex-wrap gap-3">
                  {members.map((member) => {
                    const isSelected = form.selectedMembers.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            const newMembers = isSelected
                              ? form.selectedMembers.filter((id) => id !== member.id)
                              : [...form.selectedMembers, member.id];
                            setForm((p) => ({ ...p, selectedMembers: newMembers }));
                            if (reg) {
                              toggleParticipant.mutate({ registrationId: reg.id, memberId: member.id, isParticipant: isSelected });
                            }
                          }}
                        />
                        {member.name.split(" ")[0]}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Process log section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Prosesslogg</p>
                {prosessloggComplete ? (
                  <Badge className="bg-primary/10 text-primary text-[10px]">✓ Komplett</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600">Mangler felt</Badge>
                )}
              </div>

              <div>
                <Label>Hvorfor dette tidspunktet?</Label>
                <Textarea
                  value={form.timing_rationale}
                  onChange={(e) => setForm((p) => ({ ...p, timing_rationale: e.target.value }))}
                  placeholder="Forklar kort hvorfor teamet valgte å gjennomføre aktiviteten akkurat nå"
                  rows={2}
                />
              </div>
              <div>
                <Label>Gjennomføring</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder={catalogItem.prosesslogg_template || "Hvordan ble aktiviteten gjennomført?"}
                  rows={3}
                />
              </div>
              <div>
                <Label>Erfaringer</Label>
                <Textarea
                  value={form.experiences}
                  onChange={(e) => setForm((p) => ({ ...p, experiences: e.target.value }))}
                  placeholder="Beskriv positive og negative erfaringer"
                  rows={2}
                />
              </div>
              <div>
                <Label>Refleksjoner</Label>
                <Textarea
                  value={form.reflections}
                  onChange={(e) => setForm((p) => ({ ...p, reflections: e.target.value }))}
                  placeholder="Er dette noe teamet kommer til å gjøre igjen?"
                  rows={2}
                />
              </div>
            </div>

            {/* Attachments — file upload + links */}
            <div className="space-y-3 border-t pt-4">
              <Label>Vedlegg (bilder og filer)</Label>
              <FileUpload
                files={form.attachment_links.filter((l) => !l.startsWith("http"))}
                onFilesChange={(storagePaths) => {
                  const links = form.attachment_links.filter((l) => l.startsWith("http"));
                  setForm((p) => ({ ...p, attachment_links: [...storagePaths, ...links] }));
                }}
                folder="activities"
              />

              <Label className="mt-2">Lenker</Label>
              {form.attachment_links.filter((l) => l.startsWith("http")).map((link, i) => (
                <div key={`link-${i}`} className="flex items-center gap-2">
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex-1 truncate">
                    {link}
                  </a>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                    const storagePaths = form.attachment_links.filter((l) => !l.startsWith("http"));
                    const links = form.attachment_links.filter((l) => l.startsWith("http")).filter((_, idx) => idx !== i);
                    setForm((p) => ({ ...p, attachment_links: [...storagePaths, ...links] }));
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1">
                <Input
                  value={form.newLink}
                  onChange={(e) => setForm((p) => ({ ...p, newLink: e.target.value }))}
                  placeholder="https://..."
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                />
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={addLink}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Lukk</Button>
              <Button onClick={handleSave} disabled={createReg.isPending || updateReg.isPending}>
                {reg ? "Oppdater" : "Opprett registrering"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Meeting data read-only section ──────────────────────────────────────────

const retroFormatLabels: Record<string, string> = {
  sailboat: "Sailboat", start_stop_continue: "Start-Stop-Continue",
  mad_sad_glad: "Mad-Sad-Glad", annet: "Annet",
};
const standupFormatLabels: Record<string, string> = {
  fysisk: "Fysisk standup", digital: "Digital", asynkron: "Asynkron i Flyt",
};

function MeetingDataSection({
  type, typeData, actionPoints, members,
}: {
  type: string;
  typeData: Record<string, any>;
  actionPoints: any[];
  members: any[];
}) {
  const f = (key: string) => typeData[key] as string | undefined;
  const memberName = (id: string) => members.find((m) => m.id === id)?.name?.split(" ")[0] ?? "?";

  const rows: { label: string; value: string }[] = [];

  if (type === "veiledermøte") {
    if (f("questions_for_advisor")) rows.push({ label: "Spørsmål til veileder", value: f("questions_for_advisor")! });
    if (f("advisor_feedback")) rows.push({ label: "Feedback fra veileder", value: f("advisor_feedback")! });
  } else if (type === "sprint_planning") {
    if (f("sprint_goal")) rows.push({ label: "Sprint goal", value: f("sprint_goal")! });
    if (f("capacity")) rows.push({ label: "Kapasitet", value: `${f("capacity")} SP` });
    if (f("planning_notes")) rows.push({ label: "Planlegging", value: f("planning_notes")! });
  } else if (type === "sprint_review") {
    if (f("what_was_demonstrated")) rows.push({ label: "Hva ble demonstrert", value: f("what_was_demonstrated")! });
    if (f("feedback")) rows.push({ label: "Feedback", value: f("feedback")! });
  } else if (type === "daily_standup") {
    if (f("format")) rows.push({ label: "Format", value: standupFormatLabels[f("format")!] ?? f("format")! });
    if (f("duration_minutes")) rows.push({ label: "Varighet", value: `${f("duration_minutes")} min` });
  } else if (type === "retrospective") {
    if (f("retro_format")) rows.push({ label: "Format", value: retroFormatLabels[f("retro_format")!] ?? f("retro_format")! });
    if (f("tools_used")) rows.push({ label: "Verktøy", value: f("tools_used")! });
    if (f("what_works")) rows.push({ label: "Hva fungerer", value: f("what_works")! });
    if (f("improvements")) rows.push({ label: "Forbedringspunkter", value: f("improvements")! });
  } else if (type === "mobb_programmering") {
    if (f("what_was_built")) rows.push({ label: "Hva ble laget", value: f("what_was_built")! });
    if (f("code_link")) rows.push({ label: "Kildekode", value: f("code_link")! });
    if (f("schedule")) rows.push({ label: "Tidsskjema", value: f("schedule")! });
    if (f("duration_minutes")) rows.push({ label: "Varighet", value: `${f("duration_minutes")} min` });
  } else if (type === "workshop") {
    if (f("workshop_type")) rows.push({ label: "Type workshop", value: f("workshop_type")! });
    if (f("source")) rows.push({ label: "Kilde", value: f("source")! });
    if (f("purpose")) rows.push({ label: "Formål", value: f("purpose")! });
    if (f("agenda")) rows.push({ label: "Agenda", value: f("agenda")! });
  }

  if (rows.length === 0 && actionPoints.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Fra møtekalenderen</p>
      </div>
      {rows.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className="text-xs whitespace-pre-wrap mt-0.5">{value}</p>
        </div>
      ))}
      {actionPoints.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Action points</p>
          <ul className="mt-0.5 space-y-0.5">
            {actionPoints.map((ap: any) => (
              <li key={ap.id} className="flex items-center gap-1.5 text-xs">
                <span>{ap.is_completed ? "✓" : "○"}</span>
                <span className={ap.is_completed ? "line-through text-muted-foreground" : ""}>{ap.title || "—"}</span>
                {ap.assignee_id && <span className="text-muted-foreground">→ {memberName(ap.assignee_id)}</span>}
                {ap.deadline && <span className="text-muted-foreground text-[10px]">({ap.deadline})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {value ? (
        <p className="text-sm whitespace-pre-wrap mt-0.5">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground/50 italic mt-0.5">Ikke utfylt</p>
      )}
    </div>
  );
}
