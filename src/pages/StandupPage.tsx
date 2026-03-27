import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useWeekNavigation, useDailyUpdates, useCurrentMember, useDailyTeamNotes } from "@/hooks/useDailyUpdates";
import { WeekNavigation } from "@/components/standup/WeekNavigation";
import { HeatmapStripe } from "@/components/standup/HeatmapStripe";
import { DayByDayTab } from "@/components/standup/DayByDayTab";
import { OverviewTab } from "@/components/standup/OverviewTab";

type Tab = "daily" | "overview";

export default function StandupPage() {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const { data: members } = useTeamMembers();
  const { currentMember } = useCurrentMember();
  const week = useWeekNavigation();
  const { data: entries } = useDailyUpdates(week.weekStart, week.weekEnd);
  const { data: teamNotes = [] } = useDailyTeamNotes(week.weekStart, week.weekEnd);

  const tabs: { key: Tab; label: string }[] = [
    { key: "daily", label: "Dag for dag" },
    { key: "overview", label: "Oversikt" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Standup" description="Asynkrone daglige oppdateringer" />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2 px-1 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "font-semibold text-foreground border-primary"
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
          teamNotes={teamNotes}
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
