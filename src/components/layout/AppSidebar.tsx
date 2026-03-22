import {
  LayoutDashboard,
  Flag,
  Target,
  Layers,
  CheckSquare,
  Calendar,
  Link2,
  LogOut,
  KeyRound,
  ClipboardCheck,
  FileText,
  MessageCircle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
  { title: "Milepæler", url: "/milepaeler", icon: Flag },
  { title: "Standup", url: "/standup", icon: MessageCircle, hasNotification: true },
  { title: "Aktiviteter", url: "/aktiviteter", icon: Target },
  { title: "Sprinter", url: "/sprinter", icon: Layers },
  { title: "Oppgaver", url: "/oppgaver", icon: CheckSquare },
  { title: "Møter", url: "/moter", icon: Calendar },
  { title: "Ressurser", url: "/ressurser", icon: Link2 },
  { title: "Prosesslogg", url: "/prosesslogg", icon: ClipboardCheck },
  { title: "Rapport", url: "/rapport", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { currentMember } = useCurrentMember();
  const { data: hasUpdate } = useTodayHasUpdate(currentMember?.id);
  const today = new Date();
  const isWorkday = today.getDay() >= 1 && today.getDay() <= 5;
  const showDot = isWorkday && hasUpdate === false;

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
          <div className="px-4 pb-4 mb-2">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Flyt</h1>
            <p className="text-xs text-muted-foreground">Prosjektstyring for Team 34</p>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center pb-4 mb-2">
            <span className="text-lg font-bold text-primary">V</span>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent/60 transition-colors duration-150"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <span className="relative shrink-0">
                        <item.icon className="h-4 w-4" />
                        {item.hasNotification && showDot && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
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
      </SidebarContent>
      <SidebarFooter className="p-2">
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
