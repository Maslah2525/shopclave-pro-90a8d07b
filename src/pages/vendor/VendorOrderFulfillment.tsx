import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Copy, Printer, FileText, RotateCcw, User, Mail, Phone, MapPin, ArrowLeft, Truck } from "lucide-react";
import { toast } from "sonner";
import { shipmentAddressLines } from "@/lib/orderPresentation";
import { cn } from "@/lib/utils";
import FulfillmentProgress from "@/components/shipping/FulfillmentProgress";
import { canVendorTransition, nextVendorItemStatus } from "@/lib/orderStatus";
import TrackingTimeline from "@/components/shipping/TrackingTimeline";

const fmtMoney = (n: number) => `$${n.toFixed(2)} CAD`;
const payColor = (s: string) => (s === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning");

const VendorOrderFulfillment = ({ view = "orders" }: { view?: "orders" | "fulfilment" }) => {
  const fulfilment = view === "fulfilment";
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { itemId } = useParams<{ itemId: string }>();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: item, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendor-order-item", itemId],
    refetchInterval: 30000,
    queryFn: async () => {
      if (!itemId || !vendor?.id) throw new Error("Order item is required");
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, slug, product_images(url, position))")
        .eq("id", itemId)
        .eq("vendor_id", vendor.id)
        .single();
      if (error) throw error;
      const { data: deliveries, error: deliveryError } = await supabase.rpc("get_vendor_order_delivery_details", {
        p_vendor_id: vendor.id,
        p_order_ids: [data.order_id],
      });
      if (deliveryError) throw deliveryError;
      return { ...data, orders: deliveries?.[0] ?? null };
    },
    enabled: !!vendor?.id && !!itemId,
  });

  const { data: linkedShipments = [] } = useQuery({
    queryKey: ["vendor-item-shipments", itemId],
    enabled: !!itemId && !!vendor?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!itemId || !vendor?.id) throw new Error("Order item is required");
      const { data, error } = await supabase.from("shipments")
        .select("id, status, carrier, service, tracking_number, tracking_url, label_url, label_error, label_purchased_at, estimated_delivery, shipping_amount_cad, shipment_items!inner(order_item_id)")
        .eq("vendor_id", vendor.id).eq("shipment_items.order_item_id", itemId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: returnRequest } = useQuery({
    queryKey: ["vendor-order-return", itemId],
    queryFn: async () => {
      if (!itemId) throw new Error("Order item is required");
      const { data, error } = await supabase
        .from("return_requests")
        .select("id, status")
        .eq("order_item_id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const { data: trackingEvents = [] } = useQuery({
    queryKey: ["vendor-item-tracking-events", itemId, linkedShipments.map((s) => s.id)],
    enabled: fulfilment && linkedShipments.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      const ids = linkedShipments.map((s) => s.id);
      if (!ids.length) return [];
      const { data, error } = await supabase.from("tracking_events").select("*").in("shipment_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (item) {
      setNote((item as any).vendor_notes || "");
    }
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!itemId || !vendor?.id) throw new Error("Order item is required");
      const { data: current, error: lookupError } = await supabase.from("order_items")
        .select("id,status,vendor_id,order_id")
        .eq("id", itemId).eq("vendor_id", vendor.id).single();
      if (lookupError || !current) throw new Error("Order item not found");
      const { data: delivery, error: paymentError } = await supabase.rpc("get_vendor_order_delivery_details", {
        p_vendor_id: vendor.id, p_order_ids: [current.order_id],
      });
      if (paymentError) throw paymentError;
      if (delivery?.[0]?.payment_status !== "paid") throw new Error("Payment must be confirmed before fulfillment");
      if (!canVendorTransition(current.status, status, delivery?.[0]?.payment_status ?? "")) throw new Error("Invalid fulfillment status transition");
      const { data: updated, error } = await supabase.from("order_items").update({ status }).eq("id", itemId).eq("vendor_id", vendor.id).eq("status", current.status).select("id,status").maybeSingle();
      if (error) throw error;
      if (!updated || updated.status !== status) throw new Error("The order changed. Refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-order-item", itemId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-fulfilment-queue"] });
      queryClient.invalidateQueries({ queryKey: ["order-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders-detailed"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update status"),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!itemId || !vendor?.id) throw new Error("Order item is required");
      const { error } = await supabase.from("order_items")
        .update({ vendor_notes: note.trim() || null })
        .eq("id", itemId).eq("vendor_id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor-order-item", itemId] }); toast.success("Note saved"); },
    onError: (e: any) => toast.error(e.message || "Failed to save note"),
  });

  const updateParcel = useMutation({
    mutationFn: async ({ id, current, next }: { id: string; current: string; next: string }) => {
      if (!vendor?.id || !item || item.orders?.payment_status !== "paid") throw new Error("Payment must be confirmed before fulfillment");
      const { data, error } = await supabase.from("shipments").update({ status: next })
        .eq("id", id).eq("vendor_id", vendor.id).eq("status", current).select("id,status").maybeSingle();
      if (error) throw error;
      if (!data || data.status !== next) throw new Error("The parcel changed. Refresh and try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-item-shipments", itemId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-fulfilment-queue"] });
      queryClient.invalidateQueries({ queryKey: ["order-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["my-orders-detailed"] });
      toast.success("Parcel updated");
    },
    onError: (e: any) => toast.error(e.message || "Could not update parcel"),
  });

  const copyAddress = async (addr: any) => {
    try {
      await navigator.clipboard.writeText(shipmentAddressLines(addr).join("\n"));
      toast.success("Delivery address copied");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading order…</p>;
  if (isError || !item) return (
    <div role="alert" className="space-y-3">
      <p>Unable to load this order. It may not belong to your store.</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void refetch()}>Retry</Button>
        <Button variant="ghost" asChild><Link to={fulfilment ? "/vendor/shipments" : "/vendor/orders"}>Back to {fulfilment ? "fulfilment" : "orders"}</Link></Button>
      </div>
    </div>
  );

  const order = item.orders as any;
  const addr = order?.shipping_address as any;
  const addressLines = shipmentAddressLines(addr);
  const itemTotal = Number(item.price) * item.quantity;
  const shipping = Number(item.shipping_amount || 0);
  const tax = Number(item.tax_amount || 0);
  const nextStatus = nextVendorItemStatus(item.status);
  const paymentConfirmed = order?.payment_status === "paid";
  const product = item.products as any;
  const image = product?.product_images?.slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url;
  const variant = (item.variant_options as any)?.label as string | undefined;

  return (
    <div className="space-y-4">
      <Link to={fulfilment ? "/vendor/shipments" : "/vendor/orders"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {fulfilment ? "Fulfilment" : "Orders"}
      </Link>

      {/* Header */}
      <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">Order #{String(item.order_id).slice(0, 8).toUpperCase()}</h2>
            <span className={cn("status-pill", payColor(order?.payment_status))}>Payment: {order?.payment_status === "paid" ? "Paid" : "Pending"}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {order?.created_at ? `Placed on ${new Date(order.created_at).toLocaleString()}` : "Order date unavailable"}
            {vendor?.store_name ? `  |  ${vendor.store_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fulfilment ? <>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <FileText className="h-4 w-4" /> Print Packing Slip
          </Button>
          {linkedShipments.some((s) => s.label_url) ? linkedShipments.filter((s) => s.label_url).map((s, index) => (
            <Button key={s.id} variant="outline" size="sm" className="gap-2" asChild>
              <a href={s.label_url ?? undefined} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /> Print Shipping Label{linkedShipments.length > 1 ? ` ${index + 1}` : ""}</a>
            </Button>
          )) : (
            <Button variant="outline" size="sm" className="gap-2" disabled title="Label available after shipment is booked">
              <Printer className="h-4 w-4" /> Print Shipping Label
            </Button>
          )}
          {nextStatus ? (
            <Button size="sm" className="font-semibold" disabled={updateStatus.isPending || !paymentConfirmed} onClick={() => updateStatus.mutate({ status: nextStatus })}>
              Mark as {nextStatus === "processing" ? "Processing" : nextStatus === "shipped" ? "Shipped" : "Delivered"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{item.status === "delivered" ? "Fulfilment complete" : item.status === "cancelled" ? "Order cancelled" : "No action available for this status"}</span>
          )}
          {nextStatus && !paymentConfirmed && <p className="w-full text-xs text-muted-foreground">Payment must be confirmed before you can update delivery.</p>}
          </> : <Button variant="outline" size="sm" className="gap-2" asChild><Link to={`/vendor/shipments/${item.id}`}><Truck className="h-4 w-4" /> Open Fulfilment</Link></Button>}
        </div>
      </div>

      {/* Timeline */}
      {fulfilment && <div className="border-y border-border py-4 md:py-6">
        <FulfillmentProgress status={item.status} shipmentStatuses={linkedShipments.map((s) => s.status)} />
      </div>}

      {/* Main grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="admin-card space-y-3 p-4">
          <h3 className="font-semibold">Customer Information</h3>
          {addr?.fullName && <p className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{addr.fullName}</p>}
          {addr?.email && <p className="flex items-center gap-2 break-all text-sm"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" />{addr.email}</p>}
          {addr?.phone && <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{addr.phone}</p>}
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><MapPin className="h-4 w-4" /> Shipping Address</p>
            <p className="whitespace-pre-line break-words text-sm">{addressLines.filter((l) => l !== addr?.fullName && l !== addr?.phone).join("\n") || "Delivery address unavailable"}</p>
            {fulfilment && addr && <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={() => copyAddress(addr)}><Copy className="h-3.5 w-3.5" /> Copy address</Button>}
          </div>
        </section>

        <section className="admin-card p-4">
          <h3 className="mb-3 font-semibold">Products (1)</h3>
          <div className="flex gap-3">
            {image && <img src={image} alt={product?.name || "Product"} className="h-20 w-16 rounded-md border border-border object-cover" />}
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              {product?.slug ? (
                <Link className="font-semibold text-primary hover:underline" to={`/product/${product.slug}`}>{product.name}</Link>
              ) : <p className="font-semibold">{product?.name || "Product unavailable"}</p>}
              {variant && <p className="text-xs text-muted-foreground">{variant}</p>}
              <p className="text-xs text-muted-foreground">Price: {fmtMoney(Number(item.price))}</p>
              <div className="flex items-center justify-between pt-1 text-sm">
                <span className="text-muted-foreground">Qty: {item.quantity}</span>
                <span className="font-semibold">{fmtMoney(itemTotal)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-card space-y-2 p-4 text-sm">
          <h3 className="mb-2 font-semibold">Order Summary</h3>
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmtMoney(itemTotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Shipping:</span><span>{fmtMoney(shipping)}</span></div>
          {tax > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax:</span><span>{fmtMoney(tax)}</span></div>}
          <div className="flex justify-between border-t border-border pt-2 font-bold"><span>Total Paid:</span><span>{fmtMoney(itemTotal + shipping + tax)}</span></div>
          <div className="flex justify-between pt-1"><span className="text-muted-foreground">Payment Status</span><span className={cn("status-pill", payColor(order?.payment_status))}>{order?.payment_status === "paid" ? "Paid" : "Pending"}</span></div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="admin-card space-y-3 p-4 text-sm">
          <h3 className="font-semibold">{fulfilment ? "Shipping & Tracking" : "Fulfilment"}</h3>
          {fulfilment ? <>
          {linkedShipments.length === 0 ? (
            <p className="text-muted-foreground">{paymentConfirmed ? "Shipping label is being prepared automatically." : "Your shipping label is bought automatically once payment is confirmed."}</p>
          ) : linkedShipments.map((s: any) => (
            <div key={s.id} className="space-y-1 rounded-md border border-border p-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Carrier</span><span>{[s.carrier, s.service].filter(Boolean).join(" · ") || "Awaiting label"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tracking</span>
                {s.tracking_number ? (s.tracking_url ? <a className="break-all text-primary hover:underline" href={s.tracking_url} target="_blank" rel="noreferrer">{s.tracking_number}</a> : <span className="break-all">{s.tracking_number}</span>) : <span>Awaiting label</span>}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping paid</span><span>{fmtMoney(Number(s.shipping_amount_cad || 0))}</span></div>
              {s.estimated_delivery && <div className="flex justify-between"><span className="text-muted-foreground">Est. delivery</span><span>{new Date(s.estimated_delivery).toLocaleDateString()}</span></div>}
              {s.label_url && <Button size="sm" variant="outline" className="mt-1 w-full gap-2" asChild><a href={s.label_url} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /> Print label</a></Button>}
              {s.label_url && (s.status === "preparing" || s.status === "ready_for_pickup") && <Button size="sm" variant="outline" className="mt-1 w-full" disabled={!paymentConfirmed || updateParcel.isPending} onClick={() => updateParcel.mutate({ id: s.id, current: s.status, next: s.status === "preparing" ? "ready_for_pickup" : "collected" })}>{s.status === "preparing" ? "Mark Ready for Pickup" : "Mark Collected"}</Button>}
              {s.label_error && !s.label_url && <p className="text-xs text-destructive">Label could not be bought automatically. Contact support@barakaz.com.</p>}
              {trackingEvents.some((e) => e.shipment_id === s.id) && <div className="border-t border-border pt-3"><TrackingTimeline events={trackingEvents.filter((e) => e.shipment_id === s.id)} /></div>}
            </div>
          ))}
          </> : <>
            <p className="capitalize text-muted-foreground">{item.status.replace(/_/g, " ")}</p>
            {!paymentConfirmed && <p className="text-muted-foreground">Awaiting payment confirmation.</p>}
            <Button size="sm" variant="outline" className="gap-2" asChild><Link to={`/vendor/shipments/${item.id}`}><Truck className="h-4 w-4" /> Open Fulfilment</Link></Button>
          </>}
        </section>

        <section className="admin-card space-y-3 p-4">
          <h3 className="font-semibold">Order Notes</h3>
          <Textarea placeholder="Add a note (visible to you only)…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <Button size="sm" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>Save Note</Button>
        </section>

        <section className="admin-card space-y-3 p-4">
          <h3 className="font-semibold">Customer Actions</h3>
          <Link to={`/orders/${item.order_id}/chat`} className="block">
            <Button size="sm" variant="outline" className="w-full gap-2"><MessageCircle className="h-4 w-4" /> Message Customer</Button>
          </Link>
          {returnRequest && (
            <Link to={`/orders/${item.order_id}/chat`} className="block">
              <Button size="sm" variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> View Return Request ({returnRequest.status})</Button>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
};

export default VendorOrderFulfillment;
