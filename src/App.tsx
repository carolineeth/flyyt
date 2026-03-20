import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { AppLayout } from "@/components/layout/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import ActivitiesPage from "@/pages/ActivitiesPage";
import BacklogPage from "@/pages/BacklogPage";
import SprintBoardPage from "@/pages/SprintBoardPage";
import StandupPage from "@/pages/StandupPage";

import MeetingCalendarPage from "@/pages/MeetingCalendarPage";
import ResourcesPage from "@/pages/ResourcesPage";
import ProcessLogExportPage from "@/pages/ProcessLogExportPage";
import ReportPage from "@/pages/ReportPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthWrapper>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/aktiviteter" element={<ActivitiesPage />} />
              <Route path="/standup" element={<StandupPage />} />
              <Route path="/backlog" element={<BacklogPage />} />
              <Route path="/sprint" element={<SprintBoardPage />} />
              
              <Route path="/moter" element={<MeetingCalendarPage />} />
              <Route path="/ressurser" element={<ResourcesPage />} />
              <Route path="/prosesslogg" element={<ProcessLogExportPage />} />
              <Route path="/rapport" element={<ReportPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
