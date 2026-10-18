import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { shipmentAddressLines } from "@/lib/orderPresentation";

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

  const statusColor = (s: string) => {
    if (s === "delivered") return "bg-success/10 text-success";
    if (s === "shipped") return "bg-primary/10 text-primary";
    if (s === "processing") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
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
          {/* Desktop */}
          <div className="hidden md:block admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="min-w-[260px]">Deliver to</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item: any) => {
                    const idx = orderStatusFlow.indexOf(item.status);
                    const order = item.orders as any;
                    const next = order?.payment_status === "paid" && idx >= 0 && idx < orderStatusFlow.length - 1 ? orderStatusFlow[idx + 1] : null;
                    const addr = order?.shipping_address as any;
                    return (
                      <tr key={item.id}>
                        <td className="font-medium">
                          {item.products?.slug ? <Link className="text-primary hover:underline break-words" to={`/product/${item.products.slug}`}>{item.products.name}</Link> : <div>{item.products?.name || "Product unavailable"}</div>}
                          {(item.variant_options as any)?.label && (
                            <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              {(item.variant_options as any).label}
                            </span>
                          )}
                        </td>
                        <td className="text-xs align-top">
                          <div className="space-y-0.5 leading-snug">
                            <p className="whitespace-pre-line break-words text-foreground">{formatAddress(addr) || "Delivery address unavailable"}</p>
                            {addr && (
                              <Button variant="ghost" size="sm"
                                type="button"
                                onClick={() => copyAddress(addr)}
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                              >
                                <Copy className="h-3 w-3" /> Copy address
                              </Button>
                            )}
                          </div>
                        </td>
                        <td>{item.quantity}</td>
                        <td className="font-semibold">${(Number(item.price) * item.quantity).toLocaleString()}</td>
                        <td>
                          <span className={`status-pill ${payColor(order?.payment_status)}`}>
                            {order?.payment_status || "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${statusColor(item.status)}`}>{item.status}</span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {order?.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            {next ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => updateStatus.mutate({ id: item.id, status: next, productName: (item.products as any)?.name, orderId: item.order_id })}
                              >
                                Mark {next}
                              </Button>
                            ) : (
                              <div className="text-xs text-muted-foreground text-center">Completed</div>
                            )}
                            <Link to={`/orders/${item.order_id}/chat`}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs w-full gap-1">
                                <MessageCircle className="h-3 w-3" /> Chat
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {orderItems.map((item: any) => {
              const idx = orderStatusFlow.indexOf(item.status);
              const order = item.orders as any;
              const next = order?.payment_status === "paid" && idx >= 0 && idx < orderStatusFlow.length - 1 ? orderStatusFlow[idx + 1] : null;
              const addr = order?.shipping_address as any;
              return (
                <div key={item.id} className="admin-card p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {item.products?.slug ? <Link className="font-medium text-sm text-primary hover:underline break-words" to={`/product/${item.products.slug}`}>{item.products.name}</Link> : <p className="font-medium text-sm">{item.products?.name || "Product unavailable"}</p>}
                      {(item.variant_options as any)?.label && (
                        <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {(item.variant_options as any).label}
                        </span>
                      )}
                    </div>
                    <span className={`status-pill ${statusColor(item.status)}`}>{item.status}</span>
                  </div>

                  {addr && (
                    <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                          Deliver to
                        </span>
                        <Button variant="ghost" size="sm"
                          type="button"
                          onClick={() => copyAddress(addr)}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <div className="space-y-0.5 leading-snug">
                        <p className="whitespace-pre-line break-words text-foreground">{formatAddress(addr) || "Delivery address unavailable"}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Qty: {item.quantity}
                      {order?.created_at && ` · ${new Date(order.created_at).toLocaleDateString()}`}
                    </span>
                    <span className="font-semibold">${(Number(item.price) * item.quantity).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className={`status-pill ${payColor(order?.payment_status)}`}>{order?.payment_status || "—"}</span>
                    <div className="flex gap-1">
                      <Link to={`/orders/${item.order_id}/chat`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                          <MessageCircle className="h-3 w-3" /> Chat
                        </Button>
                      </Link>
                      {next && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => updateStatus.mutate({ id: item.id, status: next, productName: (item.products as any)?.name, orderId: item.order_id })}
                        >
                          Mark {next}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default VendorOrders;
