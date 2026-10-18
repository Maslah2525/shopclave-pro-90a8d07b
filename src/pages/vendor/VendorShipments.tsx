import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { FULFILLMENT_QUEUES, vendorFulfillmentQueue, type FulfillmentQueue } from "@/lib/vendorFulfillmentQueue";
import { fulfillmentStageLabel } from "@/components/shipping/FulfillmentProgress";

const VendorShipments = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const [queue, setQueue] = useState<FulfillmentQueue>("packing");
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["vendor-fulfilment-queue", vendor?.id],
    enabled: !!vendor?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data: orderItems, error } = await supabase.from("order_items")
        .select("id, order_id, status, quantity, created_at, products(name)")
        .eq("vendor_id", vendor.id).order("created_at", { ascending: false });
      if (error) throw error;
      if (!orderItems?.length) return [];
      const { data: deliveries, error: deliveryError } = await supabase.rpc("get_vendor_order_delivery_details", {
        p_vendor_id: vendor.id, p_order_ids: [...new Set(orderItems.map((item) => item.order_id))],
      });
      if (deliveryError) throw deliveryError;
      const { data: shipments, error: shipmentError } = await supabase.from("shipments")
        .select("id, status, carrier, service, shipment_items(order_item_id)").eq("vendor_id", vendor.id);
      if (shipmentError) throw shipmentError;
      return orderItems.flatMap((item) => {
        const order = deliveries?.find((order) => order.id === item.order_id);
        const parcels = (shipments ?? []).filter((shipment) => shipment.shipment_items.some((link) => link.order_item_id === item.id));
        const bucket = vendorFulfillmentQueue(item.status, order?.payment_status ?? "", parcels.map((s) => s.status));
        return bucket ? [{ ...item, order, parcels, bucket }] : [];
      });
    },
  });
  const visible = items.filter((item) => item.bucket === queue);

  return (
    <div className="space-y-5">
      <AdminPageHeader title="Fulfilment" subtitle="Packing, labels and delivery." count={items.length} countLabel="paid items" />
      <Tabs value={queue} onValueChange={(value) => setQueue(value as FulfillmentQueue)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:w-auto sm:inline-flex">
          {FULFILLMENT_QUEUES.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="gap-2">{tab.label}<span className="text-xs">{items.filter((item) => item.bucket === tab.value).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading fulfilment…</p> : isError ? (
        <div role="alert" className="space-y-3"><p>Unable to load fulfilment. Please try again.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>
      ) : !visible.length ? (
        <div className="admin-card"><AdminEmptyState icon={Truck} title="No orders in this stage" description="Paid orders appear here when they reach this stage." /></div>
      ) : (
        <div className="admin-card divide-y divide-border">
          {visible.map((item) => (
            <Link key={item.id} to={`/vendor/shipments/${item.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Order #{item.order_id.slice(0, 8).toUpperCase()}</span>
                  <span className="status-pill bg-primary/10 text-primary">{fulfillmentStageLabel(item.status)}</span>
                  <span className="status-pill bg-success/10 text-success">Paid</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.products?.name || "Product"} · Qty {item.quantity}{item.order?.created_at ? ` · ${new Date(item.order.created_at).toLocaleDateString()}` : ""}</p>
                {item.parcels.some((s) => s.carrier) && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.parcels.map((s) => [s.carrier, s.service].filter(Boolean).join(" · ")).filter(Boolean).join(" / ")}</p>}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorShipments;
