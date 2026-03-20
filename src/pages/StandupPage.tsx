import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useWeekNavigation, useDailyUpdates, useCurrentMember } from "@/hooks/useDailyUpdates";
import { WeekNavigation } from "@/components/standup/WeekNavigation";
import { HeatmapStripe } from "@/components/standup/HeatmapStripe";
import { DayByDayTab } from "@/components/standup/DayByDayTab";
import { OverviewTab } from "@/components/standup/OverviewTab";

type Tab = "daily" | "overview";

export default function StandupPage() {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const { data: members } = useTeamMembers();
  const { currentMember, userEmail } = useCurrentMember();
  const week = useWeekNavigation();
  const { data: entries } = useDailyUpdates(week.weekStart, week.weekEnd);

  if (userEmail && members && !currentMember) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-destructive">
          Kontoen din er ikke koblet til et teammedlem. Kontakt admin.
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Dag for dag" },
    { key: "overview", label: "Oversikt" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Standup" description="Asynkrone daglige oppdateringer" />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "font-medium text-foreground border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Week navigation */}
      <WeekNavigation
        weekLabel={week.weekLabel}
        isCurrentWeek={week.isCurrentWeek}
        onPrev={week.goToPrevWeek}
        onNext={week.goToNextWeek}
        onToday={week.goToThisWeek}
      >
        {activeTab === "daily" && members && (
          <HeatmapStripe weekdays={week.weekdays} entries={entries ?? []} memberCount={members.length} />
        )}
      </WeekNavigation>

      {/* Tab content */}
      {activeTab === "daily" && members && (
        <DayByDayTab
          weekdays={week.weekdays}
          entries={entries ?? []}
          members={members}
          currentMemberId={currentMember?.id ?? null}
          isCurrentWeek={week.isCurrentWeek}
        />
      )}

      {activeTab === "overview" && members && (
        <OverviewTab
          members={members}
          weekStart={week.weekStart}
          weekEnd={week.weekEnd}
          onNavigateToWeek={week.goToWeek}
          onSwitchTab={() => setActiveTab("daily")}
        />
      )}
    </div>
  );
}
