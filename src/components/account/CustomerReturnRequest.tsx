import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CustomerReturnRequest({ orderItemId, maxQuantity, userId }: {
  orderItemId: string; maxQuantity: number; userId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const submit = async () => {
    if (busy || reason.trim().length < 10 || quantity < 1 || quantity > maxQuantity) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_customer_return", {
        p_order_item_id: orderItemId,
        p_quantity: quantity,
        p_reason: reason.trim(),
      });
      if (error) throw error;
      toast.success("Return request submitted for review. No refund has been issued.");
      setExpanded(false);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["my-return-requests", userId] });
    } catch (error: any) {
      toast.error(error?.message || "Unable to submit return request");
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) return <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>Request return</Button>;
  return <div className="space-y-2 rounded-md border border-border p-3 w-full">
    <p className="text-xs text-muted-foreground">Returns are reviewed for eligibility. Submitting a request does not guarantee approval or a refund.</p>
    <label className="text-sm font-medium" htmlFor={`return-qty-${orderItemId}`}>Quantity</label>
    <input id={`return-qty-${orderItemId}`} className="block w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" type="number" min={1} max={maxQuantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
    <label className="text-sm font-medium" htmlFor={`return-reason-${orderItemId}`}>Reason for return</label>
    <Textarea id={`return-reason-${orderItemId}`} maxLength={2000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the problem (at least 10 characters)" />
    <div className="flex gap-2"><Button type="button" size="sm" disabled={busy || reason.trim().length < 10 || quantity < 1 || quantity > maxQuantity} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit request"}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setExpanded(false)}>Cancel</Button></div>
  </div>;
}
