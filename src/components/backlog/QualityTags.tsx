import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

const PREDEFINED_TAGS = [
  { label: "Teknisk gjeld", color: "#DC2626" },
  { label: "Ytelse", color: "#EA580C" },
  { label: "Tilgjengelighet", color: "#7C3AED" },
  { label: "Sikkerhet", color: "#0891B2" },
  { label: "Testdekning", color: "#2563EB" },
  { label: "UX", color: "#BE185D" },
];

function getTagColor(tag: string): string {
  const predefined = PREDEFINED_TAGS.find(t => t.label === tag);
  return predefined?.color ?? "#6B7280";
}

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function QualityTagSelector({ value, onChange }: Props) {
  const [customTag, setCustomTag] = useState("");

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter(t => t !== tag) : [...value, tag]);
  };

  const addCustom = () => {
    const trimmed = customTag.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setCustomTag("");
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {PREDEFINED_TAGS.map(tag => {
          const selected = value.includes(tag.label);
          return (
            <button key={tag.label} type="button" onClick={() => toggle(tag.label)}
              className={`py-0.5 px-2 rounded-md text-[11px] font-medium transition-all ${selected ? "ring-1 ring-offset-1" : "opacity-60 hover:opacity-100"}`}
              style={{ backgroundColor: tag.color + "15", color: tag.color, ...(selected ? { ringColor: tag.color } : {}) }}>
              {tag.label}
            </button>
          );
        })}
        {/* Custom tags already added */}
        {value.filter(t => !PREDEFINED_TAGS.some(p => p.label === t)).map(tag => (
          <span key={tag} className="py-0.5 px-2 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 flex items-center gap-1">
            {tag}
            <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="Egendefinert tag..."
          className="h-6 text-[11px] flex-1" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        {customTag.trim() && <button type="button" onClick={addCustom} className="text-[11px] text-primary"><Plus className="h-3 w-3" /></button>}
      </div>
    </div>
  );
}

export function QualityTagChips({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(tag => (
        <span key={tag} className="py-0.5 px-1.5 rounded text-[9px] font-medium"
          style={{ backgroundColor: getTagColor(tag) + "15", color: getTagColor(tag) }}>
          {tag}
        </span>
      ))}
    </div>
  );
}

export { PREDEFINED_TAGS, getTagColor };
