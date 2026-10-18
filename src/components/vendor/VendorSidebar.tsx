import { LayoutDashboard, Package, Plus, ShoppingBag, DollarSign, Bell, Upload, Settings, Home, MessageCircle, Images, GraduationCap, CreditCard, Truck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import barakazLogo from "@/assets/barakaz-logo.webp";

const groups: { label: string; items: { title: string; url: string; icon: any }[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/vendor/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/vendor/products", icon: Package },
      { title: "Add Product", url: "/vendor/products/new", icon: Plus },
      { title: "Bulk Import", url: "/vendor/bulk-import", icon: Upload },
      { title: "Media", url: "/vendor/media", icon: Images },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", url: "/vendor/orders", icon: ShoppingBag },
      { title: "Fulfilment", url: "/vendor/shipments", icon: Truck },
      { title: "Earnings", url: "/vendor/earnings", icon: DollarSign },
      { title: "Payments", url: "/vendor/payments", icon: CreditCard },
    ],
  },
  {
    label: "Engage",
    items: [
      { title: "Messages", url: "/vendor/messages", icon: MessageCircle },
      { title: "Notifications", url: "/vendor/notifications", icon: Bell },
    ],
  },
  {
    label: "Learn",
    items: [{ title: "Barakaz Academy", url: "/vendor/resources", icon: GraduationCap }],
  },
  {
    label: "System",
    items: [{ title: "Store Settings", url: "/vendor/settings", icon: Settings }],
  },
];

export function VendorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();

  const { data: vendor } = useQuery({
    queryKey: ["vendor-for-sidebar", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("vendors").select("id,status").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["vendor-unread-messages", vendor?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", vendor!.id)
        .eq("is_read", false)
        .neq("sender_id", user!.id);
      return count || 0;
    },
    enabled: !!vendor && !!user,
    refetchInterval: 15000,
  });

  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ["vendor-unread-notifs", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const badgeFor = (title: string): number => {
    if (title === "Messages") return unreadCount;
    if (title === "Notifications") return unreadNotifs;
    return 0;
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 [&_[data-sidebar=sidebar]]:bg-[hsl(var(--vendor-sidebar-bg))] [&_[data-sidebar=sidebar]]:text-[hsl(var(--vendor-sidebar-fg))]"
    >
      <SidebarHeader className="border-b border-[hsl(var(--vendor-sidebar-border))] px-4 py-4 flex items-center justify-center bg-[hsl(var(--vendor-sidebar-bg))]">
        <Link to="/" className="flex items-center justify-center">
          <img
            src={barakazLogo}
            alt="Barakaz"
            className="h-14 w-auto group-data-[collapsible=icon]:h-8 transition-all brightness-0 invert"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-[hsl(var(--vendor-sidebar-bg))] stagger-children">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--vendor-sidebar-fg-muted))] px-3 mt-1">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const badge = badgeFor(item.title);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="hover:bg-transparent">
                        <NavLink
                          to={item.url}
                          end={item.url !== "/vendor/orders" && item.url !== "/vendor/shipments"}
                          className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[hsl(var(--vendor-sidebar-fg))] hover:bg-[hsl(var(--vendor-sidebar-bg-elevated))] hover:text-white transition-colors ${item.url === "/vendor/settings" && vendor?.status && vendor.status !== "approved" ? "ring-2 ring-primary animate-pulse" : ""}`}
                          activeClassName="!bg-[hsl(var(--vendor-sidebar-active-bg))] !text-[hsl(var(--vendor-sidebar-active-fg))] font-medium shadow-sm"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <span className="flex-1 flex items-center justify-between">
                              {item.title}
                              {badge > 0 && (
                                <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                                  {badge > 99 ? "99+" : badge}
                                </span>
                              )}
                            </span>
                          )}
                          {collapsed && badge > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                              {badge > 9 ? "9+" : badge}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="hover:bg-transparent">
                  <Link
                    to="/"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-[hsl(var(--vendor-sidebar-fg-muted))] hover:bg-[hsl(var(--vendor-sidebar-bg-elevated))] hover:text-white transition-colors"
                  >
                    <Home className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Back to Site</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
