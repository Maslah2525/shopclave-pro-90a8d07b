import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XCircle, Search, Eye, MousePointer, Package, Store } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import AdminSellerApplications from "@/pages/admin/AdminSellerApplications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminVendors = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: vendors } = useQuery({
    queryKey: ["admin-vendors-detail"],
    queryFn: async () => {
      const { data: vendorData } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
      if (!vendorData || vendorData.length === 0) return [];

      const userIds = vendorData.map((v: any) => v.user_id);
      const { data: profileData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = new Map((profileData || []).map((p: any) => [p.user_id, p.full_name]));

      const vendorIds = vendorData.map((v: any) => v.id);
      const { data: analyticsData } = await supabase.from("vendor_analytics").select("vendor_id, event_type").in("vendor_id", vendorIds);

      const analyticsMap = new Map<string, { views: number; clicks: number }>();
      (analyticsData || []).forEach((a: any) => {
        const existing = analyticsMap.get(a.vendor_id) || { views: 0, clicks: 0 };
        if (a.event_type === "view") existing.views++;
        else existing.clicks++;
        analyticsMap.set(a.vendor_id, existing);
      });

      const { data: productCounts } = await supabase.from("products").select("vendor_id").in("vendor_id", vendorIds).eq("status", "active");
      const productMap = new Map<string, number>();
      (productCounts || []).forEach((p: any) => {
        productMap.set(p.vendor_id, (productMap.get(p.vendor_id) || 0) + 1);
      });

      const { data: subs } = await supabase
        .from("vendor_subscriptions")
        .select("vendor_id, plan_name, max_listings, expires_at, created_at")
        .in("vendor_id", vendorIds)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      const subMap = new Map<string, any>();
      (subs || []).forEach((s: any) => {
        if (!subMap.has(s.vendor_id)) subMap.set(s.vendor_id, s);
      });

      return vendorData.map((v: any) => ({
        ...v,
        owner_name: profileMap.get(v.user_id) || "—",
        stats: analyticsMap.get(v.id) || { views: 0, clicks: 0 },
        listing_count: productMap.get(v.id) || 0,
        subscription: subMap.get(v.id) || null,
      }));
    },
    enabled: !!user,
  });

  const updateVendorStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vendors").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "approved") {
        const { data: email } = await supabase.rpc("admin_get_vendor_owner_email", { _vendor_id: id });
        const v = vendors?.find((x: any) => x.id === id);
        if (email) {
          await supabase.functions.invoke("send-transactional-email", {
            body: { templateName: "seller-approved", recipientEmail: email, idempotencyKey: `seller-approved-${id}-${Date.now()}`, templateData: { storeName: v?.store_name } },
          }).catch(() => undefined);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors-detail"] });
      toast.success("Vendor status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = vendors?.filter((v: any) =>
    v.store_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const statusPill = (s: string) => {
    if (s === "approved") return "bg-success/10 text-success";
    if (s === "pending") return "bg-warning/10 text-warning";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <div>
      <AdminPageHeader title="Vendor Management" subtitle="Review marketplace vendors. New seller approvals require verified applications." count={vendors?.length || 0} countLabel="vendors">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vendors..." className="pl-9 h-9 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </AdminPageHeader>

      <Tabs defaultValue="vendors">
      <TabsList className="mb-4"><TabsTrigger value="applications">Applications to approve</TabsTrigger><TabsTrigger value="vendors">All vendors</TabsTrigger></TabsList>
      <TabsContent value="applications"><AdminSellerApplications /></TabsContent>
      <TabsContent value="vendors">
      <div className="admin-card overflow-hidden">
        {filtered.length === 0 ? (
          <AdminEmptyState
            icon={Store}
            title={search ? "No vendors match your search" : "No vendors yet"}
            description={search ? "Try a different store name." : "Vendors will appear here once they register."}
          />
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-220px)]">
            <table className="admin-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Owner</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Listings</th>
                  <th>Views</th>
                  <th>Clicks</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v: any) => (
                  <tr key={v.id}>
                    <td className="font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {v.store_name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="truncate">{v.store_name}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{v.owner_name}</td>
                    <td className="text-muted-foreground text-xs">{v.phone || "—"}</td>
                    <td>
                      {v.subscription ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium capitalize">{v.subscription.plan_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {v.subscription.max_listings} listings
                            {v.subscription.expires_at && ` · exp ${new Date(v.subscription.expires_at).toLocaleDateString()}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Free (5)</span>
                      )}
                    </td>
                    <td><span className="inline-flex items-center gap-1 text-sm"><Package className="h-3.5 w-3.5 text-muted-foreground" /> {v.listing_count}</span></td>
                    <td><span className="inline-flex items-center gap-1 text-sm"><Eye className="h-3.5 w-3.5 text-muted-foreground" /> {v.stats.views}</span></td>
                    <td><span className="inline-flex items-center gap-1 text-sm"><MousePointer className="h-3.5 w-3.5 text-muted-foreground" /> {v.stats.clicks}</span></td>
                    <td><span className={`status-pill ${statusPill(v.status)}`}>{v.status}</span></td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        {v.status !== "approved" && (
                          <Button size="sm" className="h-8 px-3 text-xs" onClick={() => updateVendorStatus.mutate({ id: v.id, status: "approved" })}>
                            {v.status === "rejected" ? "Re-approve" : "Approve"}
                          </Button>
                        )}
                        {v.status === "approved" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-warning hover:text-warning hover:bg-warning/10 text-xs" onClick={() => updateVendorStatus.mutate({ id: v.id, status: "suspended" })}>
                            Suspend
                          </Button>
                        )}
                        {v.status !== "rejected" && (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => updateVendorStatus.mutate({ id: v.id, status: "rejected" })}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminVendors;
