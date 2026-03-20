import {
  LayoutDashboard,
  Target,
  ListTodo,
  Columns3,
  Calendar,
  Link2,
  LogOut,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  { title: "Aktiviteter", url: "/aktiviteter", icon: Target },
  { title: "Backlog", url: "/backlog", icon: ListTodo },
  { title: "Sprint Board", url: "/sprint", icon: Columns3 },
  
  { title: "Møtekalender", url: "/moter", icon: Calendar },
  { title: "Ressurser", url: "/ressurser", icon: Link2 },
  { title: "Prosesslogg", url: "/prosesslogg", icon: ClipboardCheck },
  { title: "Rapport", url: "/rapport", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logget ut");
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
                      <item.icon className="h-4 w-4 shrink-0" />
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
