import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, MessageCircle, Copy, Check, Package, Home, Printer, FileText, RotateCcw, User, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { shipmentAddressLines } from "@/lib/orderPresentation";
import { cn } from "@/lib/utils";

const orderStatusFlow = ["pending", "processing", "shipped", "delivered"];
const CARRIERS = ["Canada Post", "Purolator", "UPS", "FedEx", "DHL", "Other"];

// Six customer-facing fulfilment stages; vendors advance the four inner ones.
const STAGES = [
  { key: "received", label: "Order Received", caption: "Order placed" },
  { key: "processing", label: "Processing", caption: "Preparing the item" },
  { key: "ready", label: "Ready to Ship", caption: "Prepare and ship the item" },
  { key: "shipped", label: "Shipped", caption: "Add tracking number" },
  { key: "out_for_delivery", label: "Out for Delivery", caption: "In transit to customer" },
  { key: "delivered", label: "Delivered", caption: "Customer received item" },
];

const stageIndexFor = (status: string) =>
  status === "pending" ? 0
  : status === "processing" ? 1
  : status === "shipped" ? 3
  : status === "delivered" ? 5
  : 0;

const fmtMoney = (n: number) => `$${n.toFixed(2)} CAD`;
const payColor = (s: string) => (s === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning");

const VendorOrders = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ carrier: string; number: string }>({ carrier: "", number: "" });
  const [note, setNote] = useState("");
  const [noteLoadedFor, setNoteLoadedFor] = useState<string | null>(null);

  const { data: orderItems, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendor-orders", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, slug, product_images(url, position))")
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

  const selected = useMemo(
    () => orderItems?.find((i: any) => i.id === selectedId) ?? orderItems?.[0] ?? null,
    [orderItems, selectedId],
  );

  const { data: returnRequest } = useQuery({
    queryKey: ["vendor-order-return", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_requests")
        .select("id, status")
        .eq("order_item_id", selected.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selected?.id,
  });

  if (selected && noteLoadedFor !== selected.id) {
    setNoteLoadedFor(selected.id);
    setNote((selected as any).vendor_notes || "");
    setTracking({ carrier: (selected as any).carrier || "", number: (selected as any).tracking_number || "" });
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
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

  const saveTracking = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (!tracking.carrier) throw new Error("Choose a carrier");
      const { error } = await supabase.from("order_items")
        .update({ carrier: tracking.carrier, tracking_number: tracking.number.trim() || null })
        .eq("id", selected.id).eq("vendor_id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor-orders"] }); toast.success("Tracking saved"); },
    onError: (e: any) => toast.error(e.message || "Failed to save tracking"),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase.from("order_items")
        .update({ vendor_notes: note.trim() || null })
        .eq("id", selected.id).eq("vendor_id", vendor.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["vendor-orders"] }); toast.success("Note saved"); },
    onError: (e: any) => toast.error(e.message || "Failed to save note"),
  });

  const copyAddress = async (addr: any) => {
    try {
      await navigator.clipboard.writeText(shipmentAddressLines(addr).join("\n"));
      toast.success("Delivery address copied");
    } catch {
      toast.error("Failed to copy address");
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading orders…</p>;
  if (isError) return (
    <div role="alert" className="space-y-3"><p>Unable to load orders. Please try again.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>
  );
  if (!orderItems?.length) return (
    <div className="space-y-5">
      <AdminPageHeader title="Orders" subtitle="Fulfil customer orders and keep statuses up to date." count={0} countLabel="orders" />
      <div className="admin-card">
        <AdminEmptyState icon={Truck} title="No orders yet" description="Once customers place orders for your products, they'll appear here for fulfilment." />
      </div>
    </div>
  );

  const order = selected?.orders as any;
  const addr = order?.shipping_address as any;
  const addressLines = shipmentAddressLines(addr);
  const itemTotal = selected ? Number(selected.price) * selected.quantity : 0;
  const shipping = Number(selected?.shipping_amount || 0);
  const tax = Number(selected?.tax_amount || 0);
  const idx = selected ? orderStatusFlow.indexOf(selected.status) : -1;
  const nextStatus = order?.payment_status === "paid" && idx >= 0 && idx < orderStatusFlow.length - 1 ? orderStatusFlow[idx + 1] : null;
  const activeStage = selected ? stageIndexFor(selected.status) : 0;
  const product = selected?.products as any;
  const image = product?.product_images?.slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url;
  const variant = (selected?.variant_options as any)?.label as string | undefined;

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Orders" subtitle="Fulfil customer orders and keep statuses up to date." count={orderItems.length} countLabel="orders" />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Order list */}
        <div className="admin-card max-h-[70vh] divide-y divide-border overflow-y-auto">
          {orderItems.map((item: any) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50",
                selected?.id === item.id && "border-l-2 border-primary bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">#{String(item.order_id).slice(0, 8).toUpperCase()}</span>
                <span className={cn("status-pill", payColor(item.orders?.payment_status))}>{item.orders?.payment_status || "pending"}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.products?.name || "Product"}</p>
              <p className="text-xs text-muted-foreground capitalize">{item.status} · {fmtMoney(Number(item.price) * item.quantity)}</p>
            </button>
          ))}
        </div>

        {/* Order detail */}
        {selected && (
          <div className="space-y-4">
            {/* Header */}
            <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold">Order #{String(selected.order_id).slice(0, 8).toUpperCase()}</h2>
                  <span className={cn("status-pill", payColor(order?.payment_status))}>Payment: {order?.payment_status === "paid" ? "Paid" : "Pending"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {order?.created_at ? `Placed on ${new Date(order.created_at).toLocaleString()}` : "Order date unavailable"}
                  {vendor?.store_name ? `  |  ${vendor.store_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                  <FileText className="h-4 w-4" /> Print Packing Slip
                </Button>
                {selected.label_url ? (
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <a href={selected.label_url} target="_blank" rel="noreferrer"><Printer className="h-4 w-4" /> Print Shipping Label</a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2" disabled title="Label available after shipment is booked">
                    <Printer className="h-4 w-4" /> Print Shipping Label
                  </Button>
                )}
                {nextStatus ? (
                  <Button size="sm" className="font-semibold" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: selected.id, status: nextStatus })}>
                    Mark as {nextStatus === "processing" ? "Processing" : nextStatus === "shipped" ? "Shipped" : "Delivered"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{order?.payment_status !== "paid" ? "Awaiting payment confirmation" : "Fulfilment complete"}</span>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="admin-card overflow-x-auto p-4 md:p-6">
              <div className="flex min-w-[640px] items-start">
                {STAGES.map((stage, i) => {
                  const done = i < activeStage;
                  const current = i === activeStage;
                  return (
                    <div key={stage.key} className="relative flex-1 text-center">
                      {i > 0 && (
                        <div className={cn("absolute left-0 right-1/2 top-5 h-0.5 -translate-y-1/2", i <= activeStage ? "bg-primary" : "bg-border")} />
                      )}
                      {i < STAGES.length - 1 && (
                        <div className={cn("absolute left-1/2 right-0 top-5 h-0.5 -translate-y-1/2", i < activeStage ? "bg-primary" : "bg-border")} />
                      )}
                      <div className={cn(
                        "relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary bg-background text-primary",
                        !done && !current && "border-border bg-muted text-muted-foreground",
                      )}>
                        {done ? <Check className="h-5 w-5" /> : i === 5 ? <Home className="h-5 w-5" /> : i >= 3 ? <Truck className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <p className={cn("mt-2 text-xs font-semibold", current || done ? "text-foreground" : "text-muted-foreground")}>{stage.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {i === 0 && order?.created_at ? new Date(order.created_at).toLocaleDateString() : stage.caption}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Customer information */}
              <section className="admin-card space-y-3 p-4">
                <h3 className="font-semibold">Customer Information</h3>
                {addr?.fullName && <p className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{addr.fullName}</p>}
                {addr?.email && <p className="flex items-center gap-2 break-all text-sm"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" />{addr.email}</p>}
                {addr?.phone && <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{addr.phone}</p>}
                <div>
                  <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><MapPin className="h-4 w-4" /> Shipping Address</p>
                  <p className="whitespace-pre-line break-words text-sm">{addressLines.filter((l) => l !== addr?.fullName && l !== addr?.phone).join("\n") || "Delivery address unavailable"}</p>
                  {addr && <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={() => copyAddress(addr)}><Copy className="h-3.5 w-3.5" /> Copy address</Button>}
                </div>
              </section>

              {/* Products */}
              <section className="admin-card p-4">
                <h3 className="mb-3 font-semibold">Products (1)</h3>
                <div className="flex gap-3">
                  {image && <img src={image} alt={product?.name || "Product"} className="h-20 w-16 rounded-md border border-border object-cover" />}
                  <div className="min-w-0 flex-1 space-y-1 text-sm">
                    {product?.slug ? (
                      <Link className="font-semibold text-primary hover:underline" to={`/product/${product.slug}`}>{product.name}</Link>
                    ) : <p className="font-semibold">{product?.name || "Product unavailable"}</p>}
                    {variant && <p className="text-xs text-muted-foreground">{variant}</p>}
                    <p className="text-xs text-muted-foreground">Price: {fmtMoney(Number(selected.price))}</p>
                    <div className="flex items-center justify-between pt-1 text-sm">
                      <span className="text-muted-foreground">Qty: {selected.quantity}</span>
                      <span className="font-semibold">{fmtMoney(itemTotal)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Order summary */}
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
              <section className="admin-card space-y-3 p-4">
                <h3 className="font-semibold">Shipping & Tracking</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={tracking.carrier} onValueChange={(v) => setTracking((t) => ({ ...t, carrier: v }))}>
                    <SelectTrigger><SelectValue placeholder="Carrier" /></SelectTrigger>
                    <SelectContent>{CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Tracking number" value={tracking.number} onChange={(e) => setTracking((t) => ({ ...t, number: e.target.value }))} />
                </div>
                <Button size="sm" onClick={() => saveTracking.mutate()} disabled={saveTracking.isPending}>Save</Button>
              </section>

              <section className="admin-card space-y-3 p-4">
                <h3 className="font-semibold">Order Notes</h3>
                <Textarea placeholder="Add a note (visible to you only)…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                <Button size="sm" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>Save Note</Button>
              </section>

              <section className="admin-card space-y-3 p-4">
                <h3 className="font-semibold">Customer Actions</h3>
                <Link to={`/orders/${selected.order_id}/chat`} className="block">
                  <Button size="sm" variant="outline" className="w-full gap-2"><MessageCircle className="h-4 w-4" /> Message Customer</Button>
                </Link>
                {returnRequest && (
                  <Link to={`/orders/${selected.order_id}/chat`} className="block">
                    <Button size="sm" variant="outline" className="w-full gap-2"><RotateCcw className="h-4 w-4" /> View Return Request ({returnRequest.status})</Button>
                  </Link>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorOrders;
