import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, Circle, AlertTriangle } from "lucide-react";
import type { CatalogItem, Registration } from "@/hooks/useActivityCatalog";
import { RegistrationModal } from "./RegistrationModal";

interface CatalogViewProps {
  catalog: CatalogItem[];
  registrations: Registration[];
}

export function CatalogView({ catalog, registrations }: CatalogViewProps) {
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const getRegistrationsFor = (catId: string) => registrations.filter((r) => r.catalog_id === catId);
  const isCompleted = (catId: string) => getRegistrationsFor(catId).some((r) => r.status === "completed");
  const isInProgress = (catId: string) => getRegistrationsFor(catId).some((r) => r.status === "in_progress");

  const mandatoryFirstHalf = catalog.filter((c) => c.is_mandatory && c.period === "first_half");
  const optionalFirstHalf = catalog.filter((c) => !c.is_mandatory && c.period === "first_half");
  const meetingBased = catalog.filter((c) => c.category === "meeting_based");
  const secondHalf = catalog.filter((c) => c.period === "second_half");
  const custom = catalog.filter((c) => c.name === "Egendefinert aktivitet");

  // Agile meetings (standup, planning, review)
  const agileMeetings = meetingBased.filter((c) => ["daily_standup", "sprint_planning", "sprint_review"].includes(c.meeting_type || ""));
  const advisorMeeting = meetingBased.find((c) => c.meeting_type === "veiledermøte");

  // Check for same-week agile meetings warning (different types in same week)
  const agileWeekWarning = useMemo(() => {
    const agileRegs = agileMeetings.flatMap((c) => getRegistrationsFor(c.id).filter((r) => r.status === "completed" && r.completed_week));
    const weekMap = new Map<number, Set<string>>();
    agileRegs.forEach((r) => {
      const cat = catalog.find((c) => c.id === r.catalog_id);
      const w = r.completed_week!;
      if (!weekMap.has(w)) weekMap.set(w, new Set());
      weekMap.get(w)!.add(cat?.meeting_type || "");
    });
    const conflicts: string[] = [];
    weekMap.forEach((types, w) => {
      if (types.size > 1) conflicts.push(`Uke ${w}: ${[...types].map(t => {
        if (t === "daily_standup") return "Daily Standup";
        if (t === "sprint_planning") return "Sprint Planning";
        if (t === "sprint_review") return "Sprint Review";
        return t;
      }).join(" + ")}`);
    });
    return conflicts;
  }, [agileMeetings, registrations, catalog]);

  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null | undefined>(undefined);

  const openModal = (item: CatalogItem) => {
    setSelectedCatalog(item);
    setSelectedRegistration(undefined); // will use getExistingRegistration
    setModalOpen(true);
  };

  const openModalNew = (item: CatalogItem) => {
    setSelectedCatalog(item);
    setSelectedRegistration(null); // force new registration
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
      {/* Mandatory first half */}
      <Section title="Obligatoriske — første halvdel" subtitle="Frist 5. april" variant="mandatory">
        {mandatoryFirstHalf
          .sort((a, b) => (isCompleted(a.id) ? 1 : 0) - (isCompleted(b.id) ? 1 : 0))
          .map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{item.points}p</Badge>
              <Badge variant="destructive" className="text-[10px]">Obligatorisk</Badge>
              <Badge variant="outline" className="text-[10px]">5. apr</Badge>
            </CatalogRow>
          ))}
      </Section>

      {/* Optional first half */}
      {optionalFirstHalf.length > 0 && (
        <Section title="Valgfrie — første halvdel">
          {optionalFirstHalf.map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{item.points}p</Badge>
              {item.period_deadline && <Badge variant="outline" className="text-[10px]">5. apr</Badge>}
            </CatalogRow>
          ))}
        </Section>
      )}

      {/* Meeting-based activities */}
      <Section title="Møtebaserte aktiviteter" subtitle="Kobles automatisk fra møtekalenderen">
        {/* Advisor meetings */}
        {advisorMeeting && (
          <Card className="overflow-hidden">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{advisorMeeting.name}</span>
                  <Badge variant="secondary" className="text-[10px]">1p per uke, maks 4</Badge>
                </div>
                {getRegistrationsFor(advisorMeeting.id).length < 4 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openModalNew(advisorMeeting)}>
                    + Registrer ny
                  </Button>
                )}
              </div>
              {/* Existing registrations */}
              {getRegistrationsFor(advisorMeeting.id).map((reg, i) => (
                <div
                  key={reg.id}
                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => openModalWithRegistration(advisorMeeting, reg)}
                >
                  <StatusIcon catId={advisorMeeting.id} />
                  <span className="flex-1">Møte #{i + 1}{reg.completed_date ? ` — ${reg.completed_date}` : ""}</span>
                  <Badge variant={reg.status === "completed" ? "default" : "outline"} className="text-[10px]">
                    {reg.status === "completed" ? "Fullført" : reg.status === "in_progress" ? "Pågår" : "Ikke startet"}
                  </Badge>
                </div>
              ))}
              <div className="flex gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => {
                  const completed = getRegistrationsFor(advisorMeeting.id).filter((r) => r.status === "completed").length;
                  return (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-full border-2 ${
                        i < completed ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {getRegistrationsFor(advisorMeeting.id).filter((r) => r.status === "completed").length} av 4 gjennomført
              </p>
            </CardContent>
          </Card>
        )}

        {/* Agile meetings */}
        {agileWeekWarning.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Smidige møter kan ikke gjennomføres i samme uke: {agileWeekWarning.join(", ")}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">1p per type per uke · Maks 3p totalt · Ulike typer ikke i samme uke</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {agileMeetings.map((item) => {
            const regs = getRegistrationsFor(item.id);
            const completedCount = regs.filter((r) => r.status === "completed").length;
            const totalAgileCompleted = agileMeetings.reduce((sum, m) =>
              sum + getRegistrationsFor(m.id).filter((r) => r.status === "completed").length, 0
            );
            const canAddMore = totalAgileCompleted < 3;
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="py-3 space-y-2">
                  <div className="text-center">
                    <p className="text-sm font-medium">{item.name.replace("Smidige møter: ", "")}</p>
                    <Badge variant="secondary" className="text-[10px]">{item.points}p</Badge>
                  </div>
                  {regs.map((reg, i) => (
                    <div
                      key={reg.id}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => openModalWithRegistration(item, reg)}
                    >
                      <StatusIcon catId={item.id} />
                      <span className="flex-1">#{i + 1}{reg.completed_date ? ` — ${reg.completed_date}` : ""}</span>
                      <Badge variant={reg.status === "completed" ? "default" : "outline"} className="text-[10px]">
                        {reg.status === "completed" ? "Fullført" : reg.status === "in_progress" ? "Pågår" : "Planlagt"}
                      </Badge>
                    </div>
                  ))}
                  {regs.length === 0 && (
                    <div className="flex justify-center">
                      <StatusIcon catId={item.id} />
                    </div>
                  )}
                  {canAddMore && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => openModalNew(item)}>
                      + Registrer ny
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Second half */}
      <Section title="Andre halvdel" subtitle="Tilgjengelig etter 5. april" variant="dimmed">
        {secondHalf.length > 0 ? (
          secondHalf.map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px] tabular-nums">{item.points}p</Badge>
            </CatalogRow>
          ))
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nye aktiviteter publiseres etter 5. april. Du kan legge dem til her når de er klare.
          </div>
        )}
      </Section>

      {/* Custom */}
      {custom.length > 0 && (
        <Section title="Egendefinert aktivitet">
          {custom.map((item) => (
            <CatalogRow key={item.id} item={item} onClick={() => openModal(item)}>
              <StatusIcon catId={item.id} />
              <span className="text-sm flex-1">{item.name}</span>
              <Badge variant="secondary" className="text-[10px]">{item.points}p</Badge>
            </CatalogRow>
          ))}
        </Section>
      )}

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
    </div>
  );
}

// --- Sub-components ---

function Section({ title, subtitle, variant, children }: { title: string; subtitle?: string; variant?: "mandatory" | "dimmed"; children: React.ReactNode }) {
  return (
    <div className={variant === "dimmed" ? "opacity-60" : ""}>
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={`space-y-1 ${variant === "mandatory" ? "border-l-2 border-destructive/40 pl-3" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function CatalogRow({ item, onClick, children }: { item: CatalogItem; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {children}
    </div>
  );
}
