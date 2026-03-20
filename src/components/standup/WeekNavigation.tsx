import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  weekLabel: string;
  isCurrentWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  children?: React.ReactNode;
}

export function WeekNavigation({ weekLabel, isCurrentWeek, onPrev, onNext, onToday, children }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {!isCurrentWeek && (
        <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onToday}>
          Denne uken
        </Button>
      )}
      <span className="text-sm font-medium text-foreground">{weekLabel}</span>
      {children}
    </div>
  );
}
