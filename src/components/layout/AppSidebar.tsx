import {
  LayoutDashboard,
  Target,
  Layers,
  CheckSquare,
  BarChart3,
  Calendar,
  Link2,
  LogOut,
  KeyRound,
  ClipboardCheck,
  ClipboardList,
  FileText,
  MessageCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCurrentMember, useTodayHasUpdate } from "@/hooks/useDailyUpdates";
import { logoutUser } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Standup", url: "/standup", icon: MessageCircle, hasNotification: true },
  { title: "Aktiviteter", url: "/aktiviteter", icon: Target },
  { title: "Sprinter", url: "/sprinter", icon: Layers },
  { title: "Krav", url: "/krav", icon: ClipboardList },
  { title: "Oppgaver", url: "/oppgaver", icon: CheckSquare },
  { title: "Møter", url: "/moter", icon: Calendar },
  { title: "Ressurser", url: "/ressurser", icon: Link2 },
  { title: "Prosesslogg", url: "/prosesslogg", icon: ClipboardCheck },
  { title: "Innsikt", url: "/innsikt", icon: BarChart3 },
  { title: "Rapport", url: "/rapport", icon: FileText },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { currentMember } = useCurrentMember();
  const { data: hasUpdate } = useTodayHasUpdate(currentMember?.id);
  const showDot = hasUpdate === false;

  const handleLogout = async () => {
    const { error } = await logoutUser();
    if (error) {
      toast.error("Kunne ikke logge ut fullstendig, men lokal økt ble tømt");
    } else {
      toast.success("Logget ut");
    }
    window.location.href = "/";
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="pt-4">
        {!collapsed && (
          <div className="px-4 pb-6 mb-2">
            <span className="text-xl font-bold text-primary tracking-tight">Flyyt</span>
            <p className="text-xs text-muted-foreground mt-0.5">Prosjektstyring for Team 34</p>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center pb-4 mb-2">
            <span className="text-base font-bold text-primary">F</span>
          </div>
        )}
        <nav aria-label="Hovedmeny">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-accent/60 transition-colors duration-150 py-2.5 px-4"
                        activeClassName="bg-primary/10 text-primary font-medium rounded-[10px]"
                        aria-label={collapsed ? item.title : undefined}
                      >
                        <span className="relative shrink-0">
                          <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                          {item.hasNotification && showDot && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" aria-label="Standup mangler" />
                          )}
                        </span>
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter className="p-2">
        {currentMember && (
          <button
            onClick={() => navigate("/profil")}
            className={`flex items-center gap-2 w-full rounded-md px-2 py-2 mb-1 hover:bg-accent/60 transition-colors text-left ${
              location.pathname === "/profil" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
              style={{ backgroundColor: currentMember.avatar_color }}
            >
              {getInitials(currentMember.name)}
            </div>
            {!collapsed && (
              <span className="text-sm font-medium truncate">{currentMember.name.split(" ")[0]}</span>
            )}
          </button>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-muted-foreground hover:text-foreground">
              <NavLink to="/bytt-passord" activeClassName="bg-accent text-accent-foreground font-medium">
                <KeyRound className="h-4 w-4" />
                {!collapsed && <span>Bytt passord</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logg ut</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
