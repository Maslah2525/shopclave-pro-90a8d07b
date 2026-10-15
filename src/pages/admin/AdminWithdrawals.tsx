import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, DollarSign, Wallet } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

const statusPill: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-[hsl(var(--admin-accent-info))]/10 text-[hsl(var(--admin-accent-info))]",
  completed: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const AdminWithdrawals = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const { data: withdrawals, refetch } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*, vendors(store_name, user_id)")
        .order("requested_at", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-withdrawals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      if (status === "completed") throw new Error("Payout completion requires verified Stripe settlement and cannot be marked manually.");
      const updates: any = { status };
      if (notes) updates.admin_notes = notes;
      if (status === "completed" || status === "rejected") updates.processed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("withdrawal_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      toast({ title: "Withdrawal updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totals = {
    pending: withdrawals?.filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + Number(w.amount), 0) || 0,
    completed: withdrawals?.filter((w: any) => w.status === "completed").reduce((s: number, w: any) => s + Number(w.amount), 0) || 0,
  };

  const StatTile = ({ icon: Icon, label, value, accent }: any) => (
    <div className="admin-card admin-card-hover p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="admin-section-label">{label}</span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );

  return (
    <div>
      <AdminPageHeader title="Withdrawal Requests" subtitle="Review vendor payout requests. Completion requires verified Stripe settlement." count={withdrawals?.length || 0} countLabel="requests" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
        <StatTile icon={Clock} label="Pending" value={`$${totals.pending.toLocaleString()}`} accent="bg-warning/10 text-warning" />
        <StatTile icon={DollarSign} label="Paid Out" value={`$${totals.completed.toLocaleString()}`} accent="bg-success/10 text-success" />
        <StatTile icon={Wallet} label="Total Requests" value={withdrawals?.length || 0} accent="bg-primary/10 text-primary" />
      </div>

      <div className="admin-card overflow-hidden">
        {(!withdrawals || withdrawals.length === 0) ? (
          <AdminEmptyState
            icon={Wallet}
            title="No withdrawal requests yet"
            description="When vendors request payouts they will appear here for review."
          />
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-340px)]">
            <table className="admin-table min-w-[900px]">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w: any) => (
                  <tr key={w.id}>
                    <td className="font-medium">{(w.vendors as any)?.store_name || "—"}</td>
                    <td className="font-bold text-foreground">${Number(w.amount).toLocaleString()}</td>
                    <td className="capitalize text-sm">{w.payment_method?.replace("_", " ")}</td>
                    <td className="text-xs font-mono max-w-[180px] truncate text-muted-foreground">
                      {w.payment_details ? JSON.stringify(w.payment_details) : "—"}
                    </td>
                    <td><span className={`status-pill capitalize ${statusPill[w.status] || ""}`}>{w.status}</span></td>
                    <td className="text-muted-foreground text-xs">{new Date(w.requested_at).toLocaleDateString()}</td>
                    <td>
                      {w.status === "pending" && (
                        <div className="flex gap-1.5 flex-col items-end min-w-[200px]">
                          <Input
                            placeholder="Notes (optional)"
                            className="h-7 text-xs"
                            value={adminNotes[w.id] || ""}
                            onChange={(e) => setAdminNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => updateStatus.mutate({ id: w.id, status: "approved", notes: adminNotes[w.id] })}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs"
                              onClick={() => updateStatus.mutate({ id: w.id, status: "rejected", notes: adminNotes[w.id] })}>
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                      {w.status === "approved" && (
                        <span className="text-xs text-muted-foreground block text-right">Awaiting verified Stripe settlement</span>
                      )}
                      {(w.status === "completed" || w.status === "rejected") && (
                        <span className="text-xs text-muted-foreground block text-right">{w.admin_notes || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWithdrawals;
