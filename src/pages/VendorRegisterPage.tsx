import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function VendorRegisterPage() {
 const { user, loading: authLoading } = useAuth();
 const navigate = useNavigate();
 const [checking, setChecking] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [status, setStatus] = useState<string | null>(null);
 useEffect(() => {
  if (authLoading) return;
  if (!user) { navigate("/auth", { replace: true, state: { from: "/vendor/register" } }); return; }
  let active = true;
  void supabase.from("vendors").select("status").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
   if (!active) return;
   if (error) toast.error("Could not check seller application status.");
   if (data?.status === "approved") { navigate("/vendor/settings", { replace: true }); return; }
   setStatus(data?.status ?? null); setChecking(false);
  });
  return () => { active = false; };
 }, [authLoading, user, navigate]);
 const apply = async () => {
  if (!user || submitting || status) return;
  setSubmitting(true);
  // Placeholder is internal only. Seller must choose a real store name in Settings before listing.
  const { error } = await supabase.from("vendors").insert({
   user_id: user.id, store_name: `Pending Store Setup ${user.id.slice(0, 8)}`,
   status: "pending"
  });
  setSubmitting(false);
  if (error) {
   if (error.code === "23505") { setStatus("pending"); toast.info("Your seller application already exists."); return; }
   toast.error("Unable to submit your seller application. Please try again."); return;
  }
  setStatus("pending"); toast.success("Seller application submitted for admin review.");
 };
 if (authLoading || checking) return <MarketplaceLayout><div className="container py-16 flex justify-center"><Loader2 className="animate-spin" /></div></MarketplaceLayout>;
 return <MarketplaceLayout><main className="container max-w-lg py-12"><section className="rounded-xl border bg-card p-8 text-center space-y-5">
  <Store className="mx-auto h-10 w-10 text-primary" />
  <h1 className="text-2xl font-bold">Become a Seller</h1>
  {status ? <><p role="status">{status === "pending" ? "Your application is awaiting admin approval." : status === "rejected" || status === "suspended" ? "Your seller application is not approved. Contact support for assistance." : `Application status: ${status}`}</p><Button variant="outline" onClick={() => navigate("/account")}>Back to My Account</Button></> :
   <><p className="text-muted-foreground">Apply using your existing Barakaz account. Once approved, complete Store Settings before listing products.</p><Button className="w-full" onClick={() => void apply()} disabled={submitting}>{submitting ? "Submitting…" : "Apply to Become a Seller"}</Button></>}
 </section></main></MarketplaceLayout>;
}
