import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOutletContext, Link } from "react-router-dom";
import { Eye, MousePointer, Package, PackageCheck, PackageX, CirclePause, Users, AlertTriangle, ArrowUpCircle, Clock, CheckCircle2, Check, GraduationCap, ChevronRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { PLANS, type Plan, isAdminUnlimited } from "@/lib/subscriptionPlans";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import StoreQRDialog from "@/components/vendor/StoreQRDialog";
import { SITE_URL } from "@/components/seo/SEO";
import { QrCode, ExternalLink } from "lucide-react";
import VendorProfileChecklist from "@/components/vendor/VendorProfileChecklist";
import { vendorProductSummary } from "@/lib/vendorProductSummary";

const VendorDashboard = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const { user, userRoles } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = isAdminUnlimited(userRoles);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [transactionCode, setTransactionCode] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: products, isLoading: productsLoading, error: productsError, refetch: refetchProducts } = useQuery({
    queryKey: ["vendor-products", vendor?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("vendor_id", vendor.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendor,
  });

  const { data: analytics } = useQuery({
    queryKey: ["vendor-analytics", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_analytics")
        .select("event_type")
        .eq("vendor_id", vendor.id);
      return data || [];
    },
    enabled: !!vendor,
  });

  const { data: subscription } = useQuery({
    queryKey: ["vendor-subscription", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("*")
        .eq("vendor_id", vendor.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!vendor,
  });

  const { data: pendingPayment } = useQuery({
    queryKey: ["vendor-pending-payment", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_subscription_payments")
        .select("*")
        .eq("vendor_id", vendor.id)
        .eq("status", "pending_verification")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!vendor,
  });

  const { data: followerCount = 0 } = useQuery({
    queryKey: ["vendor-followers", vendor?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_vendor_follower_count", { v_id: vendor.id });
      return data || 0;
    },
    enabled: !!vendor,
  });

  const { data: featuredResources = [] } = useQuery({
    queryKey: ["dash-featured-resources"],
    queryFn: async () => {
      const { data } = await supabase
        .from("resources")
        .select("id, slug, title, summary, cover_image_url, resource_type, duration_minutes")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("display_order")
        .limit(3);
      return data || [];
    },
  });


  const totalViews = analytics?.filter((a: any) => a.event_type === "view").length || 0;
  const totalClicks = analytics?.filter((a: any) => ["call_click", "whatsapp_click", "website_click"].includes(a.event_type)).length || 0;
  const productSummary = vendorProductSummary(products ?? []);

  const isExpiring = subscription?.expires_at && new Date(subscription.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  const openUpgradeDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setTransactionCode("");
    setPayerPhone("");
    setNotes("");
  };

  const submitPayment = async () => {
    if (!selectedPlan || !vendor || !user) return;
    if (!transactionCode.trim() || !payerPhone.trim()) {
      toast.error("Payment reference and phone number are required");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vendor_subscription_payments").insert({
        vendor_id: vendor.id,
        plan_name: selectedPlan.key,
        price: selectedPlan.price,
        max_listings: selectedPlan.listings,
        expires_days: selectedPlan.expires_days,
        payment_method: "manual",
        transaction_code: transactionCode.trim(),
        payer_phone: payerPhone.trim(),
        notes: notes.trim() || null,
      } as any);
      if (error) throw error;
      toast.success("Payment submitted. Your plan will activate once an admin verifies your payment.");
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ["vendor-subscription", vendor.id] });
      queryClient.invalidateQueries({ queryKey: ["vendor-pending-payment", vendor.id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  const stats = [
    { label: "Product Views", value: totalViews, icon: Eye, color: "text-primary" },
    { label: "Contact Clicks", value: totalClicks, icon: MousePointer, color: "text-success" },
    { label: "Followers", value: followerCount, icon: Users, color: "text-primary" },
  ];
  const productStats = [
    { label: "Total products", value: productSummary.total, icon: Package, color: "text-primary", note: "Your full catalogue" },
    { label: "Active products", value: productSummary.active, icon: PackageCheck, color: "text-success", note: "Live product listings" },
    { label: "Inactive products", value: productSummary.inactive, icon: CirclePause, color: "text-warning", note: `${productSummary.drafts} drafts included` },
    { label: "Out of stock", value: productSummary.outOfStock, icon: PackageX, color: "text-destructive", note: "Zero available units" },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Vendor Overview"
        subtitle={`Welcome back to ${vendor?.store_name || "your store"}. Here's what's happening today.`}
      />
      <VendorProfileChecklist vendor={vendor} />


      {/* Pending payment banner */}
      {pendingPayment && (
        <div className="admin-card flex items-start gap-2.5 p-3 text-sm border-primary/30 bg-primary/5">
          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Payment pending verification</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Your <span className="capitalize font-medium text-foreground">{pendingPayment.plan_name}</span> plan request is awaiting verification. Payment reference <span className="font-mono">{pendingPayment.transaction_code}</span> awaiting admin review.
            </p>
          </div>
        </div>
      )}

      {/* Subscription warning */}
      {isExpiring && !pendingPayment && (
        <div className="admin-card flex items-center gap-2.5 p-3 text-sm border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>Your subscription expires on {subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "—"}. Upgrade or renew below.</span>
        </div>
      )}

      <section className="space-y-3" aria-label="Product overview">
        <div className="flex items-center justify-between gap-3">
          <h2 className="admin-section-label">Product overview</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-xs"><Link to="/vendor/products">Manage products <ChevronRight className="h-3.5 w-3.5" /></Link></Button>
        </div>
        {productsError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>Your product counts could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void refetchProducts()}>Try again</Button></div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {productStats.map(stat => (
              <div key={stat.label} className="admin-card p-4 min-w-0">
                <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{stat.label}</p><stat.icon className={`h-5 w-5 shrink-0 ${stat.color}`} /></div>
                <p className="mt-3 text-3xl font-bold tabular-nums" aria-busy={productsLoading}>{productsLoading ? "—" : stat.value.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">{productsLoading ? "Loading products…" : stat.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Store QR card */}
      {vendor?.slug && (
        <div className="admin-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <QrCode className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Your store QR code</p>
            <p className="text-xs text-muted-foreground">
              Share or print this to send customers straight to your shop.
            </p>
          </div>
          <div className="flex gap-2">
            <StoreQRDialog
              storeUrl={`${SITE_URL}/store/${vendor.slug}`}
              storeName={vendor.store_name}
              logoUrl={vendor.logo_url}
            />
            <Button asChild size="sm" variant="ghost" className="gap-1">
              <Link to={`/store/${vendor.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> View
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-card admin-card-hover p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-muted ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Help & Tutorials */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="admin-section-label flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-primary" /> Barakaz Academy
          </h3>
          <Link to="/vendor/resources" className="text-xs text-primary hover:underline flex items-center gap-0.5">
            Browse all guides <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {featuredResources.length === 0 ? (
          <Link to="/vendor/resources" className="admin-card admin-card-hover p-4 flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><GraduationCap className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Visit Barakaz Academy</p>
              <p className="text-xs text-muted-foreground">Watch quick videos and read step-by-step guides on how to grow your store.</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </Link>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featuredResources.map((r: any) => (
              <Link key={r.id} to={`/vendor/resources/r/${r.slug}`} className="admin-card admin-card-hover overflow-hidden group">
                <div className="aspect-video bg-muted relative">
                  {r.cover_image_url ? (
                    <img src={r.cover_image_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><PlayCircle className="h-10 w-10" /></div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm line-clamp-1">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{r.duration_minutes} min · {r.resource_type}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Viewed Products */}
      {products && products.length > 0 && (
        <div className="space-y-3">
          <h3 className="admin-section-label">Your Products</h3>
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[400px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 10).map((p: any, idx: number) => (
                    <tr key={p.id}>
                      <td className="text-muted-foreground">{idx + 1}</td>
                       <td className="font-medium"><Link className="hover:underline text-primary" to={`/vendor/products/edit/${p.id}`}>{p.name}</Link></td>
                       <td className="font-semibold">CA${Number(p.price).toLocaleString()}</td>
                      <td>
                        <span className={`status-pill ${p.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Upgrade — hidden for admins */}
      {!isAdmin && (
        <div className="space-y-3">
          <h3 className="admin-section-label flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5 text-primary" /> Upgrade Your Plan
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PLANS.filter(p => p.key !== "free").map((plan) => {
              const isCurrent = subscription?.plan_name?.toLowerCase() === plan.key;
              return (
                <div key={plan.key} className={`admin-card admin-card-hover p-4 flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary/20" : ""}`}>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{plan.name}</p>
                    <p className="text-lg font-bold mt-1">${plan.price.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">/month</p>
                  </div>
                  <ul className="mt-3 space-y-1.5 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <p className="text-xs text-primary font-medium mt-3 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Current
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full text-xs"
                      onClick={() => openUpgradeDialog(plan)}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade Payment Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(o) => !o && setSelectedPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              Pay <span className="font-semibold text-foreground">${selectedPlan?.price.toLocaleString()}</span> using the payment details shared by our team, then submit your payment reference.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-secondary rounded-lg p-3 text-sm">
            <p className="text-xs text-muted-foreground">Contact support at support@barakaz.com for the current payment details before submitting your reference.</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Payment Reference / Transaction Code *</Label>
              <Input
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                placeholder="e.g. SGH7K2P3LM"
                maxLength={20}
              />
            </div>
            <div>
              <Label>Phone Number Used *</Label>
              <Input
                value={payerPhone}
                onChange={(e) => setPayerPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                maxLength={20}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional info..."
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          <Button onClick={submitPayment} disabled={submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit Payment & Activate Plan"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorDashboard;
