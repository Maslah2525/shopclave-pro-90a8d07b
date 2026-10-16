import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { CreditCard, Loader2, ShieldCheck, AlertCircle, ExternalLink, Landmark } from "lucide-react";
import { toast } from "sonner";
import { sellerBankingGuidance, sellerBankFields } from "@/lib/sellerBankingGuidance";

/** Countries offered in the payout country picker. Availability is still
 * gated server-side by seller_country_requirements — this list is only the
 * presentation of countries Barakaz intends to support. */
const PAYOUT_COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
];

const VendorPayments = () => {
  const { vendor } = useOutletContext<{ vendor: any }>();
  const [busy, setBusy] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");

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

  // Default the picker to the seller's application country once loaded.
  useEffect(() => {
    if (!selectedCountry && application?.country) setSelectedCountry(application.country);
  }, [application?.country, selectedCountry]);

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
  const loading = applicationLoading || payoutLoading;
  const country = selectedCountry || application?.country || "";
  // Onboarding is only possible when the picked country matches the seller's
  // approved application country; the server re-checks this and the enabled
  // country rules before creating any Connect account (fail closed).
  const countryMatchesApplication = !!application?.country && country === application.country;
  const eligible = countryMatchesApplication &&
    ["draft", "more_information_required"].includes(application?.status || "");

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
          <div className="space-y-2">
            <Label htmlFor="payout-country">Payout country</Label>
            <select
              id="payout-country"
              value={country}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {!country && <option value="">Select your country</option>}
              {PAYOUT_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Choose the country where your payout bank account is held. The bank details below update to match.</p>
          </div>

          {country && <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Bank details for {PAYOUT_COUNTRIES.find((c) => c.code === country)?.name ?? country}</p>
            </div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {sellerBankFields(country).map((field) => <li key={field}>{field}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground">{sellerBankingGuidance(country)}</p>
          </div>}

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Application</p><p className="font-medium capitalize">{application.status.replace(/_/g, " ")}</p></div>
            <div className="rounded border p-3"><p className="text-xs text-muted-foreground">Payout verification</p><p className="font-medium capitalize">{(payout?.verification_status || "Not started").replace(/_/g, " ")}</p></div>
          </div>

          {verified ? <p className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-success" /> Your Stripe payout account is verified and enabled.</p> :
            !countryMatchesApplication && country ? <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Your seller application is registered in {application.country}. Payout onboarding must use the same country as your application. Contact support if your business country has changed.</AlertDescription></Alert> :
            eligible ? <Button onClick={startOnboarding} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />} {payout ? "Continue Stripe verification" : "Connect Stripe payouts"}</Button> :
            <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Payout onboarding is not enabled for this seller country or application status. Barakaz welcomes global seller applications, but each payout country and business type must be verified with the payment provider before activation.</AlertDescription></Alert>}
          <p className="text-xs text-muted-foreground">Stripe securely collects bank and identity details. Barakaz does not request your full banking credentials on this page. Payouts depend on verified provider country support, approval and account verification.</p>
        </>}
      </CardContent>
    </Card>
  </div>;
};
export default VendorPayments;
