import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { shipmentAddressLines } from "@/lib/orderPresentation";
import FulfillmentProgress, { fulfillmentStageLabel } from "@/components/shipping/FulfillmentProgress";

const orderStatusFlow = ["pending", "processing", "shipped", "delivered"];

const formatAddress = (addr: any) => {
  return shipmentAddressLines(addr).join("\n");
};

const VendorOrders = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const queryClient = useQueryClient();

  const { data: orderItems, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendor-orders", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, slug)")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: deliveries, error: deliveryError } = await supabase.rpc("get_vendor_order_delivery_details", {
        p_vendor_id: vendor.id,
        p_order_ids: [...new Set(data.map((item) => item.order_id))],
      });
      if (deliveryError) throw deliveryError;
      return data.map((item) => ({ ...item, orders: deliveries?.find((order) => order.id === item.order_id) ?? null }));
    },
    enabled: !!vendor,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, productName, orderId }: { id: string; status: string; productName?: string; orderId?: string }) => {
      // Recheck payment and ownership immediately before advancing fulfillment.
      const { data: current, error: lookupError } = await supabase.from("order_items")
        .select("id,status,vendor_id,order_id")
        .eq("id", id).eq("vendor_id", vendor.id).single();
      if (lookupError || !current) throw new Error("Order item not found");
      const { data: delivery, error: paymentError } = await supabase.rpc("get_vendor_order_delivery_details", {
        p_vendor_id: vendor.id, p_order_ids: [current.order_id],
      });
      if (paymentError) throw paymentError;
      if (delivery?.[0]?.payment_status !== "paid") throw new Error("Payment must be confirmed before fulfillment");
      const next = orderStatusFlow[orderStatusFlow.indexOf(current.status) + 1];
      if (!next || next !== status) throw new Error("Invalid fulfillment status transition");
      // Customer notification is created by the database when the status changes.
      const { error } = await supabase.from("order_items").update({ status }).eq("id", id).eq("vendor_id", vendor.id).eq("status", current.status);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-tracking"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update status"),
  });

  const copyAddress = async (addr: any) => {
    try {
      await navigator.clipboard.writeText(formatAddress(addr));
      toast.success("Delivery address copied");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const payColor = (s: string) =>
    s === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Orders"
        subtitle="Fulfil customer orders and keep statuses up to date."
        count={orderItems?.length || 0}
        countLabel="orders"
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading orders…</p> : isError ? (
        <div role="alert" className="space-y-3"><p>Unable to load orders. Please try again.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>
      ) : !orderItems?.length ? (
        <div className="admin-card">
          <AdminEmptyState
            icon={Truck}
            title="No orders yet"
            description="Once customers place orders for your products, they'll appear here for fulfilment."
          />
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {orderItems.map((item: any) => {
              const order = item.orders as any;
              const idx = orderStatusFlow.indexOf(item.status);
              const next = order?.payment_status === "paid" && idx >= 0 && idx < orderStatusFlow.length - 1 ? orderStatusFlow[idx + 1] : null;
              const addr = order?.shipping_address as any;
              const total = Number(item.price) * item.quantity;
              return (
                <article key={item.id} className="admin-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4 md:p-6">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">Order #{String(item.order_id).slice(0, 8).toUpperCase()}</h2>
                        <span className={`status-pill ${payColor(order?.payment_status)}`}>Payment: {order?.payment_status || "Pending"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{order?.created_at ? `Placed on ${new Date(order.created_at).toLocaleString()}` : "Order date unavailable"}</p>
                    </div>
                    {next ? (
                      <Button className="font-semibold" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: item.id, status: next, orderId: item.order_id })}>
                        Move to {fulfillmentStageLabel(next)}
                      </Button>
                    ) : <span className="text-sm text-muted-foreground">{order?.payment_status !== "paid" ? "Awaiting payment confirmation" : "Fulfilment complete"}</span>}
                  </div>

                  <div className="border-b border-border px-4 py-6 md:px-8">
                    <FulfillmentProgress status={item.status} />
                  </div>

                  <div className="grid gap-4 p-4 md:grid-cols-12 md:p-6">
                    <section className="rounded-lg border border-border p-4 md:col-span-4">
                      <h3 className="mb-3 font-semibold">Customer information</h3>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Shipping address</p>
                      <p className="whitespace-pre-line break-words text-sm">{formatAddress(addr) || "Delivery address unavailable"}</p>
                      {addr && <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => copyAddress(addr)}><Copy className="h-3.5 w-3.5" /> Copy address</Button>}
                    </section>
                    <section className="rounded-lg border border-border p-4 md:col-span-5">
                      <h3 className="mb-3 font-semibold">Products (1)</h3>
                      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                        <div className="space-y-1">
                          {item.products?.slug ? <Link className="font-semibold text-primary hover:underline" to={`/product/${item.products.slug}`}>{item.products.name}</Link> : <p className="font-semibold">{item.products?.name || "Product unavailable"}</p>}
                          {(item.variant_options as any)?.label && <p className="text-xs text-muted-foreground">{(item.variant_options as any).label}</p>}
                          <p className="text-xs text-muted-foreground">Quantity: {item.quantity}</p>
                        </div>
                        <span className="font-semibold">${total.toFixed(2)} CAD</span>
                      </div>
                    </section>
                    <section className="rounded-lg border border-border p-4 md:col-span-3">
                      <h3 className="mb-3 font-semibold">Order summary</h3>
                      <div className="flex justify-between gap-2 text-sm"><span>Item total</span><span className="font-semibold">${total.toFixed(2)} CAD</span></div>
                      <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3 text-sm"><span>Payment</span><span className={`status-pill ${payColor(order?.payment_status)}`}>{order?.payment_status || "Pending"}</span></div>
                    </section>
                    <section className="rounded-lg border border-border p-4 md:col-span-12">
                      <h3 className="mb-3 font-semibold">Customer actions</h3>
                      <Link to={`/orders/${item.order_id}/chat`}>
                        <Button size="sm" variant="outline" className="gap-2"><MessageCircle className="h-4 w-4" /> Message customer</Button>
                      </Link>
                    </section>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default VendorOrders;
