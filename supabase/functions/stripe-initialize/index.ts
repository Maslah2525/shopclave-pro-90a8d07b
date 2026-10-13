import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { liveCheckoutAllowed } from "../_shared/stripeLiveGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const Body = z.object({ order_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid order id" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await admin.from("orders")
      .select("id,user_id,payment_status,shipping_address,stripe_checkout_session_id,tax_amount,tax_province,tax_breakdown,shipping_total,total")
      .eq("id", parsed.data.order_id).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (order.payment_status === "paid") return json({ error: "Order already paid" }, 400);

    // Retry: reuse a still-open Stripe session rather than creating a new one.
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!liveCheckoutAllowed(secretKey, Deno.env.get("STRIPE_LIVE_CHECKOUT_ENABLED"))) {
      return json({ error: "Live payments are not enabled yet. You have not been charged." }, 503);
    }
    if (secretKey && order.stripe_checkout_session_id) {
      const existing = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.stripe_checkout_session_id)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } },
      ).then((r) => r.ok ? r.json() : null).catch(() => null);
      if (existing?.status === "open" && existing?.url) {
        return json({ url: existing.url, session_id: existing.id, currency: "CAD", amount: Number(existing.amount_total) / 100 });
      }
    }

    const { data: items, error: itemsErr } = await admin.from("order_items")
      .select("price,quantity,shipping_amount").eq("order_id", order.id);
    if (itemsErr || !items?.length) return json({ error: "No order items" }, 400);

    // Barakaz catalogue/order totals are CAD. Stripe accepts CAD directly.
    const subtotalCents = items.reduce((sum, item) => sum + Math.round(Number(item.price) * Number(item.quantity) * 100), 0);
    const shippingCents = Math.round(Number(order.shipping_total ?? 0) * 100);
    const itemShippingCents = items.reduce((sum, item) => sum + Math.round(Number(item.shipping_amount || 0) * 100), 0);
    if (shippingCents < 0 || shippingCents !== itemShippingCents) return json({ error: "Shipping total mismatch. Please retry checkout." }, 409);
    const goodsCad = (subtotalCents + shippingCents) / 100;
    // Tax is computed server-side at order creation and must never come from the client.
    if (order.tax_amount === null || order.tax_amount === undefined) {
      return json({ error: "Sales tax has not been calculated for this order. You have not been charged." }, 422);
    }
    const taxCad = Number(order.tax_amount);
    const taxCents = Math.round(taxCad * 100);
    const totalCad = Math.round((goodsCad + taxCad) * 100) / 100;
    const amount = Math.round(goodsCad * 100);
    if (amount <= 0 || taxCents < 0 || Math.round(Number(order.total) * 100) !== subtotalCents + shippingCents + taxCents) return json({ error: "Order total mismatch. Please retry checkout." }, 409);

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "Stripe is not configured" }, 503);
    // Live payments stay blocked until tax is server-authoritative and reconciled.
    if (!liveCheckoutAllowed(secret, Deno.env.get("STRIPE_LIVE_CHECKOUT_ENABLED"))) {
      return json({ error: "Live payments are not enabled yet. You have not been charged." }, 503);
    }

    const shipping = order.shipping_address as Record<string, unknown> | null;
    const shippingEmail = typeof shipping?.email === "string" ? shipping.email.trim() : "";
    const email: string | undefined = shippingEmail || user.email;
    if (!email) return json({ error: "Customer email is required" }, 400);

    // Never trust a caller-controlled Origin for payment redirects.
    // Preview environments must be explicitly allowlisted server-side.
    const allowedOrigins = new Set(["https://barakaz.com", "https://www.barakaz.com"]);
    const configuredOrigins = (Deno.env.get("STRIPE_ALLOWED_RETURN_ORIGINS") || "")
      .split(",").map((value) => value.trim()).filter(Boolean);
    for (const configured of configuredOrigins) {
      try {
        const parsed = new URL(configured);
        if (parsed.protocol === "https:" && parsed.origin === configured.replace(/\/$/, "")) {
          allowedOrigins.add(parsed.origin);
        }
      } catch { /* Ignore malformed configuration */ }
    }
    const requestedOrigin = req.headers.get("origin") || "";
    const origin = allowedOrigins.has(requestedOrigin) ? requestedOrigin : "https://barakaz.com";
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/order-confirmation/${order.id}?provider=stripe&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/checkout?payment_cancelled=stripe`);
    params.set("customer_email", email);
    params.set("client_reference_id", order.id);
    params.set("metadata[order_id]", order.id);
    params.set("metadata[user_id]", user.id);
    params.set("payment_intent_data[metadata][order_id]", order.id);
    const addLine = (index: number, name: string, cents: number) => {
      params.set(`line_items[${index}][price_data][currency]`, "cad");
      params.set(`line_items[${index}][price_data][product_data][name]`, name);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(cents));
      params.set(`line_items[${index}][quantity]`, "1");
    };
    let lineIndex = 0;
    addLine(lineIndex++, "Subtotal — Barakaz products", subtotalCents);
    if (shippingCents > 0) {
      const { data: shipmentRows } = await admin.from("shipments").select("service").eq("order_id", order.id);
      const services = [...new Set((shipmentRows ?? []).map((row) => String(row.service ?? "").toLowerCase()))];
      const shippingLabel = services.length === 1 && services[0].includes("express") ? "Express" : services.length === 1 && services[0].includes("standard") ? "Standard" : "Selected delivery";
      addLine(lineIndex++, `Shipping (${shippingLabel})`, shippingCents);
    }
    const provinceNames: Record<string, string> = { AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon" };
    const breakdown = order.tax_breakdown as { components?: Array<{ component?: string; ratePpm?: number; taxCents?: number }> } | null;
    const components = breakdown?.components ?? [];
    const componentTotal = components.reduce((sum, component) => sum + Number(component.taxCents ?? 0), 0);
    if (taxCents > 0 && (!components.length || componentTotal !== taxCents)) return json({ error: "Tax breakdown mismatch. Please retry checkout." }, 409);
    for (const component of components) {
      const cents = Number(component.taxCents ?? 0);
      if (!Number.isSafeInteger(cents) || cents < 0) return json({ error: "Invalid tax breakdown" }, 409);
      if (!cents) continue;
      const rate = Number(component.ratePpm ?? 0) / 10000;
      const province = String(order.tax_province ?? "").toUpperCase();
      const label = `${component.component ?? "Tax"} (${rate}%)${provinceNames[province] ? ` – ${provinceNames[province]}` : ""}`;
      addLine(lineIndex++, label, cents);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `barakaz-checkout-${order.id}`,
      },
      body: params.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok || !session?.id || !session?.url) {
      console.error("Stripe checkout creation failed", session);
      return json({ error: "Could not start Stripe checkout" }, 502);
    }

    // Never redirect the customer to Stripe unless the session is durably
    // associated with the pending order. Otherwise webhook reconciliation and
    // retries may not have a reliable local session reference.
    const { data: savedOrder, error: saveError } = await admin.from("orders").update({
      payment_provider: "stripe",
      stripe_checkout_session_id: session.id,
      charged_currency: "CAD",
      charged_amount: totalCad,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id).eq("payment_status", "pending")
      .select("id,stripe_checkout_session_id").maybeSingle();

    if (saveError || savedOrder?.stripe_checkout_session_id !== session.id) {
      console.error("Stripe session persistence failed", {
        order_id: order.id,
        session_id: session.id,
        error: saveError?.message ?? "Order no longer pending or missing",
      });
      return json({ error: "Could not finalize checkout session. You have not been redirected to payment." }, 503);
    }

    return json({ url: session.url, session_id: session.id, currency: "CAD", amount: totalCad });
  } catch (error) {
    console.error("stripe-initialize", error);
    return json({ error: "Internal server error" }, 500);
  }
});
