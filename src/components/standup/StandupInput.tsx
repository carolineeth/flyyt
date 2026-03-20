import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUpsertDailyUpdate, useInProgressBacklogItems, type DailyUpdate } from "@/hooks/useDailyUpdates";
import { X, Link2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CATEGORIES = [
  { key: "code", label: "Kode", bg: "#E6F1FB", fg: "#0C447C" },
  { key: "design", label: "Design", bg: "#FBEAF0", fg: "#72243E" },
  { key: "report", label: "Rapport", bg: "#EEEDFE", fg: "#3C3489" },
  { key: "research", label: "Research", bg: "#E1F5EE", fg: "#085041" },
  { key: "admin", label: "Admin", bg: "#F1EFE8", fg: "#444441" },
];

interface Props {
  memberId: string;
  existingEntry: DailyUpdate | null;
  date: Date;
  dayLabel: string;
}

export function StandupInput({ memberId, existingEntry, date, dayLabel }: Props) {
  const [content, setContent] = useState(existingEntry?.content ?? "");
  const [category, setCategory] = useState<string | null>(existingEntry?.category ?? null);
  const [backlogItemId, setBacklogItemId] = useState<string | null>(existingEntry?.backlog_item_id ?? null);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const upsert = useUpsertDailyUpdate();
  const { data: backlogItems } = useInProgressBacklogItems(memberId);

  useEffect(() => {
    if (existingEntry) {
      setContent(existingEntry.content ?? "");
      setCategory(existingEntry.category ?? null);
      setBacklogItemId(existingEntry.backlog_item_id ?? null);
    } else {
      setContent("");
      setCategory(null);
      setBacklogItemId(null);
    }
  }, [existingEntry]);

  const dateStr = format(date, "yyyy-MM-dd");

  const handlePublish = async () => {
    if (!content.trim()) {
      toast.error("Skriv en oppdatering før du publiserer");
      return;
    }
    try {
      await upsert.mutateAsync({
        member_id: memberId,
        entry_date: dateStr,
        content: content.trim(),
        category,
        backlog_item_id: backlogItemId,
      });
      toast.success("Oppdatering publisert!");
    } catch {
      toast.error("Kunne ikke publisere oppdatering");
    }
  };

  const selectedBacklog = backlogItems?.find((b) => b.id === backlogItemId);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground capitalize">{dayLabel}</h3>
        <p className="text-xs text-muted-foreground">
          {existingEntry
            ? `Oppdatering sendt kl. ${format(new Date(existingEntry.updated_at), "HH:mm")}`
            : "Skriv din oppdatering"}
        </p>
      </div>

      <Textarea
        placeholder="Hva har du gjort/jobbet med?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[80px] resize-none text-sm"
      />

      {selectedBacklog && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md flex items-center gap-1">
            {selectedBacklog.item_id}: {selectedBacklog.title}
            <button onClick={() => setBacklogItemId(null)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(category === cat.key ? null : cat.key)}
              className="px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-opacity"
              style={{
                backgroundColor: cat.bg,
                color: cat.fg,
                opacity: category === cat.key ? 1 : 0.5,
              }}
            >
              {cat.label}
            </button>
          ))}
          <Popover open={backlogOpen} onOpenChange={setBacklogOpen}>
            <PopoverTrigger asChild>
              <button className="text-xs text-primary hover:underline flex items-center gap-1 ml-2">
                <Link2 className="h-3 w-3" />
                Koble til oppgave
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {backlogItems && backlogItems.length > 0 ? (
                  backlogItems.map((item) => (
                    <button
                      key={item.id}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent truncate"
                      onClick={() => {
                        setBacklogItemId(item.id);
                        setBacklogOpen(false);
                      }}
                    >
                      <span className="text-muted-foreground">{item.item_id}</span>{" "}
                      {item.title}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground p-2">Ingen oppgaver pågår</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Button
          size="sm"
          className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handlePublish}
          disabled={upsert.isPending}
        >
          {existingEntry ? "Oppdater" : "Publiser"}
        </Button>
      </div>
    </div>
  );
}

export { CATEGORIES };
