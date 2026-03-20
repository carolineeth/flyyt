import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useRegistrationParticipants, type CatalogItem, type Registration } from "@/hooks/useActivityCatalog";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { RegistrationModal } from "./RegistrationModal";
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";

interface RegistrationsViewProps {
  catalog: CatalogItem[];
  registrations: Registration[];
}

export function RegistrationsView({ catalog, registrations }: RegistrationsViewProps) {
  const { data: members } = useTeamMembers();
  const { data: participants } = useRegistrationParticipants();

  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const activeRegs = useMemo(() =>
    registrations.filter((r) => r.status === "completed" || r.status === "in_progress")
      .sort((a, b) => {
        if (a.completed_date && b.completed_date) return b.completed_date.localeCompare(a.completed_date);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [registrations]
  );

  const openReg = (reg: Registration) => {
    const cat = catalog.find((c) => c.id === reg.catalog_id);
    if (!cat) return;
    setSelectedCatalog(cat);
    setSelectedReg(reg);
    setModalOpen(true);
  };

  if (activeRegs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Ingen gjennomføringer ennå. Gå til Katalog-fanen for å registrere aktiviteter.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activeRegs.map((reg) => {
        const cat = catalog.find((c) => c.id === reg.catalog_id);
        if (!cat) return null;
        const regPs = participants?.filter((p) => p.registration_id === reg.id) || [];
        const regMembers = members?.filter((m) => regPs.some((p) => p.member_id === m.id)) || [];
        const prosessloggComplete = !!(reg.timing_rationale && reg.description && reg.experiences && reg.reflections);

        return (
          <Card
            key={reg.id}
            className="overflow-hidden cursor-pointer hover:bg-accent/30 transition-colors"
            onClick={() => openReg(reg)}
          >
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                {reg.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{cat.name}</span>
                    {reg.occurrence_number > 1 && (
                      <Badge variant="outline" className="text-[10px]">#{reg.occurrence_number}</Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] tabular-nums">{cat.points}p</Badge>
                    {reg.completed_week && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Uke {reg.completed_week}
                        {reg.completed_date && ` — ${new Date(reg.completed_date + "T00:00:00").toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {regMembers.length > 0 && (
                      <div className="flex -space-x-1">
                        {regMembers.slice(0, 4).map((m) => (
                          <MemberAvatar key={m.id} member={m} />
                        ))}
                        {regMembers.length > 4 && <span className="text-[10px] text-muted-foreground ml-1">+{regMembers.length - 4}</span>}
                      </div>
                    )}
                    {reg.linked_meeting_id && (
                      <Badge variant="outline" className="text-[10px] gap-0.5">
                        📅 Koblet til møte
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Process log completeness indicator */}
                <div className="shrink-0">
                  {prosessloggComplete ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" title="Prosesslogg komplett" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Prosesslogg mangler felt" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {selectedCatalog && (
        <RegistrationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          catalogItem={selectedCatalog}
          registration={selectedReg}
          allRegistrations={registrations}
        />
      )}
    </div>
  );
}
