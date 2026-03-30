import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, Circle, Trash2, Link2 } from "lucide-react";
import type { CatalogItem, Registration } from "@/hooks/useActivityCatalog";
import { useDeleteRegistration } from "@/hooks/useActivityCatalog";
import { RegistrationModal } from "./RegistrationModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface CatalogViewProps {
  catalog: CatalogItem[];
  registrations: Registration[];
}

export function CatalogView({ catalog, registrations }: CatalogViewProps) {
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const deleteRegistration = useDeleteRegistration();

  const getRegistrationsFor = (catId: string) => registrations.filter((r) => r.catalog_id === catId);
  const isCompleted = (catId: string) => getRegistrationsFor(catId).some((r) => r.status === "completed");
  const isInProgress = (catId: string) => getRegistrationsFor(catId).some((r) => r.status === "in_progress");

  const meetingBased = catalog.filter((c) => c.category === "meeting_based");
  const custom = catalog.filter((c) => c.name === "Egendefinert aktivitet");
  const meetingAndCustomIds = new Set([...meetingBased.map(c => c.id), ...custom.map(c => c.id)]);
  const allMandatory = catalog.filter((c) => c.is_mandatory && !meetingAndCustomIds.has(c.id));
  const allOptional = catalog.filter((c) => !c.is_mandatory && !meetingAndCustomIds.has(c.id));

  const agileMeetings = meetingBased.filter((c) => ["daily_standup", "sprint_planning", "sprint_review"].includes(c.meeting_type || ""));
  const advisorMeeting = meetingBased.find((c) => c.meeting_type === "veiledermøte");


  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null | undefined>(undefined);

  const openModal = (item: CatalogItem) => {
    setSelectedCatalog(item);
    setSelectedRegistration(undefined);
    setModalOpen(true);
  };

  const openModalNew = (item: CatalogItem) => {
    setSelectedCatalog(item);
    setSelectedRegistration(null);
    setModalOpen(true);
  };

  const openModalWithRegistration = (item: CatalogItem, reg: Registration) => {
    setSelectedCatalog(item);
    setSelectedRegistration(reg);
    setModalOpen(true);
  };

  const StatusIcon = ({ catId }: { catId: string }) => {
    if (isCompleted(catId)) return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
    if (isInProgress(catId)) return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  };

  const getExistingRegistration = (catId: string) => {
    const regs = getRegistrationsFor(catId);
    return regs.length > 0 ? regs[0] : null;
  };

  return (
    <div className="space-y-6">
      {/* Obligatoriske + Valgfrie in one card */}
      <div className="card-elevated p-6 space-y-0">
      <Section title="Obligatoriske aktiviteter" variant="mandatory">
        {allMandatory
          .sort((a, b) => (isCompleted(a.id) ? 1 : 0) - (isCompleted(b.id) ? 1 : 0))
          .map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{item.points}p</Badge>
              <Badge variant="destructive" className="text-[10px]">Obligatorisk</Badge>
            </CatalogRow>
          ))}
      </Section>

      {allOptional.length > 0 && (
        <><div className="border-t border-neutral-200 mt-6 pt-6" />
        <Section title="Valgfrie aktiviteter">
          {allOptional.map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{item.points}p</Badge>
            </CatalogRow>
          ))}
        </Section>
        </>
      )}
      </div>

      {/* Meetings: Veileder */}
      <div className="card-elevated p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Møter med veileder</h3>
          <p className="text-sm text-muted-foreground">Kobles automatisk fra møtekalenderen</p>
        </div>
        <div className="space-y-2">
          {advisorMeeting && (() => {
            const advisorRegs = [...getRegistrationsFor(advisorMeeting.id)].sort((a, b) =>
              (a.completed_date ?? a.created_at ?? "").localeCompare(b.completed_date ?? b.created_at ?? "")
            );
            const completedCount = advisorRegs.filter((r) => r.status === "completed").length;
            return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{advisorMeeting.name}</span>
                    <Badge variant="secondary" className="text-[10px]">1p per uke, maks 4p</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openModalNew(advisorMeeting)}>
                    + Registrer ny
                  </Button>
                </div>
                {advisorRegs.map((reg, i) => (
                  <div
                    key={reg.id}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => openModalWithRegistration(advisorMeeting, reg)}
                  >
                    <StatusIcon catId={advisorMeeting.id} />
                    <span className="flex-1">Møte #{i + 1}{reg.completed_date ? ` — ${reg.completed_date}` : ""}</span>
                    {i >= 4 && <Badge variant="outline" className="text-[9px] text-muted-foreground">0p</Badge>}
                    {reg.linked_meeting_id && (
                      <a
                        href="/moter"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary shrink-0"
                        title="Koblet til møtekalenderen"
                      >
                        <Link2 className="h-2.5 w-2.5" />
                        Møte
                      </a>
                    )}
                    <Badge variant={reg.status === "completed" ? "default" : "outline"} className="text-[10px]">
                      {reg.status === "completed" ? "Fullført" : reg.status === "in_progress" ? "Pågår" : "Ikke startet"}
                    </Badge>
                    <button
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(reg); }}
                      aria-label="Slett registrering"
                      title="Slett registrering"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 ${
                        i < completedCount ? "bg-green-500 border-green-500" : "border-neutral-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedCount} av 4 gir poeng · {advisorRegs.length} totalt registrert
                </p>
            </div>
            );
          })()}
        </div>
      </div>

      {/* Meetings: Smidige */}
      <div className="card-elevated p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Smidige møter</h3>
          <p className="text-sm text-muted-foreground">1p per type per uke · Maks 3p totalt · Ulike typer ikke i samme uke</p>
        </div>
        {/* 3-column grid for agile meetings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {agileMeetings.map((item) => {
            const regs = [...getRegistrationsFor(item.id)].sort((a, b) =>
              (a.completed_date ?? a.created_at ?? "").localeCompare(b.completed_date ?? b.created_at ?? "")
            );
            return (
              <div key={item.id} className="bg-neutral-50 rounded-xl p-4 space-y-2">
                <div className="text-center">
                  <p className="text-sm font-semibold">{item.name.replace("Smidige møter: ", "")}</p>
                  <Badge variant="secondary" className="text-xs">{item.points}p (1 gir poeng)</Badge>
                </div>
                {regs.map((reg, i) => (
                  <div
                    key={reg.id}
                    className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer transition-colors"
                    onClick={() => openModalWithRegistration(item, reg)}
                  >
                    <StatusIcon catId={item.id} />
                    <span className="flex-1">#{i + 1}{reg.completed_date ? ` — ${reg.completed_date}` : ""}</span>
                    {i >= 1 && reg.status === "completed" && <Badge variant="outline" className="text-[9px] text-muted-foreground">0p</Badge>}
                    {reg.linked_meeting_id && (
                      <a href="/moter" onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary shrink-0">
                        <Link2 className="h-2.5 w-2.5" /> Møte
                      </a>
                    )}
                    <Badge variant={reg.status === "completed" ? "default" : "outline"} className="text-xs py-0.5 px-2">
                      {reg.status === "completed" ? "Fullført" : reg.status === "in_progress" ? "Pågår" : "Planlagt"}
                    </Badge>
                    <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); setDeleteTarget(reg); }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {regs.length === 0 && <div className="flex justify-center"><StatusIcon catId={item.id} /></div>}
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => openModalNew(item)}>+ Registrer ny</Button>
              </div>
            );
          })}
        </div>

        {/* Custom activity — full-width row */}
        {custom.map((item) => {
          const regs = getRegistrationsFor(item.id);
          return (
            <div key={item.id} className="bg-neutral-50 rounded-xl p-4 mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">Egendefinert aktivitet</p>
                    <Badge variant="secondary" className="text-xs">{item.points}p</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">Gjennomfør en smidig aktivitet som ikke er nevnt i kursdokumentet</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {regs.map((reg, i) => (
                  <div key={reg.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-accent/30 cursor-pointer" onClick={() => openModalWithRegistration(item, reg)}>
                    <StatusIcon catId={item.id} />
                    <span>#{i + 1}</span>
                    <Badge variant={reg.status === "completed" ? "default" : "outline"} className="text-xs py-0.5 px-2">
                      {reg.status === "completed" ? "Fullført" : "Planlagt"}
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openModal(item)}>
                  {regs.length > 0 ? "Se detaljer" : "+ Registrer"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Second-half sections removed — activities merged into unified sections above */}

      {/* Registration modal */}
      {selectedCatalog && (
        <RegistrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          catalogItem={selectedCatalog}
          registration={selectedRegistration === undefined ? getExistingRegistration(selectedCatalog.id) : selectedRegistration}
          allRegistrations={registrations}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett registrering?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.completed_date
                ? `Registrering fra ${deleteTarget.completed_date} vil bli permanent slettet.`
                : "Denne registreringen vil bli permanent slettet."}
              {" "}Dette kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                deleteRegistration.mutate(deleteTarget.id, {
                  onSuccess: () => toast.success("Registrering slettet"),
                  onError: () => toast.error("Kunne ikke slette registreringen"),
                });
                setDeleteTarget(null);
              }}
            >
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- Sub-components ---

function Section({ title, subtitle, variant, children }: { title: string; subtitle?: string; variant?: "mandatory" | "dimmed"; children: React.ReactNode }) {
  return (
    <div className={variant === "dimmed" ? "opacity-60 mt-6" : ""}>
      <div className="mb-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>}
      </div>
      <div className="space-y-0">
        {children}
      </div>
    </div>
  );
}

function CatalogRow({ item: _item, onClick, children }: { item: CatalogItem; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-3 py-4 border-b border-neutral-100 last:border-b-0 hover:bg-accent/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {children}
    </div>
  );
}
