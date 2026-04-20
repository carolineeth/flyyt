import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/layout/AppLayout";
import { TeamLinkingModal } from "@/components/TeamLinkingModal";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ActivitiesPage from "@/pages/ActivitiesPage";
import SprinterPage from "@/pages/SprinterPage";
import RequirementsPage from "@/pages/RequirementsPage";

import StandupPage from "@/pages/StandupPage";
import MeetingCalendarPage from "@/pages/MeetingCalendarPage";
import ResourcesPage from "@/pages/ResourcesPage";
import ProcessLogExportPage from "@/pages/ProcessLogExportPage";
import InsightsPage from "@/pages/InsightsPage";
import ReportPage from "@/pages/ReportPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import ProfilePage from "@/pages/ProfilePage";
import BacklogPage from "@/pages/BacklogPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid clobbering in-progress edits when window regains focus
      refetchOnWindowFocus: false,
    },
  },
});

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return <>{children}</>;
}

function TeamLinkingGuard({ children }: { children: React.ReactNode }) {
  const { authUserId, authEmail, isLinked, isLoading, refetch } = useCurrentTeamMember();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (authUserId && !isLinked) {
    return <TeamLinkingModal authUserId={authUserId} authEmail={authEmail} onLinked={() => refetch()} />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthWrapper>
          <TeamLinkingGuard>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                
                <Route path="/aktiviteter" element={<ActivitiesPage />} />
                <Route path="/standup" element={<StandupPage />} />
                <Route path="/sprinter" element={<SprinterPage />} />
                <Route path="/backlog" element={<BacklogPage />} />
                <Route path="/krav" element={<RequirementsPage />} />
                
                <Route path="/moter" element={<MeetingCalendarPage />} />
                <Route path="/ressurser" element={<ResourcesPage />} />
                <Route path="/prosesslogg" element={<ProcessLogExportPage />} />
                <Route path="/innsikt" element={<InsightsPage />} />
                <Route path="/rapport" element={<ReportPage />} />
                <Route path="/bytt-passord" element={<ChangePasswordPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/profil/:memberId" element={<ProfilePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </TeamLinkingGuard>
        </AuthWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
