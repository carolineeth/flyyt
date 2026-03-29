import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
  value: string | null; // epic_id
  onChange: (epicId: string | null) => void;
}

export function EpicSelector({ value, onChange }: Props) {
  const qc = useQueryClient();
  const { data: epics = [] } = useEpics();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(EPIC_COLORS[0]);

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
      toast.success(`Epic "${data.name}" opprettet`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeEpics = epics.filter(e => !e.is_archived);
  const selected = epics.find(e => e.id === value);

  return (
    <div className="space-y-1.5">
      {/* Current selection */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`py-1 px-2.5 rounded-md text-xs font-medium transition-colors ${!value ? "bg-neutral-200 text-foreground" : "bg-neutral-100 text-muted-foreground hover:bg-neutral-150"}`}
        >
          Ingen epic
        </button>
        {activeEpics.map(epic => (
          <button
            key={epic.id}
            type="button"
            onClick={() => onChange(epic.id)}
            className={`py-1 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${value === epic.id ? "ring-2 ring-primary ring-offset-1" : "hover:ring-1 hover:ring-neutral-300"}`}
            style={{ backgroundColor: epic.color + "15", color: epic.color }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
            {epic.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="py-1 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-neutral-100 transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Ny epic
        </button>
      </div>

      {/* Create inline */}
      {showCreate && (
        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg">
          <div className="flex gap-1">
            {EPIC_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className={`w-4 h-4 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-offset-1 ring-neutral-400" : ""}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Epic-navn..."
            className="h-7 text-xs flex-1" onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) createEpic.mutate(); if (e.key === "Escape") setShowCreate(false); }} />
          <button onClick={() => { if (newName.trim()) createEpic.mutate(); }}
            disabled={!newName.trim() || createEpic.isPending}
            className="text-xs text-primary font-medium hover:underline disabled:opacity-50">Opprett</button>
        </div>
      )}
    </div>
  );
}
