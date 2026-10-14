import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Truck } from "lucide-react";
import TrackingTimeline, { SHIPMENT_STATUS_LABELS } from "@/components/shipping/TrackingTimeline";
import { useLocale } from "@/hooks/useLocale";
import { hasShipped } from "@/lib/orderTracking";

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const { formatPrice } = useLocale();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order-tracking", orderId],
    enabled: !!orderId,
    refetchInterval: 60000,
    queryFn: async () => {
      const [orderResult, shipmentResult, itemResult] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId!).maybeSingle(),
        supabase
          .from("shipments")
          .select("*, vendors(store_name)")
          .eq("order_id", orderId!)
          .order("created_at", { ascending: true }),
        supabase
          .from("order_items")
          .select("id, quantity, price, vendor_id, products(name)")
          .eq("order_id", orderId!),
      ]);

      if (orderResult.error) throw orderResult.error;
      if (shipmentResult.error) throw shipmentResult.error;
      if (itemResult.error) throw itemResult.error;
      const order = orderResult.data;
      const shipments = shipmentResult.data;
      const items = itemResult.data;
      const shipmentIds = (shipments || []).map((s: any) => s.id);
      const { data: events, error: eventsError } = shipmentIds.length
        ? await supabase
            .from("tracking_events")
            .select("*")
            .in("shipment_id", shipmentIds)
        : { data: [] as any[], error: null };
      if (eventsError) throw eventsError;

      return { order, shipments: shipments || [], items: items || [], events: events || [] };
    },
  });

  if (isLoading) {
    return (
      <MarketplaceLayout>
        <div className="container py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MarketplaceLayout>
    );
  }

  if (isError) {
    return <MarketplaceLayout><div className="container py-20 text-center space-y-4" role="alert"><p>Tracking information is temporarily unavailable. Please try again.</p><Button variant="outline" onClick={() => void refetch()}>Retry tracking</Button></div></MarketplaceLayout>;
  }

  if (!data?.order) {
    return (
      <MarketplaceLayout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground mb-6">We couldn't find that order.</p>
          <Link to="/account">
            <Button>Back to my orders</Button>
          </Link>
        </div>
      </MarketplaceLayout>
    );
  }

  const { order, shipments, items, events } = data;

  return (
    <MarketplaceLayout>
      <div className="container py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Track your order</h1>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono">#{order.id.slice(0, 8)}</span> •{" "}
            {new Date(order.created_at).toLocaleDateString()} • {formatPrice(Number(order.total))}
          </p>
        </div>

        {order.payment_status !== "paid" && (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Payment is not yet confirmed for this order. Shipping progress is not guaranteed until payment is confirmed.</div>
        )}

        {shipments.length === 0 && (
          <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            <Package className="h-5 w-5 mb-2 text-muted-foreground" />
            Your parcels haven't been created yet. This page updates automatically once the seller
            prepares your shipment.
          </div>
        )}

        {shipments.map((s: any, idx: number) => {
          const sEvents = events.filter((e: any) => e.shipment_id === s.id);
          const sItems = items.filter((i: any) => i.vendor_id === s.vendor_id);
          return (
            <div key={s.id} className="rounded-lg border border-border p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">
                    Parcel {idx + 1} — {s.vendors?.store_name || "Seller"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasShipped(s.status) && s.carrier
                      ? `${s.carrier}${s.service ? ` • ${s.service}` : ""}`
                      : "Carrier and tracking appear once your parcel ships"}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {SHIPMENT_STATUS_LABELS[s.status] || s.status}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                {sItems.map((i: any) => (
                  <p key={i.id} className="text-muted-foreground">
                    {i.quantity} × {i.products?.name || "Item"}
                  </p>
                ))}
              </div>

              <div className="text-xs text-muted-foreground space-y-1 break-words">
                {hasShipped(s.status) && s.tracking_number && (
                  <p>
                    Tracking number: <span className="font-mono">{s.tracking_number}</span>
                    {s.tracking_url && (
                      <>
                        {" — "}
                        <a
                          href={s.tracking_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          open carrier page
                        </a>
                      </>
                    )}
                  </p>
                )}
                {s.estimated_delivery && (
                  <p>Estimated delivery: {new Date(s.estimated_delivery).toLocaleDateString()}</p>
                )}
                {!hasShipped(s.status) && <p>Tracking details are not yet confirmed by a carrier.</p>}
                <p className="inline-flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Shipping {formatPrice(Number(s.shipping_amount_cad))}
                </p>
              </div>

              <TrackingTimeline events={sEvents} />
            </div>
          );
        })}
      </div>
    </MarketplaceLayout>
  );
};

export default OrderTrackingPage;
