import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Loader2, ShieldCheck, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { sellerBankingGuidance } from "@/lib/sellerBankingGuidance";

const VendorPayments = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const [busy, setBusy] = useState(false);

  const { data: application, isLoading: applicationLoading, isError: applicationError } = useQuery({
    queryKey: ["vendor-seller-application", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in to manage payouts");
      const { data, error } = await supabase.from("seller_applications")
        .select("id,status,country,business_type")
        .eq("user_id", auth.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payout, isLoading: payoutLoading, isError: payoutError } = useQuery({
    queryKey: ["vendor-stripe-payout", application?.id],
    enabled: !!application?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_payout_accounts")
        .select("provider,verification_status,charges_enabled,payouts_enabled,country,currency")
        .eq("application_id", application!.id).eq("provider", "stripe").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startOnboarding = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("seller-stripe-connect", { body: {} });
      if (error) throw error;
      if (!data?.url || typeof data.url !== "string" || !data.url.startsWith("https://connect.stripe.com/")) {
        throw new Error(data?.error || "Secure onboarding link unavailable");
      }
      window.location.assign(data.url);
    } catch (error: any) {
      toast.error(error?.message || "Unable to start Stripe onboarding");
      setBusy(false);
    }
  };

  const verified = payout?.verification_status === "verified" && payout?.payouts_enabled === true;
  const eligible = application?.country === "CA" &&
    ["draft", "more_information_required"].includes(application?.status || "");
  const loading = applicationLoading || payoutLoading;

  return <div className="space-y-6 max-w-3xl">
    <div>
      <h1 className="text-2xl font-semibold">Payment settings</h1>
      <p className="text-sm text-muted-foreground mt-1">Manage secure seller payout onboarding through Stripe Connect.</p>
    </div>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-primary" />
            <div><CardTitle>Stripe Connect</CardTitle><CardDescription>Secure payout verification and bank details</CardDescription></div>
          </div>
          <Badge variant={verified ? "default" : "outline"}>{verified ? "Payouts enabled" : "Not yet verified"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading payout status…</p>}
        {(applicationError || payoutError) && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Unable to load your payout status. Please refresh or contact support.</AlertDescription></Alert>}
        {!loading && !applicationError && !payoutError && !application && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>A seller application is required before connecting payouts.</AlertDescription></Alert>}
        {!loading && !applicationError && !payoutError && application && <>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Application</p><p className="font-medium capitalize">{application.status.replace(/_/g, " ")}</p></div>
            <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Payout verification</p><p className="font-medium capitalize">{(payout?.verification_status || "Not started").replace(/_/g, " ")}</p></div>
          </div>
          {verified ? <p className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-success" /> Your Stripe payout account is verified and enabled.</p> :
            eligible ? <Button onClick={startOnboarding} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />} {payout ? "Continue Stripe verification" : "Connect Stripe payouts"}</Button> :
            <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Payout onboarding is not enabled for this seller country or application status. Barakaz welcomes global seller applications, but each payout country and business type must be verified with the payment provider before activation.</AlertDescription></Alert>}
          <p className="text-xs text-muted-foreground">{application?.country ? sellerBankingGuidance(application.country) + " " : ""}Stripe securely collects bank and identity details. Barakaz does not request your full banking credentials on this page. Payouts depend on verified provider country support, approval and account verification.</p>
        </>}
      </CardContent>
    </Card>
  </div>;
};
export default VendorPayments;
