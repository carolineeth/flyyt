import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUpdateRegistration, type Registration, type CatalogItem } from "@/hooks/useActivityCatalog";
import { toast } from "sonner";
import { Copy, Plus, X } from "lucide-react";
import type { ProsessloggNote } from "@/hooks/useProsesslogg";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registration: Registration | null;
  catalogItem: CatalogItem | null;
  linkedNotes?: ProsessloggNote[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

export function ActivitySlideOver({ open, onOpenChange, registration, catalogItem, linkedNotes }: Props) {
  const update = useUpdateRegistration();
  const [timing, setTiming] = useState("");
  const [desc, setDesc] = useState("");
  const [exp, setExp] = useState("");
  const [refl, setRefl] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (registration) {
      setTiming(registration.timing_rationale ?? "");
      setDesc(registration.description ?? "");
      setExp(registration.experiences ?? "");
      setRefl(registration.reflections ?? "");
      setLinks(registration.attachment_links ?? []);
    }
  }, [registration]);

  const autoSave = (field: string, value: string) => {
    if (!registration) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update.mutate({ id: registration.id, [field]: value } as any, {
        onSuccess: () => toast.success("Lagret", { duration: 1500 }),
      });
    }, 800);
  };

  const exportText = () => {
    if (!registration || !catalogItem) return;
    const text = [
      `${catalogItem.name} (#${registration.occurrence_number})`,
      `Uke: ${registration.completed_week ?? registration.planned_week ?? "?"}`,
      registration.completed_date ? `Dato: ${formatDate(registration.completed_date)}` : "",
      `Poeng: ${catalogItem.points}`,
      "",
      "Hvorfor dette tidspunktet:",
      timing || "(Ikke utfylt)",
      "",
      "Gjennomføring:",
      desc || "(Ikke utfylt)",
      "",
      "Erfaringer:",
      exp || "(Ikke utfylt)",
      "",
      "Refleksjoner:",
      refl || "(Ikke utfylt)",
      "",
      links.length ? `Vedlegg: ${links.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Kopiert til utklippstavlen");
  };

  const addLink = () => {
    if (!newLink.trim() || !registration) return;
    const updated = [...links, newLink.trim()];
    setLinks(updated);
    setNewLink("");
    update.mutate({ id: registration.id, attachment_links: updated } as any);
  };

  const removeLink = (idx: number) => {
    if (!registration) return;
    const updated = links.filter((_, i) => i !== idx);
    setLinks(updated);
    update.mutate({ id: registration.id, attachment_links: updated } as any);
  };

  if (!registration || !catalogItem) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:max-w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">{catalogItem.name} #{registration.occurrence_number}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Uke {registration.completed_week ?? registration.planned_week ?? "?"}</span>
            {registration.completed_date && <span>· {formatDate(registration.completed_date)}</span>}
            <Badge variant="secondary" className="text-[10px]">{catalogItem.points}p</Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hvorfor dette tidspunktet?</label>
            <Textarea
              value={timing}
              onChange={(e) => { setTiming(e.target.value); autoSave("timing_rationale", e.target.value); }}
              placeholder="Beskriv hvorfor aktiviteten ble gjennomført på dette tidspunktet..."
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gjennomføring</label>
            <Textarea
              value={desc}
              onChange={(e) => { setDesc(e.target.value); autoSave("description", e.target.value); }}
              placeholder={catalogItem.prosesslogg_template || "Beskriv gjennomføringen..."}
              className="mt-1 min-h-[100px] text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Erfaringer</label>
            <Textarea
              value={exp}
              onChange={(e) => { setExp(e.target.value); autoSave("experiences", e.target.value); }}
              placeholder="Hva lærte dere? Hva fungerte bra eller dårlig?"
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Refleksjoner</label>
            <Textarea
              value={refl}
              onChange={(e) => { setRefl(e.target.value); autoSave("reflections", e.target.value); }}
              placeholder="Reflekter over erfaringene og hva dere ville gjort annerledes..."
              className="mt-1 min-h-[80px] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vedlegg-lenker</label>
            <div className="mt-1 space-y-1">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <a href={link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1">{link}</a>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeLink(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-1">
                <Input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="https://..."
                  className="h-7 text-xs"
                />
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={addLink}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {linkedNotes && linkedNotes.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Huskeliste-notater</label>
              <div className="mt-1 space-y-1">
                {linkedNotes.map((note) => (
                  <div key={note.id} className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                    {note.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={exportText} className="w-full">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Eksporter denne aktiviteten
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
