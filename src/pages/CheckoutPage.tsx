import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import MarketplaceLayout from "@/components/layout/MarketplaceLayout";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, MapPin, Truck, CreditCard, ArrowLeft, Lock, ShieldCheck, RotateCcw, Pencil, ShoppingBag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/hooks/useLocale";
import CheckoutLoader from "@/components/checkout/CheckoutLoader";
import { validateStripeCheckoutUrl, logHandoff } from "@/lib/stripeHandoff";
import { estimateDeliveryWindow, formatDeliveryWindow, transitDaysForService, deliveryItemsLabel, readDeliveryPreference } from "@/lib/deliveryEstimate";
import { COUNTRIES, DEFAULT_COUNTRY, countryByCode, countryByName, searchCountries, addressFormat, validatePostal, isDomesticDestination } from "@/lib/countries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

type Step = "address" | "delivery" | "review" | "payment";

const PENDING_STRIPE_ORDER_KEY = "barakaz_pending_stripe_order";

type PendingStripeOrder = {
  signature: string;
  orderId: string;
  userId: string;
  cartFingerprint: string;
};

const readPendingStripeOrder = (): PendingStripeOrder | null => {
  try {
    const saved = sessionStorage.getItem(PENDING_STRIPE_ORDER_KEY);
    return saved ? JSON.parse(saved) as PendingStripeOrder : null;
  } catch {
    return null;
  }
};

