import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, Package, MapPin, Phone, CreditCard } from "lucide-react";
import { useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

const statusPill = (s: string) => {
  if (s === "delivered") return "bg-success/10 text-success";
  if (s === "shipped") return "bg-[hsl(var(--admin-accent-info))]/10 text-[hsl(var(--admin-accent-info))]";
  if (s === "processing") return "bg-warning/10 text-warning";
  if (s === "cancelled") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

const AdminOrders = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["admin-orders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: orderItems, isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: ["admin-order-items-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(name, slug), vendors(store_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const filtered =
    orders?.filter(
      (o: any) =>
        o.id.includes(filter) || o.status.includes(filter.toLowerCase())
    ) || [];

  const getItemsForOrder = (orderId: string) =>
    orderItems?.filter((i: any) => i.order_id === orderId) || [];

  return (
    <div>
      <AdminPageHeader title="All Orders" subtitle="Track and review every order placed on the marketplace." count={filtered.length} countLabel="orders">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by order ID or status..."
            className="pl-9 h-9 bg-card"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </AdminPageHeader>

      {(ordersError || itemsError) && <p role="alert" className="text-destructive mb-4">Unable to load all orders or order items. Please retry after checking database permissions and connectivity.</p>}
      {(ordersLoading || itemsLoading) ? <p className="text-sm text-muted-foreground">Loading orders and order items…</p> : (ordersError || itemsError) ? null : filtered.length === 0 ? (
        <div className="admin-card">
          <AdminEmptyState
            icon={Package}
            title={filter ? "No orders match your filter" : "No orders yet"}
            description={filter ? "Try a different ID or status." : "When customers place orders they will appear here."}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o: any) => {
            const items = getItemsForOrder(o.id);
            const isExpanded = expandedOrder === o.id;
            return (
              <div key={o.id} className="admin-card admin-card-hover overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-primary/5 transition-colors"
                  onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                >
                  <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded font-semibold">
                      #{o.id.slice(0, 8)}
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      ${Number(o.total).toLocaleString()}
                    </span>
                    <span className={`status-pill ${o.payment_status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                      {o.payment_status}
                    </span>
                    <span className={`status-pill ${statusPill(o.status)}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {o.shipping_address && (
                      <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex flex-wrap gap-x-5 gap-y-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <strong className="text-foreground">{(o.shipping_address as any).fullName}</strong>
                          — {(o.shipping_address as any).addressLine}, {(o.shipping_address as any).city}
                        </span>
                        {(o.shipping_address as any).phone && (
                          <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {(o.shipping_address as any).phone}</span>
                        )}
                        <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {o.payment_method || "—"}</span>
                      </div>
                    )}

                    {items.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No items found for this order.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Vendor</th>
                              <th>Qty</th>
                              <th>Price</th>
                              <th>Commission</th>
                              <th>Item Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item: any) => (
                              <tr key={item.id}>
                                <td className="font-medium">
                                  <div>{(item.products as any)?.name || "—"}</div>
                                  {(item.variant_options as any)?.label && (
                                    <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                      {(item.variant_options as any).label}
                                    </span>
                                  )}
                                </td>
                                <td className="text-muted-foreground text-xs">{(item.vendors as any)?.store_name || "—"}</td>
                                <td>{item.quantity}</td>
                                <td>${(Number(item.price) * item.quantity).toLocaleString()}</td>
                                <td className="text-xs text-muted-foreground">${Number(item.commission_amount).toLocaleString()}</td>
                                <td><span className={`status-pill ${statusPill(item.status)}`}>{item.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
