import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveToSupabase } from "@/lib/saveToSupabase";
import { Copy } from "lucide-react";
import type { Sprint } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sprint: Sprint | null;
  snapshot: any | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });
}

export function SprintSlideOver({ open, onOpenChange, sprint, snapshot }: Props) {
  const qc = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [reflection, setReflection] = useState("");
  const reviewDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reflectionDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (sprint) {
      setReviewNotes(sprint.sprint_review_notes ?? "");
      setReflection(sprint.reflection ?? "");
    }
  }, [sprint]);

  const autoSave = (field: string, value: string, debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>) => {
    if (!sprint) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveToSupabase(
        () => supabase.from("sprints").update({ [field]: value }).eq("id", sprint.id) as any,
        { silent: true, errorMessage: "Kunne ikke lagre sprint-notater. Prøv igjen." }
      ).then((result) => {
        if (result.ok) qc.invalidateQueries({ queryKey: ["completed_sprints"] });
      });
    }, 800);
  };

  const exportText = () => {
    if (!sprint) return;
    const completionRate = snapshot ? `${Math.round((snapshot.completed_points / (snapshot.total_points || 1)) * 100)}%` : "?";
    const text = [
      sprint.name,
      `Periode: ${formatDate(sprint.start_date)} – ${formatDate(sprint.end_date)}`,
      sprint.goal ? `Mål: ${sprint.goal}` : "",
      snapshot ? `Fullført: ${snapshot.completed_points}/${snapshot.total_points} SP (${completionRate})` : "",
      "",
      "Review-notater:",
      reviewNotes || "(Ikke utfylt)",
      "",
      "Refleksjon:",
      reflection || "(Ikke utfylt)",
      "",
      snapshot?.completed_item_titles?.length ? `Fullførte items:\n${snapshot.completed_item_titles.map((t: string) => `- ${t}`).join("\n")}` : "",
      snapshot?.incomplete_item_titles?.length ? `\nUfullførte items:\n${snapshot.incomplete_item_titles.map((t: string) => `- ${t}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Kopiert til utklippstavlen");
  };

  if (!sprint) return null;

  const completionRate = snapshot ? Math.round((snapshot.completed_points / (snapshot.total_points || 1)) * 100) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:max-w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-base">{sprint.name}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(sprint.start_date)} – {formatDate(sprint.end_date)}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {sprint.goal && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sprint-mål</label>
              <p className="text-sm mt-1">{sprint.goal}</p>
            </div>
          )}

          {snapshot && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {snapshot.completed_points}/{snapshot.total_points} SP
              </Badge>
              {completionRate !== null && (
                <span className="text-xs text-muted-foreground">{completionRate}% fullført</span>
              )}
            </div>
          )}

          {snapshot?.completed_item_titles?.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fullførte items</label>
              <ul className="mt-1 space-y-0.5">
                {snapshot.completed_item_titles.map((t: string, i: number) => (
                  <li key={i} className="text-xs text-foreground">• {t}</li>
                ))}
              </ul>
            </div>
          )}

          {snapshot?.incomplete_item_titles?.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ufullførte items</label>
              <ul className="mt-1 space-y-0.5">
                {snapshot.incomplete_item_titles.map((t: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground">• {t}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Review-notater</label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => { setReviewNotes(e.target.value); autoSave("sprint_review_notes", e.target.value, reviewDebounceRef); }}
              placeholder="Notater fra sprint review..."
              className="mt-1 min-h-[100px] text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Refleksjon</label>
            <Textarea
              value={reflection}
              onChange={(e) => { setReflection(e.target.value); autoSave("reflection", e.target.value, reflectionDebounceRef); }}
              placeholder="Reflekter over sprinten..."
              className="mt-1 min-h-[100px] text-sm"
            />
          </div>
        </div>

        <SheetFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={exportText} className="w-full">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Eksporter denne sprinten
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
