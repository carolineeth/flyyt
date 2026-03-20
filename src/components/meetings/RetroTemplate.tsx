import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TeamMember } from "@/lib/types";

const COLUMNS = [
  { key: "wind", label: "Vind", icon: "⛵", desc: "Hva driver oss fremover?", color: "bg-green-50 border-green-200" },
  { key: "anchor", label: "Anker", icon: "⚓", desc: "Hva holder oss tilbake?", color: "bg-orange-50 border-orange-200" },
  { key: "rock", label: "Skjær", icon: "🪨", desc: "Risikoer fremover?", color: "bg-red-50 border-red-200" },
  { key: "island", label: "Øy", icon: "🏝️", desc: "Mål vi sikter mot?", color: "bg-blue-50 border-blue-200" },
] as const;

interface RetroItem {
  id?: string;
  column_type: string;
  text: string;
  member_id: string | null;
  is_anonymous: boolean;
}

interface Props {
  meetingId: string | null;
  members: TeamMember[];
  participantIds: string[];
  items: RetroItem[];
  onItemsChange: (items: RetroItem[]) => void;
  readOnly?: boolean;
}

export function RetroTemplate({ meetingId, members, participantIds, items, onItemsChange, readOnly }: Props) {
  const [newTexts, setNewTexts] = useState<Record<string, string>>({});
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Load existing items
  useEffect(() => {
    if (!meetingId) return;
    supabase.from("retro_items").select("*").eq("meeting_id", meetingId).order("created_at").then(({ data }) => {
      if (data) {
        onItemsChange(data.map((d) => ({
          id: d.id,
          column_type: d.column_type,
          text: d.text,
          member_id: d.member_id,
          is_anonymous: d.is_anonymous,
        })));
      }
    });
  }, [meetingId]);

  const addItem = (columnType: string) => {
    const text = newTexts[columnType]?.trim();
    if (!text) return;
    onItemsChange([...items, { column_type: columnType, text, member_id: isAnonymous ? null : null, is_anonymous: isAnonymous }]);
    setNewTexts((prev) => ({ ...prev, [columnType]: "" }));
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="rounded"
          />
          Anonym modus
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colItems = items.filter((i) => i.column_type === col.key);
          return (
            <div key={col.key} className={`rounded-lg border-2 p-3 min-h-[200px] ${col.color}`}>
              <div className="text-center mb-3">
                <span className="text-2xl">{col.icon}</span>
                <h4 className="text-sm font-semibold mt-0.5">{col.label}</h4>
                <p className="text-[10px] text-muted-foreground">{col.desc}</p>
              </div>

              <div className="space-y-1.5 mb-3">
                {colItems.map((item, idx) => {
                  const globalIdx = items.indexOf(item);
                  const member = item.member_id ? members.find((m) => m.id === item.member_id) : null;
                  return (
                    <div key={idx} className="bg-white rounded-md p-2 shadow-sm text-xs flex items-start gap-1.5 group">
                      {member && !item.is_anonymous && <MemberAvatar member={member} />}
                      <span className="flex-1">{item.text}</span>
                      {!readOnly && (
                        <button onClick={() => removeItem(globalIdx)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {!readOnly && (
                <div className="flex gap-1">
                  <Input
                    value={newTexts[col.key] ?? ""}
                    onChange={(e) => setNewTexts((p) => ({ ...p, [col.key]: e.target.value }))}
                    placeholder="Legg til..."
                    className="h-7 text-xs bg-white"
                    onKeyDown={(e) => e.key === "Enter" && addItem(col.key)}
                  />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => addItem(col.key)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
