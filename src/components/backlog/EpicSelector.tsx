import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, ChevronDown, X } from "lucide-react";

const EPIC_COLORS = ["#0F6E56", "#2563EB", "#7C3AED", "#DC2626", "#EA580C", "#CA8A04", "#0891B2", "#BE185D"];

interface Epic {
  id: string;
  name: string;
  color: string;
  is_archived: boolean;
}

export function useEpics() {
  return useQuery<Epic[]>({
    queryKey: ["epics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("epics").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

interface Props {
  value: string | null;
  onChange: (epicId: string | null) => void;
}

export function EpicSelector({ value, onChange }: Props) {
  const qc = useQueryClient();
  const { data: epics = [] } = useEpics();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(EPIC_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const createEpic = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("epics").insert({ name: newName.trim(), color: newColor }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["epics"] });
      onChange(data.id);
      setShowCreate(false);
      setNewName("");
      setOpen(false);
      toast.success(`Epic "${data.name}" opprettet`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeEpics = epics.filter(e => !e.is_archived);
  const selected = epics.find(e => e.id === value);
  const filtered = search.trim()
    ? activeEpics.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : activeEpics;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); setShowCreate(false); }}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-[10px] border border-neutral-200 bg-white text-sm hover:border-neutral-300 transition-colors"
      >
        {selected ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="flex-1 text-left truncate" style={{ color: selected.color }}>{selected.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </>
        ) : (
          <>
            <span className="flex-1 text-left text-muted-foreground">Velg epic...</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden">
          <div className="p-2">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk epics..."
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {/* No epic option */}
            <button type="button" onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${!value ? "bg-neutral-50 font-medium" : ""}`}>
              Ingen epic
            </button>
            {/* Existing epics */}
            {filtered.map(epic => (
              <button key={epic.id} type="button"
                onClick={() => { onChange(epic.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center gap-2 ${value === epic.id ? "bg-neutral-50 font-medium" : ""}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                <span style={{ color: epic.color }}>{epic.name}</span>
              </button>
            ))}
            {filtered.length === 0 && search.trim() && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Ingen treff</p>
            )}
          </div>
          {/* Create new */}
          {!showCreate ? (
            <button type="button" onClick={() => setShowCreate(true)}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5 border-t border-neutral-100">
              <Plus className="h-3.5 w-3.5" /> Opprett ny epic
            </button>
          ) : (
            <div className="p-2 border-t border-neutral-100 space-y-2">
              <div className="flex gap-1">
                {EPIC_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? "scale-110 ring-2 ring-offset-1 ring-neutral-400" : ""}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Epic-navn..."
                  className="h-7 text-xs flex-1" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createEpic.mutate(); if (e.key === "Escape") setShowCreate(false); }} />
                <button onClick={() => { if (newName.trim()) createEpic.mutate(); }}
                  disabled={!newName.trim() || createEpic.isPending}
                  className="text-xs text-primary font-medium hover:underline disabled:opacity-50 shrink-0">Opprett</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
