import { useState, useRef, useEffect, useMemo } from "react";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useActivityRegistrations, useActivityCatalog } from "@/hooks/useActivityCatalog";
import {
  useProsessloggNotes,
  useCreateProsessloggNote,
  useUpdateProsessloggNote,
  useDeleteProsessloggNote,
  type ProsessloggNote,
} from "@/hooks/useProsesslogg";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, ChevronDown, Link2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

const CATEGORIES = [
  { key: "aktivitet", label: "Aktivitet", bg: "bg-orange-100 dark:bg-orange-950/40", fg: "text-orange-700 dark:text-orange-300" },
  { key: "sprint", label: "Sprint", bg: "bg-teal-100 dark:bg-teal-950/40", fg: "text-teal-700 dark:text-teal-300" },
  { key: "møte", label: "Møte", bg: "bg-blue-100 dark:bg-blue-950/40", fg: "text-blue-700 dark:text-blue-300" },
  { key: "refleksjon", label: "Refleksjon", bg: "bg-purple-100 dark:bg-purple-950/40", fg: "text-purple-700 dark:text-purple-300" },
  { key: "annet", label: "Annet", bg: "bg-muted", fg: "text-muted-foreground" },
];

function getCategoryStyle(cat: string) {
  return CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[4];
}

export function HuskelisteTab() {
  const { data: notes } = useProsessloggNotes();
  const createNote = useCreateProsessloggNote();
  const updateNote = useUpdateProsessloggNote();
  const deleteNote = useDeleteProsessloggNote();
  const { currentMember } = useCurrentTeamMember();
  const { data: members } = useTeamMembers();
  const { data: registrations } = useActivityRegistrations();
  const { data: catalog } = useActivityCatalog();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState("annet");
  const [linkedRegId, setLinkedRegId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + "px";
    }
  }, [content]);

  const catalogMap = useMemo(() => {
    const map: Record<string, any> = {};
    (catalog ?? []).forEach((c) => { map[c.id] = c; });
    return map;
  }, [catalog]);

  const activeNotes = useMemo(() => (notes ?? []).filter((n) => !n.is_resolved), [notes]);
  const resolvedNotes = useMemo(() => (notes ?? []).filter((n) => n.is_resolved), [notes]);

  const handleAdd = () => {
    if (!content.trim()) return;
    createNote.mutate({
      content: content.trim(),
      added_by: currentMember?.id ?? null,
      category,
      linked_registration_id: category === "aktivitet" ? linkedRegId : null,
    }, {
      onSuccess: () => {
        setContent("");
        setCategory("annet");
        setLinkedRegId(null);
        toast.success("Notat lagt til");
      },
    });
  };

  const toggleResolved = (note: ProsessloggNote) => {
    updateNote.mutate({
      id: note.id,
      is_resolved: !note.is_resolved,
      resolved_at: !note.is_resolved ? new Date().toISOString() : null,
    });
  };

  const completedRegs = useMemo(() => {
    return (registrations ?? []).filter((r) => r.status === "completed");
  }, [registrations]);

  const getMemberById = (id: string | null) => (members ?? []).find((m) => m.id === id);

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
          placeholder="Skriv noe vi må huske til prosessloggen..."
          className="min-h-[40px] max-h-[96px] resize-none text-sm"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${c.bg} ${c.fg} ${category === c.key ? "ring-2 ring-primary/30 ring-offset-1" : "opacity-60 hover:opacity-100"}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {category === "aktivitet" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  {linkedRegId ? "Koblet" : "Koble til aktivitet"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2 max-h-[200px] overflow-y-auto" align="start">
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs mb-1" onClick={() => setLinkedRegId(null)}>
                  Ingen kobling
                </Button>
                {completedRegs.map((r) => {
                  const cat = catalogMap[r.catalog_id];
                  return (
                    <button
                      key={r.id}
                      onClick={() => setLinkedRegId(r.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted ${linkedRegId === r.id ? "bg-muted" : ""}`}
                    >
                      {cat?.name ?? "?"} #{r.occurrence_number}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}

          <div className="flex-1" />
          <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!content.trim()}>
            <Plus className="h-3 w-3 mr-1" /> Legg til
          </Button>
        </div>
      </div>

      {/* Active notes */}
      <div className="space-y-0">
        {activeNotes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Ingen notater ennå. Legg til det dere må huske til prosessloggen!</p>
        )}
        {activeNotes.map((note) => {
          const member = getMemberById(note.added_by);
          const catStyle = getCategoryStyle(note.category);
          return (
            <div key={note.id} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
              <Checkbox
                checked={false}
                onCheckedChange={() => toggleResolved(note)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px]">{note.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${catStyle.bg} ${catStyle.fg}`}>
                    {catStyle.label}
                  </span>
                  {note.linked_registration_id && (
                    <span className="text-[10px] text-primary">
                      Koblet til aktivitet
                    </span>
                  )}
                  {member && (
                    <div className="flex items-center gap-1">
                      <div className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] text-white font-medium" style={{ backgroundColor: member.avatar_color }}>
                        {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{member.name}</span>
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: nb })}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => deleteNote.mutate(note.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Resolved notes */}
      {resolvedNotes.length > 0 && (
        <Collapsible open={showResolved} onOpenChange={setShowResolved}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3 w-3 transition-transform ${showResolved ? "" : "-rotate-90"}`} />
            Håndtert ({resolvedNotes.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-0">
            {resolvedNotes.map((note) => {
              const member = getMemberById(note.added_by);
              const catStyle = getCategoryStyle(note.category);
              return (
                <div key={note.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0 opacity-40">
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => toggleResolved(note)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] line-through">{note.content}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${catStyle.bg} ${catStyle.fg}`}>
                        {catStyle.label}
                      </span>
                      {member && <span className="text-[11px] text-muted-foreground">{member.name}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
