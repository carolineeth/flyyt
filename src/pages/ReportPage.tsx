import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Clock } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "not_started", label: "Ikke startet" },
  { value: "draft", label: "Utkast" },
  { value: "done", label: "Ferdig" },
  { value: "revised", label: "Revidert" },
];

const statusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  draft: "bg-warning/10 text-warning",
  done: "bg-primary/10 text-primary",
  revised: "bg-chart-4/15 text-chart-4",
};

type ReportSection = {
  id: string;
  title: string;
  assignee_id: string | null;
  status: string;
  word_count_goal: number;
  notes: string | null;
  sort_order: number;
};

export default function ReportPage() {
  const queryClient = useQueryClient();
  const { data: members } = useTeamMembers();

  const { data: sections, isLoading } = useQuery<ReportSection[]>({
    queryKey: ["report_sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_sections" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReportSection> & { id: string }) => {
      const { error } = await supabase
        .from("report_sections" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_sections"] });
    },
  });

  const handleUpdate = (id: string, field: string, value: string | null) => {
    updateSection.mutate({ id, [field]: value } as any, {
      onSuccess: () => toast.success("Oppdatert"),
    });
  };

  // Countdown
  const deadline = new Date("2026-05-15T23:59:59");
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 86400000));

  // Progress
  const total = sections?.length ?? 0;
  const completed = sections?.filter((s) => s.status === "done" || s.status === "revised").length ?? 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Word count
  const totalWordGoal = sections?.reduce((s, sec) => s + sec.word_count_goal, 0) ?? 0;
  const maxWords = 7500;

  if (isLoading) return <div className="p-8 text-muted-foreground">Laster rapport...</div>;

  return (
    <div className="space-y-6 scroll-reveal">
      <PageHeader
        title="Rapport"
        description="Oversikt over innleveringsrapportens seksjoner og fremdrift"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Seksjonsstatus</p>
            <p className="text-lg font-bold tabular-nums">{completed}/{total} ferdige</p>
            <Progress value={progressPct} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Estimert ordtelling</p>
            <p className="text-lg font-bold tabular-nums">{totalWordGoal.toLocaleString("nb-NO")} ord</p>
            <p className="text-xs text-muted-foreground mt-1">Mål: ~{maxWords.toLocaleString("nb-NO")} ord (≈25 sider)</p>
          </CardContent>
        </Card>
        <Card className={daysLeft <= 7 ? "border-destructive/50" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Innlevering 15. mai</p>
            </div>
            <p className={`text-lg font-bold tabular-nums ${daysLeft <= 7 ? "text-destructive" : ""}`}>
              {daysLeft} dager igjen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Seksjon</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Ansvarlig</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-36">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-24">Ordmål</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-52">Notater</th>
                </tr>
              </thead>
              <tbody>
                {sections?.map((sec) => (
                  <tr key={sec.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{sec.title}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={sec.assignee_id ?? "none"}
                        onValueChange={(v) => handleUpdate(sec.id, "assignee_id", v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                          <SelectValue placeholder="Velg..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ikke tildelt</SelectItem>
                          {members?.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name.split(" ")[0]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={sec.status}
                        onValueChange={(v) => handleUpdate(sec.id, "status", v)}
                      >
                        <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {sec.word_count_goal.toLocaleString("nb-NO")}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        defaultValue={sec.notes ?? ""}
                        placeholder="Skriv notater..."
                        className="h-8 text-xs border-transparent hover:border-border"
                        onBlur={(e) => {
                          if (e.target.value !== (sec.notes ?? "")) {
                            handleUpdate(sec.id, "notes", e.target.value);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
