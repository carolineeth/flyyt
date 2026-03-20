import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Link2, FileText, Plus, Trash2 } from "lucide-react";

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
  const [form, setForm] = useState({
    status: "not_started",
    completed_date: "",
    timing_rationale: "",
    description: "",
    experiences: "",
    reflections: "",
    attachment_links: [] as string[],
    newLink: "",
  });

  useEffect(() => {
    if (registration) {
      setReg(registration);
      setForm({
        status: registration.status,
        completed_date: registration.completed_date || "",
        timing_rationale: registration.timing_rationale || "",
        description: registration.description || "",
        experiences: registration.experiences || "",
        reflections: registration.reflections || "",
        attachment_links: registration.attachment_links || [],
        newLink: "",
      });
    } else {
      setReg(null);
      setForm({
        status: "not_started",
        completed_date: "",
        timing_rationale: "",
        description: "",
        experiences: "",
        reflections: "",
        attachment_links: [],
        newLink: "",
      });
    }
  }, [registration, open]);

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

        <div className="space-y-4">
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
            </div>
          </div>

          {/* Participants */}
          {reg && members && (
            <div>
              <Label className="mb-2 block">Deltakere</Label>
              <div className="flex flex-wrap gap-3">
                {members.map((member) => {
                  const isP = regParticipants.some((p) => p.member_id === member.id);
                  return (
                    <label key={member.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={isP}
                        onCheckedChange={() => toggleParticipant.mutate({ registrationId: reg.id, memberId: member.id, isParticipant: isP })}
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

          {/* Attachments */}
          <div className="space-y-2 border-t pt-4">
            <Label>Vedlegg (lenker)</Label>
            {form.attachment_links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex-1 truncate">
                  {link}
                </a>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeLink(i)}>
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Lukk</Button>
          <Button onClick={handleSave} disabled={createReg.isPending || updateReg.isPending}>
            {reg ? "Oppdater" : "Opprett registrering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
