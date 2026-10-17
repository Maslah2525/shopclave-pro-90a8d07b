import {
  LayoutDashboard, Store, Package, ShoppingBag, Users, Upload, Bell, FolderTree,
  Settings, Wallet, BarChart3, CreditCard, MessageCircle, Images, Shield, UserCog,
  Megaphone, GraduationCap, BookOpen, Share2, Percent, RotateCcw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
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
import barakazIcon from "@/assets/barakaz-icon.webp";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";

type Item = { title: string; url: string; icon: typeof Store; end?: boolean; permission: string };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true, permission: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    label: "Operations",
    items: [
      { title: "Orders", url: "/admin/orders", icon: ShoppingBag, permission: PERMISSIONS.ORDERS_VIEW },
      { title: "Returns & Refunds", url: "/admin/returns", icon: RotateCcw, permission: PERMISSIONS.ORDERS_UPDATE },
      { title: "Evidence Vault", url: "/admin/evidence", icon: Shield, permission: PERMISSIONS.EVIDENCE_VIEW },
      { title: "Messages", url: "/admin/messages", icon: MessageCircle, permission: PERMISSIONS.MESSAGES_VIEW },
      { title: "Notifications", url: "/admin/notifications", icon: Bell, permission: PERMISSIONS.NOTIFICATIONS_SEND },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/admin/products", icon: Package, permission: PERMISSIONS.PRODUCTS_VIEW },
      { title: "Categories", url: "/admin/categories", icon: FolderTree, permission: PERMISSIONS.CATEGORIES_MANAGE },
      { title: "Bulk Import", url: "/admin/bulk-import", icon: Upload, permission: PERMISSIONS.BULK_IMPORT_USE },
      { title: "Media", url: "/admin/media", icon: Images, permission: PERMISSIONS.MEDIA_MANAGE },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Withdrawals", url: "/admin/withdrawals", icon: Wallet, permission: PERMISSIONS.WITHDRAWALS_VIEW },
      { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard, permission: PERMISSIONS.SUBSCRIPTIONS_VIEW },
      { title: "Commissions", url: "/admin/commissions", icon: Percent, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Analytics", url: "/admin/analytics", icon: BarChart3, permission: PERMISSIONS.ANALYTICS_VIEW }],
  },
  {
    label: "Content",
    items: [
      { title: "Marketing", url: "/admin/marketing", icon: Megaphone, permission: PERMISSIONS.MARKETING_MANAGE },
      { title: "Social Media", url: "/admin/social", icon: Share2, permission: PERMISSIONS.SOCIAL_MEDIA_MANAGE },
      { title: "Barakaz Academy", url: "/admin/resources", icon: GraduationCap, permission: PERMISSIONS.RESOURCES_MANAGE },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Vendors", url: "/admin/vendors", icon: Store, permission: PERMISSIONS.VENDORS_VIEW },
      { title: "Users", url: "/admin/users", icon: Users, permission: PERMISSIONS.USERS_VIEW },
      { title: "Team & Roles", url: "/admin/team", icon: UserCog, permission: PERMISSIONS.TEAM_MANAGE },
      { title: "Settings", url: "/admin/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
      { title: "Documentation", url: "/admin/documentation", icon: BookOpen, permission: PERMISSIONS.DOCUMENTATION_VIEW },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const { hasPermission } = useAuth();
  const collapsed = state === "collapsed";

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(i.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 [&_[data-sidebar=sidebar]]:bg-admin-sidebar-bg [&_[data-sidebar=sidebar]]:text-admin-sidebar-fg"
    >
      <SidebarHeader className="border-b border-admin-sidebar-border px-4 py-4 bg-admin-sidebar-bg flex items-center justify-center">
        <Link to="/" className="flex items-center justify-center">
          <img
            src={collapsed ? barakazIcon : barakazLogo}
            alt="Barakaz"
            className="h-14 w-auto group-data-[collapsible=icon]:h-8 transition-all brightness-0 invert opacity-95"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-admin-sidebar-bg stagger-children">
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-semibold text-admin-sidebar-fg-muted px-3">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="hover:bg-transparent">
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className="relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-admin-sidebar-fg hover:bg-admin-sidebar-elevated hover:text-admin-sidebar-active-fg transition-colors"
                        activeClassName="bg-admin-sidebar-active-bg text-admin-sidebar-active-fg font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-primary before:rounded-r"
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
