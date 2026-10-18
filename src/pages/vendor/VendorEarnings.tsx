import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { DollarSign, TrendingUp, Wallet, Clock, ArrowDownToLine, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import WithdrawalRequests from "@/components/vendor/WithdrawalRequests";

const VendorEarnings = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { data: orderItems, isError: ordersError, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendor-orders", vendor?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*, products(name)").eq("vendor_id", vendor.id);
      if (error) throw error;
      const ids = [...new Set((data || []).map(item => item.order_id))];
      if (!ids.length) return [];
      const paid = await supabase.rpc("get_vendor_order_delivery_details", { p_vendor_id: vendor.id, p_order_ids: ids });
      if (paid.error) throw paid.error;
      const paidIds = new Set(paid.data.filter(order => order.payment_status === "paid").map(order => order.id));
      return (data || []).filter(item => paidIds.has(item.order_id));
    },
    enabled: !!vendor,
  });

  const { data: withdrawals, isError: withdrawalsError, isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["vendor-withdrawals", vendor?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendor,
  });

  const totalRevenue = orderItems?.reduce((sum: number, i: any) => sum + Number(i.price) * i.quantity, 0) || 0;
  const totalCommission = orderItems?.reduce((sum: number, i: any) => sum + Number(i.commission_amount), 0) || 0;
  const netEarnings = orderItems?.reduce((sum: number, item: any) => sum + Number(item.vendor_payout || 0), 0) || 0;
  const withdrawnOrPending = withdrawals
    ?.filter((w: any) => w.status === "completed" || w.status === "pending" || w.status === "approved")
    .reduce((s: number, w: any) => s + Number(w.amount), 0) || 0;
  const availableBalance = netEarnings - withdrawnOrPending;
  const balancesReady = !ordersLoading && !withdrawalsLoading && !ordersError && !withdrawalsError;

  const topProducts = (() => {
    const map: Record<string, { name: string; units: number; revenue: number }> = {};
    orderItems?.forEach((i: any) => {
      const pid = i.product_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { name: (i.products as any)?.name || "Unknown", units: 0, revenue: 0 };
      map[pid].units += i.quantity;
      map[pid].revenue += Number(i.price) * i.quantity;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  })();

  const statusColors: Record<string, string> = {
    pending: "bg-warning/10 text-warning",
    approved: "bg-primary/10 text-primary",
    completed: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
  };

  const stats = [
    { label: "Gross Revenue", value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, accent: "text-foreground", iconBg: "bg-muted text-muted-foreground" },
    { label: `Platform Fee (${vendor?.commission_rate}%)`, value: `- $${totalCommission.toLocaleString()}`, icon: TrendingUp, accent: "text-destructive", iconBg: "bg-destructive/10 text-destructive" },
    { label: "Net Earnings", value: `$${netEarnings.toLocaleString()}`, icon: Wallet, accent: "text-success", iconBg: "bg-success/10 text-success" },
    { label: "Estimated remainder", value: `CA$${Math.max(0, availableBalance).toLocaleString()}`, icon: Clock, accent: "text-primary", iconBg: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Earnings & Withdrawals"
        subtitle="Review earnings from confirmed paid orders and withdrawal history."
      />

      {(ordersError || withdrawalsError) && <div className="admin-card p-3 text-sm text-destructive flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Earnings data could not be loaded. Balances are unavailable until the connection is restored.</div>}
      {(ordersLoading || withdrawalsLoading) && <p className="text-sm text-muted-foreground">Loading confirmed earnings…</p>}
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="admin-card admin-card-hover p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.iconBg}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-lg font-bold ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Figures include confirmed paid orders only. Available balance is an estimate based on recorded commissions and withdrawal requests; final settlement and eligibility are subject to reconciliation.</p>
      <WithdrawalRequests vendorId={vendor.id} />
      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="space-y-3">
          <h3 className="admin-section-label">Top Performing Products</h3>
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[400px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, idx) => (
                    <tr key={idx}>
                      <td className="text-muted-foreground">{idx + 1}</td>
                      <td className="font-medium">{p.name}</td>
                      <td>{p.units}</td>
                      <td className="font-semibold">${p.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal History */}
      <div className="space-y-3">
        <h3 className="admin-section-label">Withdrawal History</h3>
        {!withdrawals || withdrawals.length === 0 ? (
          <div className="admin-card">
            <AdminEmptyState
              icon={ArrowDownToLine}
              title="No withdrawals yet"
              description="Requested payouts will appear here with status updates from the admin team."
            />
          </div>
        ) : (
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[500px]">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w: any) => (
                    <tr key={w.id}>
                      <td className="font-bold">${Number(w.amount).toLocaleString()}</td>
                      <td className="capitalize">{w.payment_method?.replace("_", " ")}</td>
                      <td>
                        <span className={`status-pill ${statusColors[w.status] || ""}`}>{w.status}</span>
                      </td>
                      <td className="text-muted-foreground text-xs">{new Date(w.requested_at).toLocaleDateString()}</td>
                      <td className="text-xs text-muted-foreground">{w.admin_notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorEarnings;
