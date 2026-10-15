import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { DollarSign, TrendingUp, Wallet, Clock, ArrowDownToLine, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

const VendorEarnings = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { data: orderItems, isError: ordersError, isLoading: ordersLoading } = useQuery({
    queryKey: ["vendor-orders", vendor?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*, products(name), orders!inner(payment_status)").eq("vendor_id", vendor.id).eq("orders.payment_status", "paid");
      if (error) throw error;
      return data || [];
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

  // Use the existing ledger-maintained balance instead of inferring withdrawable funds
  // from paid orders (which can include holds, refunds and unsettled payments).
  const { data: ledgerBalance, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ["vendor-ledger-balance", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("vendor_balances")
        .select("available_balance,pending_balance,total_withdrawn,currency")
        .eq("vendor_id", vendor.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = orderItems?.reduce((sum: number, i: any) => sum + Number(i.price) * i.quantity, 0) || 0;
  const totalCommission = orderItems?.reduce((sum: number, i: any) => sum + Number(i.commission_amount), 0) || 0;
  const netEarnings = totalRevenue - totalCommission;
  const balancesReady = !ordersLoading && !withdrawalsLoading && !ordersError && !withdrawalsError;
  const balanceCurrency = ledgerBalance?.currency || "CAD";
  const formatBalance = (amount: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: balanceCurrency }).format(amount);
  const availableBalance = ledgerBalance ? Number(ledgerBalance.available_balance) : null;
  const pendingBalance = ledgerBalance ? Number(ledgerBalance.pending_balance) : null;

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
    { label: "Available Balance", value: !balanceLoading && !balanceError && availableBalance !== null && Number.isFinite(availableBalance) ? formatBalance(availableBalance) : "Unavailable", icon: Clock, accent: "text-primary", iconBg: "bg-primary/10 text-primary" },
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

      <p className="text-xs text-muted-foreground">Gross revenue, commission and net earnings above are paid-order summaries, not settlement statements. Available balance comes from the existing vendor ledger-maintained balance; it does not guarantee payout eligibility.</p>\n      {balanceError && <p className="text-sm text-destructive">Ledger balance could not be loaded. No available balance can be confirmed.</p>}\n      {pendingBalance !== null && !balanceError && <p className="text-sm text-muted-foreground">Ledger pending balance: {formatBalance(pendingBalance)}. Payout eligibility still depends on settlement and provider verification.</p>}
      {/* Payout destinations are collected only by the verified payment provider. */}
      <div className="admin-card p-6 space-y-2">
        <h3 className="font-semibold">Secure payouts</h3>
        <p className="text-sm text-muted-foreground">Bank and identity information must be submitted through the payment provider’s secure onboarding flow. Barakaz does not collect account numbers, routing numbers, IBANs or SWIFT details in withdrawal requests.</p>
        <p className="text-sm"><Link to="/vendor/payments" className="text-primary underline">Open payment settings to view your provider verification status</Link>.</p>
        <p className="text-xs text-muted-foreground">Balances displayed here are estimates, not a guarantee that funds are available for withdrawal. Provider-confirmed settlement and account eligibility govern payouts.</p>
      </div>
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
