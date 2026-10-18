import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { cn } from "@/lib/utils";

const fmtMoney = (n: number) => `$${n.toFixed(2)} CAD`;
const payColor = (s: string) => (s === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning");
const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  processing: "bg-primary/10 text-primary",
  shipped: "bg-[hsl(var(--admin-accent-info))]/10 text-[hsl(var(--admin-accent-info))]",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const VendorOrders = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();

  const { data: orderItems, isLoading, isError, refetch } = useQuery({
    queryKey: ["vendor-orders", vendor?.id],
    queryFn: async () => {
      if (!vendor?.id) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, status, quantity, price, created_at, products(name)")
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

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Orders"
        subtitle="Select an order to open its fulfilment page."
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
        <div className="admin-card divide-y divide-border">
          {orderItems.map((item: any) => (
            <Link
              key={item.id}
              to={`/vendor/orders/${item.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Order #{String(item.order_id).slice(0, 8).toUpperCase()}</span>
                  <span className={cn("status-pill capitalize", statusColor[item.status] || "")}>{item.status}</span>
                  <span className={cn("status-pill", payColor(item.orders?.payment_status))}>
                    {item.orders?.payment_status === "paid" ? "Paid" : "Payment pending"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.products?.name || "Product"} · Qty {item.quantity}
                  {item.orders?.created_at ? ` · ${new Date(item.orders.created_at).toLocaleDateString()}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold">{fmtMoney(Number(item.price) * item.quantity)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorOrders;