const showPaymentWindowLoader = (paymentWindow: Window) => {
  paymentWindow.document.title = "Opening Stripe | Barakaz";
  paymentWindow.document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;margin:0;background:#fff7f3;color:#201a18;font-family:system-ui,sans-serif">
      <div style="padding:32px;text-align:center">
        <div style="width:44px;height:44px;margin:0 auto 18px;border:4px solid #ffd3c5;border-top-color:#ff420e;border-radius:50%;animation:spin .8s linear infinite"></div>
        <h1 style="margin:0 0 8px;font-size:20px">Preparing secure checkout…</h1>
        <p style="margin:0;color:#6f625e;font-size:14px">Stripe will open here shortly.</p>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){div{animation:none!important}}</style>
    </main>`;
};

const CheckoutPage = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const { formatPrice, country } = useLocale();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const cardProvider = "stripe" as const;
  const [activeStep, setActiveStep] = useState<Step>("address");
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const location = useLocation();
  const hasCheckedRef = useRef(false);
  const pendingOrderRef = useRef<PendingStripeOrder | null>(null);
  const [checkoutStage, setCheckoutStage] = useState<"order" | "payment" | "redirect" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState<string | null>(null);
  const cartFingerprint = JSON.stringify(items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    variantId: item.variantId ?? null,
    price: item.price,
  })));

  useEffect(() => {
    const pending = readPendingStripeOrder();
    if (pending && pending.cartFingerprint !== cartFingerprint) {
      sessionStorage.removeItem(PENDING_STRIPE_ORDER_KEY);
      pendingOrderRef.current = null;
    }
  }, [cartFingerprint]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("payment_cancelled")) {
      toast.info("Payment was cancelled. Your cart is saved — you can try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    addressLine: "",
    city: "",
    country: countryByCode(DEFAULT_COUNTRY)!.name,
    state: "",
    zip: "",
    email: "",
  });
  const [countryOpen, setCountryOpen] = useState(false);
  const selectedCountry = countryByName(address.country);
  const countryCode = selectedCountry?.code ?? "";
  const fmt = addressFormat(countryCode);
  const domestic = isDomesticDestination(countryCode);
  void country;
  // Prefill email from auth user
  useEffect(() => {
    if (user?.email) {
      setAddress((a) => (a.email ? a : { ...a, email: user.email ?? "" }));
    }
  }, [user?.email]);

  // Redirect to cart if empty - but skip on first render if coming from Buy Now
  useEffect(() => {
    if (hasCheckedRef.current && items.length === 0) {
      navigate("/cart", { replace: true });
    }
    // After first render, mark as checked
    const timer = setTimeout(() => { hasCheckedRef.current = true; }, 500);
    return () => clearTimeout(timer);
  }, [items.length, navigate]);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  // Load saved address
  const { data: savedAddress } = useQuery({
    queryKey: ["user-address", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (savedAddress) {
      setAddress((prev) => ({
        fullName: savedAddress.full_name,
        phone: savedAddress.phone || "",
        addressLine: savedAddress.address_line,
        city: savedAddress.city,
        country: savedAddress.country,
        state: (savedAddress as any).state || "",
        zip: (savedAddress as any).postal_code || (savedAddress as any).zip || "",
        email: prev.email || user?.email || "",
      }));
      setAddressConfirmed(true);
      setActiveStep("delivery");
    }
  }, [savedAddress, user?.email]);

  if (items.length === 0 || !user) {
    return null; // useEffect handles redirect
  }

  // Group items by vendor
  const vendorIds = [...new Set(items.map(i => i.vendorId))];
  const vendorGroups = items.reduce((acc, item) => {
    const key = item.vendorId;
    if (!acc[key]) acc[key] = { vendorName: item.vendorName, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { vendorName: string; items: typeof items }>);

  // Fetch vendor payment details via SECURITY DEFINER RPC (table access to
  // payment_details is restricted; the RPC requires an authenticated caller).
  const { data: vendorPaymentDetails } = useQuery({
    queryKey: ["vendor-payment-details", vendorIds],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_vendor_payment_details", {
        _vendor_ids: vendorIds,
      });
      return data || [];
    },
    enabled: vendorIds.length > 0,
  });

  // Seller handling days (max per vendor) for delivery-date estimates.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const { data: handlingRows } = useQuery({
    queryKey: ["checkout-handling-days", productIds],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, vendor_id, handling_time_days").in("id", productIds);
      return data || [];
    },
    enabled: productIds.length > 0,
  });
  const handlingByVendor: Record<string, number> = {};
  (handlingRows || []).forEach((r) => {
    handlingByVendor[r.vendor_id] = Math.max(handlingByVendor[r.vendor_id] ?? 0, r.handling_time_days ?? 1);
  });
  const windowFor = (vendorId: string, service: string) =>
    formatDeliveryWindow(
      estimateDeliveryWindow({
        from: new Date(),
        ...transitDaysForService(service),
        handlingDays: handlingByVendor[vendorId] ?? 1,
        province: address.country === "Canada" ? address.state : undefined,
      }),
    );



  // Live shipping rates from Shippo (keyed by vendor_id)
  const [shippingRates, setShippingRates] = useState<Record<string, any[]>>({});
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});
  const [fallbackOrigin, setFallbackOrigin] = useState<Record<string, boolean>>({});
  const [selectedRates, setSelectedRates] = useState<Record<string, any>>({});
  const [ratesLoading, setRatesLoading] = useState(false);

  // Server-calculated Canadian sales tax (never computed in the browser).
  type TaxQuote =
    | { ok: true; province: string; total_tax_cad: number; components: Array<{ component: string; rate_percent: number; tax_cad: number }> }
    | { ok: false; message: string };
  const [taxQuote, setTaxQuote] = useState<TaxQuote | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  const shippingTotal = Object.values(selectedRates).reduce(
    (s: number, r: any) => s + Number(r?.amount_cad || 0),
    0
  );
  const taxTotal = taxQuote?.ok ? Number(taxQuote.total_tax_cad) : 0;
  const grandTotal = totalPrice + shippingTotal + taxTotal;

  const etaLabel = (days: number | null | undefined) => {
    if (!days || days <= 0) return "Carrier ETA unavailable";
    const arrival = new Date(); arrival.setDate(arrival.getDate() + days);
    return "Estimated " + arrival.toLocaleDateString("en-CA", { day: "2-digit", month: "short" });
  };
  // Delivery dates
  const deliveryStart = new Date();
  deliveryStart.setDate(deliveryStart.getDate() + 3);
  const deliveryEnd = new Date();
  deliveryEnd.setDate(deliveryEnd.getDate() + 7);
  const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });

  // Ask the server for the sales tax owed on this cart when the review step opens.
  const quoteIdSignature = Object.values(selectedRates).map((r: any) => r?.quote_id).filter(Boolean).join(",");
  useEffect(() => {
    if (activeStep !== "review" || !deliveryConfirmed || items.length === 0) return;
    let cancelled = false;
    setTaxLoading(true);
    supabase.functions
      .invoke("tax-quote", {
        body: {
          province: address.state,
          country: address.country,
          items: items.map((it) => ({
            product_id: it.productId,
            quantity: it.quantity,
            variant_id: it.variantId || null,
          })),
          shipping_quote_ids: Object.values(selectedRates).map((r: any) => r.quote_id).filter(Boolean),
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setTaxQuote({ ok: false, message: "We couldn't calculate sales tax right now. Please try again." });
          return;
        }
        setTaxQuote(data as TaxQuote);
      })
      .finally(() => { if (!cancelled) setTaxLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, deliveryConfirmed, address.state, address.country, quoteIdSignature, items.length]);

  // Fetch live shipping rates when entering delivery step
  useEffect(() => {
    if (activeStep !== "delivery" || !addressConfirmed) return;
    if (ratesLoading) return;
    if (Object.keys(shippingRates).length > 0) return;

    let cancelled = false;
    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-shipping-rates", {
          body: {
            items: items.map((it) => ({
              product_id: it.productId,
              quantity: it.quantity,
              variant_id: it.variantId || null,
            })),
            shipping_address: address,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        const rateMap: Record<string, any[]> = {};
        const errMap: Record<string, string> = {};
        const fbMap: Record<string, boolean> = {};
        const autoSelect: Record<string, any> = {};
        (data?.vendors || []).forEach((v: any) => {
          if (v.blocked) errMap[v.vendor_id] = v.message;
          rateMap[v.vendor_id] = v.rates || [];
          if (v.rates?.length) {
            const preferredService = readDeliveryPreference(v.vendor_id);
            autoSelect[v.vendor_id] = v.rates.find((rate: any) => rate.service === preferredService) || v.rates[0];
          }
        });
        setShippingRates(rateMap);
        setShippingErrors(errMap);
        setFallbackOrigin(fbMap);
        setSelectedRates(autoSelect);
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || "Could not fetch shipping rates");
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    };
    fetchRates();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, addressConfirmed]);

  const changeCountry = (code: string) => {
    const c = countryByCode(code);
    setCountryOpen(false);
    if (!c || c.code === countryCode) return;
    // Stale region/postal/quotes never carry across countries.
    setAddress((a) => ({ ...a, country: c.name, state: "", zip: "" }));
    setShippingRates({});
    setSelectedRates({});
    setShippingErrors({});
    setFallbackOrigin({});
    setAddressConfirmed(false);
    setDeliveryConfirmed(false);
  };

  const handleConfirmAddress = () => {
    if (!address.fullName || !address.phone || !address.addressLine || !address.city) {
      toast.error("Please fill in all address fields");
      return;
    }
    if (!domestic) {
      toast.error("International shipping isn't available yet. We currently deliver within Canada only.");
      return;
    }
    if (!address.state) { toast.error("Please select your province or territory"); return; }
    const postalErr = validatePostal(countryCode, address.zip);
    if (postalErr) { toast.error(postalErr); return; }
    // Reset rates so they re-fetch for the (possibly updated) address
    setShippingRates({});
    setSelectedRates({});
    setShippingErrors({});
    setFallbackOrigin({});
    setAddressConfirmed(true);
    setActiveStep("delivery");
  };

  const handleConfirmDelivery = () => {
    setDeliveryConfirmed(true);
    setActiveStep("review");
  };

  // Manual, user-gesture handoff. Works when auto-redirect or pop-ups were blocked.
  const handleContinueToStripe = () => {
    const url = validateStripeCheckoutUrl(stripeCheckoutUrl);
    const framed = window.top !== window.self;
    const orderRef = pendingOrderRef.current?.orderId ?? readPendingStripeOrder()?.orderId;
    if (!url) {
      logHandoff("invalid_checkout_url", { framed, orderRef });
      setStripeCheckoutUrl(null);
      setCheckoutError("The payment link expired. Tap Try again to get a new one.");
      return;
    }
    logHandoff("manual_continue_clicked", { framed, orderRef });
    if (framed) {
      // Framed preview: parent navigation is blocked, so open a new top-level tab from this click.
      const opened = window.open(url, "_blank", "noopener");
      if (!opened) {
        // With noopener some browsers return null even on success; fall back to a direct anchor click.
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return;
    }
    window.location.assign(url);
  };

  const handlePlaceOrder = async () => {
    if (loading) return;
    const isFramed = window.top !== window.self;
    const paymentWindow = paymentMethod === "card" && isFramed
      ? window.open("about:blank", "_blank")
      : null;
    if (paymentMethod === "card" && isFramed && !paymentWindow) {
      // Don't stop: we'll still prepare the session and show the manual Continue button.
      logHandoff("popup_blocked", { framed: true });
    }
    if (paymentWindow) showPaymentWindowLoader(paymentWindow);
    setLoading(true);
    setCheckoutError(null);
    setStripeCheckoutUrl(null);
    setCheckoutStage("order");
    let redirecting = false;
    try {
      // Check session validity before placing order
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth", { replace: true });
        return;
      }

      const orderPayload = {
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          variant_id: item.variantId || null,
          variant_label: item.variantLabel || null,
        })),
        shipping_address: address,
        payment_method: paymentMethod,
        // Only opaque quote ids — the server owns every shipping price.
        shipping_quote_ids: Object.values(selectedRates).map((r: any) => r.quote_id),
      };
      const signature = JSON.stringify({
        items: orderPayload.items,
        shippingAddress: orderPayload.shipping_address,
        paymentMethod: orderPayload.payment_method,
        cardProvider,
        rates: Object.values(selectedRates).map((rate: any) => ({
          vendorId: rate.vendor_id,
          provider: rate.provider,
          service: rate.service,
          amountCad: Number(rate.amount_cad),
        })),
      });

      // Retry safety: reuse the unpaid order created for this exact cart instead of creating a duplicate.
      const savedPendingOrder = readPendingStripeOrder();
      const reusablePendingOrder = pendingOrderRef.current?.signature === signature
        ? pendingOrderRef.current
        : savedPendingOrder?.signature === signature &&
            savedPendingOrder.userId === user.id &&
            savedPendingOrder.cartFingerprint === cartFingerprint
          ? savedPendingOrder
          : null;
      let orderId: string | null = reusablePendingOrder?.orderId ?? null;

      if (!orderId) {
        const { data, error } = await supabase.functions.invoke("create-order", { body: orderPayload });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        orderId = data.order_id as string;
        if (paymentMethod === "card") {
          const pendingOrder = { signature, orderId, userId: user.id, cartFingerprint };
          pendingOrderRef.current = pendingOrder;
          sessionStorage.setItem(PENDING_STRIPE_ORDER_KEY, JSON.stringify(pendingOrder));
        }
      }

      // Card payments use Stripe-hosted checkout.
      if (paymentMethod === "card") {
        setCheckoutStage("payment");
        const isStripe = true;
        const functionName = "stripe-initialize";
        const { data: paymentData, error: paymentErr } = await supabase.functions.invoke(
          functionName,
          { body: { order_id: orderId } }
        );
        if (paymentErr) throw paymentErr;
        if (paymentData?.error) throw new Error(paymentData.error);
        const rawUrl: string | undefined = paymentData?.url;
        const payUrl = validateStripeCheckoutUrl(rawUrl);
        if (!payUrl) {
          if (isStripe) logHandoff("invalid_checkout_url", { framed: isFramed, orderRef: orderId });
          throw new Error("We couldn't open the secure Stripe payment page.");
        }
        if (isStripe && typeof paymentData.amount === "number" && Math.abs(paymentData.amount - grandTotal) > 0.01) {
          throw new Error(
            `Your total changed to CA$${paymentData.amount.toFixed(2)}. Please review your order before paying.`
          );
        }
        setCheckoutStage("redirect");
        redirecting = true;
        // Durable fallback: always show a manual Continue button once a valid session exists.
        if (isStripe) setStripeCheckoutUrl(payUrl);
        const stopLoader = (reason: string) => {
          if (isStripe) logHandoff("auto_redirect_stalled", { framed: isFramed, orderRef: orderId, reason });
          setLoading(false);
          setCheckoutStage(null);
        };
        // A framed preview cannot navigate its parent after asynchronous server calls.
        // Use the window opened directly by the original customer click instead.
        if (paymentWindow && !paymentWindow.closed) {
          try {
            paymentWindow.location.replace(payUrl);
            logHandoff("auto_redirect_started", { framed: true, orderRef: orderId });
          } catch {
            paymentWindow.close();
          }
          stopLoader("new_window");
          return;
        }
        if (isFramed) {
          stopLoader("framed_no_window");
          return;
        }
        logHandoff("auto_redirect_started", { framed: false, orderRef: orderId });
        window.location.assign(payUrl);
        // If navigation hasn't happened after a few seconds, reveal the manual button.
        window.setTimeout(() => {
          if (document.visibilityState === "visible") stopLoader("timeout");
        }, 4000);
        return;
      }

      clearCart();
      toast.success("Order placed successfully!");
      navigate(`/order-confirmation/${orderId}`);
    } catch (err: any) {
      paymentWindow?.close();
      if (paymentMethod === "card") logHandoff("initialize_failed", { framed: isFramed, reason: err?.name || "error" });
      if (err.message?.includes("Refresh Token") || err.message?.includes("Unauthorized")) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/auth", { replace: true });
      } else {
        let message = err.message || "Failed to place order";
        try {
          const body = await err?.context?.json?.();
          if (body?.error) message = body.error;
        } catch { /* keep message */ }
        setCheckoutError(message);
        toast.error(message);
      }
    } finally {
      if (!redirecting) {
        setLoading(false);
        setCheckoutStage(null);
      }
    }
  };

  const stepDone = (step: Step) => {
    if (step === "address") return addressConfirmed;
    if (step === "delivery") return deliveryConfirmed;
    if (step === "review") return activeStep === "payment";
    return false;
  };

  const stepNumber = (step: Step) => {
    if (step === "address") return 1;
    if (step === "delivery") return 2;
    if (step === "review") return 3;
    return 4;
  };

  const StepHeader = ({ step, title }: { step: Step; title: string }) => (
    <div
      className={`flex items-center gap-3 p-4 cursor-pointer ${activeStep === step ? "" : "opacity-70"}`}
      onClick={() => {
        if (step === "address") setActiveStep("address");
        if (step === "delivery" && addressConfirmed) setActiveStep("delivery");
        if (step === "review" && deliveryConfirmed) setActiveStep("review");
      }}
    >
      {stepDone(step) ? (
        <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
      ) : (
        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
          activeStep === step ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground/50"
        }`}>
          {stepNumber(step)}
        </div>
      )}
      <span className={`text-sm font-bold tracking-wider uppercase ${activeStep === step ? "text-foreground" : "text-muted-foreground"}`}>
        {title}
      </span>
      {stepDone(step) && activeStep !== step && (
        <button className="ml-auto text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Change <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );

  return (
    <MarketplaceLayout>
      <CheckoutLoader stage={checkoutStage} provider={paymentMethod === "card" ? cardProvider : null} />
      <div className="container px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/cart" className="text-sm text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Go back & continue shopping
          </Link>
        </div>

        <div className={activeStep === "review" ? "grid grid-cols-1 gap-6" : "grid lg:grid-cols-[1fr_320px] gap-6"}>
          {/* Left: Steps */}
          <div className="space-y-4">
            {/* Step 1: Address */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <StepHeader step="address" title="Customer Address" />
              {activeStep === "address" && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Full Name</Label>
                      <Input value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs" htmlFor="checkout-phone">Phone Number</Label>
                      <div className="flex">
                        <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-2 text-xs text-muted-foreground" aria-label={`Dial code ${selectedCountry?.name ?? ""}`}>
                          {selectedCountry ? `${selectedCountry.code} ${selectedCountry.dial}` : "+"}
                        </span>
                        <Input id="checkout-phone" type="tel" className="rounded-l-none" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder={countryCode === "CA" ? "416 555 0123" : "Phone number"} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input value={address.addressLine} onChange={(e) => setAddress({ ...address, addressLine: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs" id="country-label">Country</Label>
                      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" role="combobox" aria-expanded={countryOpen} aria-labelledby="country-label" className="w-full justify-between font-normal">
                            <span className="truncate">{selectedCountry?.name ?? "Select country"}</span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command filter={(value, search) => (searchCountries(search).some((c) => c.code === value) ? 1 : 0)}>
                            <CommandInput placeholder="Search country…" />
                            <CommandList>
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandGroup>
                                {COUNTRIES.map((c) => (
                                  <CommandItem key={c.code} value={c.code} onSelect={() => changeCountry(c.code)}>
                                    <Check className={`mr-2 h-4 w-4 ${c.code === countryCode ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />
                                    <span className="flex-1 truncate">{c.name}</span>
                                    <span className="text-xs text-muted-foreground">{c.dial}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {countryCode === "CA" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Province / Territory</Label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })}>
                          <option value="">Select province</option>
                          {["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div><Label className="text-xs">Postal Code</Label><Input value={address.zip} maxLength={7} placeholder="K1A 0B1" onChange={(e) => setAddress({ ...address, zip: e.target.value.toUpperCase() })} /></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">{fmt.regionLabel}</Label><Input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} /></div>
                      <div><Label className="text-xs">{fmt.postalLabel}</Label><Input value={address.zip} placeholder={fmt.postalExample} onChange={(e) => setAddress({ ...address, zip: e.target.value })} /></div>
                    </div>
                  )}
                  {!domestic && (
                    <div role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
                      <p className="font-medium">International shipping quote required — not yet available</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        We currently deliver within Canada only. Shipping, tax and duties for {selectedCountry?.name ?? "this destination"} can't be calculated yet, so checkout and payment are unavailable. Prices are shown in CAD.
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Email for order updates</Label>
                    <Input
                      type="email"
                      value={address.email}
                      onChange={(e) => setAddress({ ...address, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      We'll send your order confirmation here.
                    </p>
                  </div>
                  <Button className="w-full mt-2" onClick={handleConfirmAddress} disabled={!domestic}>
                    Save & Continue
                  </Button>
                </div>
              )}
              {addressConfirmed && activeStep !== "address" && activeStep !== "review" && (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{address.fullName}</p>
                  <p>{address.addressLine} | {address.city}, {address.state} {address.zip} - {address.country} | {address.phone}</p>
                </div>
              )}
            </div>

            {/* Step 2: Delivery Details */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <StepHeader step="delivery" title="Delivery Details" />
              {activeStep === "delivery" && (
                <div className="px-4 pb-4 space-y-4">
                  {ratesLoading && (
                    <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                      Preparing delivery options…
                    </div>
                  )}

                  {Object.entries(vendorGroups).map(([vendorId, group]) => {
                    const rates = shippingRates[vendorId] || [];
                    const err = shippingErrors[vendorId];
                    const selected = selectedRates[vendorId];
                    return (
                      <div key={vendorId} className="border border-border rounded-lg p-3 space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Shipment from <span className="font-medium text-foreground">{group.vendorName}</span>
                        </p>
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3">
                              <img src={item.image} alt="" className="w-12 h-12 rounded object-cover bg-secondary border border-border" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                                {item.variantLabel && <p className="text-xs text-muted-foreground">{item.variantLabel}</p>}
                                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                              </div>
                              <p className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</p>
                            </div>
                          ))}
                        </div>

                        {err && !ratesLoading && (
                          <div className="text-xs text-warning bg-warning/10 rounded p-2">
                            {err}
                          </div>
                        )}

                        {rates.length > 0 && (
                          <RadioGroup
                            value={selected?.quote_id || ""}
                            onValueChange={(qid) => {
                              const r = rates.find((x) => x.quote_id === qid);
                              if (r) setSelectedRates((s) => ({ ...s, [vendorId]: r }));
                            }}
                            className="space-y-1.5"
                          >
                            {rates.map((r) => (
                              <label
                                key={r.quote_id}
                                htmlFor={`${vendorId}-${r.quote_id}`}
                                className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer text-sm ${
                                  selected?.quote_id === r.quote_id ? "border-primary bg-primary/5" : "border-border"
                                }`}
                              >
                                <RadioGroupItem value={r.quote_id} id={`${vendorId}-${r.quote_id}`} />
                                <Truck className="h-4 w-4 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">
                                    {r.service}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">Est. arrival {windowFor(vendorId, r.service)}</p>
                                </div>

                                <p className="font-semibold">{formatPrice(r.amount_cad)}</p>
                              </label>
                            ))}
                          </RadioGroup>
                        )}
                        
                      </div>
                    );
                  })}

                  <Button
                    className="w-full"
                    onClick={handleConfirmDelivery}
                    disabled={
                      ratesLoading ||
                      Object.keys(vendorGroups).some((vid) => !selectedRates[vid])
                    }
                  >
                    Confirm Delivery Details
                  </Button>
                </div>
              )}
              {deliveryConfirmed && activeStep !== "delivery" && activeStep !== "review" && (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  <p>{deliveryItemsLabel(items.length)}</p>
                  {Object.entries(selectedRates).map(([vid, rate]: [string, any]) => <p key={vid}>{rate.service}: {formatPrice(rate.amount_cad)}</p>)}
                
                </div>
              )}
            </div>

            {/* Step 3: Review */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <StepHeader step="review" title="Review Order" />
              {activeStep === "review" && (
                <div className="px-4 pb-5 sm:px-6 sm:pb-6">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
                    <div className="min-w-0 space-y-6">
                      <section aria-labelledby="delivery-address-title">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <h2 id="delivery-address-title" className="font-semibold">Delivery address</h2>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-primary" onClick={() => setActiveStep("address")}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                          </Button>
                        </div>
                        <div className="border-l-2 border-primary/30 pl-4 text-sm leading-6">
                          <p className="font-medium text-foreground">{address.fullName}</p>
                          <p className="break-words text-muted-foreground">{address.addressLine}</p>
                          <p className="break-words text-muted-foreground">{address.city}, {address.state} {address.zip}</p>
                          <p className="text-muted-foreground">{address.country} · {address.phone}</p>
                        </div>
                      </section>

                      <Separator />

                      <section aria-labelledby="order-items-title">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <ShoppingBag className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <h2 id="order-items-title" className="font-semibold">Items and delivery</h2>
                          </div>
                          <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-primary">
                            <Link to="/cart"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit items</Link>
                          </Button>
                        </div>

                        <div className="divide-y divide-border">
                          {Object.entries(vendorGroups).map(([vendorId, group]) => {
                            const rate = selectedRates[vendorId];
                            return (
                              <div key={vendorId} className="py-5 first:pt-0 last:pb-0">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="min-w-0 truncate text-xs text-muted-foreground">Sold by <span className="font-medium text-foreground">{group.vendorName}</span></p>
                                  <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-primary" onClick={() => setActiveStep("delivery")}>
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit delivery
                                  </Button>
                                </div>

                                <div className="space-y-3">
                                  {group.items.map((item) => (
                                    <div key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-3">
                                      <img src={item.image} alt="" className="h-14 w-14 rounded-md border border-border bg-secondary object-cover" />
                                      <div className="min-w-0 pt-0.5">
                                        <p className="line-clamp-2 font-medium leading-5 text-foreground">{item.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">Qty {item.quantity}{item.variantLabel ? ` · ${item.variantLabel}` : ""}</p>
                                      </div>
                                      <p className="pt-0.5 text-right font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</p>
                                    </div>
                                  ))}
                                </div>

                                {rate && (
                                  <div className="mt-4 flex items-start gap-3 bg-secondary/40 px-3 py-2.5 text-xs">
                                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">{rate.service}</p>
                                      <p className="mt-0.5 text-muted-foreground">Estimated arrival {windowFor(vendorId, rate.service)}</p>
                                    </div>
                                    <span className="shrink-0 font-medium text-foreground tabular-nums">{formatPrice(rate.amount_cad)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>

                    <aside className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="review-total-title">
                      <h2 id="review-total-title" className="mb-4 font-semibold">Order total</h2>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Items</span><span className="font-medium tabular-nums">{formatPrice(totalPrice)}</span></div>
                        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Delivery</span><span className="font-medium tabular-nums">{formatPrice(shippingTotal)}</span></div>
                        {taxLoading && (
                          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Taxes</span><span className="text-right text-muted-foreground">Calculating…</span></div>
                        )}
                        {!taxLoading && taxQuote?.ok && taxQuote.components.map((c) => (
                          <div key={c.component} className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{c.component} ({c.rate_percent}%)</span>
                            <span className="font-medium tabular-nums">{formatPrice(c.tax_cad)}</span>
                          </div>
                        ))}
                        {!taxLoading && taxQuote?.ok && taxQuote.components.length === 0 && (
                          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Taxes</span><span className="font-medium tabular-nums">{formatPrice(0)}</span></div>
                        )}
                      </div>
                      {!taxLoading && taxQuote && !taxQuote.ok && (
                        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-foreground">
                          {(taxQuote as { ok: false; message: string }).message}
                        </div>
                      )}
                      <Separator className="my-4" />
                      <div className="flex items-start justify-between gap-4">
                        <span className="max-w-[180px] font-semibold leading-5">Order total (incl. taxes)</span>
                        <span className="text-lg font-bold tabular-nums">{formatPrice(grandTotal)}</span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">Prices are in CAD. Delivery dates are estimates and are not guaranteed.</p>
                      <Button
                        className="mt-5 h-12 w-full font-semibold"
                        disabled={taxLoading || !taxQuote?.ok}
                        onClick={() => setActiveStep("payment")}
                      >
                        {taxLoading ? "Calculating taxes…" : "Continue to secure payment"}
                      </Button>
                    </aside>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Payment Method */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <StepHeader step="payment" title="Payment Method" />
              {activeStep === "payment" && (
                <div className="px-4 pb-4">
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5">
                      <RadioGroupItem value="card" id="card" checked />
                      <Label htmlFor="card" className="cursor-pointer flex-1">
                        <span className="font-medium text-sm">Pay securely online</span>
                        <p className="text-xs text-muted-foreground">
                          Visa, Mastercard, Amex and more — processed securely by Stripe
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>

                  <p className="mt-3 text-xs text-muted-foreground">
                    You'll be redirected to Stripe's secure payment page to enter your card. Charged in CAD.
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-border bg-secondary/40 p-2 text-center text-[11px] text-muted-foreground" aria-label="Checkout protections">
                    <div className="flex flex-col items-center gap-1"><Lock className="h-4 w-4 text-primary" aria-hidden="true" />Secure Payment</div>
                    <div className="flex flex-col items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />Buyer Protection</div>
                    <Link to="/return-policy" className="flex flex-col items-center gap-1 underline-offset-2 hover:underline"><RotateCcw className="h-4 w-4 text-primary" aria-hidden="true" />Easy Returns</Link>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Returns subject to our <Link to="/return-policy" className="underline">return policy</Link>.</p>

                  {stripeCheckoutUrl && (
                    <div role="status" className="mt-4 rounded-md border border-primary/40 bg-primary/5 p-3">
                      <p className="text-sm font-medium">Your secure Stripe payment page is ready.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        If it didn't open automatically, tap below. You won't be charged until you pay on Stripe.
                      </p>
                      <Button
                        className="w-full mt-3 font-semibold h-12 text-base"
                        size="lg"
                        onClick={handleContinueToStripe}
                      >
                        <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
                        Continue to secure Stripe payment
                      </Button>
                    </div>
                  )}
                  <Button
                    className="w-full mt-4 font-semibold h-12 text-base"
                    size="lg"
                    variant={stripeCheckoutUrl ? "outline" : "default"}
                    disabled={loading || !domestic}
                    onClick={handlePlaceOrder}
                  >
                    {loading ? "Preparing secure checkout…" : checkoutError || stripeCheckoutUrl ? "Try again" : "Continue to payment"}
                  </Button>
                  {checkoutError && (
                    <div role="alert" className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                      <p className="font-medium">
                        {stripeCheckoutUrl ? "Payment hasn't started yet — you have not been charged." : "Payment didn't start — you have not been charged."}
                      </p>
                      <p className="mt-1 text-xs">{checkoutError}</p>
                      <p className="mt-1 text-xs">Tap "Try again" to retry. We'll reuse the same order, so you won't get a duplicate.</p>
                    </div>
                  )}
                </div>

              )}
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className={activeStep === "review" ? "hidden" : "lg:sticky lg:top-20 lg:self-start"}>
            <div className="bg-card rounded-lg border border-border p-4 space-y-4">
              <h3 className="font-semibold text-base">Order Summary</h3>
              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item's total ({items.reduce((s, i) => s + i.quantity, 0)})</span>
                  <span className="font-medium">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery fees</span>
                  <span className="font-medium">
                    {ratesLoading
                      ? "Calculating…"
                      : shippingTotal > 0
                        ? formatPrice(shippingTotal)
                        : addressConfirmed ? "—" : "Enter address"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-medium">
                    {taxLoading ? "Calculating…" : taxQuote?.ok ? formatPrice(taxTotal) : "Calculated at review"}
                  </span>
                </div>
              </div>

              <Separator />

              
              <div className="flex justify-between items-center">
                <span className="font-semibold">{taxQuote?.ok ? "Order total (incl. taxes)" : "Order total"}</span>
                <span className="font-bold text-lg">{formatPrice(grandTotal)}</span>
              </div>

              {activeStep !== "payment" && (
                <p className="text-xs text-center text-muted-foreground">
                  Complete each step on the left to continue.
                </p>
              )}
              <p className="text-[10px] text-center text-muted-foreground">
                By proceeding, you are automatically accepting the{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </MarketplaceLayout>
  );
};

export default CheckoutPage;
