import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { withdrawalAmountSchema } from "@/lib/withdrawalRules";

const money = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
export default function WithdrawalRequests({ vendorId }: { vendorId: string }) {
  const client = useQueryClient();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  const summary = useQuery({ queryKey: ["withdrawal-summary", vendorId], queryFn: async () => {
    const { data, error } = await supabase.rpc("vendor_withdrawal_summary", { p_vendor_id: vendorId });
    if (error) throw error;
    return data as { available: number; reserved: number; pending: number; currency: string };
  }});
  const history = useQuery({ queryKey: ["vendor-withdrawals", vendorId], queryFn: async () => {
    const { data, error } = await supabase.from("withdrawal_requests").select("id,amount,currency,payment_method,status,requested_at,admin_notes").eq("vendor_id", vendorId).order("requested_at", { ascending: false });
    if (error) throw error;
    return data;
  }});
  const submit = async () => {
    const parsed = withdrawalAmountSchema.safeParse(Number(amount));
    if (!parsed.success) { toast.error("Minimum withdrawal is CA$20. Use at most two decimal places."); return; }
    setBusy(true);
    requestKey.current ??= crypto.randomUUID();
    try {
      const { error } = await supabase.rpc("request_vendor_withdrawal", { p_vendor_id: vendorId, p_amount: parsed.data, p_request_key: requestKey.current });
      if (error) throw error;
      requestKey.current = null;
      setAmount("");
      await Promise.all([client.invalidateQueries({ queryKey: ["withdrawal-summary", vendorId] }), client.invalidateQueries({ queryKey: ["vendor-withdrawals", vendorId] })]);
      toast.success("Withdrawal request submitted for admin review.");
    } catch (error) { toast.error(error instanceof Error ? error.message : (error as { message?: string })?.message || "Request failed"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 border-t border-border pt-5">
    <h3 className="font-semibold">Request withdrawal</h3>
    {summary.isError ? <p role="alert" className="text-sm text-destructive">Balance unavailable. <Button variant="link" onClick={() => void summary.refetch()}>Retry</Button></p> : <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Available</p><p className="text-xl font-semibold">{summary.data ? money(summary.data.available) : "…"}</p></div><div><p className="text-muted-foreground">Awaiting review</p><p className="text-xl font-semibold">{summary.data ? money(summary.data.reserved) : "…"}</p></div></div>}
    <p className="text-sm text-muted-foreground">Minimum CA$20. Requests use your saved bank or PayPal details.</p>
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="withdrawal-amount">Amount (CAD)</Label><Input id="withdrawal-amount" type="number" min={20} step="0.01" value={amount} onChange={e => { setAmount(e.target.value); requestKey.current = null; }} disabled={busy} /></div><Button onClick={() => void submit()} disabled={busy || !summary.data || Number(amount) < 20 || Number(amount) > summary.data.available}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowDownToLine className="mr-2 h-4 w-4" />}Request withdrawal</Button></div>
    <Link to="/vendor/settings?section=payouts" className="text-sm text-primary underline">Edit payment details</Link>
    <h4 className="font-semibold">Withdrawal requests</h4>
    {history.isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : history.isError ? <p role="alert" className="text-sm text-destructive">Unable to load requests.</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p> : <ul className="divide-y divide-border">{history.data.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><strong>{row.currency} {Number(row.amount).toFixed(2)}</strong><p className="text-muted-foreground">{row.payment_method === "bank" ? "Bank account" : "PayPal"} · {new Date(row.requested_at).toLocaleDateString()}</p>{row.admin_notes && <p>{row.admin_notes}</p>}</div><span className="capitalize">{row.status}</span></li>)}</ul>}
  </section>;
}