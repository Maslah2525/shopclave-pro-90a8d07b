import { useEffect, useState } from "react";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import CustomerReturnRequest from "@/components/account/CustomerReturnRequest";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Package,
  User,
  Store,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  CreditCard,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  Heart,
  ShieldCheck,
} from "lucide-react";

const PAYMENT_LABEL: Record<string, string> = {
  mpesa: "M-Pesa",
  card: "Card",
  cod: "Pay on Delivery",
  vendor_payment: "Pay Vendor Directly",
};

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-success/10 text-success",
  shipped: "bg-primary/10 text-primary",
  processing: "bg-primary/10 text-primary",
  confirmed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
};

const TIMELINE = [
  { key: "pending", label: "Placed", Icon: Clock },
  { key: "processing", label: "Processing", Icon: Package },
  { key: "shipped", label: "Shipped", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: PackageCheck },
];

const stepIndex = (status: string) => {
  const idx = TIMELINE.findIndex((t) => t.key === status);
  return idx >= 0 ? idx : 0;
};


const AccountPage = () => {
  const { user, userRoles, signOut } = useAuth();
  const navigate = useNavigate();
  const formatPrice = (amount: number | string | null | undefined) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(amount ?? 0));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: retryOrders } = useQuery({
    queryKey: ["my-orders-detailed", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `*, order_items(*, products(name, vendor_id, vendors(store_name), product_images(url, position)))`
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: returnRequests, isError: returnsError } = useQuery({
    queryKey: ["my-return-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("return_requests")
        .select("id, order_id, order_item_id, status, reason, created_at, refund_amount_cad")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
  });

  if (!user) return null;

  const toggle = (id: string) =>
    setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <MarketplaceLayout>
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">My Account</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/wishlist">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Heart className="h-4 w-4" /> Wishlist
              </Button>
            </Link>
            {!userRoles.includes("vendor") && (
              <Link to="/vendor/register">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Store className="h-4 w-4" /> Become a Seller
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>

        {/* Profile */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{profile?.full_name || "User"}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Orders */}
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" /> My Orders
        </h2>

        {ordersLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading your orders…</div>
        ) : ordersError ? (
          <div role="alert" className="text-center py-12 bg-card rounded-lg border border-border space-y-3"><p>We could not load your orders. Please try again.</p><Button variant="outline" onClick={() => void retryOrders()}>Retry</Button></div>
        ) : orders?.length ? (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const isOpen = !!expanded[order.id];
              const items = order.order_items || [];
              const itemCount = items.reduce(
                (acc: number, it: any) => acc + (it.quantity || 0),
                0
              );
              const subtotal = items.reduce(
                (acc: number, it: any) => acc + Number(it.price) * it.quantity,
                0
              );
              const deliveryFee = Number(order.shipping_amount_cad ?? Math.max(0, Number(order.total) - subtotal));
              const addr = order.shipping_address || {};
              const currentStep = stepIndex(order.status);
              const orderReturns = (returnRequests || []).filter((request) => request.order_id === order.id);
              const showTimeline = !["cancelled", "refunded", "returned"].includes(order.status) && order.payment_status === "paid";

              return (
                <div
                  key={order.id}
                  className="bg-card rounded-lg border border-border overflow-hidden"
                >
                  {/* Collapsed header */}
                  <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()} ·{" "}
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(order.total)}</p>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            STATUS_STYLES[order.status] || STATUS_STYLES.pending
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <Link to={`/orders/${order.id}/chat`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <MessageCircle className="h-3.5 w-3.5" /> Chat
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => toggle(order.id)}
                      >
                        {isOpen ? (
                          <>
                            Hide <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            Details <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-border p-4 space-y-5 bg-muted/30">
                      {/* Timeline */}
                      {showTimeline && <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Status
                        </h3>
                        <div className="flex items-center justify-between gap-1">
                          {TIMELINE.map((step, idx) => {
                            const reached = idx <= currentStep;
                            const Icon = step.Icon;
                            return (
                              <div
                                key={step.key}
                                className="flex-1 flex flex-col items-center"
                              >
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    reached
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {reached && idx < currentStep ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <Icon className="h-4 w-4" />
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] sm:text-xs mt-1 ${
                                    reached
                                      ? "text-foreground font-medium"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>}

                      <div className="flex flex-wrap gap-2">
                        <Link to={`/orders/${order.id}/tracking`}><Button size="sm" variant="outline" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Track parcels</Button></Link>
                        <Link to={`/orders/${order.id}/chat`}><Button size="sm" variant="outline">Discuss return or refund</Button></Link>
                        <Link to={`/orders/${order.id}/chat`}><Button size="sm" variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection / dispute</Button></Link>
                      </div>
                      {orderReturns.length > 0 && <div className="bg-card border border-border rounded-md p-3 space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Return and refund requests</h3>{orderReturns.map((request) => <div key={request.id} className="text-sm flex flex-wrap justify-between gap-2"><span>{request.reason}</span><span className="font-medium">{request.status.replace(/_/g, " ")}</span></div>)}<p className="text-xs text-muted-foreground">A request status does not confirm a refund has reached your payment method.</p></div>}
                      {returnsError && <p role="alert" className="text-xs text-muted-foreground">Return request statuses are temporarily unavailable.</p>}
                      {order.payment_status === "paid" && order.status === "delivered" && items.filter((it: any) => !orderReturns.some((r) => r.order_item_id === it.id && !["rejected", "cancelled"].includes(r.status))).map((it: any) => <div key={it.id} className="mb-2"><p className="text-sm mb-1">Return: {it.products?.name || "Item"}</p><CustomerReturnRequest orderItemId={it.id} maxQuantity={it.quantity} userId={user.id} /></div>)}
                      {/* Items */}
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Items
                        </h3>
                        <div className="space-y-2">
                          {items.map((it: any) => {
                            const product = it.products;
                            const images = product?.product_images || [];
                            const sorted = [...images].sort(
                              (a: any, b: any) => (a.position || 0) - (b.position || 0)
                            );
                            const thumb = sorted[0]?.url;
                            const variantLabel =
                              it.variant_options &&
                              typeof it.variant_options === "object"
                                ? (it.variant_options as any).label
                                : null;
                            return (
                              <div
                                key={it.id}
                                className="flex items-center gap-3 bg-card border border-border rounded-md p-2.5"
                              >
                                <div className="w-12 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={product?.name || "Product"}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <Package className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {product?.name || "Product"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {product?.vendors?.store_name && (
                                      <>by {product.vendors.store_name} · </>
                                    )}
                                    {variantLabel && <>{variantLabel} · </>}
                                    Qty {it.quantity}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-semibold">
                                    {formatPrice(Number(it.price) * it.quantity)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {formatPrice(Number(it.price))} each
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Totals + Payment + Address */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-card border border-border rounded-md p-3 space-y-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5" /> Payment
                          </h3>
                          <p className="text-sm">
                            {PAYMENT_LABEL[order.payment_method] ||
                              order.payment_method ||
                              "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status:{" "}
                            <span className="font-medium text-foreground">
                              {order.payment_status}
                            </span>
                          </p>
                          <div className="border-t border-border pt-2 mt-2 space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Delivery</span>
                              <span>{formatPrice(deliveryFee)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-sm pt-1">
                              <span>Total</span>
                              <span>{formatPrice(order.total)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-card border border-border rounded-md p-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
                            <MapPin className="h-3.5 w-3.5" /> Deliver to
                          </h3>
                          <div className="text-sm space-y-0.5">
                            <p className="font-medium">{addr.fullName || "—"}</p>
                            <p className="text-muted-foreground">{addr.phone}</p>
                            <p>{addr.addressLine}</p>
                            <p className="text-muted-foreground">
                              {addr.city}
                              {addr.country ? `, ${addr.country}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No orders yet</p>
            <Link to="/">
              <Button className="mt-4" size="sm">Start Shopping</Button>
            </Link>
          </div>
        )}
      </div>
    </MarketplaceLayout>
  );
};

export default AccountPage;
