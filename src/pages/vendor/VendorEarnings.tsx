import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, Wallet, Clock, ArrowDownToLine, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

interface PaymentDetails {
  phone?: string;
  email?: string;
  account_name?: string;
  bank_name?: string;
  branch?: string;
  account_number?: string;
  swift_code?: string;
}

const VendorEarnings = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({});

  const updateDetail = (key: keyof PaymentDetails, value: string) =>
    setPaymentDetails((prev) => ({ ...prev, [key]: value }));

  const handleMethodChange = (method: string) => {
    setPaymentMethod(method);
    setPaymentDetails({});
  };

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

  const totalRevenue = orderItems?.reduce((sum: number, i: any) => sum + Number(i.price) * i.quantity, 0) || 0;
  const totalCommission = orderItems?.reduce((sum: number, i: any) => sum + Number(i.commission_amount), 0) || 0;
  const netEarnings = totalRevenue - totalCommission;
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

  const validateDetails = (): string | null => {
    if (paymentMethod === "bank_transfer") {
      if (!paymentDetails.account_name?.trim()) return "Enter account name";
      if (!paymentDetails.bank_name?.trim()) return "Enter bank name";
      if (!paymentDetails.account_number?.trim()) return "Enter account number";
    } else if (paymentMethod === "paypal") {
      if (!paymentDetails.email?.trim()) return "Enter PayPal email";
    }
    return null;
  };

  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!balancesReady) throw new Error("Balance information is unavailable. Please retry.");
      if (!amt || amt <= 0 || amt > availableBalance) throw new Error("Invalid amount");
      const detailError = validateDetails();
      if (detailError) throw new Error(detailError);
      const { error } = await (supabase as any).from("withdrawal_requests").insert({
        vendor_id: vendor.id,
        amount: amt,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-withdrawals", vendor?.id] });
      setAmount("");
      setPaymentDetails({});
      toast({ title: "Withdrawal requested successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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
    { label: "Available Balance", value: `$${Math.max(0, availableBalance).toLocaleString()}`, icon: Clock, accent: "text-primary", iconBg: "bg-primary/10 text-primary" },
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
      {/* Withdrawal Form */}
      <div className="admin-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownToLine className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Request Withdrawal</h3>
        </div>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">For Stripe Connect payouts, use <Link to="/vendor/payments" className="text-primary underline">Payment settings</Link>. Manual withdrawal requests require administrator review and do not initiate an automatic transfer.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Amount (CAD)</Label>
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} max={availableBalance} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={handleMethodChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentMethod === "bank_transfer" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Account Name</Label>
                <Input placeholder="John Doe" value={paymentDetails.account_name || ""} onChange={(e) => updateDetail("account_name", e.target.value)} />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input placeholder="e.g. Equity Bank" value={paymentDetails.bank_name || ""} onChange={(e) => updateDetail("bank_name", e.target.value)} />
              </div>
              <div>
                <Label>Branch</Label>
                <Input placeholder="e.g. Nairobi CBD" value={paymentDetails.branch || ""} onChange={(e) => updateDetail("branch", e.target.value)} />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input placeholder="Account #" value={paymentDetails.account_number || ""} onChange={(e) => updateDetail("account_number", e.target.value)} />
              </div>
              <div>
                <Label>SWIFT Code</Label>
                <Input placeholder="e.g. EABORBI" value={paymentDetails.swift_code || ""} onChange={(e) => updateDetail("swift_code", e.target.value)} />
              </div>
            </div>
          )}

          {paymentMethod === "paypal" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>PayPal Email</Label>
                <Input type="email" placeholder="email@example.com" value={paymentDetails.email || ""} onChange={(e) => updateDetail("email", e.target.value)} />
              </div>
            </div>
          )}

          <Button onClick={() => requestWithdrawal.mutate()} disabled={requestWithdrawal.isPending || !balancesReady || availableBalance <= 0}>
            {requestWithdrawal.isPending ? "Submitting..." : "Request Withdrawal"}
          </Button>
        </div>
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
